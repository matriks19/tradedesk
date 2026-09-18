/**
 * HAM + AO + Jurik-like RMA Z-Score (Pine HAM_AO_JRMA_Z port).
 *
 * Cross semantics (list scan / alarms — edge only):
 * - AO debug up: aoSmooth crosses above 0 (prev ≤ 0, now > 0). Uses z-scored smoothed AO.
 * - RMA debug up: rmaSignal crosses above jurikCore (prev rma ≤ jurik, now rma > jurik).
 *   Note: TV Long is often crossover(jurikCore, rmaSignal) — the inverse of this.
 *   User asked "rma debug yukarı keser" → RMA crossing up through Jurik (this impl).
 * - PT: posTrend > negTrend on signal bar; NT: negTrend > posTrend.
 * - PT↑NT: posTrend crosses above negTrend; NT↑PT: negTrend crosses above posTrend.
 */
import type { Candle } from "@/lib/types";
import { ema, priceSeries, sma, smma, stdev } from "@/lib/indicators/math";

export type HamAoJrmaZOpts = {
  hamMomLen?: number;
  volBaseLen?: number;
  hamPower?: number;
  aoFast?: number;
  aoSlow?: number;
  hamWeight?: number;
  aoWeight?: number;
  trendLen?: number;
  trendBoost?: number;
  preSmoothLen?: number;
  jurikLen?: number;
  rmaLen?: number;
  postSmoothLen?: number;
  zLen?: number;
};

export const HAM_AO_JRMA_Z_DEFAULTS = {
  hamMomLen: 21,
  volBaseLen: 34,
  hamPower: 1.2,
  aoFast: 5,
  aoSlow: 34,
  hamWeight: 0.6,
  aoWeight: 0.4,
  trendLen: 34,
  trendBoost: 1.3,
  preSmoothLen: 3,
  jurikLen: 8,
  rmaLen: 13,
  postSmoothLen: 2,
  zLen: 89,
} as const;

/** Warmup: zLen + trend/jurik/rma + cushions */
export const HAM_AO_JRMA_Z_MIN_BARS = 160;

function safeDiv(num: number, den: number): number {
  return den === 0 || !Number.isFinite(den) ? 0 : num / den;
}

function softsign(x: number): number {
  return x / (1 + Math.abs(x));
}

function fillNulls(values: (number | null)[]): number[] {
  const out: number[] = new Array(values.length);
  let last = 0;
  let seen = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) {
      last = v;
      seen = true;
      out[i] = v;
    } else {
      out[i] = seen ? last : 0;
    }
  }
  return out;
}

function zscoreSeries(
  values: (number | null)[],
  period: number
): (number | null)[] {
  const filled = fillNulls(values);
  const mean = sma(filled, period);
  const sd = stdev(filled, period);
  return values.map((v, i) => {
    if (v == null || mean[i] == null || sd[i] == null) return null;
    const s = sd[i] as number;
    if (s === 0 || !Number.isFinite(s)) return 0;
    return (v - (mean[i] as number)) / s;
  });
}

/** Jurik-like: 2*EMA - EMA(EMA) */
function jurikLike(
  values: (number | null)[],
  len: number
): (number | null)[] {
  const filled = fillNulls(values);
  const e1 = ema(filled, len);
  const e1f = fillNulls(e1);
  const e2 = ema(e1f, len);
  return values.map((_, i) =>
    e1[i] != null && e2[i] != null
      ? 2 * (e1[i] as number) - (e2[i] as number)
      : null
  );
}

function emaNullable(
  values: (number | null)[],
  len: number
): (number | null)[] {
  const filled = fillNulls(values);
  const e = ema(filled, len);
  // Preserve null until source has produced a value at least once
  let ready = false;
  return values.map((v, i) => {
    if (v != null) ready = true;
    if (!ready || e[i] == null) return null;
    return e[i];
  });
}

function rmaNullable(
  values: (number | null)[],
  len: number
): (number | null)[] {
  const filled = fillNulls(values);
  const r = smma(filled, len);
  let ready = false;
  return values.map((v, i) => {
    if (v != null) ready = true;
    if (!ready || r[i] == null) return null;
    return r[i];
  });
}

