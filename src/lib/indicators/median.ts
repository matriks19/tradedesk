/**
 * Median / percentile indicators — robust alternatives to mean-based bands.
 *
 * Thesis: mean+stddev (BB) is fragile to spikes; median/MAD and TradingView-style
 * percentile linear interpolation (PLI) channel width (oran) better capture
 * "narrowing" squeezes. Hybrid with signed bar delta-volume filters breakouts.
 *
 * Reference Pine (Go-10-Pli / dg_factor):
 *   p1 = ta.percentile_linear_interpolation(close, u, 100-x)  // upper
 *   p2 = ta.percentile_linear_interpolation(close, u, x)      // lower
 *   oran = p1/p2 - 1
 *   long = ta.crossover(close, p1); short = ta.crossunder(close, p2)
 */
import type { Candle } from "@/lib/types";
import { ema } from "./math";

const MAD_SCALE = 1.4826; // normal-consistency constant

function fillNull(n: number): (number | null)[] {
  return new Array(n).fill(null);
}

/** In-place-safe median of a copy of `arr` (must be non-empty finite numbers). */
function medianOf(arr: number[]): number {
  const a = arr.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Sorted copy helper. */
function sortedWindow(values: number[], end: number, period: number): number[] {
  const w: number[] = new Array(period);
  for (let j = 0; j < period; j++) w[j] = values[end - period + 1 + j];
  w.sort((a, b) => a - b);
  return w;
}

/**
 * Rolling median over `period` bars. Null until enough samples.
 */
export function rollingMedian(
  values: number[],
  period: number
): (number | null)[] {
  const n = values.length;
  const out = fillNull(n);
  const p = Math.max(1, Math.floor(period));
  for (let i = p - 1; i < n; i++) {
    out[i] = medianOf(values.slice(i - p + 1, i + 1));
  }
  return out;
}

/**
 * Median Absolute Deviation bands:
 *   mid = median(close)
 *   mad = median(|x − mid|)
 *   upper/lower = mid ± mult * 1.4826 * mad
 *   outerUpper/outerLower use outerMult (default 3)
 */
export function madBands(
  values: number[],
  period: number,
  mult = 2,
  outerMult = 3
): {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
  outerUpper: (number | null)[];
  outerLower: (number | null)[];
  mad: (number | null)[];
} {
  const n = values.length;
  const p = Math.max(2, Math.floor(period));
  const mid = fillNull(n);
  const upper = fillNull(n);
  const lower = fillNull(n);
  const outerUpper = fillNull(n);
  const outerLower = fillNull(n);
  const madArr = fillNull(n);

  for (let i = p - 1; i < n; i++) {
    const slice = values.slice(i - p + 1, i + 1);
    const m = medianOf(slice);
    const deviations = slice.map((v) => Math.abs(v - m));
    const mad = medianOf(deviations);
    const scaled = MAD_SCALE * mad;
    mid[i] = m;
    madArr[i] = mad;
    upper[i] = m + mult * scaled;
    lower[i] = m - mult * scaled;
    outerUpper[i] = m + outerMult * scaled;
    outerLower[i] = m - outerMult * scaled;
  }
  return { mid, upper, lower, outerUpper, outerLower, mad: madArr };
}

/**
 * Median channel — rolling median of high / low / close.
 */
export function medianChannel(
  candles: Candle[],
  period: number
): {
  medHigh: (number | null)[];
  medLow: (number | null)[];
  medClose: (number | null)[];
} {
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const closes = candles.map((c) => c.close);
  return {
    medHigh: rollingMedian(highs, period),
    medLow: rollingMedian(lows, period),
    medClose: rollingMedian(closes, period),
  };
}

/**
 * TradingView-style `ta.percentile_linear_interpolation(source, length, percentage)`.
 * percentage ∈ [0, 100]. Linear interpolate between nearest ranks of the sorted window.
 */
export function percentileLinearInterpolation(
  values: number[],
  length: number,
  percentage: number
): (number | null)[] {
  const n = values.length;
  const out = fillNull(n);
  const len = Math.max(1, Math.floor(length));
  const pct = Math.max(0, Math.min(100, percentage));

  for (let i = len - 1; i < n; i++) {
    const sorted = sortedWindow(values, i, len);
    if (len === 1) {
      out[i] = sorted[0];
      continue;
    }
    const rank = (pct / 100) * (len - 1);
    const lo = Math.floor(rank);
    const hi = Math.ceil(rank);
    if (lo === hi) {
      out[i] = sorted[lo];
    } else {
      const w = rank - lo;
      out[i] = sorted[lo] * (1 - w) + sorted[hi] * w;
    }
  }
  return out;
}

/**
 * PLI channel (Go-10-Pli):
 *   upper = PLI(src, length, 100-x)
 *   lower = PLI(src, length, x)
 *   oran  = upper/lower - 1   (channel width ratio; squeeze when small)
 */
export function pliChannel(
  values: number[],
  length = 50,
  x = 5
): {
  upper: (number | null)[];
  lower: (number | null)[];
  oran: (number | null)[];
} {
  const xx = Math.max(0.1, Math.min(49, x));
  const upper = percentileLinearInterpolation(values, length, 100 - xx);
  const lower = percentileLinearInterpolation(values, length, xx);
  const oran = values.map((_, i) => {
    const u = upper[i];
    const l = lower[i];
    if (u == null || l == null || l === 0) return null;
    return u / l - 1;
  });
  return { upper, lower, oran };
}

/**
 * Approximate signed bar volume (close vs open). Optional EMA smooth → deltaEma.
 * close>open → +vol; close<open → −vol; else 0.
 */
export function barDeltaVolume(
  candles: Candle[],
  smoothPeriod = 0
): {
  deltaVol: (number | null)[];
  deltaEma: (number | null)[];
} {
  const deltaVol: (number | null)[] = candles.map((c) => {
    if (c.close > c.open) return c.volume;
    if (c.close < c.open) return -c.volume;
    return 0;
  });
  if (!smoothPeriod || smoothPeriod < 1) {
    return { deltaVol, deltaEma: deltaVol.slice() };
  }
  const filled = deltaVol.map((v) => v ?? 0);
  const smoothed = ema(filled, Math.floor(smoothPeriod));
  return { deltaVol, deltaEma: smoothed };
}

export interface PliDeltaHybridOpts {
  length?: number;
  x?: number;
  /** EMA period for delta volume (default 5) */
  deltaSmooth?: number;
  /** Lookback to judge whether oran is "narrow" (default = length) */
  narrowLookback?: number;
  /** Oran below this percentile of itself = squeeze (default 25) */
  narrowPct?: number;
  /** Bars after squeeze still count as "after narrow" (default 5) */
  narrowMemory?: number;
  /** Bounce: low within this ATR-fraction of lower band — unused ATR; use pct of range */
  bounceTolPct?: number;
}

export interface PliDeltaHybridResult {
  upper: (number | null)[];
  lower: (number | null)[];
  oran: (number | null)[];
  deltaVol: (number | null)[];
  deltaEma: (number | null)[];
  /** 1 when oran is in squeeze vs its own distribution */
  narrow: (number | null)[];
  /** Hybrid long signal 0/1 */
  longSignal: (number | null)[];
  /** Hybrid short signal 0/1 */
  shortSignal: (number | null)[];
  /** Optional 0–100 score: narrowness + |delta| */
  score: (number | null)[];
  /** +1 / −1 / 0 for bar tinting */
  barBias: (number | null)[];
}

/**
 * PLI channel narrowing × delta-volume hybrid.
 *
 * narrow: oran ≤ PLI(oran, narrowLookback, narrowPct)
 * hybrid long: (crossover close>upper OR bounce off lower after narrow)
 *              AND delta supportive (deltaEma>0 or rising)
 * hybrid short: mirror
 * score: 0–100 from inverted oran rank + |deltaEma| soft-norm
 */
export function pliDeltaHybrid(
  candles: Candle[],
  opts: PliDeltaHybridOpts = {}
): PliDeltaHybridResult {
  const length = opts.length ?? 50;
  const x = opts.x ?? 5;
  const deltaSmooth = opts.deltaSmooth ?? 5;
  const narrowLookback = opts.narrowLookback ?? length;
  const narrowPct = opts.narrowPct ?? 25;
  const narrowMemory = opts.narrowMemory ?? 5;
  const bounceTolPct = opts.bounceTolPct ?? 0.15;

  const closes = candles.map((c) => c.close);
  const n = candles.length;
  const { upper, lower, oran } = pliChannel(closes, length, x);
  const { deltaVol, deltaEma } = barDeltaVolume(candles, deltaSmooth);

  // Build oran numeric series for percentile (use 0 where null early)
  const oranPctGate = fillNull(n);
  for (let i = 0; i < n; i++) {
    if (oran[i] == null) continue;
    // need enough non-null oran history
    if (i < length - 1 + Math.min(narrowLookback, length) - 1) {
      // still compute when we have narrowLookback finite oran points ending at i
    }
    const window: number[] = [];
    for (let j = Math.max(0, i - narrowLookback + 1); j <= i; j++) {
      if (oran[j] != null) window.push(oran[j] as number);
    }
    if (window.length < Math.max(5, Math.min(10, narrowLookback))) continue;
    window.sort((a, b) => a - b);
    const rank = (narrowPct / 100) * (window.length - 1);
    const lo = Math.floor(rank);
    const hi = Math.ceil(rank);
    oranPctGate[i] =
      lo === hi ? window[lo] : window[lo] * (1 - (rank - lo)) + window[hi] * (rank - lo);
  }

  const narrow = fillNull(n);
  for (let i = 0; i < n; i++) {
    if (oran[i] == null || oranPctGate[i] == null) continue;
    narrow[i] = (oran[i] as number) <= (oranPctGate[i] as number) ? 1 : 0;
  }

  // recent narrow memory
  const recentlyNarrow = (i: number): boolean => {
    for (let k = 0; k <= narrowMemory && i - k >= 0; k++) {
      if (narrow[i - k] === 1) return true;
    }
    return false;
  };

  const longSignal = fillNull(n);
  const shortSignal = fillNull(n);
  const score = fillNull(n);
  const barBias = fillNull(n);

  // Precompute |deltaEma| soft scale via rolling median of abs for score
  const absDelta = deltaEma.map((v) => (v == null ? 0 : Math.abs(v)));
  const absDeltaMed = rollingMedian(absDelta, Math.max(20, narrowLookback));

  for (let i = 1; i < n; i++) {
    if (upper[i] == null || lower[i] == null || oran[i] == null) continue;

    const c = closes[i];
    const cPrev = closes[i - 1];
    const u = upper[i] as number;
    const uPrev = upper[i - 1];
    const l = lower[i] as number;
    const lPrev = lower[i - 1];
    const band = Math.max(u - l, Number.EPSILON);
    const tol = band * bounceTolPct;

    const crossUp =
      uPrev != null && cPrev <= (uPrev as number) && c > u;
    const crossDn =
      lPrev != null && cPrev >= (lPrev as number) && c < l;

    // Bounce from lower: touched/near lower recently, now closing up from lower zone
    const nearLow =
      candles[i].low <= l + tol ||
      (lPrev != null && candles[i - 1].low <= (lPrev as number) + tol);
    const bounceLow = nearLow && c > cPrev && c >= l && recentlyNarrow(i);

    // Bounce from upper (short): mirror
    const nearHigh =
      candles[i].high >= u - tol ||
      (uPrev != null && candles[i - 1].high >= (uPrev as number) - tol);
    const bounceHigh = nearHigh && c < cPrev && c <= u && recentlyNarrow(i);

    const d = deltaEma[i];
    const dPrev = deltaEma[i - 1];
    const deltaLongOk =
      d != null && (d > 0 || (dPrev != null && d > dPrev));
    const deltaShortOk =
      d != null && (d < 0 || (dPrev != null && d < dPrev));

    const long =
      (crossUp || bounceLow) && deltaLongOk ? 1 : 0;
    const short =
      (crossDn || bounceHigh) && deltaShortOk ? 1 : 0;

    longSignal[i] = long;
    shortSignal[i] = short;
    barBias[i] = long ? 1 : short ? -1 : 0;

    // Score: narrowness (how far below typical oran) + |delta|
    let narrowScore = 0;
    if (oranPctGate[i] != null && (oranPctGate[i] as number) > 0) {
      const ratio = (oran[i] as number) / (oranPctGate[i] as number);
      // tighter → higher; clamp
      narrowScore = Math.max(0, Math.min(100, (1.5 - ratio) * 60));
      if (narrow[i] === 1) narrowScore = Math.max(narrowScore, 55);
    }
    let deltaScore = 0;
    if (d != null) {
      const med = absDeltaMed[i];
      const scale = med != null && med > 0 ? med : Math.max(...absDelta.slice(Math.max(0, i - 50), i + 1), 1e-9);
      const z = Math.abs(d) / scale;
      deltaScore = Math.max(0, Math.min(100, (1 - Math.exp(-z)) * 100));
    }
    score[i] = Math.round(0.55 * narrowScore + 0.45 * deltaScore);
  }

  return {
    upper,
    lower,
    oran,
    deltaVol,
    deltaEma,
    narrow,
    longSignal,
    shortSignal,
    score,
    barBias,
  };
}
