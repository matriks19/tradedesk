/**
 * MAVK ribbon + R-Squared helpers for indicator registry / chart panes.
 */
import type { Candle } from "@/lib/types";
import {
  computeMavkRibbon,
  computeRSquaredSeries,
} from "@/lib/patterns/mavkCluster";

const DEFAULT_PERIODS = [8, 13, 21, 34, 55, 89];

export function computeMavkIndicator(
  candles: Candle[],
  opts: {
    clusterPct?: number;
    useSma?: boolean;
    p1?: number;
    p2?: number;
    p3?: number;
    p4?: number;
    p5?: number;
    p6?: number;
  } = {}
) {
  const periods = [
    opts.p1 ?? 8,
    opts.p2 ?? 13,
    opts.p3 ?? 21,
    opts.p4 ?? 34,
    opts.p5 ?? 55,
    opts.p6 ?? 89,
  ];
  const thresh = opts.clusterPct ?? 0.015;
  const ribbon = computeMavkRibbon(candles, periods, !!opts.useSma);
  const clustered = ribbon.clusterPct.map((v) =>
    v != null && v <= thresh ? 1 : v != null ? 0 : null
  );
  return {
    ma1: ribbon.lines[0] ?? [],
    ma2: ribbon.lines[1] ?? [],
    ma3: ribbon.lines[2] ?? [],
    ma4: ribbon.lines[3] ?? [],
    ma5: ribbon.lines[4] ?? [],
    ma6: ribbon.lines[5] ?? [],
    upper: ribbon.upper,
    lower: ribbon.lower,
    mid: ribbon.mid,
    clusterPct: ribbon.clusterPct,
    clustered,
  };
}

export function computeRSquaredIndicator(
  candles: Candle[],
  period = 30
): {
  r2: (number | null)[];
  low: (number | null)[];
  mid: (number | null)[];
  rising: (number | null)[];
} {
  const r2 = computeRSquaredSeries(candles, period);
  const low = r2.map((v) => (v == null ? null : 0.25));
  const mid = r2.map((v) => (v == null ? null : 0.5));
  const rising: (number | null)[] = r2.map((v, i) => {
    if (v == null || i < 3) return null;
    const a = r2[i - 3];
    const b = r2[i - 1];
    if (a == null || b == null) return null;
    return a <= 0.3 && v > b && v > a + 0.04 ? 1 : 0;
  });
  return { r2, low, mid, rising };
}

export { DEFAULT_PERIODS };
