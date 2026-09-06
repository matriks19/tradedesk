import type { Candle } from "@/lib/types";
import { closes, rsi } from "./math";

export type RsiPuNuOpts = {
  rsiLen?: number;
  /** Pivot left bars (Pine lbL) */
  lbL?: number;
  /** Pivot right bars (Pine lbR) — signal confirms with this lag */
  lbR?: number;
  /** Min bars between pivots for divergence (Pine rangeLower) */
  rangeLower?: number;
  /** Max bars between pivots for divergence (Pine rangeUpper) */
  rangeUpper?: number;
};

export type RsiPuNuResult = {
  rsi: (number | null)[];
  /** Regular bullish divergence (PU) marker at pivot confirm bar */
  pu: (number | null)[];
  /** Regular bearish divergence (NU) marker at pivot confirm bar */
  nu: (number | null)[];
  /** 1 at confirmed RSI pivot low bars */
  pivotLow: (number | null)[];
  /** 1 at confirmed RSI pivot high bars */
  pivotHigh: (number | null)[];
};

function isPivotLow(
  series: (number | null)[],
  i: number,
  left: number,
  right: number
): boolean {
  const v = series[i];
  if (v == null) return false;
  for (let j = i - left; j <= i + right; j++) {
    if (j === i) continue;
    if (j < 0 || j >= series.length) return false;
    const o = series[j];
    if (o == null || o <= v) return false;
  }
  return true;
}

function isPivotHigh(
  series: (number | null)[],
  i: number,
  left: number,
  right: number
): boolean {
  const v = series[i];
  if (v == null) return false;
  for (let j = i - left; j <= i + right; j++) {
    if (j === i) continue;
    if (j < 0 || j >= series.length) return false;
    const o = series[j];
    if (o == null || o >= v) return false;
  }
  return true;
}

/**
 * RSI regular bullish (PU) / bearish (NU) divergences — Pine-style pivots on RSI.
 * PU: price lower low + RSI higher low at RSI pivot lows.
 * NU: price higher high + RSI lower high at RSI pivot highs.
 * Defaults match common TV script: rsiLen=14, lbL=15, lbR=2, range 15–60.
 */
export function computeRsiPuNu(
  candles: Candle[],
  opts: RsiPuNuOpts = {}
): RsiPuNuResult {
  const rsiLen = opts.rsiLen ?? 14;
  const lbL = opts.lbL ?? 15;
  const lbR = opts.lbR ?? 2;
  const rangeLower = opts.rangeLower ?? 15;
  const rangeUpper = opts.rangeUpper ?? 60;
  const n = candles.length;
  const osc = rsi(closes(candles), rsiLen);

  const pu: (number | null)[] = new Array(n).fill(null);
  const nu: (number | null)[] = new Array(n).fill(null);
  const pivotLow: (number | null)[] = new Array(n).fill(null);
  const pivotHigh: (number | null)[] = new Array(n).fill(null);

  type Pivot = { confirm: number; pivot: number; osc: number; price: number };
  const lows: Pivot[] = [];
  const highs: Pivot[] = [];

  for (let i = 0; i < n; i++) {
    const pi = i - lbR;
    if (pi < lbL) continue;

    if (isPivotLow(osc, pi, lbL, lbR)) {
      const ov = osc[pi] as number;
      const price = candles[pi]!.low;
      pivotLow[i] = 1;
      if (lows.length >= 1) {
        const prev = lows[lows.length - 1]!;
        const bars = pi - prev.pivot;
        if (bars >= rangeLower && bars <= rangeUpper) {
          const oscHL = ov > prev.osc;
          const priceLL = price < prev.price;
          if (oscHL && priceLL) {
            pu[i] = ov;
          }
        }
      }
      lows.push({ confirm: i, pivot: pi, osc: ov, price });
    }

    if (isPivotHigh(osc, pi, lbL, lbR)) {
      const ov = osc[pi] as number;
      const price = candles[pi]!.high;
      pivotHigh[i] = 1;
      if (highs.length >= 1) {
        const prev = highs[highs.length - 1]!;
        const bars = pi - prev.pivot;
        if (bars >= rangeLower && bars <= rangeUpper) {
          const oscLH = ov < prev.osc;
          const priceHH = price > prev.price;
          if (oscLH && priceHH) {
            nu[i] = ov;
          }
        }
      }
      highs.push({ confirm: i, pivot: pi, osc: ov, price });
    }
  }

  return { rsi: osc, pu, nu, pivotLow, pivotHigh };
}

/** True if a PU/NU marker fired within the last `maxBarsAgo` bars (0 = last bar). */
export function recentRsiPuNu(
  candles: Candle[],
  direction: "bull" | "bear" | "any",
  maxBarsAgo = 2,
  opts?: RsiPuNuOpts
): { ok: boolean; barsAgo: number; kind: "pu" | "nu" | null } {
  const r = computeRsiPuNu(candles, opts);
  const end = candles.length - 1;
  if (end < 0) return { ok: false, barsAgo: -1, kind: null };
  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = end - ago;
    if (i < 0) break;
    const isPu = r.pu[i] != null;
    const isNu = r.nu[i] != null;
    if (direction === "bull" || direction === "any") {
      if (isPu) return { ok: true, barsAgo: ago, kind: "pu" };
    }
    if (direction === "bear" || direction === "any") {
      if (isNu) return { ok: true, barsAgo: ago, kind: "nu" };
    }
  }
  return { ok: false, barsAgo: -1, kind: null };
}
