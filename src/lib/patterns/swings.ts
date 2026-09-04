import type { Candle } from "@/lib/types";
import type { SwingPoint } from "./types";

export function findSwings(candles: Candle[], strength = 2): SwingPoint[] {
  const s = Math.max(1, Math.min(5, strength | 0));
  const out: SwingPoint[] = [];
  for (let i = s; i < candles.length - s; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= s; j++) {
      if (
        candles[i].high <= candles[i - j].high ||
        candles[i].high <= candles[i + j].high
      )
        isHigh = false;
      if (
        candles[i].low >= candles[i - j].low ||
        candles[i].low >= candles[i + j].low
      )
        isLow = false;
    }
    if (isHigh)
      out.push({
        index: i,
        time: candles[i].time,
        price: candles[i].high,
        kind: "high",
      });
    if (isLow)
      out.push({
        index: i,
        time: candles[i].time,
        price: candles[i].low,
        kind: "low",
      });
  }
  return out;
}

export function lastN<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n));
}
