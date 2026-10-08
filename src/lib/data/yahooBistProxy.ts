import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { Candle } from "@/lib/types";
import { aggregateCandles } from "@/lib/data/timeframes";

/** Plain Yahoo headers. A full browser UA on this host returns HTTP 429. */
const YAHOO_HEADERS: HeadersInit = {
  Accept: "*/*",
  "User-Agent": "Mozilla/5.0",
};

const HOSTS = [
  "https://query1.finance.yahoo.com/v8/finance/chart",
  "https://query2.finance.yahoo.com/v8/finance/chart",
];

/** Gap between live Yahoo calls on this server instance. */
export const YAHOO_GAP_MS = 400;
/** Stop starting new Yahoo calls so a hobby function can still answer. */
export const YAHOO_BUDGET_MS = 7500;

export type ScreenerInterval =
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "8h"
  | "12h"
  | "1d"
  | "3d"
  | "1w";

export const SCREENER_INTERVALS: ScreenerInterval[] = [
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
];

type YahooMap = {
  interval: string;
  range: string;
  aggregateMinutes?: number;
};

/** Screener intervals → Yahoo chart. Hours without a native Yahoo bar are built from 60m. */
const INTERVAL_MAP: Record<ScreenerInterval, YahooMap> = {
  "15m": { interval: "15m", range: "60d" },
  "30m": { interval: "30m", range: "60d" },
  "1h": { interval: "60m", range: "6mo" },
  "2h": { interval: "60m", range: "2y", aggregateMinutes: 120 },
  "4h": { interval: "60m", range: "2y", aggregateMinutes: 240 },
  "6h": { interval: "60m", range: "2y", aggregateMinutes: 360 },
  "8h": { interval: "60m", range: "2y", aggregateMinutes: 480 },
  "12h": { interval: "60m", range: "2y", aggregateMinutes: 720 },
  "1d": { interval: "1d", range: "5y" },
  "3d": { interval: "1d", range: "10y", aggregateMinutes: 4320 },
  "1w": { interval: "1wk", range: "10y" },
};

export function mapScreenerInterval(iv: string): YahooMap | null {
  if (Object.prototype.hasOwnProperty.call(INTERVAL_MAP, iv)) {
    return INTERVAL_MAP[iv as ScreenerInterval];
  }
  return null;
}

type YahooQuote = {
  open?: Array<number | null>;
  high?: Array<number | null>;
  low?: Array<number | null>;
  close?: Array<number | null>;
  volume?: Array<number | null>;
};

type YahooMeta = {
  regularMarketPrice?: number;
  regularMarketTime?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketOpen?: number;
  regularMarketChangePercent?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketVolume?: number;
};

type YahooResult = {
  timestamp?: number[];
  meta?: YahooMeta;
  indicators?: { quote?: YahooQuote[] };
};

type YahooJson = {
  chart?: { result?: Array<YahooResult | null> | null };
};

type CacheEntry = {
  ts: number;
  candles: Candle[];
  meta: YahooMeta;
};

const MEM = new Map<string, CacheEntry>();
const CACHE_DIR = join("/tmp", "qx-yahoo-bist");

function ttlMs(yahooInterval: string): number {
  // Daily/weekly: short enough that a finished session (18:10 TRT) shows up the same evening.
  if (yahooInterval === "1d" || yahooInterval === "1wk") return 30 * 60e3;
  if (yahooInterval === "60m") return 20 * 60e3;
  return 10 * 60e3;
}

function cacheKey(symbol: string, interval: string, range: string): string {
  return `${symbol}|${interval}|${range}`;
}

function filePath(key: string): string {
  return join(CACHE_DIR, key.replace(/[^A-Z0-9|._-]/gi, "_") + ".json");
}

