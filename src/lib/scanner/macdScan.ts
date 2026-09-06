import type { Candle } from "@/lib/types";
import { closes, macd } from "@/lib/indicators/math";

export type MacdBias = "bull" | "bear";

export type MacdCrossHit = {
  bias: MacdBias;
  /** Bars since MACD/signal cross (0 = current/last closed bar) */
  barsAgo: number;
  macd: number;
  signal: number;
  hist: number;
  /** MACD line also crossed zero on the same bar */
  macdZeroCross?: boolean;
};

export type DetectMacdCrossOpts = {
  fast?: number;
  slow?: number;
  signalPeriod?: number;
  /** Look back this many bars for the most recent cross (default 20) */
  maxBarsAgo?: number;
};

function crossedAboveAt(
  a: (number | null)[],
  b: (number | null)[],
  i: number
): boolean {
  if (i < 1) return false;
  const a0 = a[i - 1];
  const a1 = a[i];
  const b0 = b[i - 1];
  const b1 = b[i];
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false;
  return a0 <= b0 && a1 > b1;
}

function crossedBelowAt(
  a: (number | null)[],
  b: (number | null)[],
  i: number
): boolean {
  if (i < 1) return false;
  const a0 = a[i - 1];
  const a1 = a[i];
  const b0 = b[i - 1];
  const b1 = b[i];
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false;
  return a0 >= b0 && a1 < b1;
}

function lineZeroCrossAt(line: (number | null)[], i: number): boolean {
  if (i < 1) return false;
  const v0 = line[i - 1];
  const v1 = line[i];
  if (v0 == null || v1 == null) return false;
  return (v0 <= 0 && v1 > 0) || (v0 >= 0 && v1 < 0);
}

/**
 * Find the most recent MACD line × signal cross within maxBarsAgo.
 * AL (bull) = MACD crosses above signal; SAT (bear) = crosses below.
 * (Hist zero-cross ≡ signal cross since hist = macd − signal.)
 */
export function detectMacdCross(
  candles: Candle[],
  opts: DetectMacdCrossOpts = {}
): MacdCrossHit | null {
  const fast = opts.fast ?? 12;
  const slow = opts.slow ?? 26;
  const signalPeriod = opts.signalPeriod ?? 9;
  const maxBarsAgo = opts.maxBarsAgo ?? 20;

  if (candles.length < slow + signalPeriod + 2) return null;

  const series = closes(candles);
  const m = macd(series, fast, slow, signalPeriod);
  const last = m.macd.length - 1;
  const lookFrom = Math.max(1, last - maxBarsAgo);

  for (let i = last; i >= lookFrom; i--) {
    const bull = crossedAboveAt(m.macd, m.signal, i);
    const bear = crossedBelowAt(m.macd, m.signal, i);
    if (!bull && !bear) continue;
    const mv = m.macd[i];
    const sv = m.signal[i];
    const hv = m.hist[i];
    if (mv == null || sv == null || hv == null) continue;
    return {
      bias: bull ? "bull" : "bear",
      barsAgo: last - i,
      macd: mv,
      signal: sv,
      hist: hv,
      macdZeroCross: lineZeroCrossAt(m.macd, i),
    };
  }
  return null;
}

/**
 * Full-series MACD + per-bar signal-cross markers — same rules as detectMacdCross.
 * crossUp/crossDn are 1 on cross bars, null otherwise (for chart hist spikes).
 */
export function macdCrossMarkerSeries(
  candles: Candle[],
  opts: DetectMacdCrossOpts = {}
): {
  macd: (number | null)[];
  signal: (number | null)[];
  hist: (number | null)[];
  crossUp: (number | null)[];
  crossDn: (number | null)[];
} {
  const fast = opts.fast ?? 12;
  const slow = opts.slow ?? 26;
  const signalPeriod = opts.signalPeriod ?? 9;
  const m = macd(closes(candles), fast, slow, signalPeriod);
  const n = m.macd.length;
  const crossUp: (number | null)[] = Array(n).fill(null);
  const crossDn: (number | null)[] = Array(n).fill(null);
  for (let i = 1; i < n; i++) {
    if (crossedAboveAt(m.macd, m.signal, i)) crossUp[i] = 1;
    if (crossedBelowAt(m.macd, m.signal, i)) crossDn[i] = 1;
  }
  return {
    macd: m.macd,
    signal: m.signal,
    hist: m.hist,
    crossUp,
    crossDn,
  };
}
