import type { Candle, SymbolInfo, TickerQuote } from "@/lib/types";
import {
  aggregateCandles,
  isBinanceNativeInterval,
  normalizeTimeframe,
  resolveBinanceFetch,
} from "@/lib/data/timeframes";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { FALLBACK_USDT_PERPS } from "@/lib/data/binancePerpSnapshot";
import {
  PERP_FETCH_HEADERS,
  fetchAltPerpKlines,
  fetchAltPerpTickers,
  setLastPerpFeed,
} from "@/lib/data/perpAlts";

/** Spot market data — api.binance.com returns 451 in some regions. */
const REST = process.env.BINANCE_REST_URL ?? "https://data-api.binance.vision";
const WS_BASE = process.env.BINANCE_WS_URL ?? "wss://data-stream.binance.vision";

/**
 * USDT-M futures REST. fapi.binance.com is geo-blocked (451) in some regions;
 * www.binance.com/fapi/v1/... works (~528 USDT PERPETUAL TRADING).
 */
const FAPI = process.env.BINANCE_FAPI_URL ?? "https://www.binance.com";
const FAPI_WS =
  process.env.BINANCE_FAPI_WS_URL ?? "wss://fstream.binance.com";

const CACHE_DIR = join(process.cwd(), "data", "cache");
const SYMBOLS_CACHE = join(CACHE_DIR, "binance_usdt_symbols.json");
const PERP_SYMBOLS_CACHE = join(CACHE_DIR, "binance_usdt_perp_symbols.json");

let memSymbols: { ts: number; symbols: SymbolInfo[] } | null = null;
let memPerpSymbols: { ts: number; symbols: SymbolInfo[] } | null = null;
const MEM_TTL = 60 * 60 * 1000; // 1h
const FILE_TTL = 24 * 60 * 60 * 1000; // 24h

/** Display / desk symbol ends with .P (e.g. BTCUSDT.P). */
export function isBinancePerp(symbol: string): boolean {
  return /\.P$/i.test(symbol.trim());
}

/** Strip .P/.p for Binance REST/WS symbol param. */
export function toBinanceRestSymbol(symbol: string): string {
  return symbol.trim().replace(/\.P$/i, "").toUpperCase();
}

/** Ensure display form XXXUSDT.P for a rest symbol or already-suffixed symbol. */
export function toPerpDisplaySymbol(symbol: string): string {
  const rest = toBinanceRestSymbol(symbol);
  return `${rest}.P`;
}

function snapshotPerpSymbols(): SymbolInfo[] {
  return FALLBACK_USDT_PERPS.map((s) => {
    const rest = toBinanceRestSymbol(s);
    return {
      symbol: toPerpDisplaySymbol(s),
      exchange: "binance" as const,
      base: rest.replace(/USDT$/i, ""),
      quote: "USDT",
      name: "PERP",
    };
  });
}

function readFileCache(path: string): SymbolInfo[] | null {
  try {
    if (!existsSync(path)) return null;
    const raw = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(raw?.symbols) || !raw.symbols.length) return null;
    if (Date.now() - Number(raw.ts || 0) > FILE_TTL) return null;
    return raw.symbols as SymbolInfo[];
  } catch {
    return null;
  }
}

function writeFileCache(path: string, symbols: SymbolInfo[]) {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(path, JSON.stringify({ ts: Date.now(), symbols }), "utf8");
  } catch {
    /* ignore */
  }
}

function fapiUrl(pathAndQuery: string): string {
  const base = FAPI.replace(/\/$/, "");
  const path = pathAndQuery.startsWith("/")
    ? pathAndQuery
    : `/${pathAndQuery}`;
  // BINANCE_FAPI_URL may be https://www.binance.com or already .../fapi
  if (/\/fapi$/i.test(base)) return `${base}${path}`;
  return `${base}/fapi${path}`;
}

