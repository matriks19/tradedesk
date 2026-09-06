import type { Candle } from "@/lib/types";

export type DescendingBreakOpts = {
  /** Pivot lookback on each side (Pine pivothigh length; default 20) */
  lookback?: number;
  /** Also emit flat S/R boxes from recent pivot highs/lows */
  srBoxes?: boolean;
};

export type DescendingBreakResult = {
  /** Projected descending resistance trendline value (null when inactive) */
  trend: (number | null)[];
  /** 1 on breakout bar (close crosses above prior bar trend) */
  breakOut: (number | null)[];
  /** Optional pivot-high resistance levels (flat) */
  resBox: (number | null)[];
  /** Optional pivot-low support levels (flat) */
  supBox: (number | null)[];
  /** Pivot high marks (price) */
  pivotHigh: (number | null)[];
  /** Pivot low marks (price) */
  pivotLow: (number | null)[];
};

function isPivotHigh(
  candles: Candle[],
  i: number,
  L: number,
  R: number
): boolean {
  const h = candles[i]!.high;
  for (let j = i - L; j <= i + R; j++) {
    if (j === i) continue;
    if (j < 0 || j >= candles.length) return false;
    if (candles[j]!.high >= h) return false;
  }
  return true;
}

function isPivotLow(
  candles: Candle[],
  i: number,
  L: number,
  R: number
): boolean {
  const l = candles[i]!.low;
  for (let j = i - L; j <= i + R; j++) {
    if (j === i) continue;
    if (j < 0 || j >= candles.length) return false;
    if (candles[j]!.low <= l) return false;
  }
  return true;
}

function lineAt(
  i0: number,
  p0: number,
  i1: number,
  p1: number,
  i: number
): number {
  if (i1 === i0) return p1;
  const slope = (p1 - p0) / (i1 - i0);
  return p0 + slope * (i - i0);
}

/**
 * "Düşen Kırılımı" — descending pivot-high trendline breakout (Pine port).
 * When the last two pivot highs are descending, project the line; breakout when
 * close crosses above the previous bar's trend value.
 */
export function computeDescendingBreak(
  candles: Candle[],
  opts: DescendingBreakOpts = {}
): DescendingBreakResult {
  const L = opts.lookback ?? 20;
  const R = L;
  const srBoxes = opts.srBoxes !== false;
  const n = candles.length;

  const trend: (number | null)[] = new Array(n).fill(null);
  const breakOut: (number | null)[] = new Array(n).fill(null);
  const resBox: (number | null)[] = new Array(n).fill(null);
  const supBox: (number | null)[] = new Array(n).fill(null);
  const pivotHigh: (number | null)[] = new Array(n).fill(null);
  const pivotLow: (number | null)[] = new Array(n).fill(null);

  type Pt = { i: number; price: number };
  const highs: Pt[] = [];
  const lows: Pt[] = [];
  let active: { i0: number; p0: number; i1: number; p1: number } | null = null;
  let lastRes: number | null = null;
  let lastSup: number | null = null;

  for (let i = 0; i < n; i++) {
    const pi = i - R;
    if (pi >= L) {
      if (isPivotHigh(candles, pi, L, R)) {
        highs.push({ i: pi, price: candles[pi]!.high });
        pivotHigh[i] = candles[pi]!.high;
        lastRes = candles[pi]!.high;
        if (highs.length >= 2) {
          const a = highs[highs.length - 2]!;
          const b = highs[highs.length - 1]!;
          // Descending: second high lower than first
          if (b.price < a.price) {
            active = { i0: a.i, p0: a.price, i1: b.i, p1: b.price };
          } else {
            // Non-descending pair clears active trend
            active = null;
          }
        }
      }
      if (isPivotLow(candles, pi, L, R)) {
        lows.push({ i: pi, price: candles[pi]!.low });
        pivotLow[i] = candles[pi]!.low;
        lastSup = candles[pi]!.low;
      }
    }

    if (srBoxes) {
      resBox[i] = lastRes;
      supBox[i] = lastSup;
    }

    if (active) {
      const tv = lineAt(active.i0, active.p0, active.i1, active.p1, i);
      trend[i] = tv;
      if (i > 0 && trend[i - 1] != null) {
        const prevT = trend[i - 1] as number;
        const prevC = candles[i - 1]!.close;
        const currC = candles[i]!.close;
        // Close crosses above previous bar's trend value
        if (prevC <= prevT && currC > prevT) {
          breakOut[i] = 1;
        }
      }
    }
  }

  return { trend, breakOut, resBox, supBox, pivotHigh, pivotLow };
}

/** Recent descending-trendline breakout within maxBarsAgo (default 2). */
export function recentDescendingBreak(
  candles: Candle[],
  maxBarsAgo = 2,
  opts?: DescendingBreakOpts
): { ok: boolean; barsAgo: number } {
  const r = computeDescendingBreak(candles, opts);
  const end = candles.length - 1;
  if (end < 0) return { ok: false, barsAgo: -1 };
  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = end - ago;
    if (i < 0) break;
    if (r.breakOut[i] === 1) return { ok: true, barsAgo: ago };
  }
  return { ok: false, barsAgo: -1 };
}