export function crossedAboveAt(
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

export function lineZeroCrossUp(line: (number | null)[], i: number): boolean {
  if (i < 1) return false;
  const v0 = line[i - 1];
  const v1 = line[i];
  if (v0 == null || v1 == null) return false;
  return v0 <= 0 && v1 > 0;
}

export type HamAoJrmaZSeries = {
  hamSmooth: (number | null)[];
  aoSmooth: (number | null)[];
  blend: (number | null)[];
  posTrend: (number | null)[];
  negTrend: (number | null)[];
  jurikCore: (number | null)[];
  rmaSignal: (number | null)[];
  aoUp: boolean[];
  rmaUp: boolean[];
  ptXNt: boolean[];
  ntXPt: boolean[];
  pt: boolean[];
  nt: boolean[];
};

export function hamAoJrmaZ(
  candles: Candle[],
  opts: HamAoJrmaZOpts = {}
): HamAoJrmaZSeries {
  const d = HAM_AO_JRMA_Z_DEFAULTS;
  const hamMomLen = opts.hamMomLen ?? d.hamMomLen;
  const volBaseLen = opts.volBaseLen ?? d.volBaseLen;
  const hamPower = opts.hamPower ?? d.hamPower;
  const aoFast = opts.aoFast ?? d.aoFast;
  const aoSlow = opts.aoSlow ?? d.aoSlow;
  const hamWeight = opts.hamWeight ?? d.hamWeight;
  const aoWeight = opts.aoWeight ?? d.aoWeight;
  const trendLen = opts.trendLen ?? d.trendLen;
  const trendBoost = opts.trendBoost ?? d.trendBoost;
  const preSmoothLen = opts.preSmoothLen ?? d.preSmoothLen;
  const jurikLen = opts.jurikLen ?? d.jurikLen;
  const rmaLen = opts.rmaLen ?? d.rmaLen;
  const postSmoothLen = opts.postSmoothLen ?? d.postSmoothLen;
  const zLen = opts.zLen ?? d.zLen;

  const n = candles.length;
  const src = priceSeries(candles, "hlc3");
  const hl2 = priceSeries(candles, "hl2");
  const vol = candles.map((c) => c.volume);
  const volRma = smma(vol, volBaseLen);

  const hamRaw: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i < hamMomLen) continue;
    const ref = src[i - hamMomLen]!;
    if (ref === 0) continue;
    const mom = (100 * (src[i]! - ref)) / ref;
    const vr = volRma[i];
    const volRatio =
      vr == null || vr === 0 ? 1 : Math.pow(safeDiv(vol[i]!, vr), hamPower);
    hamRaw[i] = mom * volRatio;
  }
  const hamZ = zscoreSeries(hamRaw, zLen);
  const hamSmooth = emaNullable(hamZ, preSmoothLen);

  const aoSmaFast = sma(hl2, aoFast);
  const aoSmaSlow = sma(hl2, aoSlow);
  const aoRaw: (number | null)[] = hl2.map((_, i) =>
    aoSmaFast[i] != null && aoSmaSlow[i] != null
      ? (aoSmaFast[i] as number) - (aoSmaSlow[i] as number)
      : null
  );
  const aoZ = zscoreSeries(aoRaw, aoSlow);
  const aoSmooth = emaNullable(aoZ, preSmoothLen);

  const blend: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (hamSmooth[i] == null || aoSmooth[i] == null) continue;
    blend[i] = softsign(
      hamWeight * (hamSmooth[i] as number) +
        aoWeight * (aoSmooth[i] as number)
    );
  }

  const posSeed = blend.map((v) => (v == null ? null : Math.max(v, 0)));
  const negSeed = blend.map((v) => (v == null ? null : Math.max(-v, 0)));
  const pos0 = rmaNullable(posSeed, trendLen).map((v) =>
    v == null ? null : v * trendBoost
  );
  const neg0 = rmaNullable(negSeed, trendLen).map((v) =>
    v == null ? null : v * trendBoost
  );

  const posWithSlope: (number | null)[] = new Array(n).fill(null);
  const negWithSlope: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (pos0[i] == null) continue;
    const dPos =
      i > 0 && pos0[i - 1] != null
        ? (pos0[i] as number) - (pos0[i - 1] as number)
        : 0;
    posWithSlope[i] = (pos0[i] as number) + Math.max(dPos, 0);
    if (neg0[i] == null) continue;
    const dNeg =
      i > 0 && neg0[i - 1] != null
        ? (neg0[i] as number) - (neg0[i - 1] as number)
        : 0;
    negWithSlope[i] = (neg0[i] as number) + Math.max(dNeg, 0);
  }
  const posTrend = emaNullable(posWithSlope, 2);
  const negTrend = emaNullable(negWithSlope, 2);

  const trendBias: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (posTrend[i] == null || negTrend[i] == null) continue;
    trendBias[i] = (posTrend[i] as number) - (negTrend[i] as number);
  }

  const core: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (blend[i] == null || trendBias[i] == null) continue;
    core[i] = (blend[i] as number) + (trendBias[i] as number);
  }
  const corePre = emaNullable(core, preSmoothLen);
  const jurikMid = jurikLike(corePre, jurikLen);
  const jurikCore = emaNullable(jurikMid, postSmoothLen);
  const rmaMid = rmaNullable(jurikCore, rmaLen);
  const rmaSignal = emaNullable(rmaMid, postSmoothLen);

  const aoUp = new Array(n).fill(false);
  const rmaUp = new Array(n).fill(false);
  const ptXNt = new Array(n).fill(false);
  const ntXPt = new Array(n).fill(false);
  const pt = new Array(n).fill(false);
  const nt = new Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    if (posTrend[i] != null && negTrend[i] != null) {
      pt[i] = (posTrend[i] as number) > (negTrend[i] as number);
      nt[i] = (negTrend[i] as number) > (posTrend[i] as number);
    }
    if (i < 1) continue;
    aoUp[i] = lineZeroCrossUp(aoSmooth, i);
    rmaUp[i] = crossedAboveAt(rmaSignal, jurikCore, i);
    ptXNt[i] = crossedAboveAt(posTrend, negTrend, i);
    ntXPt[i] = crossedAboveAt(negTrend, posTrend, i);
  }

  return {
    hamSmooth,
    aoSmooth,
    blend,
    posTrend,
    negTrend,
    jurikCore,
    rmaSignal,
    aoUp,
    rmaUp,
    ptXNt,
    ntXPt,
    pt,
    nt,
  };
}
