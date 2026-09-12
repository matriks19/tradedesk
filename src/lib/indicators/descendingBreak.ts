import type { Candle } from "@/lib/types";
import {
  aroon,
  cci,
  ema,
  ichimoku,
  rsi,
  sma,
  vwma,
} from "@/lib/indicators/math";

export type DescendingBreakOpts = {
  /** Pivot lookback on each side (Pine pivothigh length; default 20) */
  lookback?: number;
  /** Also emit flat S/R boxes from recent pivot highs/lows */
  srBoxes?: boolean;
};

export type DescendingBreakResult = {
  /** Projected descending resistance trendline value (null when inactive) */
  trend: (number | null)[];
  /** 1 on breakout bar (close crosses above prior bar trend) */
  breakOut: (number | null)[];
  /** Optional pivot-high resistance levels (flat) */
  resBox: (number | null)[];
  /** Optional pivot-low support levels (flat) */
  supBox: (number | null)[];
  /** Pivot high marks (price) */
  pivotHigh: (number | null)[];
  /** Pivot low marks (price) */
  pivotLow: (number | null)[];
};

function isPivotHigh(
  candles: Candle[],
  i: number,
  L: number,
  R: number
): boolean {
  const h = candles[i]!.high;
  for (let j = i - L; j <= i + R; j++) {
    if (j === i) continue;
    if (j < 0 || j >= candles.length) return false;
    if (candles[j]!.high >= h) return false;
  }
  return true;
}

function isPivotLow(
  candles: Candle[],
  i: number,
  L: number,
  R: number
): boolean {
  const l = candles[i]!.low;
  for (let j = i - L; j <= i + R; j++) {
    if (j === i) continue;
    if (j < 0 || j >= candles.length) return false;
    if (candles[j]!.low <= l) return false;
  }
  return true;
}

function lineAt(
  i0: number,
  p0: number,
  i1: number,
  p1: number,
  i: number
): number {
  if (i1 === i0) return p1;
  const slope = (p1 - p0) / (i1 - i0);
  return p0 + slope * (i - i0);
}

/**
 * "Düşen Kırılımı" — descending pivot-high trendline breakout (Pine port).
 * When the last two pivot highs are descending, project the line; breakout when
 * close crosses above the previous bar's trend value.
 */
export function computeDescendingBreak(
  candles: Candle[],
  opts: DescendingBreakOpts = {}
): DescendingBreakResult {
  const L = opts.lookback ?? 20;
  const R = L;
  const srBoxes = opts.srBoxes !== false;
  const n = candles.length;

  const trend: (number | null)[] = new Array(n).fill(null);
  const breakOut: (number | null)[] = new Array(n).fill(null);
  const resBox: (number | null)[] = new Array(n).fill(null);
  const supBox: (number | null)[] = new Array(n).fill(null);
  const pivotHigh: (number | null)[] = new Array(n).fill(null);
  const pivotLow: (number | null)[] = new Array(n).fill(null);

  type Pt = { i: number; price: number };
  const highs: Pt[] = [];
  const lows: Pt[] = [];
  let active: { i0: number; p0: number; i1: number; p1: number } | null = null;
  let lastRes: number | null = null;
  let lastSup: number | null = null;

  for (let i = 0; i < n; i++) {
    const pi = i - R;
    if (pi >= L) {
      if (isPivotHigh(candles, pi, L, R)) {
        highs.push({ i: pi, price: candles[pi]!.high });
        pivotHigh[i] = candles[pi]!.high;
        lastRes = candles[pi]!.high;
        if (highs.length >= 2) {
          const a = highs[highs.length - 2]!;
          const b = highs[highs.length - 1]!;
          // Descending: second high lower than first
          if (b.price < a.price) {
            active = { i0: a.i, p0: a.price, i1: b.i, p1: b.price };
          } else {
            // Non-descending pair clears active trend
            active = null;
          }
        }
      }
      if (isPivotLow(candles, pi, L, R)) {
        lows.push({ i: pi, price: candles[pi]!.low });
        pivotLow[i] = candles[pi]!.low;
        lastSup = candles[pi]!.low;
      }
    }

    if (srBoxes) {
      resBox[i] = lastRes;
      supBox[i] = lastSup;
    }

    if (active) {
      const tv = lineAt(active.i0, active.p0, active.i1, active.p1, i);
      trend[i] = tv;
      if (i > 0 && trend[i - 1] != null) {
        const prevT = trend[i - 1] as number;
        const prevC = candles[i - 1]!.close;
        const currC = candles[i]!.close;
        // Close crosses above previous bar's trend value
        if (prevC <= prevT && currC > prevT) {
          breakOut[i] = 1;
        }
      }
    }
  }

  return { trend, breakOut, resBox, supBox, pivotHigh, pivotLow };
}

