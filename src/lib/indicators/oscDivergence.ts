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
  /** Hidden bullish (continuation long): price HL + osc LL at osc pivot lows */
  hiddenBull: (number | null)[];
  /** Hidden bearish (continuation short): price LH + osc HH at osc pivot highs */
  hiddenBear: (number | null)[];
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
 * Oscillator divergence — Pine-style pivots on `osc`.
 * Regular bull: price LL + osc HL. Regular bear: price HH + osc LH.
 * Hidden bull: price HL + osc LL. Hidden bear: price LH + osc HH.
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
  const hiddenBull: (number | null)[] = new Array(n).fill(null);
  const hiddenBear: (number | null)[] = new Array(n).fill(null);
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
          const oscLL = ov < prev.osc;
          const priceLL = price < prev.price;
          const priceHL = price > prev.price;
          if (oscHL && priceLL) {
            bull[i] = ov;
          }
          if (oscLL && priceHL) {
            hiddenBull[i] = ov;
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
          const oscHH = ov > prev.osc;
          const priceHH = price > prev.price;
          const priceLH = price < prev.price;
          if (oscLH && priceHH) {
            bear[i] = ov;
          }
          if (oscHH && priceLH) {
            hiddenBear[i] = ov;
          }
        }
      }
      highs.push({ confirm: i, pivot: pi, osc: ov, price });
    }
  }

  return { bull, bear, hiddenBull, hiddenBear, pivotLow, pivotHigh };
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

export type OscDivKind = "bull" | "bear" | "hiddenBull" | "hiddenBear";

/** True if a divergence marker fired within the last `maxBarsAgo` bars (0 = last bar). */
export function recentOscDivergence(
  candles: Candle[],
  osc: (number | null)[],
  direction: "bull" | "bear" | "hiddenBull" | "hiddenBear" | "any" | "regular" | "hidden",
  maxBarsAgo = 2,
  opts?: OscDivergenceOpts
): { ok: boolean; barsAgo: number; kind: OscDivKind | null } {
  const r = computeOscDivergence(candles, osc, opts);
  const end = Math.min(candles.length, osc.length) - 1;
  if (end < 0) return { ok: false, barsAgo: -1, kind: null };
  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = end - ago;
    if (i < 0) break;
    const isBull = r.bull[i] != null;
    const isBear = r.bear[i] != null;
    const isHidBull = r.hiddenBull[i] != null;
    const isHidBear = r.hiddenBear[i] != null;
    if (
      (direction === "bull" || direction === "any" || direction === "regular") &&
      isBull
    ) {
      return { ok: true, barsAgo: ago, kind: "bull" };
    }
    if (
      (direction === "bear" || direction === "any" || direction === "regular") &&
      isBear
    ) {
      return { ok: true, barsAgo: ago, kind: "bear" };
    }
    if (
      (direction === "hiddenBull" ||
        direction === "any" ||
        direction === "hidden") &&
      isHidBull
    ) {
      return { ok: true, barsAgo: ago, kind: "hiddenBull" };
    }
    if (
      (direction === "hiddenBear" ||
        direction === "any" ||
        direction === "hidden") &&
      isHidBear
    ) {
      return { ok: true, barsAgo: ago, kind: "hiddenBear" };
    }
  }
  return { ok: false, barsAgo: -1, kind: null };
}
