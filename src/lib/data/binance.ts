import type { Candle, SymbolInfo, TickerQuote } from "@/lib/types";
import {
  aggregateCandles,
  isBinanceNativeInterval,
  normalizeTimeframe,
  resolveBinanceFetch,
} from "@/lib/data/timeframes";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

/** Market data via Binance Vision — api.binance.com returns 451 in some regions. */
const REST = process.env.BINANCE_REST_URL ?? "https://data-api.binance.vision";
const WS_BASE = process.env.BINANCE_WS_URL ?? "wss://data-stream.binance.vision";

const CACHE_DIR = join(process.cwd(), "data", "cache");
const SYMBOLS_CACHE = join(CACHE_DIR, "binance_usdt_symbols.json");

let memSymbols: { ts: number; symbols: SymbolInfo[] } | null = null;
const MEM_TTL = 60 * 60 * 1000; // 1h
const FILE_TTL = 24 * 60 * 60 * 1000; // 24h

function readFileCache(): SymbolInfo[] | null {
  try {
    if (!existsSync(SYMBOLS_CACHE)) return null;
    const raw = JSON.parse(readFileSync(SYMBOLS_CACHE, "utf8"));
    if (!Array.isArray(raw?.symbols) || !raw.symbols.length) return null;
    if (Date.now() - Number(raw.ts || 0) > FILE_TTL) return null;
    return raw.symbols as SymbolInfo[];
  } catch {
    return null;
  }
}

function writeFileCache(symbols: SymbolInfo[]) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(
      SYMBOLS_CACHE,
      JSON.stringify({ ts: Date.now(), symbols }),
      "utf8"
    );
  } catch {
    /* ignore */
  }
}

async function fetchNativeKlines(
  symbol: string,
  interval: string,
  limit: number
): Promise<Candle[]> {
  const url = `${REST}/api/v3/klines?symbol=${encodeURIComponent(
    symbol.toUpperCase()
  )}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Binance klines ${res.status}`);
  const rows = (await res.json()) as unknown[][];
  return rows.map((r) => ({
    time: Math.floor(Number(r[0]) / 1000),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
  }));
}

export class BinanceProvider {
  static async getUsdtSymbols(): Promise<SymbolInfo[]> {
    if (memSymbols && Date.now() - memSymbols.ts < MEM_TTL) {
      return memSymbols.symbols;
    }
    const fileCached = readFileCache();
    if (fileCached?.length) {
      memSymbols = { ts: Date.now(), symbols: fileCached };
      // refresh in background if stale-ish
    }
    try {
      const res = await fetch(`${REST}/api/v3/exchangeInfo`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) {
        if (fileCached?.length) return fileCached;
        throw new Error(`Binance exchangeInfo ${res.status}`);
      }
      const data = await res.json();
      const symbols = (data.symbols as Array<Record<string, unknown>>)
        .filter(
          (s) =>
            s.status === "TRADING" &&
            s.quoteAsset === "USDT" &&
            s.isSpotTradingAllowed !== false
        )
        .map((s) => ({
          symbol: String(s.symbol),
          exchange: "binance" as const,
          base: String(s.baseAsset),
          quote: String(s.quoteAsset),
        }))
        .sort((a, b) => a.symbol.localeCompare(b.symbol));
      memSymbols = { ts: Date.now(), symbols };
      writeFileCache(symbols);
      return symbols;
    } catch (e) {
      if (fileCached?.length) return fileCached;
      if (memSymbols?.symbols?.length) return memSymbols.symbols;
      throw e;
    }
  }

  static async getKlines(
    symbol: string,
    timeframe: string,
    limit = 500
  ): Promise<Candle[]> {
    const resolved = resolveBinanceFetch(timeframe);
    if (!resolved) {
      throw new Error(`Unsupported timeframe: ${timeframe}`);
    }
    if (!resolved.aggregated) {
      return fetchNativeKlines(symbol, resolved.fetchInterval, limit);
    }
    // Need enough source bars to fill `limit` aggregated bars
    const srcLimit = Math.min(1000, Math.max(limit * resolved.factor + resolved.factor, limit * 2));
    const raw = await fetchNativeKlines(symbol, resolved.fetchInterval, srcLimit);
    const agg = aggregateCandles(raw, resolved.targetMinutes);
    return agg.slice(-limit);
  }

  static async getTicker24h(symbol?: string): Promise<TickerQuote[]> {
    const url = symbol
      ? `${REST}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol.toUpperCase())}`
      : `${REST}/api/v3/ticker/24hr`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Binance ticker ${res.status}`);
    const data = await res.json();
    const arr = Array.isArray(data) ? data : [data];
    return arr
      .filter((t: { symbol: string }) => t.symbol.endsWith("USDT"))
      .map(
        (t: {
          symbol: string;
          lastPrice: string;
          priceChangePercent: string;
          highPrice: string;
          lowPrice: string;
          volume: string;
          quoteVolume: string;
        }) => ({
          symbol: t.symbol,
          exchange: "binance" as const,
          last: Number(t.lastPrice),
          changePct: Number(t.priceChangePercent),
          high24h: Number(t.highPrice),
          low24h: Number(t.lowPrice),
          volume: Number(t.volume),
          quoteVolume: Number(t.quoteVolume),
        })
      );
  }

  /** WS only for native Binance intervals; custom TFs return null. */
  static wsKlineUrl(symbol: string, timeframe: string): string | null {
    const n = normalizeTimeframe(timeframe);
    if (!n || !isBinanceNativeInterval(n)) return null;
    // 3h is in our native list for charts but not on Binance — already excluded by isBinanceNativeInterval
    const s = symbol.toLowerCase();
    return `${WS_BASE}/ws/${s}@kline_${n}`;
  }

  static wsTickerUrl(symbol: string): string {
    return `${WS_BASE}/ws/${symbol.toLowerCase()}@ticker`;
  }

  static parseKlineMessage(msg: unknown): Candle | null {
    const m = msg as { k?: Record<string, unknown> };
    if (!m?.k) return null;
    const k = m.k;
    return {
      time: Math.floor(Number(k.t) / 1000),
      open: Number(k.o),
      high: Number(k.h),
      low: Number(k.l),
      close: Number(k.c),
      volume: Number(k.v),
    };
  }
}