function readCache(key: string, allowStale: boolean, yahooInterval: string): CacheEntry | null {
  const mem = MEM.get(key);
  const fresh = (e: CacheEntry) => Date.now() - e.ts <= ttlMs(yahooInterval);
  if (mem && (allowStale || fresh(mem)) && mem.candles.length) return mem;
  try {
    const p = filePath(key);
    if (!existsSync(p)) return null;
    const raw = JSON.parse(readFileSync(p, "utf8")) as CacheEntry;
    if (!raw || !Array.isArray(raw.candles) || !raw.candles.length) return null;
    MEM.set(key, raw);
    if (!allowStale && !fresh(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

function writeCache(key: string, entry: CacheEntry) {
  MEM.set(key, entry);
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(filePath(key), JSON.stringify(entry));
  } catch {
    /* /tmp may be full; memory cache still serves this instance */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let gate: Promise<void> = Promise.resolve();
let nextOk = 0;

function schedule<T>(job: () => Promise<T>): Promise<T> {
  const run = gate.then(async () => {
    const wait = nextOk - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      return await job();
    } finally {
      nextOk = Date.now() + YAHOO_GAP_MS;
    }
  });
  gate = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** BIST (Europe/Istanbul) is fixed UTC+3, no DST. */
const TRT_OFFSET_SEC = 3 * 3600;
/** Continuous session 10:00–18:00 TRT, closing auction until ~18:10. */
const SESSION_OPEN_MIN = 10 * 60;
const SESSION_CLOSE_MIN = 18 * 60;

/** UTC seconds of 00:00 TRT on the TRT day containing `sec`. */
function trtDayStart(sec: number): number {
  return Math.floor((sec + TRT_OFFSET_SEC) / 86400) * 86400 - TRT_OFFSET_SEC;
}

type PartialDay = {
  time: number;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
};

const fin = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function parseChart(
  json: YahooJson,
  daily = false
): { candles: Candle[]; meta: YahooMeta; partial?: PartialDay } | null {
  const result = json.chart?.result?.[0];
  if (!result?.timestamp?.length) return null;
  const q = result.indicators?.quote?.[0];
  if (!q) return null;
  const candles: Candle[] = [];
  const ts = result.timestamp;
  const meta = result.meta ?? {};
  let partial: PartialDay | undefined;
  for (let i = 0; i < ts.length; i++) {
    if (daily && i === ts.length - 1 && (q.close?.[i] == null || q.open?.[i] == null)) {
      const rawT = Number(ts[i]);
      const sec = rawT > 1e12 ? Math.floor(rawT / 1000) : rawT;
      partial = { time: sec, open: q.open?.[i], high: q.high?.[i], low: q.low?.[i], volume: q.volume?.[i] };
      continue;
    }
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    const v = q.volume?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    if (![o, h, l, c].every((n) => Number.isFinite(Number(n)))) continue;
    const rawT = Number(ts[i]);
    const sec = rawT > 1e12 ? Math.floor(rawT / 1000) : rawT;
    candles.push({
      time: sec,
      open: Number(o),
      high: Number(h),
      low: Number(l),
      close: Number(c),
      volume: Number(v ?? 0),
    });
  }
  if (!candles.length) return null;
  return { candles, meta, partial };
}

/**
 * Yahoo often sends today's BIST daily bar with close=null (sometimes no row at all)
 * even after the session closed. Rebuild it from meta (regularMarketPrice/Time, day H/L)
 * and, when needed, that day's 60m bars. Only when regularMarketTime is on that TRT day.
 */
async function fillLastDaily(
  ysym: string,
  candles: Candle[],
  meta: YahooMeta,
  partial?: PartialDay
): Promise<Candle[]> {
  const px = meta.regularMarketPrice;
  const mt = meta.regularMarketTime;
  if (!fin(px) || !fin(mt) || px <= 0) return candles;
  const day = trtDayStart(mt);
  const last = candles[candles.length - 1];
  if (last && trtDayStart(last.time) >= day) return candles; // already have that session
  if (partial && trtDayStart(partial.time) !== day) partial = undefined;
  const time = partial ? partial.time : day + 9 * 3600 + 30 * 60; // Yahoo stamps BIST daily 09:30 TRT
  let open = partial && fin(partial.open) ? partial.open : fin(meta.regularMarketOpen) ? meta.regularMarketOpen : undefined;
  let high = partial && fin(partial.high) ? partial.high : fin(meta.regularMarketDayHigh) ? meta.regularMarketDayHigh : undefined;
  let low = partial && fin(partial.low) ? partial.low : fin(meta.regularMarketDayLow) ? meta.regularMarketDayLow : undefined;
  let volume = partial && fin(partial.volume) && partial.volume > 0 ? partial.volume : fin(meta.regularMarketVolume) ? meta.regularMarketVolume : undefined;
  if (open === undefined || high === undefined || low === undefined || volume === undefined) {
    await sleep(YAHOO_GAP_MS);
    const intra = await fetchYahooRaw(ysym, "60m", "5d");
    if (!("error" in intra)) {
      const bars = intra.candles.filter((c) => trtDayStart(c.time) === day);
      if (bars.length) {
        if (open === undefined) open = bars[0].open;
        if (high === undefined) high = Math.max(...bars.map((c) => c.high));
        if (low === undefined) low = Math.min(...bars.map((c) => c.low));
        if (volume === undefined) volume = bars.reduce((a, c) => a + (c.volume || 0), 0);
      }
    }
  }
  if (open === undefined) return candles; // no honest open → leave the day out
  const h = Math.max(high ?? px, open, px);
  const l = Math.min(low ?? px, open, px);
  return [...candles, { time, open, high: h, low: l, close: px, volume: volume ?? 0 }];
}

async function fetchYahoo(ysym: string, interval: string, range: string): Promise<
  { candles: Candle[]; meta: YahooMeta } | { error: string }
> {
  const got = await fetchYahooRaw(ysym, interval, range);
  if ("error" in got || interval !== "1d") return got;
  try {
    return { candles: await fillLastDaily(ysym, got.candles, got.meta, got.partial), meta: got.meta };
  } catch {
    return { candles: got.candles, meta: got.meta };
  }
}

async function fetchYahooRaw(ysym: string, interval: string, range: string): Promise<
  { candles: Candle[]; meta: YahooMeta; partial?: PartialDay } | { error: string }
> {
  let last = "empty";
  for (let attempt = 0; attempt < 3; attempt++) {
    const base = HOSTS[attempt % HOSTS.length];
    const url = `${base}/${encodeURIComponent(ysym)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}&includePrePost=false`;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: YAHOO_HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 429 || res.status === 503) {
        last = `HTTP ${res.status}`;
        await sleep(1200 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        last = `HTTP ${res.status}`;
        await sleep(400);
        continue;
      }
      const json = (await res.json()) as YahooJson;
      const parsed = parseChart(json, interval === "1d");
      if (parsed) return parsed;
      last = "empty";
    } catch (e) {
      last = e instanceof Error ? e.message : "fetch";
      await sleep(400);
    }
  }
  return { error: last };
}

export type KlineRow = [number, number, number, number, number, number];

export type ChartRow = {
  symbol: string;
  ok: boolean;
  cached?: boolean;
  stale?: boolean;
  error?: string;
  price?: number;
  chg?: number;
  qv?: number;
  bars?: number;
  klines?: KlineRow[];
};


/** Session % for the BIST "24s" column. Yahoo regularMarketChangePercent, else price vs previousClose. Never chartPreviousClose (that is the start of the chart range). */
function sessionChangePercent(meta: YahooMeta): number {
  const yahoo = meta.regularMarketChangePercent;
  if (typeof yahoo === "number" && Number.isFinite(yahoo)) return yahoo;
  const prevClose = Number(meta.previousClose);
  const px = Number(meta.regularMarketPrice);
  if (Number.isFinite(px) && Number.isFinite(prevClose) && prevClose !== 0) {
    const pct = ((px - prevClose) / prevClose) * 100;
    return Number.isFinite(pct) ? pct : 0;
  }
  return 0;
}

function toKlines(candles: Candle[], limit: number, meta: YahooMeta): Pick<ChartRow, "price" | "chg" | "qv" | "bars" | "klines"> {
  const sliced = candles.length > limit ? candles.slice(candles.length - limit) : candles;
  const klines: KlineRow[] = sliced.map((c) => [
    c.time * 1000,
    c.open,
    c.high,
    c.low,
    c.close,
    c.volume,
  ]);
  const last = sliced[sliced.length - 1];
  const price = Number(meta.regularMarketPrice || 0) || (last ? last.close : 0);
  const chg = sessionChangePercent(meta);
  const vol = Number(meta.regularMarketVolume || 0) || (last ? last.volume : 0);
  const qv = vol * (price || (last ? last.close : 0));
  return { price, chg, qv, bars: klines.length, klines };
}

export function normalizeBistSymbol(raw: string): string | null {
  const s = raw.toUpperCase().trim().replace(/\.IS$/, "");
  if (!/^[A-Z0-9]{2,10}$/.test(s)) return null;
  return s;
}

export async function loadBistCharts(opts: {
  symbols: string[];
  interval: ScreenerInterval;
  limit: number;
}): Promise<{
  interval: ScreenerInterval;
  yahoo: YahooMap;
  gapMs: number;
  results: ChartRow[];
  pending: string[];
}> {
  const mapped = INTERVAL_MAP[opts.interval];
  const results: ChartRow[] = [];
  const pending: string[] = [];
  const started = Date.now();
  let budgetHit = false;

  for (const symbol of opts.symbols) {
    const ysym = `${symbol}.IS`;
    const key = cacheKey(symbol, mapped.interval, mapped.range);
    const fresh = readCache(key, false, mapped.interval);
    if (fresh) {
      pushBars(results, symbol, applyMap(fresh.candles, mapped), opts.limit, fresh.meta, true, false);
      continue;
    }
    if (budgetHit || Date.now() - started > YAHOO_BUDGET_MS - 2500) {
      pending.push(symbol);
      budgetHit = true;
      continue;
    }
    const fetched = await schedule(() => fetchYahoo(ysym, mapped.interval, mapped.range));
    if ("error" in fetched) {
      const stale = readCache(key, true, mapped.interval);
      if (stale) {
        pushBars(results, symbol, applyMap(stale.candles, mapped), opts.limit, stale.meta, true, true);
      } else {
        results.push({ symbol, ok: false, error: fetched.error });
      }
      continue;
    }
    const entry: CacheEntry = { ts: Date.now(), candles: fetched.candles, meta: fetched.meta };
    writeCache(key, entry);
    pushBars(results, symbol, applyMap(fetched.candles, mapped), opts.limit, fetched.meta, false, false);
  }

  return {
    interval: opts.interval,
    yahoo: mapped,
    gapMs: YAHOO_GAP_MS,
    results,
    pending,
  };
}


function pushBars(
  results: ChartRow[],
  symbol: string,
  bars: Candle[],
  limit: number,
  meta: YahooMeta,
  cached: boolean,
  stale: boolean
) {
  if (!bars.length) {
    results.push({ symbol, ok: false, error: "empty", cached });
    return;
  }
  results.push({ symbol, ok: true, cached, stale, ...toKlines(bars, limit, meta) });
}

/**
 * BIST intraday buckets anchored to the session (10:00 TRT), not to the UTC epoch.
 * Bucket k starts at 10:00 + k·period; bars before 10:00 (Yahoo's 09:30 hour) join the
 * first bucket, bars at/after the last bucket start (incl. the 18:00 auction print) join the last.
 * 4h → 10:00 and 14:00 TRT; 2h → 10/12/14/16; 6h → 10/16; 8h/12h → one 10:00 bar per session.
 */
function aggregateSession(candles: Candle[], periodMinutes: number): Candle[] {
  const out: Candle[] = [];
  const maxIdx = Math.max(0, Math.ceil((SESSION_CLOSE_MIN - SESSION_OPEN_MIN) / periodMinutes) - 1);
  let bucket: Candle | null = null;
  for (const c of candles) {
    const day = trtDayStart(c.time);
    const minOfDay = (c.time - day) / 60;
    let idx = Math.floor((minOfDay - SESSION_OPEN_MIN) / periodMinutes);
    if (idx < 0) idx = 0;
    if (idx > maxIdx) idx = maxIdx;
    const start = day + (SESSION_OPEN_MIN + idx * periodMinutes) * 60;
    if (bucket && bucket.time === start) {
      bucket.high = Math.max(bucket.high, c.high);
      bucket.low = Math.min(bucket.low, c.low);
      bucket.close = c.close;
      bucket.volume += c.volume;
    } else {
      if (bucket) out.push(bucket);
      bucket = { time: start, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
    }
  }
  if (bucket) out.push(bucket);
  return out;
}

function applyMap(candles: Candle[], mapped: YahooMap): Candle[] {
  if (!mapped.aggregateMinutes) return candles;
  if (mapped.interval === "60m" && mapped.aggregateMinutes > 60 && mapped.aggregateMinutes < 1440) {
    return aggregateSession(candles, mapped.aggregateMinutes);
  }
  const srcMin =
    mapped.interval === "60m"
      ? 60
      : mapped.interval === "1d"
        ? 1440
        : mapped.interval === "1wk"
          ? 10080
          : mapped.interval.endsWith("m")
            ? Number(mapped.interval.replace("m", "")) || 1
            : 1440;
  if (mapped.aggregateMinutes === srcMin) return candles;
  return aggregateCandles(candles, mapped.aggregateMinutes);
}
