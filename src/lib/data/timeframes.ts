import type { Candle } from "@/lib/types";

/** Native chart / API timeframes (Binance-compatible set). */
export const NATIVE_TIMEFRAMES = [
  "1m",
  "3m",
  "5m",
  "10m",
  "15m",
  "30m",
  "1h",
  "2h",
  "3h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
] as const;

export type NativeTimeframe = (typeof NATIVE_TIMEFRAMES)[number];

const TF_RE = /^(\d+)(m|h|d|w)$/i;

const NATIVE_MINUTES: Record<string, number> = {
  "1m": 1,
  "3m": 3,
  "5m": 5,
  "10m": 10,
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "2h": 120,
  "3h": 180,
  "4h": 240,
  "6h": 360,
  "8h": 480,
  "12h": 720,
  "1d": 1440,
  "3d": 4320,
  "1w": 10080,
};

/** Binance spot kline intervals that exist natively (no 3h). */
const BINANCE_NATIVE = new Set([
  "1m",
  "3m",
  "5m",
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
]);

/** Prefer largest native source that evenly divides the target. */
const AGG_SOURCES_ASC = [
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
] as const;

export function normalizeTimeframe(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const m = s.match(TF_RE);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = m[2].toLowerCase();
  return `${n}${u}`;
}

export function timeframeToMinutes(tf: string): number | null {
  const n = normalizeTimeframe(tf);
  if (!n) return null;
  if (n in NATIVE_MINUTES) return NATIVE_MINUTES[n];
  const m = n.match(TF_RE);
  if (!m) return null;
  const v = Number(m[1]);
  switch (m[2].toLowerCase()) {
    case "m":
      return v;
    case "h":
      return v * 60;
    case "d":
      return v * 1440;
    case "w":
      return v * 10080;
    default:
      return null;
  }
}

export function isNativeTimeframe(tf: string): tf is NativeTimeframe {
  const n = normalizeTimeframe(tf);
  return !!n && (NATIVE_TIMEFRAMES as readonly string[]).includes(n);
}

export function isBinanceNativeInterval(tf: string): boolean {
  const n = normalizeTimeframe(tf);
  return !!n && BINANCE_NATIVE.has(n);
}

export interface ResolveBinanceResult {
  /** Interval to request from Binance REST/WS */
  fetchInterval: string;
  /** Target bar size in minutes */
  targetMinutes: number;
  /** Aggregate every `factor` source bars when > 1 */
  factor: number;
  aggregated: boolean;
}

/** Resolve how to fetch a (possibly custom) TF from Binance. */
export function resolveBinanceFetch(tf: string): ResolveBinanceResult | null {
  const minutes = timeframeToMinutes(tf);
  if (minutes == null || minutes <= 0) return null;
  const normalized = normalizeTimeframe(tf)!;

  if (BINANCE_NATIVE.has(normalized)) {
    return {
      fetchInterval: normalized,
      targetMinutes: minutes,
      factor: 1,
      aggregated: false,
    };
  }

  // Pick largest Binance-native source that divides target evenly
  let best: { interval: string; factor: number } | null = null;
  for (const src of AGG_SOURCES_ASC) {
    if (!BINANCE_NATIVE.has(src)) continue;
    const srcMin = NATIVE_MINUTES[src];
    if (srcMin >= minutes) continue;
    if (minutes % srcMin !== 0) continue;
    const factor = minutes / srcMin;
    if (factor < 2) continue;
    if (!best || srcMin > NATIVE_MINUTES[best.interval]) {
      best = { interval: src, factor };
    }
  }
  if (!best) {
    // Fall back to 1m aggregation when possible
    if (minutes >= 2 && minutes % 1 === 0) {
      best = { interval: "1m", factor: minutes };
    } else {
      return null;
    }
  }
  return {
    fetchInterval: best.interval,
    targetMinutes: minutes,
    factor: best.factor,
    aggregated: true,
  };
}

/**
 * Aggregate lower-TF candles into larger bars aligned to epoch buckets.
 */
export function aggregateCandles(
  candles: Candle[],
  periodMinutes: number
): Candle[] {
  if (!candles.length || periodMinutes <= 0) return [];
  const periodSec = periodMinutes * 60;
  const out: Candle[] = [];
  let bucket: Candle | null = null;
  let bucketStart = -1;

  for (const c of candles) {
    const start = Math.floor(c.time / periodSec) * periodSec;
    if (bucket && start === bucketStart) {
      bucket.high = Math.max(bucket.high, c.high);
      bucket.low = Math.min(bucket.low, c.low);
      bucket.close = c.close;
      bucket.volume += c.volume;
    } else {
      if (bucket) out.push(bucket);
      bucketStart = start;
      bucket = {
        time: start,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      };
    }
  }
  if (bucket) out.push(bucket);
  return out;
}

/** Yahoo Finance chart interval + range (best-effort for BIST). */
export function yahooParamsForTimeframe(tf: string): {
  interval: string;
  range: string;
  /** If set, aggregate Yahoo bars to this many minutes */
  aggregateMinutes?: number;
} {
  const minutes = timeframeToMinutes(tf) ?? 1440;
  const n = normalizeTimeframe(tf) ?? "1d";

  // Direct Yahoo support where available
  if (n === "1m") return { interval: "1m", range: "1d" };
  if (n === "5m" || n === "3m") {
    return {
      interval: "5m",
      range: "5d",
      aggregateMinutes: n === "3m" ? undefined : undefined,
    };
  }
  if (n === "15m") return { interval: "15m", range: "5d" };
  if (n === "30m") return { interval: "30m", range: "1mo" };
  if (n === "1h") return { interval: "60m", range: "1mo" };
  if (n === "1d") return { interval: "1d", range: "1y" };
  if (n === "1w") return { interval: "1wk", range: "5y" };
  if (n === "3d") {
    return { interval: "1d", range: "2y", aggregateMinutes: 4320 };
  }

  // Intraday hours from 60m
  if (minutes >= 60 && minutes < 1440 && minutes % 60 === 0) {
    return {
      interval: "60m",
      range: minutes >= 360 ? "6mo" : "3mo",
      aggregateMinutes: minutes,
    };
  }

  // Custom minutes from smaller Yahoo bar
  if (minutes < 60) {
    const src =
      minutes % 15 === 0 ? 15 : minutes % 5 === 0 ? 5 : minutes <= 5 ? 1 : 5;
    const srcInterval = src === 1 ? "1m" : src === 5 ? "5m" : "15m";
    return {
      interval: srcInterval,
      range: minutes <= 5 ? "5d" : "1mo",
      aggregateMinutes: minutes === src ? undefined : minutes,
    };
  }

  // Multi-day / multi-week
  if (minutes % 1440 === 0) {
    return {
      interval: "1d",
      range: "5y",
      aggregateMinutes: minutes === 1440 ? undefined : minutes,
    };
  }

  return { interval: "1d", range: "1y" };
}

