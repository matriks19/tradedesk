import type { Candle } from "@/lib/types";
import { closes, ema, hull, wma } from "@/lib/indicators/math";

export type HullMode = "Hma" | "Ehma" | "Thma";

export type DoktorHullOpts = {
  mode?: HullMode;
  /** Periods for ribbon — defaults match Pine Doktor Hull */
  p8?: number;
  p13?: number;
  p21?: number;
  p50?: number;
  p100?: number;
  p200?: number;
};

/** EHMA: EMA-based Hull */
export function ehma(values: number[], period: number): (number | null)[] {
  const half = Math.max(1, Math.floor(period / 2));
  const sqrtP = Math.max(1, Math.round(Math.sqrt(period)));
  const eHalf = ema(values, half);
  const eFull = ema(values, period);
  const raw = values.map((_, i) =>
    eHalf[i] != null && eFull[i] != null
      ? 2 * (eHalf[i] as number) - (eFull[i] as number)
      : 0
  );
  const h = ema(raw, sqrtP);
  return values.map((_, i) =>
    eHalf[i] == null || eFull[i] == null ? null : h[i]
  );
}

/** THMA: Triple / Tillson-style Hull via WMA */
export function thma(values: number[], period: number): (number | null)[] {
  const third = Math.max(1, Math.floor(period / 3));
  const half = Math.max(1, Math.floor(period / 2));
  const w3 = wma(values, third);
  const w2 = wma(values, half);
  const w1 = wma(values, period);
  const raw = values.map((_, i) => {
    if (w3[i] == null || w2[i] == null || w1[i] == null) return 0;
    return (w3[i] as number) * 3 - (w2[i] as number) - (w1[i] as number);
  });
  const h = wma(raw, period);
  return values.map((_, i) =>
    w3[i] == null || w2[i] == null || w1[i] == null ? null : h[i]
  );
}

export function hullByMode(
  values: number[],
  period: number,
  mode: HullMode = "Hma"
): (number | null)[] {
  if (mode === "Ehma") return ehma(values, period);
  if (mode === "Thma") return thma(values, period);
  return hull(values, period);
}

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

function crossedBelowAt(
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
  return a0 >= b0 && a1 < b1;
}

export type DoktorHullSeries = {
  h8: (number | null)[];
  h13: (number | null)[];
  h21: (number | null)[];
  h50: (number | null)[];
  h100: (number | null)[];
  h200: (number | null)[];
  /** Chart plotshape: h13 × h50 ↑ */
  chartBuy: (0 | 1)[];
  /** Chart plotshape: h21 × h50 ↓ */
  chartSell: (0 | 1)[];
  /** Scanner AL: h100 × h200 ↑ */
  scanBuy: (0 | 1)[];
  /** Scanner SAT: h21 × h100 ↓ */
  scanSell: (0 | 1)[];
  c50_100: (0 | 1)[];
  c50_200: (0 | 1)[];
  c100_200: (0 | 1)[];
  c21_50: (0 | 1)[];
  c21_100: (0 | 1)[];
};

/**
 * Minimum bars for stable Hull 200 (+ sqrt warmup + cross lookback).
 * Pine Doktor Hull uses HMA(200); 400–500 is safe on the scan TF (default 4h).
 */
export const DOKTOR_HULL_MIN_BARS = 400;
export const DOKTOR_HULL_FETCH_LIMIT = 500;

export function doktorHull(
  candles: Candle[],
  opts: DoktorHullOpts = {}
): DoktorHullSeries {
  const mode = opts.mode ?? "Hma";
  const src = closes(candles);
  const n = candles.length;
  const h8 = hullByMode(src, opts.p8 ?? 8, mode);
  const h13 = hullByMode(src, opts.p13 ?? 13, mode);
  const h21 = hullByMode(src, opts.p21 ?? 21, mode);
  const h50 = hullByMode(src, opts.p50 ?? 50, mode);
  const h100 = hullByMode(src, opts.p100 ?? 100, mode);
  const h200 = hullByMode(src, opts.p200 ?? 200, mode);

  const z = (): (0 | 1)[] => Array.from({ length: n }, () => 0);
  const chartBuy = z();
  const chartSell = z();
  const scanBuy = z();
  const scanSell = z();
  const c50_100 = z();
  const c50_200 = z();
  const c100_200 = z();
  const c21_50 = z();
  const c21_100 = z();

  for (let i = 1; i < n; i++) {
    if (crossedAboveAt(h13, h50, i)) chartBuy[i] = 1;
    if (crossedBelowAt(h21, h50, i)) chartSell[i] = 1;
    if (crossedAboveAt(h100, h200, i)) scanBuy[i] = 1;
    if (crossedBelowAt(h21, h100, i)) scanSell[i] = 1;
    if (crossedAboveAt(h50, h100, i)) c50_100[i] = 1;
    if (crossedAboveAt(h50, h200, i)) c50_200[i] = 1;
    if (crossedAboveAt(h100, h200, i)) c100_200[i] = 1;
    if (crossedAboveAt(h21, h50, i)) c21_50[i] = 1;
    if (crossedAboveAt(h21, h100, i)) c21_100[i] = 1;
  }

  return {
    h8,
    h13,
    h21,
    h50,
    h100,
    h200,
    chartBuy,
    chartSell,
    scanBuy,
    scanSell,
    c50_100,
    c50_200,
    c100_200,
    c21_50,
    c21_100,
  };
}
