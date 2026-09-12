/**
 * Alt USDT-M perp feeds when Binance fapi returns 418/451.
 * Display symbols stay XXXUSDT.P — only the candle/ticker host changes.
 */
import type { Candle, TickerQuote } from "@/lib/types";

export type PerpFeed = "binance" | "gate" | "bingx" | "bitget" | "okx" | "bybit";

export let lastPerpFeed: PerpFeed = "binance";

export function setLastPerpFeed(feed: PerpFeed) {
  lastPerpFeed = feed;
}

export function getLastPerpFeed(): PerpFeed {
  return lastPerpFeed;
}

const HDRS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

function restSym(symbol: string): string {
  return symbol.trim().replace(/\.P$/i, "").toUpperCase();
}

function baseOf(rest: string): string {
  return rest.replace(/USDT$/i, "");
}

function toMs(n: number): number {
  return n > 1e12 ? n : n * 1000;
}

function sortCandles(rows: Candle[]): Candle[] {
  return [...rows]
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close))
    .sort((a, b) => a.time - b.time);
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: HDRS,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function asQuotes(
  rows: Array<{
    rest: string;
    last: number;
    changePct: number;
    high24h: number;
    low24h: number;
    volume: number;
    quoteVolume: number;
  }>
): TickerQuote[] {
  return rows
    .filter((r) => r.rest.endsWith("USDT") && Number.isFinite(r.last))
    .map((r) => ({
      symbol: `${r.rest}.P`,
      exchange: "binance" as const,
      last: r.last,
      changePct: r.changePct,
      high24h: r.high24h,
      low24h: r.low24h,
      volume: r.volume,
      quoteVolume: r.quoteVolume,
    }));
}

function gateInterval(interval: string): string | null {
  const m: Record<string, string> = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1h",
    "4h": "4h",
    "8h": "8h",
    "1d": "1d",
  };
  return m[interval] ?? null;
}

function bitgetInterval(interval: string): string | null {
  const m: Record<string, string> = {
    "1m": "1m",
    "3m": "3m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1H",
    "2h": "2H",
    "4h": "4H",
    "6h": "6H",
    "12h": "12H",
    "1d": "1D",
    "3d": "3D",
    "1w": "1W",
  };
  return m[interval] ?? null;
}

function okxBar(interval: string): string | null {
  const m: Record<string, string> = {
    "1m": "1m",
    "3m": "3m",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "1h": "1H",
    "2h": "2H",
    "4h": "4H",
    "6h": "6H",
    "12h": "12H",
    "1d": "1D",
    "1w": "1W",
  };
  return m[interval] ?? null;
}

function bingxInterval(interval: string): string | null {
  const ok = new Set([
    "1m",
    "3m",
    "5m",
    "15m",
    "30m",
    "1h",
    "2h",
    "4h",
    "6h",
    "12h",
    "1d",
    "3d",
    "1w",
  ]);
  return ok.has(interval) ? interval : null;
}

function bybitInterval(interval: string): string | null {
  const m: Record<string, string> = {
    "1m": "1",
    "3m": "3",
    "5m": "5",
    "15m": "15",
    "30m": "30",
    "1h": "60",
    "2h": "120",
    "4h": "240",
    "6h": "360",
    "12h": "720",
    "1d": "D",
    "1w": "W",
  };
  return m[interval] ?? null;
}

async function gateKlines(
  rest: string,
  interval: string,
  limit: number
): Promise<Candle[]> {
  const iv = gateInterval(interval);
  if (!iv) throw new Error("gate interval");
  const contract = `${baseOf(rest)}_USDT`;
  const data = (await fetchJson(
    `https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=${encodeURIComponent(contract)}&interval=${iv}&limit=${Math.min(limit, 1000)}`
  )) as Array<Record<string, string | number>>;
  if (!Array.isArray(data) || !data.length) throw new Error("gate empty");
  return sortCandles(
    data.map((r) => ({
      time: Math.floor(toMs(Number(r.t)) / 1000),
      open: Number(r.o),
      high: Number(r.h),
      low: Number(r.l),
      close: Number(r.c),
      volume: Number(r.v),
    }))
  );
}

