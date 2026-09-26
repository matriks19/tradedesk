/**
 * Kijun + BB — light list-scan helper (Pine v2 port).
 *
 *   Kijun = avg(highest(high, 26), lowest(low, 26))   // Donchian mid
 *   basis = sma(Kijun, 24)
 *   dev   = 2 * stdev(Kijun, 24)
 *   upper = basis + dev ; lower = basis - dev
 *
 * NOTE: Bollinger bands are computed on the KIJUN series, not on price.
 * Uses sma/stdev/highest/lowest from math.ts. All chips are edge events
 * (fire on the crossing bar only).
 *
 * Chips:
 * - px_lower_up  — close crosses UP through lower band   (early)
 * - px_lower_dn  — close breaks DOWN through lower band  (early)
 * - px_upper_up  — close breaks UP through upper band    (early)
 * - kijun_mid_up — Kijun crosses UP through basis        (trend confirm)
 * - kijun_mid_dn — Kijun crosses DOWN through basis      (trend confirm)
 */
import type { Candle } from "@/lib/types";
import { highest, lowest, sma, stdev } from "@/lib/indicators/math";

export type KijunBbOpts = {
  basePeriods?: number;
  bbLength?: number;
  bbStdDev?: number;
};

export type KijunBbResult = {
  kijun: (number | null)[];
  basis: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
  px_lower_up: (number | null)[];
  px_lower_dn: (number | null)[];
  px_upper_up: (number | null)[];
  kijun_mid_up: (number | null)[];
  kijun_mid_dn: (number | null)[];
};

/** 26 (Donchian) + 24 (BB) − 1 warmup + cross bar + slack. */
export const KIJUN_BB_MIN_BARS = 60;
export const KIJUN_BB_FETCH_LIMIT = 220;

function crossUp(
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

function crossDn(
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

/**
 * Run a number[]-only helper (sma/stdev) over a series with a leading null
 * warmup: compute on the valid tail, then left-pad with nulls.
 */
function onValidTail(
  src: (number | null)[],
  fn: (v: number[], p: number) => (number | null)[],
  period: number
): (number | null)[] {
  const start = src.findIndex((v) => v != null);
  const out: (number | null)[] = new Array(src.length).fill(null);
  if (start < 0) return out;
  const tail = src.slice(start) as number[];
  const r = fn(tail, period);
  for (let k = 0; k < r.length; k++) out[start + k] = r[k] ?? null;
  return out;
}

export function kijunBb(
  candles: Candle[],
  opts: KijunBbOpts = {}
): KijunBbResult {
  const basePeriods = Math.max(1, Math.round(opts.basePeriods ?? 26));
  const bbLength = Math.max(1, Math.round(opts.bbLength ?? 24));
  const bbStdDev = opts.bbStdDev ?? 2;
  const n = candles.length;
  const empty = (): (number | null)[] => new Array(n).fill(null);

  const hi = highest(
    candles.map((c) => c.high),
    basePeriods
  );
  const lo = lowest(
    candles.map((c) => c.low),
    basePeriods
  );
  const kijun: (number | null)[] = hi.map((h, i) => {
    const l = lo[i];
    return h == null || l == null ? null : (h + l) / 2;
  });
  const basis = onValidTail(kijun, sma, bbLength);
  const sd = onValidTail(kijun, stdev, bbLength);
  const upper = empty();
  const lower = empty();
  for (let i = 0; i < n; i++) {
    const b = basis[i];
    const d = sd[i];
    if (b == null || d == null) continue;
    upper[i] = b + bbStdDev * d;
    lower[i] = b - bbStdDev * d;
  }

  const closeSeries: (number | null)[] = candles.map((c) => c.close);
  const px_lower_up = empty();
  const px_lower_dn = empty();
  const px_upper_up = empty();
  const kijun_mid_up = empty();
  const kijun_mid_dn = empty();
  for (let i = 1; i < n; i++) {
    if (crossUp(closeSeries, lower, i)) px_lower_up[i] = 1;
    if (crossDn(closeSeries, lower, i)) px_lower_dn[i] = 1;
    if (crossUp(closeSeries, upper, i)) px_upper_up[i] = 1;
    if (crossUp(kijun, basis, i)) kijun_mid_up[i] = 1;
    if (crossDn(kijun, basis, i)) kijun_mid_dn[i] = 1;
  }

  return {
    kijun,
    basis,
    upper,
    lower,
    px_lower_up,
    px_lower_dn,
    px_upper_up,
    kijun_mid_up,
    kijun_mid_dn,
  };
}
