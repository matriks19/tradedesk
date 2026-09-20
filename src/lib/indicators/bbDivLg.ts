/**
 * BB Alt + RSI Divergence + Liquidity Grab (Pine port, list-scan).
 *
 * Pine: bb_div_lg_optimize.pine
 * - atLowerBB: low <= lowerBB
 * - RSI oversold
 * - bullish RSI div OR unconfirmed same-bar Liquidity Grab
 * - optional trend: close > EMA50 && ADX >= min (defaults ON)
 * - light confirm for BUY: close>open OR close>high[1]
 *
 * Scan TF candles only — no HTF security.
 * Uses computeOscDivergence + bollinger/rsi/ema/adx/sma helpers.
 */
import type { Candle } from "@/lib/types";
import { adx, bollinger, closes, ema, rsi, sma } from "@/lib/indicators/math";
import {
  computeOscDivergence,
  LIST_SCAN_DIV_OPTS,
} from "@/lib/indicators/oscDivergence";

export type BbDivLgOpts = {
  bbLen?: number;
  bbMult?: number;
  rsiLen?: number;
  rsiOS?: number;
  /** Pivot left (Pine divPivotLen). Default 5. */
  divLbL?: number;
  /** Pivot right confirm lag. Default 5 (match Pine symmetric). */
  divLbR?: number;
  /** Min bars between pivots (Pine divBars). Default 5. */
  divRangeLower?: number;
  divRangeUpper?: number;
  lgWickMult?: number;
  lgVolMult?: number;
  swingLookback?: number;
  volMaLen?: number;
  useTrend?: boolean;
  emaLen?: number;
  useADX?: boolean;
  adxLen?: number;
  adxMin?: number;
};

export type BbDivLgResult = {
  lowerBB: (number | null)[];
  midBB: (number | null)[];
  upperBB: (number | null)[];
  rsi: (number | null)[];
  ema: (number | null)[];
  adx: (number | null)[];
  /** Raw same-bar LG (below swing + long wick + vol spike) */
  lg: (number | null)[];
  /** BB+RSI OS + bullish RSI div (+ trend if on) */
  divBb: (number | null)[];
  /** Pine `signal`: BB+OS+trend+(div|LG) */
  signal: (number | null)[];
  /** Pine `longCondition`: signal + bar confirm */
  buy: (number | null)[];
  /** At BB + RSI OS (+ trend) without requiring LG/div */
  bbOs: (number | null)[];
};

export const BB_DIV_LG_MIN_BARS = 80;
export const BB_DIV_LG_FETCH_LIMIT = 180;

/**
 * Pure series — BB lower + RSI OS + bullish div OR unconfirmed LG.
 */
export function bbDivLg(
  candles: Candle[],
  opts: BbDivLgOpts = {}
): BbDivLgResult {
  const bbLen = opts.bbLen ?? 20;
  const bbMult = opts.bbMult ?? 2;
  const rsiLen = opts.rsiLen ?? 14;
  const rsiOS = opts.rsiOS ?? 30;
  const divLbL = opts.divLbL ?? 5;
  const divLbR = opts.divLbR ?? 5;
  const divRangeLower = opts.divRangeLower ?? 5;
  const divRangeUpper = opts.divRangeUpper ?? LIST_SCAN_DIV_OPTS.rangeUpper;
  const lgWickMult = opts.lgWickMult ?? 2;
  const lgVolMult = opts.lgVolMult ?? 1.3;
  const swingLookback = opts.swingLookback ?? 10;
  const volMaLen = opts.volMaLen ?? 20;
  const useTrend = opts.useTrend !== false;
  const emaLen = opts.emaLen ?? 50;
  const useADX = opts.useADX !== false;
  const adxLen = opts.adxLen ?? 14;
  const adxMin = opts.adxMin ?? 20;

  const n = candles.length;
  const empty = (): (number | null)[] => new Array(n).fill(null);
  const lowerBB = empty();
  const midBB = empty();
  const upperBB = empty();
  const rsiOut = empty();
  const emaOut = empty();
  const adxOut = empty();
  const lg = empty();
  const divBb = empty();
  const signal = empty();
  const buy = empty();
  const bbOs = empty();

  if (n < BB_DIV_LG_MIN_BARS) {
    return {
      lowerBB,
      midBB,
      upperBB,
      rsi: rsiOut,
      ema: emaOut,
      adx: adxOut,
      lg,
      divBb,
      signal,
      buy,
      bbOs,
    };
  }

  const c = closes(candles);
  const bb = bollinger(c, bbLen, bbMult);
  const rsiVals = rsi(c, rsiLen);
  const emaVals = ema(c, emaLen);
  const adxPack = adx(candles, adxLen);
  const vols = candles.map((x) => x.volume);
  const volMA = sma(vols, volMaLen);

  const div = computeOscDivergence(candles, rsiVals, {
    lbL: divLbL,
    lbR: divLbR,
    rangeLower: divRangeLower,
    rangeUpper: divRangeUpper,
  });

  for (let i = 0; i < n; i++) {
    midBB[i] = bb.mid[i];
    lowerBB[i] = bb.lower[i];
    upperBB[i] = bb.upper[i];
    rsiOut[i] = rsiVals[i];
    emaOut[i] = emaVals[i];
    adxOut[i] = adxPack.adx[i];

    const bar = candles[i]!;
    const loBand = bb.lower[i];
    const rsiV = rsiVals[i];
    const emaV = emaVals[i];
    const adxV = adxPack.adx[i];
    if (loBand == null || rsiV == null) continue;

    const atLowerBB = bar.low <= loBand;
    const rsiOversold = rsiV <= rsiOS;

    const trendUp = emaV != null && bar.close > emaV;
    const adxOk = !useADX || (adxV != null && adxV >= adxMin);
    const trendFilterOk = !useTrend || (trendUp && adxOk);

    // Liquidity Grab — unconfirmed / same-bar (no pivot lag)
    let isLg = false;
    if (i >= swingLookback) {
      let swingLow = Infinity;
      for (let j = i - swingLookback; j < i; j++) {
        const lv = candles[j]!.low;
        if (lv < swingLow) swingLow = lv;
      }
      const body = Math.abs(bar.close - bar.open);
      const lowerWick = Math.min(bar.open, bar.close) - bar.low;
      const totalRange = bar.high - bar.low;
      const belowSwing = bar.low < swingLow;
      const hasLongWick =
        lowerWick > body * lgWickMult &&
        totalRange > 0 &&
        lowerWick > totalRange * 0.4;
      const vma = volMA[i];
      const volSpike = vma != null && vols[i]! > vma * lgVolMult;
      isLg = belowSwing && hasLongWick && volSpike;
    }
    if (isLg) lg[i] = 1;

    const isDiv = div.bull[i] != null;
    const zone = atLowerBB && rsiOversold && trendFilterOk;
    if (zone) bbOs[i] = 1;
    if (zone && isDiv) divBb[i] = 1;

    const sig = zone && (isDiv || isLg);
    if (sig) signal[i] = 1;

    const confirmation =
      bar.close > bar.open ||
      (i >= 1 && bar.close > candles[i - 1]!.high);
    if (sig && confirmation) buy[i] = 1;
  }

  return {
    lowerBB,
    midBB,
    upperBB,
    rsi: rsiOut,
    ema: emaOut,
    adx: adxOut,
    lg,
    divBb,
    signal,
    buy,
    bbOs,
  };
}
