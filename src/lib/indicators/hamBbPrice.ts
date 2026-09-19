import type { Candle } from "@/lib/types";
import { bollinger } from "./math";
import { hamJurikTpo } from "./hamJurikTpo";

export type HamBbPriceOpts = {
  hamLen?: number;
  hamLenSlow?: number;
  rawLen?: number;
  rawLenSlow?: number;
  momSpan?: number;
  normLen?: number;
  jLen?: number;
  jPhase?: number;
  postSmooth?: number;
  bbPeriod?: number;
  bbMult?: number;
  /** Skip hamJurikTpo when caller already computed it (same HAM params). */
  precomputedHam?: ReturnType<typeof hamJurikTpo>;
};

/**
 * Price Bollinger (close 20/2) + HAM Jurik TPO events for main-pane overlay.
 * Do NOT wrap BB around HAM oscillator values — that is hamBb (sub pane).
 */
export function hamBbPrice(candles: Candle[], opts: HamBbPriceOpts = {}) {
  const bbPeriod = opts.bbPeriod ?? 20;
  const bbMult = opts.bbMult ?? 2;
  const closes = candles.map((c) => c.close);
  const bb = bollinger(closes, bbPeriod, bbMult);
  const h =
    opts.precomputedHam ??
    hamJurikTpo(candles, {
      hamLen: opts.hamLen,
      hamLenSlow: opts.hamLenSlow,
      rawLen: opts.rawLen,
      rawLenSlow: opts.rawLenSlow,
      momSpan: opts.momSpan,
      normLen: opts.normLen,
      jLen: opts.jLen,
      jPhase: opts.jPhase,
      postSmooth: opts.postSmooth,
    });
  return {
    ...h,
    closes,
    bbMid: bb.mid,
    bbUpper: bb.upper,
    bbLower: bb.lower,
    bbPeriod,
    bbMult,
  };
}