/** Recent descending-trendline breakout within maxBarsAgo (default 2). */
export function recentDescendingBreak(
  candles: Candle[],
  maxBarsAgo = 2,
  opts?: DescendingBreakOpts
): { ok: boolean; barsAgo: number } {
  const r = computeDescendingBreak(candles, opts);
  const end = candles.length - 1;
  if (end < 0) return { ok: false, barsAgo: -1 };
  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = end - ago;
    if (i < 0) break;
    if (r.breakOut[i] === 1) return { ok: true, barsAgo: ago };
  }
  return { ok: false, barsAgo: -1 };
}

/**
 * "Düşen Kırılımı 2. Versiyon" — multi-condition AL signal (Pine port).
 * EMA5>20>50, close>VWMA&EMA5, RSI 50–75, CCI>90, SpanA>SpanB,
 * AroonUp>50 & >Down, vol>1.3×SMA10, with cooldown bars.
 */
export type DescendingBreakV2Opts = {
  cooldownBars?: number;
  useEma?: boolean;
  useVwma?: boolean;
  useRsi?: boolean;
  useCci?: boolean;
  useIchimoku?: boolean;
  useAroon?: boolean;
  useVolume?: boolean;
};

export type DescendingBreakV2Result = {
  signal: (number | null)[];
  ema5: (number | null)[];
  ema20: (number | null)[];
  ema50: (number | null)[];
};

export function computeDescendingBreakV2(
  candles: Candle[],
  opts: DescendingBreakV2Opts = {}
): DescendingBreakV2Result {
  const {
    cooldownBars = 10,
    useEma = true,
    useVwma = true,
    useRsi = true,
    useCci = true,
    useIchimoku = true,
    useAroon = true,
    useVolume = true,
  } = opts;
  const n = candles.length;
  const c = candles.map((x) => x.close);
  const e5 = ema(c, 5);
  const e20 = ema(c, 20);
  const e50 = ema(c, 50);
  const r = rsi(c, 14);
  const cc = cci(candles, 20);
  const vw = vwma(candles, 20);
  const ich = ichimoku(candles);
  const ar = aroon(candles, 14);
  const vols = candles.map((x) => x.volume);
  const volSma = sma(vols, 10);
  const signal: (number | null)[] = new Array(n).fill(null);
  let lastSig = -cooldownBars;
  for (let i = 0; i < n; i++) {
    const emaOk =
      !useEma ||
      (e5[i] != null &&
        e20[i] != null &&
        e50[i] != null &&
        (e5[i] as number) > (e20[i] as number) &&
        (e20[i] as number) > (e50[i] as number));
    const vwmaOk =
      !useVwma ||
      (vw[i] != null &&
        e5[i] != null &&
        c[i]! > (vw[i] as number) &&
        c[i]! > (e5[i] as number));
    const rsiOk =
      !useRsi || (r[i] != null && (r[i] as number) > 50 && (r[i] as number) < 75);
    const cciOk = !useCci || (cc[i] != null && (cc[i] as number) > 90);
    const ichOk =
      !useIchimoku ||
      (ich.spanA[i] != null &&
        ich.spanB[i] != null &&
        (ich.spanA[i] as number) > (ich.spanB[i] as number));
    const aroonOk =
      !useAroon ||
      (ar.up[i] != null &&
        ar.down[i] != null &&
        (ar.up[i] as number) > 50 &&
        (ar.up[i] as number) > (ar.down[i] as number));
    const volOk =
      !useVolume ||
      (volSma[i] != null && vols[i]! > (volSma[i] as number) * 1.3);
    const buy =
      emaOk && vwmaOk && rsiOk && cciOk && ichOk && aroonOk && volOk;
    if (buy && i - lastSig > cooldownBars) {
      signal[i] = 1;
      lastSig = i;
    }
  }
  return { signal, ema5: e5, ema20: e20, ema50: e50 };
}

export function recentDescendingBreakV2(
  candles: Candle[],
  maxBarsAgo = 2,
  opts?: DescendingBreakV2Opts
): { ok: boolean; barsAgo: number } {
  const r = computeDescendingBreakV2(candles, opts);
  const end = candles.length - 1;
  if (end < 0) return { ok: false, barsAgo: -1 };
  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = end - ago;
    if (i < 0) break;
    if (r.signal[i] === 1) return { ok: true, barsAgo: ago };
  }
  return { ok: false, barsAgo: -1 };
}