async function fetchNativeKlines(
  symbol: string,
  interval: string,
  limit: number,
  perp: boolean
): Promise<Candle[]> {
  const restSym = toBinanceRestSymbol(symbol);
  const url = perp
    ? `${fapiUrl("/v1/klines")}?symbol=${encodeURIComponent(restSym)}&interval=${interval}&limit=${limit}`
    : `${REST}/api/v3/klines?symbol=${encodeURIComponent(restSym)}&interval=${interval}&limit=${limit}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: perp ? PERP_FETCH_HEADERS : undefined,
    });
    if (!res.ok) throw new Error(`Binance klines ${res.status}`);
    const rows = (await res.json()) as unknown[][];
    if (perp) setLastPerpFeed("binance");
    return rows.map((r) => ({
      time: Math.floor(Number(r[0]) / 1000),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    }));
  } catch (e) {
    if (perp) {
      const alt = await fetchAltPerpKlines(symbol, interval, limit);
      if (alt.length) return alt;
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
}

function mapTickerRow(
  t: {
    symbol: string;
    lastPrice: string;
    priceChangePercent: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
  },
  asPerp: boolean
): TickerQuote {
  return {
    symbol: asPerp ? toPerpDisplaySymbol(t.symbol) : t.symbol,
    exchange: "binance" as const,
    last: Number(t.lastPrice),
    changePct: Number(t.priceChangePercent),
    high24h: Number(t.highPrice),
    low24h: Number(t.lowPrice),
    volume: Number(t.volume),
    quoteVolume: Number(t.quoteVolume),
  };
}

export class BinanceProvider {
  static async getUsdtSymbols(): Promise<SymbolInfo[]> {
    if (memSymbols && Date.now() - memSymbols.ts < MEM_TTL) {
      return memSymbols.symbols;
    }
    const fileCached = readFileCache(SYMBOLS_CACHE);
    if (fileCached?.length) {
      memSymbols = { ts: Date.now(), symbols: fileCached };
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
      writeFileCache(SYMBOLS_CACHE, symbols);
      return symbols;
    } catch (e) {
      if (fileCached?.length) return fileCached;
      if (memSymbols?.symbols?.length) return memSymbols.symbols;
      throw e;
    }
  }

  /** USDT-M perpetual symbols as XXXUSDT.P */
  static async getUsdtPerpSymbols(): Promise<SymbolInfo[]> {
    if (memPerpSymbols && Date.now() - memPerpSymbols.ts < MEM_TTL) {
      return memPerpSymbols.symbols;
    }
    const fileCached = readFileCache(PERP_SYMBOLS_CACHE);
    if (fileCached?.length) {
      memPerpSymbols = { ts: Date.now(), symbols: fileCached };
    }
    try {
      const res = await fetch(fapiUrl("/v1/exchangeInfo"), {
        next: { revalidate: 3600 },
      });
      if (!res.ok) {
        if (fileCached?.length) return fileCached;
        return snapshotPerpSymbols();
      }
      const data = await res.json();
      const symbols = (data.symbols as Array<Record<string, unknown>>)
        .filter(
          (s) =>
            s.status === "TRADING" &&
            s.contractType === "PERPETUAL" &&
            (s.quoteAsset === "USDT" || String(s.symbol).endsWith("USDT"))
        )
        .map((s) => ({
          symbol: toPerpDisplaySymbol(String(s.symbol)),
          exchange: "binance" as const,
          base: String(s.baseAsset ?? ""),
          quote: String(s.quoteAsset ?? "USDT"),
          name: "PERP",
        }))
        .sort((a, b) => a.symbol.localeCompare(b.symbol));
      memPerpSymbols = { ts: Date.now(), symbols };
      writeFileCache(PERP_SYMBOLS_CACHE, symbols);
      return symbols;
    } catch (e) {
      if (fileCached?.length) return fileCached;
      if (memPerpSymbols?.symbols?.length) return memPerpSymbols.symbols;
      return snapshotPerpSymbols();
    }
  }

  /** Spot + perp USDT symbols for search catalogs. */
  static async getAllUsdtSymbols(): Promise<SymbolInfo[]> {
    const [spot, perp] = await Promise.all([
      this.getUsdtSymbols(),
      this.getUsdtPerpSymbols(),
    ]);
    return [...spot, ...perp];
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
    const perp = isBinancePerp(symbol);
    if (!resolved.aggregated) {
      return fetchNativeKlines(symbol, resolved.fetchInterval, limit, perp);
    }
    const srcLimit = Math.min(
      1000,
      Math.max(limit * resolved.factor + resolved.factor, limit * 2)
    );
    const raw = await fetchNativeKlines(
      symbol,
      resolved.fetchInterval,
      srcLimit,
      perp
    );
    const agg = aggregateCandles(raw, resolved.targetMinutes);
    return agg.slice(-limit);
  }

  /**
   * 24h ticker. Pass a `.P` symbol for a single perp; omit symbol and set
   * `market: "perp"` for the full futures ticker list.
   */
  static async getTicker24h(
    symbol?: string,
    opts?: { market?: "spot" | "perp" }
  ): Promise<TickerQuote[]> {
    const market = opts?.market ?? (symbol && isBinancePerp(symbol) ? "perp" : "spot");
    if (market === "perp") {
      const url = symbol
        ? `${fapiUrl("/v1/ticker/24hr")}?symbol=${encodeURIComponent(toBinanceRestSymbol(symbol))}`
        : `${fapiUrl("/v1/ticker/24hr")}`;
      let res: Response;
      try {
        res = await fetch(url, { cache: "no-store", headers: PERP_FETCH_HEADERS });
      } catch {
        const alt = await fetchAltPerpTickers(symbol);
        if (alt.length) return alt;
        throw new Error("Binance fapi ticker network");
      }
      if (!res.ok) {
        const alt = await fetchAltPerpTickers(symbol);
        if (alt.length) return alt;
        throw new Error(`Binance fapi ticker ${res.status}`);
      }
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [data];
      // Full list includes non-perpetual / non-USDT-M noise — keep TRADING perps only
      let known: Set<string> | null = null;
      if (!symbol) {
        known = new Set(
          (await this.getUsdtPerpSymbols()).map((s) =>
            toBinanceRestSymbol(s.symbol)
          )
        );
      }
      return arr
        .filter((t: { symbol: string }) => {
          if (typeof t.symbol !== "string" || !t.symbol.endsWith("USDT"))
            return false;
          if (known && !known.has(t.symbol)) return false;
          return true;
        })
        .map(
          (t: {
            symbol: string;
            lastPrice: string;
            priceChangePercent: string;
            highPrice: string;
            lowPrice: string;
            volume: string;
            quoteVolume: string;
          }) => mapTickerRow(t, true)
        );
    }

    const url = symbol
      ? `${REST}/api/v3/ticker/24hr?symbol=${encodeURIComponent(toBinanceRestSymbol(symbol))}`
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
        }) => mapTickerRow(t, false)
      );
  }

  /** WS only for native Binance intervals; custom TFs return null. */
  static wsKlineUrl(symbol: string, timeframe: string): string | null {
    const n = normalizeTimeframe(timeframe);
    if (!n || !isBinanceNativeInterval(n)) return null;
    const rest = toBinanceRestSymbol(symbol).toLowerCase();
    const base = isBinancePerp(symbol) ? FAPI_WS : WS_BASE;
    return `${base.replace(/\/$/, "")}/ws/${rest}@kline_${n}`;
  }

  static wsTickerUrl(symbol: string): string {
    const rest = toBinanceRestSymbol(symbol).toLowerCase();
    const base = isBinancePerp(symbol) ? FAPI_WS : WS_BASE;
    return `${base.replace(/\/$/, "")}/ws/${rest}@ticker`;
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
