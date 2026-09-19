import type { Candle } from "@/lib/types";
import { closes, rsi } from "./math";
import {
  computeOscDivergence,
  type OscDivergenceOpts,
} from "./oscDivergence";

export type RsiPuNuOpts = OscDivergenceOpts & {
  rsiLen?: number;
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
  const osc = rsi(closes(candles), rsiLen);
  const div = computeOscDivergence(candles, osc, {
    lbL: opts.lbL ?? 15,
    lbR: opts.lbR ?? 2,
    rangeLower: opts.rangeLower ?? 15,
    rangeUpper: opts.rangeUpper ?? 60,
  });
  return {
    rsi: osc,
    pu: div.bull,
    nu: div.bear,
    pivotLow: div.pivotLow,
    pivotHigh: div.pivotHigh,
  };
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
