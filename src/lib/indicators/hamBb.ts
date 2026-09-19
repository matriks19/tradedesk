import type { Candle } from "@/lib/types";
import { hamJurikTpo } from "./hamJurikTpo";

/** Bollinger on a nullable series — window must be fully non-null. */
export function bollingerNullable(
  values: (number | null)[],
  period = 20,
  mult = 2
): {
  mid: (number | null)[];
  upper: (number | null)[];
  lower: (number | null)[];
} {
  const n = values.length;
  const mid: (number | null)[] = new Array(n).fill(null);
  const upper: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i + 1 < period) continue;
    let sum = 0;
    let ok = true;
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j];
      if (v == null) {
        ok = false;
        break;
      }
      sum += v;
    }
    if (!ok) continue;
    const m = sum / period;
    let sq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = (values[j] as number) - m;
      sq += d * d;
    }
    const std = Math.sqrt(sq / period);
    mid[i] = m;
    upper[i] = m + mult * std;
    lower[i] = m - mult * std;
  }
  return { mid, upper, lower };
}

export type HamBbOpts = {
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
 * HAM oscillator with Bollinger bands wrapped around the HAM series
 * (bands move with HAM — not price BB + separate HAM flags).
 * Primary BB source: oscDisplay (Raw hızlı); fallback osc.
 */
export function hamBb(candles: Candle[], opts: HamBbOpts = {}) {
  const bbPeriod = opts.bbPeriod ?? 20;
  const bbMult = opts.bbMult ?? 2;
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
  const n = candles.length;
  const hamSrc: (number | null)[] = new Array(n);
  for (let i = 0; i < n; i++) {
    hamSrc[i] = h.oscDisplay[i] ?? h.osc[i] ?? null;
  }
  const bb = bollingerNullable(hamSrc, bbPeriod, bbMult);
  return {
    ...h,
    hamSrc,
    bbMid: bb.mid,
    bbUpper: bb.upper,
    bbLower: bb.lower,
    bbPeriod,
    bbMult,
  };
}
