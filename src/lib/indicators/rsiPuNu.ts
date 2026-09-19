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
  /** Hidden bullish (continuation) at pivot confirm bar */
  puHidden: (number | null)[];
  /** Hidden bearish (continuation) at pivot confirm bar */
  nuHidden: (number | null)[];
  /** 1 at confirmed RSI pivot low bars */
  pivotLow: (number | null)[];
  /** 1 at confirmed RSI pivot high bars */
  pivotHigh: (number | null)[];
};

/**
 * RSI regular (PU/NU) + hidden divergences — Pine-style pivots on RSI.
 * PU: price LL + RSI HL. NU: price HH + RSI LH.
 * Hidden PU: price HL + RSI LL. Hidden NU: price LH + RSI HH.
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
    puHidden: div.hiddenBull,
    nuHidden: div.hiddenBear,
    pivotLow: div.pivotLow,
    pivotHigh: div.pivotHigh,
  };
}

export type RsiPuNuMarkerKind = "pu" | "nu" | "puHidden" | "nuHidden";

/** True if a PU/NU (regular or hidden) marker fired within the last `maxBarsAgo` bars. */
export function recentRsiPuNu(
  candles: Candle[],
  direction: "bull" | "bear" | "any",
  maxBarsAgo = 2,
  opts?: RsiPuNuOpts & { divKind?: "regular" | "hidden" | "any" }
): { ok: boolean; barsAgo: number; kind: RsiPuNuMarkerKind | null } {
  const r = computeRsiPuNu(candles, opts);
  const divKind = opts?.divKind ?? "regular";
  const end = candles.length - 1;
  if (end < 0) return { ok: false, barsAgo: -1, kind: null };
  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = end - ago;
    if (i < 0) break;
    const isPu = r.pu[i] != null;
    const isNu = r.nu[i] != null;
    const isPuH = r.puHidden[i] != null;
    const isNuH = r.nuHidden[i] != null;
    const wantReg = divKind === "regular" || divKind === "any";
    const wantHid = divKind === "hidden" || divKind === "any";
    if (direction === "bull" || direction === "any") {
      if (wantReg && isPu) return { ok: true, barsAgo: ago, kind: "pu" };
      if (wantHid && isPuH) return { ok: true, barsAgo: ago, kind: "puHidden" };
    }
    if (direction === "bear" || direction === "any") {
      if (wantReg && isNu) return { ok: true, barsAgo: ago, kind: "nu" };
      if (wantHid && isNuH) return { ok: true, barsAgo: ago, kind: "nuHidden" };
    }
  }
  return { ok: false, barsAgo: -1, kind: null };
}
