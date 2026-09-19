import type { Candle } from "@/lib/types";

export type OscDivergenceOpts = {
  /** Pivot left bars (Pine lbL). List-scan default 5. */
  lbL?: number;
  /** Pivot right bars (Pine lbR) — signal confirms with this lag. */
  lbR?: number;
  /** Min bars between pivots (Pine rangeLower). List-scan default 50. */
  rangeLower?: number;
  /** Max bars between pivots (Pine rangeUpper). List-scan default 150. */
  rangeUpper?: number;
};

export type OscDivergenceResult = {
  /** Regular bullish divergence marker at pivot confirm bar */
  bull: (number | null)[];
  /** Regular bearish divergence marker at pivot confirm bar */
  bear: (number | null)[];
  /** 1 at confirmed oscillator pivot low bars */
  pivotLow: (number | null)[];
  /** 1 at confirmed oscillator pivot high bars */
  pivotHigh: (number | null)[];
};

/** List-scan defaults: en az 50 mum between pivots. */
export const LIST_SCAN_DIV_OPTS: Required<OscDivergenceOpts> = {
  lbL: 5,
  lbR: 2,
  rangeLower: 50,
  rangeUpper: 150,
};

export function isPivotLow(
  series: (number | null)[],
  i: number,
  left: number,
  right: number
): boolean {
  const v = series[i];
  if (v == null) return false;
  for (let j = i - left; j <= i + right; j++) {
    if (j === i) continue;
    if (j < 0 || j >= series.length) return false;
    const o = series[j];
    if (o == null || o <= v) return false;
  }
  return true;
}

export function isPivotHigh(
  series: (number | null)[],
  i: number,
  left: number,
  right: number
): boolean {
  const v = series[i];
  if (v == null) return false;
  for (let j = i - left; j <= i + right; j++) {
    if (j === i) continue;
    if (j < 0 || j >= series.length) return false;
    const o = series[j];
    if (o == null || o >= v) return false;
  }
  return true;
}

/**
 * Regular oscillator divergence — Pine-style pivots on `osc`.
 * Bull: price lower low + osc higher low at osc pivot lows.
 * Bear: price higher high + osc lower high at osc pivot highs.
 */
export function computeOscDivergence(
  candles: Candle[],
  osc: (number | null)[],
  opts: OscDivergenceOpts = {}
): OscDivergenceResult {
  const lbL = opts.lbL ?? LIST_SCAN_DIV_OPTS.lbL;
  const lbR = opts.lbR ?? LIST_SCAN_DIV_OPTS.lbR;
  const rangeLower = opts.rangeLower ?? LIST_SCAN_DIV_OPTS.rangeLower;
  const rangeUpper = opts.rangeUpper ?? LIST_SCAN_DIV_OPTS.rangeUpper;
  const n = Math.min(candles.length, osc.length);

  const bull: (number | null)[] = new Array(n).fill(null);
  const bear: (number | null)[] = new Array(n).fill(null);
  const pivotLow: (number | null)[] = new Array(n).fill(null);
  const pivotHigh: (number | null)[] = new Array(n).fill(null);

  type Pivot = { confirm: number; pivot: number; osc: number; price: number };
  const lows: Pivot[] = [];
  const highs: Pivot[] = [];

  for (let i = 0; i < n; i++) {
    const pi = i - lbR;
    if (pi < lbL) continue;

    if (isPivotLow(osc, pi, lbL, lbR)) {
      const ov = osc[pi] as number;
      const price = candles[pi]!.low;
      pivotLow[i] = 1;
      if (lows.length >= 1) {
        const prev = lows[lows.length - 1]!;
        const bars = pi - prev.pivot;
        if (bars >= rangeLower && bars <= rangeUpper) {
          const oscHL = ov > prev.osc;
          const priceLL = price < prev.price;
          if (oscHL && priceLL) {
            bull[i] = ov;
          }
        }
      }
      lows.push({ confirm: i, pivot: pi, osc: ov, price });
    }

    if (isPivotHigh(osc, pi, lbL, lbR)) {
      const ov = osc[pi] as number;
      const price = candles[pi]!.high;
      pivotHigh[i] = 1;
      if (highs.length >= 1) {
        const prev = highs[highs.length - 1]!;
        const bars = pi - prev.pivot;
        if (bars >= rangeLower && bars <= rangeUpper) {
          const oscLH = ov < prev.osc;
          const priceHH = price > prev.price;
          if (oscLH && priceHH) {
            bear[i] = ov;
          }
        }
      }
      highs.push({ confirm: i, pivot: pi, osc: ov, price });
    }
  }

  return { bull, bear, pivotLow, pivotHigh };
}

/** Count non-null samples in a series. */
export function countNonNull(series: (number | null)[]): number {
  let n = 0;
  for (const v of series) if (v != null) n++;
  return n;
}

/**
 * Prefer `display` when it has enough samples; otherwise fall back to `main`.
 * "Sparse" = display has fewer than half of main's non-null count, or &lt; 20 pts.
 */
export function pickOscSeries(
  display: (number | null)[],
  main: (number | null)[]
): (number | null)[] {
  const d = countNonNull(display);
  const m = countNonNull(main);
  if (d >= 20 && d >= m * 0.5) return display;
  return main;
}

/** True if a bull/bear marker fired within the last `maxBarsAgo` bars (0 = last bar). */
export function recentOscDivergence(
  candles: Candle[],
  osc: (number | null)[],
  direction: "bull" | "bear" | "any",
  maxBarsAgo = 2,
  opts?: OscDivergenceOpts
): { ok: boolean; barsAgo: number; kind: "bull" | "bear" | null } {
  const r = computeOscDivergence(candles, osc, opts);
  const end = Math.min(candles.length, osc.length) - 1;
  if (end < 0) return { ok: false, barsAgo: -1, kind: null };
  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = end - ago;
    if (i < 0) break;
    const isBull = r.bull[i] != null;
    const isBear = r.bear[i] != null;
    if ((direction === "bull" || direction === "any") && isBull) {
      return { ok: true, barsAgo: ago, kind: "bull" };
    }
    if ((direction === "bear" || direction === "any") && isBear) {
      return { ok: true, barsAgo: ago, kind: "bear" };
    }
  }
  return { ok: false, barsAgo: -1, kind: null };
}
