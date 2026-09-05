import type { Candle } from "@/lib/types";
import { adx, sma } from "@/lib/indicators/math";
import type { Regime } from "./types";

/** Classify each bar as Bull / Bear / Range using ADX + SMA200 slope + HH-HL structure */
export function classifyRegimes(candles: Candle[]): Regime[] {
  const n = candles.length;
  const closes = candles.map((c) => c.close);
  const ma200 = sma(closes, Math.min(200, Math.max(50, Math.floor(n / 4))));
  const maPeriod = Math.min(200, Math.max(50, Math.floor(n / 4)));
  const dmi = adx(candles, 14);
  const out: Regime[] = new Array(n).fill("Range");

  for (let i = 0; i < n; i++) {
    const adxV = dmi.adx[i];
    const ma = ma200[i];
    const maPrev = i >= 10 ? ma200[i - 10] : null;
    if (adxV == null || ma == null) {
      out[i] = "Range";
      continue;
    }
    const slope =
      maPrev != null && maPrev !== 0 ? (ma - maPrev) / Math.abs(maPrev) : 0;
    const above = closes[i] > ma;
    const strong = adxV >= 22;

    // Structure hint: recent swing HH/HL vs LH/LL
    let struct = 0;
    if (i >= 20) {
      const slice = candles.slice(i - 19, i + 1);
      const hi1 = Math.max(...slice.slice(0, 10).map((c) => c.high));
      const hi2 = Math.max(...slice.slice(10).map((c) => c.high));
      const lo1 = Math.min(...slice.slice(0, 10).map((c) => c.low));
      const lo2 = Math.min(...slice.slice(10).map((c) => c.low));
      if (hi2 > hi1 && lo2 > lo1) struct = 1;
      else if (hi2 < hi1 && lo2 < lo1) struct = -1;
    }

    if (strong && (above || slope > 0.002 || struct === 1) && slope >= -0.001) {
      out[i] = "Bull";
    } else if (
      strong &&
      (!above || slope < -0.002 || struct === -1) &&
      slope <= 0.001
    ) {
      out[i] = "Bear";
    } else if (adxV < 18) {
      out[i] = "Range";
    } else if (above && slope > 0) {
      out[i] = "Bull";
    } else if (!above && slope < 0) {
      out[i] = "Bear";
    } else {
      out[i] = "Range";
    }
  }
  void maPeriod;
  return out;
}