async function bingxKlines(
  rest: string,
  interval: string,
  limit: number
): Promise<Candle[]> {
  const iv = bingxInterval(interval);
  if (!iv) throw new Error("bingx interval");
  const data = (await fetchJson(
    `https://open-api.bingx.com/openApi/swap/v2/quote/klines?symbol=${encodeURIComponent(`${baseOf(rest)}-USDT`)}&interval=${iv}&limit=${Math.min(limit, 1000)}`
  )) as { code?: number; data?: unknown };
  if (data.code !== 0) throw new Error("bingx code");
  const rows = Array.isArray(data.data) ? data.data : [];
  if (!rows.length) throw new Error("bingx empty");
  return sortCandles(
    rows.map((r) => {
      if (Array.isArray(r)) {
        return {
          time: Math.floor(toMs(Number(r[0])) / 1000),
          open: Number(r[1]),
          high: Number(r[2]),
          low: Number(r[3]),
          close: Number(r[4]),
          volume: Number(r[5]),
        };
      }
      const o = r as Record<string, string | number>;
      return {
        time: Math.floor(toMs(Number(o.time ?? o.t)) / 1000),
        open: Number(o.open),
        high: Number(o.high),
        low: Number(o.low),
        close: Number(o.close),
        volume: Number(o.volume),
      };
    })
  );
}

async function bitgetKlines(
  rest: string,
  interval: string,
  limit: number
): Promise<Candle[]> {
  const iv = bitgetInterval(interval);
  if (!iv) throw new Error("bitget interval");
  const data = (await fetchJson(
    `https://api.bitget.com/api/v2/mix/market/candles?symbol=${encodeURIComponent(rest)}&productType=USDT-FUTURES&granularity=${iv}&limit=${Math.min(limit, 1000)}`
  )) as { code?: string; data?: string[][] };
  if (data.code !== "00000" || !data.data?.length) throw new Error("bitget empty");
  return sortCandles(
    data.data.map((r) => ({
      time: Math.floor(toMs(Number(r[0])) / 1000),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    }))
  );
}

async function okxKlines(
  rest: string,
  interval: string,
  limit: number
): Promise<Candle[]> {
  const bar = okxBar(interval);
  if (!bar) throw new Error("okx interval");
  const instId = `${baseOf(rest)}-USDT-SWAP`;
  const data = (await fetchJson(
    `https://www.okx.com/api/v5/market/candles?instId=${encodeURIComponent(instId)}&bar=${bar}&limit=${Math.min(limit, 300)}`
  )) as { code?: string; data?: string[][] };
  if (data.code !== "0" || !data.data?.length) throw new Error("okx empty");
  return sortCandles(
    data.data.map((r) => ({
      time: Math.floor(toMs(Number(r[0])) / 1000),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    }))
  );
}

async function bybitKlines(
  rest: string,
  interval: string,
  limit: number
): Promise<Candle[]> {
  const iv = bybitInterval(interval);
  if (!iv) throw new Error("bybit interval");
  const data = (await fetchJson(
    `https://api.bybit.com/v5/market/kline?category=linear&symbol=${encodeURIComponent(rest)}&interval=${iv}&limit=${Math.min(limit, 1000)}`
  )) as { retCode?: number; result?: { list?: string[][] } };
  const rows = data.result?.list;
  if (data.retCode !== 0 || !rows?.length) throw new Error("bybit empty");
  return sortCandles(
    rows.map((r) => ({
      time: Math.floor(toMs(Number(r[0])) / 1000),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    }))
  );
}

