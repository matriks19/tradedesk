/**
 * MACD×Elizi hybrid scan — composite 60/40 cross (MACD leads, Elizi confirms).
 */
import type { Candle } from "@/lib/types";
import {
  macdEliziHybrid,
  type MacdEliziHybridParams,
} from "@/lib/indicators/macdEliziHybrid";

export type MacdEliziBias = "bull" | "bear";

export type MacdEliziHit = {
  bias: MacdEliziBias;
  barsAgo: number;
  hybrid: number;
  signal: number;
  hist: number;
  macdNorm: number;
  eliziNorm: number;
};

export type DetectMacdEliziOpts = MacdEliziHybridParams & {
  maxBarsAgo?: number;
};

/**
 * Most recent hybrid × signal cross within maxBarsAgo (default 2).
 */
export function detectMacdEliziCross(
  candles: Candle[],
  opts: DetectMacdEliziOpts = {}
): MacdEliziHit | null {
  const maxBarsAgo = opts.maxBarsAgo ?? 2;
  if (candles.length < 60) return null;
  const h = macdEliziHybrid(candles, opts);
  const last = h.hybrid.length - 1;
  const lookFrom = Math.max(1, last - maxBarsAgo);
  for (let i = last; i >= lookFrom; i--) {
    const bull = h.crossUp[i] === 1;
    const bear = h.crossDn[i] === 1;
    if (!bull && !bear) continue;
    const hy = h.hybrid[i];
    const sig = h.signal[i];
    const hi = h.hist[i];
    const mn = h.macdNorm[i];
    const en = h.eliziNorm[i];
    if (
      hy == null ||
      sig == null ||
      hi == null ||
      mn == null ||
      en == null
    )
      continue;
    return {
      bias: bull ? "bull" : "bear",
      barsAgo: last - i,
      hybrid: hy,
      signal: sig,
      hist: hi,
      macdNorm: mn,
      eliziNorm: en,
    };
  }
  return null;
}
