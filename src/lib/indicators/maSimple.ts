/**
 * Simple MA (SMA) 20-50-100-200 — light list-scan helper.
 * Uses existing sma() from math.ts. Chart: four SMAs on main.
 *
 * Chips (lean):
 * - stack_bull / stack_bear — full MA stack
 * - x_20_50 / x_50_100 / x_100_200 — SMA×SMA cross up
 * - price_x_20 / price_x_50 — close×SMA cross up
 */
import type { Candle } from "@/lib/types";
import { closes, sma } from "@/lib/indicators/math";

export type MaSimpleOpts = {
  p20?: number;
  p50?: number;
  p100?: number;
  p200?: number;
};

export type MaSimpleResult = {
  sma20: (number | null)[];
  sma50: (number | null)[];
  sma100: (number | null)[];
  sma200: (number | null)[];
  stack_bull: (number | null)[];
  stack_bear: (number | null)[];
  x_20_50: (number | null)[];
  x_50_100: (number | null)[];
  x_100_200: (number | null)[];
  price_x_20: (number | null)[];
  price_x_50: (number | null)[];
};

export const MA_SIMPLE_MIN_BARS = 210;
export const MA_SIMPLE_FETCH_LIMIT = 280;

function crossedAboveAt(
  a: (number | null)[],
  b: (number | null)[],
  i: number
): boolean {
  if (i < 1) return false;
  const a0 = a[i - 1];
  const a1 = a[i];
  const b0 = b[i - 1];
  const b1 = b[i];
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false;
  return a0 <= b0 && a1 > b1;
}

/** Pure series for Liste MA Basit scan + chart ribbon. */
export function maSimple(
  candles: Candle[],
  opts: MaSimpleOpts = {}
): MaSimpleResult {
  const p20 = opts.p20 ?? 20;
  const p50 = opts.p50 ?? 50;
  const p100 = opts.p100 ?? 100;
  const p200 = opts.p200 ?? 200;
  const n = candles.length;
  const empty = (): (number | null)[] => new Array(n).fill(null);

  const c = closes(candles);
  const closeSeries: (number | null)[] = c.map((v) => v);
  const sma20 = sma(c, p20);
  const sma50 = sma(c, p50);
  const sma100 = sma(c, p100);
  const sma200 = sma(c, p200);

  const stack_bull = empty();
  const stack_bear = empty();
  const x_20_50 = empty();
  const x_50_100 = empty();
  const x_100_200 = empty();
  const price_x_20 = empty();
  const price_x_50 = empty();

  for (let i = 0; i < n; i++) {
    const v20 = sma20[i];
    const v50 = sma50[i];
    const v100 = sma100[i];
    const v200 = sma200[i];
    const px = c[i]!;
    if (
      v20 != null &&
      v50 != null &&
      v100 != null &&
      v200 != null &&
      px > v20 &&
      v20 > v50 &&
      v50 > v100 &&
      v100 > v200
    ) {
      stack_bull[i] = 1;
    }
    if (
      v20 != null &&
      v50 != null &&
      v100 != null &&
      v200 != null &&
      px < v20 &&
      v20 < v50 &&
      v50 < v100 &&
      v100 < v200
    ) {
      stack_bear[i] = 1;
    }
    if (crossedAboveAt(sma20, sma50, i)) x_20_50[i] = 1;
    if (crossedAboveAt(sma50, sma100, i)) x_50_100[i] = 1;
    if (crossedAboveAt(sma100, sma200, i)) x_100_200[i] = 1;
    if (crossedAboveAt(closeSeries, sma20, i)) price_x_20[i] = 1;
    if (crossedAboveAt(closeSeries, sma50, i)) price_x_50[i] = 1;
  }

  return {
    sma20,
    sma50,
    sma100,
    sma200,
    stack_bull,
    stack_bear,
    x_20_50,
    x_50_100,
    x_100_200,
    price_x_20,
    price_x_50,
  };
}
