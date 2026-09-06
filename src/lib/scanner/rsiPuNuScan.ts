import type { Candle } from "@/lib/types";
import {
  computeRsiPuNu,
  recentRsiPuNu,
  type RsiPuNuOpts,
} from "@/lib/indicators/rsiPuNu";

export type DetectRsiPuNuOpts = RsiPuNuOpts & {
  /** Look back this many bars for a fresh PU/NU (default 2) */
  maxBarsAgo?: number;
};

export type RsiPuNuHit = {
  kind: "pu" | "nu";
  barsAgo: number;
  labelTr: string;
};

/**
 * Detect recent RSI regular bullish (PU) / bearish (NU) divergences.
 * Same engine as the rsiPuNu chart indicator (Pine pivot params).
 */
export function detectRsiPuNu(
  candles: Candle[],
  direction: "bull" | "bear" | "any" = "any",
  opts: DetectRsiPuNuOpts = {}
): RsiPuNuHit | null {
  const maxBarsAgo = opts.maxBarsAgo ?? 2;
  const hit = recentRsiPuNu(candles, direction, maxBarsAgo, opts);
  if (!hit.ok || !hit.kind) return null;
  return {
    kind: hit.kind,
    barsAgo: hit.barsAgo,
    labelTr: hit.kind === "pu" ? "RSI PU" : "RSI NU",
  };
}

/** Marker series for chart overlay (reuse compute). */
export function rsiPuNuMarkerSeries(candles: Candle[], opts?: RsiPuNuOpts) {
  return computeRsiPuNu(candles, opts);
}

export { computeRsiPuNu, recentRsiPuNu };