export async function fetchAltPerpKlines(
  symbol: string,
  interval: string,
  limit: number
): Promise<Candle[]> {
  const rest = restSym(symbol);
  const attempts: Array<[PerpFeed, () => Promise<Candle[]>]> = [
    ["gate", () => gateKlines(rest, interval, limit)],
    ["bingx", () => bingxKlines(rest, interval, limit)],
    ["bitget", () => bitgetKlines(rest, interval, limit)],
    ["okx", () => okxKlines(rest, interval, limit)],
    ["bybit", () => bybitKlines(rest, interval, limit)],
  ];
  for (const [feed, fn] of attempts) {
    try {
      const rows = await fn();
      if (rows.length >= 2) {
        setLastPerpFeed(feed);
        return rows.slice(-limit);
      }
    } catch {
      /* next venue */
    }
  }
  return [];
}

async function gateTickers(): Promise<TickerQuote[]> {
  const data = (await fetchJson(
    "https://api.gateio.ws/api/v4/futures/usdt/tickers"
  )) as Array<Record<string, string>>;
  if (!Array.isArray(data)) throw new Error("gate tickers");
  return asQuotes(
    data
      .filter((t) => String(t.contract ?? "").endsWith("_USDT"))
      .map((t) => {
        const rest = `${String(t.contract).replace(/_USDT$/i, "")}USDT`;
        return {
          rest,
          last: Number(t.last),
          changePct: Number(t.change_percentage),
          high24h: Number(t.high_24h),
          low24h: Number(t.low_24h),
          volume: Number(t.volume_24h),
          quoteVolume: Number(t.volume_24h_quote ?? t.volume_24h),
        };
      })
  );
}

async function bitgetTickers(): Promise<TickerQuote[]> {
  const data = (await fetchJson(
    "https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES"
  )) as { code?: string; data?: Array<Record<string, string>> };
  if (data.code !== "00000" || !data.data?.length) throw new Error("bitget tickers");
  return asQuotes(
    data.data.map((t) => ({
      rest: String(t.symbol ?? "").toUpperCase(),
      last: Number(t.lastPr),
      changePct: Number(t.change24h) * (Math.abs(Number(t.change24h)) <= 1 ? 100 : 1),
      high24h: Number(t.high24h),
      low24h: Number(t.low24h),
      volume: Number(t.baseVolume),
      quoteVolume: Number(t.quoteVolume),
    }))
  );
}

async function okxTickers(): Promise<TickerQuote[]> {
  const data = (await fetchJson(
    "https://www.okx.com/api/v5/market/tickers?instType=SWAP"
  )) as { code?: string; data?: Array<Record<string, string>> };
  if (data.code !== "0" || !data.data?.length) throw new Error("okx tickers");
  return asQuotes(
    data.data
      .filter((t) => String(t.instId ?? "").endsWith("-USDT-SWAP"))
      .map((t) => {
        const rest = `${String(t.instId).split("-")[0]}USDT`;
        const last = Number(t.last);
        const open = Number(t.open24h);
        const changePct = open ? ((last - open) / open) * 100 : 0;
        return {
          rest,
          last,
          changePct,
          high24h: Number(t.high24h),
          low24h: Number(t.low24h),
          volume: Number(t.vol24h),
          quoteVolume: Number(t.volCcy24h),
        };
      })
  );
}

export async function fetchAltPerpTickers(symbol?: string): Promise<TickerQuote[]> {
  const want = symbol ? restSym(symbol) : "";
  const attempts: Array<[PerpFeed, () => Promise<TickerQuote[]>]> = [
    ["gate", gateTickers],
    ["bitget", bitgetTickers],
    ["okx", okxTickers],
  ];
  for (const [feed, fn] of attempts) {
    try {
      let rows = await fn();
      if (want) rows = rows.filter((r) => restSym(r.symbol) === want);
      if (rows.length) {
        setLastPerpFeed(feed);
        return rows;
      }
    } catch {
      /* next */
    }
  }
  return [];
}

export const PERP_FETCH_HEADERS = HDRS;
