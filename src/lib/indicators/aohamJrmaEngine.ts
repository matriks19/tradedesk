/**
 * AOHAM_JRMA_ENGINE (Pine) — Gold list-scan engine.
 * Real Jurik (e0/e1/e2/jv), not the jurikLike used by hamAoJrmaZ.
 *
 * Display crosses (0–100 plots, edge-only):
 * - ao_x_score_al: crossover(aoPlot, scoreLongPlot) → AL
 * - ao_x_rma_al:   crossover(aoPlot, rawSigPlot)    → AL [= ana_long]
 * - ao_x_score_sat: crossunder(aoPlot, scoreLongPlot) → SAT
 * - ao_x_rma_sat:  crossunder(aoPlot, rawSigPlot)   → SAT [= ana_short]
 * - pt_x_nt / nt_x_pt: posTrend ↔ negTrend [= garanti_long/short]
 */
import type { Candle } from "@/lib/types";
import { ema, priceSeries, sma, smma, stdev } from "@/lib/indicators/math";

export type AohamJrmaEngineOpts = {
  hamMomLen?: number;
  volBaseLen?: number;
  hamPower?: number;
  aoFast?: number;
  aoSlow?: number;
  wHam?: number;
  wAo?: number;
  trendLen?: number;
  trendBoost?: number;
  jrmaRmaLen?: number;
  jrmaLen?: number;
  jrmaPhase?: number;
  jrmaPower?: number;
  preSmooth?: number;
  postSmooth?: number;
  normLen?: number;
  zLen?: number;
};

export const AOHAM_JRMA_DEFAULTS = {
  hamMomLen: 21,
  volBaseLen: 34,
  hamPower: 1.2,
  aoFast: 5,
  aoSlow: 34,
  wHam: 0.6,
  wAo: 0.4,
  trendLen: 34,
  trendBoost: 1.3,
  jrmaRmaLen: 13,
  jrmaLen: 8,
  jrmaPhase: 0,
  jrmaPower: 2,
  preSmooth: 3,
  postSmooth: 2,
  normLen: 40,
  zLen: 89,
} as const;

/** Warmup: zLen + normLen + trend/jurik cushions */
export const AOHAM_JRMA_MIN_BARS = 180;

export function safeDiv(num: number, den: number): number {
  return den === 0 || !Number.isFinite(den) ? 0 : num / den;
}

export function softsign(x: number): number {
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

/** Rolling z-score; null until period is ready. */
export function zscore(
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

/** Rolling min-max normalize to [0, 1]. */
export function minmax01(
  values: (number | null)[],
  period: number
): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (values[i] == null || i + 1 < period) continue;
    let lo = Infinity;
    let hi = -Infinity;
    let ok = false;
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j];
      if (v == null) continue;
      ok = true;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    if (!ok) continue;
    out[i] = safeDiv((values[i] as number) - lo, Math.max(hi - lo, 1e-12));
  }
  return out;
}

/**
 * Map series → ~0..100 via atan of rolling z-score.
 * Pine: 50 + 50 * atan(z) / (pi/2)
 */
export function atanNormalize100(
  values: (number | null)[],
  period: number
): (number | null)[] {
  const z = zscore(values, period);
  const halfPi = Math.PI / 2;
  return z.map((v) =>
    v == null ? null : 50 + (50 * Math.atan(v)) / halfPi
  );
}

/**
 * Stateful Jurik (community JMA-style) as in Pine:
 * phase clamp → b → a = pow(b, jpow); e0/e1/e2/jv.
 */
export function jurik(
  source: (number | null)[],
  jlen: number,
  jphase: number,
  jpow: number
): (number | null)[] {
  const len = Math.max(1, Math.floor(jlen));
  const pow = Math.max(0.1, jpow);
  const phaseRatio =
    jphase < -100 ? 0.5 : jphase > 100 ? 2.5 : jphase / 100 + 1.5;
  const b = (0.45 * (len - 1)) / (0.45 * (len - 1) + 2);
  const a = Math.pow(b, pow);

  const n = source.length;
  const out: (number | null)[] = new Array(n).fill(null);
  let e0 = 0;
  let e1 = 0;
  let e2 = 0;
  let jv = 0;
  let primed = false;

  for (let i = 0; i < n; i++) {
    const src = source[i];
    if (src == null || !Number.isFinite(src)) continue;
    if (!primed) {
      e0 = src;
      e1 = 0;
      e2 = 0;
      jv = src;
      primed = true;
      out[i] = i < len - 1 ? null : jv;
      continue;
    }
    e0 = (1 - a) * src + a * e0;
    e1 = (src - e0) * (1 - b) + b * e1;
    e2 =
      (e0 + phaseRatio * e1 - jv) * Math.pow(1 - a, 2) +
      Math.pow(a, 2) * e2;
    jv = e2 + jv;
    out[i] = i < len - 1 ? null : jv;
  }
  return out;
}

function emaNullable(
  values: (number | null)[],
  len: number
): (number | null)[] {
  const filled = fillNulls(values);
  const e = ema(filled, len);
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

export function crossedBelowAt(
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

export type AohamJrmaEngineSeries = {
  hamSmooth: (number | null)[];
  aoSmooth: (number | null)[];
  blend: (number | null)[];
  posTrend: (number | null)[];
  negTrend: (number | null)[];
  jurikCore: (number | null)[];
  rmaSignal: (number | null)[];
  histSmooth: (number | null)[];
  scoreLong: (number | null)[];
  scoreShort: (number | null)[];
  /** Display 0–100 */
  aoPlot: (number | null)[];
  rawSigPlot: (number | null)[];
  posPlot: (number | null)[];
  negPlot: (number | null)[];
  scoreLongPlot: (number | null)[];
  scoreShortPlot: (number | null)[];
  hamPlot: (number | null)[];
  displayPlot: (number | null)[];
  /** Edge flags */
  aoXScoreAl: boolean[];
  aoXRmaAl: boolean[];
  aoXScoreSat: boolean[];
  aoXRmaSat: boolean[];
  ptXNt: boolean[];
  ntXPt: boolean[];
};

export function aohamJrmaEngine(
  candles: Candle[],
  opts: AohamJrmaEngineOpts = {}
): AohamJrmaEngineSeries {
  const d = AOHAM_JRMA_DEFAULTS;
  const hamMomLen = opts.hamMomLen ?? d.hamMomLen;
  const volBaseLen = opts.volBaseLen ?? d.volBaseLen;
  const hamPower = opts.hamPower ?? d.hamPower;
  const aoFast = opts.aoFast ?? d.aoFast;
  const aoSlow = opts.aoSlow ?? d.aoSlow;
  const wHam = opts.wHam ?? d.wHam;
  const wAo = opts.wAo ?? d.wAo;
  const trendLen = opts.trendLen ?? d.trendLen;
  const trendBoost = opts.trendBoost ?? d.trendBoost;
  const jrmaRmaLen = opts.jrmaRmaLen ?? d.jrmaRmaLen;
  const jrmaLen = opts.jrmaLen ?? d.jrmaLen;
  const jrmaPhase = opts.jrmaPhase ?? d.jrmaPhase;
  const jrmaPower = opts.jrmaPower ?? d.jrmaPower;
  const preSmooth = opts.preSmooth ?? d.preSmooth;
  const postSmooth = opts.postSmooth ?? d.postSmooth;
  const normLen = opts.normLen ?? d.normLen;
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
  const hamZ = zscore(hamRaw, zLen);
  const hamSmooth = emaNullable(hamZ, preSmooth);

  const aoSmaFast = sma(hl2, aoFast);
  const aoSmaSlow = sma(hl2, aoSlow);
  const aoRaw: (number | null)[] = hl2.map((_, i) =>
    aoSmaFast[i] != null && aoSmaSlow[i] != null
      ? (aoSmaFast[i] as number) - (aoSmaSlow[i] as number)
      : null
  );
  const aoZ = zscore(aoRaw, aoSlow);
  const aoSmooth = emaNullable(aoZ, preSmooth);

  const blend: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (hamSmooth[i] == null || aoSmooth[i] == null) continue;
    blend[i] = softsign(
      wHam * (hamSmooth[i] as number) + wAo * (aoSmooth[i] as number)
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
  const corePre = emaNullable(core, preSmooth);
  const jurikMid = jurik(corePre, jrmaLen, jrmaPhase, jrmaPower);
  const jurikCore = emaNullable(jurikMid, postSmooth);
  const rmaMid = rmaNullable(jurikCore, jrmaRmaLen);
  const rmaSignal = emaNullable(rmaMid, postSmooth);

  const hist: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (jurikCore[i] == null || rmaSignal[i] == null) continue;
    hist[i] = (jurikCore[i] as number) - (rmaSignal[i] as number);
  }
  const histSmooth = zscore(hist, zLen);

  const scoreLong = minmax01(jurikCore, normLen);
  const negCore = jurikCore.map((v) => (v == null ? null : -v));
  const scoreShort = minmax01(negCore, normLen);

  const aoPlot = atanNormalize100(aoSmooth, zLen);
  const rawSigPlot = atanNormalize100(rmaSignal, zLen);
  const posPlot = atanNormalize100(posTrend, zLen);
  const negPlot = atanNormalize100(negTrend, zLen);
  const scoreLongPlot = scoreLong.map((v) => (v == null ? null : v * 100));
  const scoreShortPlot = scoreShort.map((v) => (v == null ? null : v * 100));
  const hamPlot = atanNormalize100(hamSmooth, zLen);
  const displayPlot = atanNormalize100(histSmooth, zLen);

  const aoXScoreAl = new Array(n).fill(false);
  const aoXRmaAl = new Array(n).fill(false);
  const aoXScoreSat = new Array(n).fill(false);
  const aoXRmaSat = new Array(n).fill(false);
  const ptXNt = new Array(n).fill(false);
  const ntXPt = new Array(n).fill(false);

  for (let i = 1; i < n; i++) {
    aoXScoreAl[i] = crossedAboveAt(aoPlot, scoreLongPlot, i);
    aoXRmaAl[i] = crossedAboveAt(aoPlot, rawSigPlot, i);
    aoXScoreSat[i] = crossedBelowAt(aoPlot, scoreLongPlot, i);
    aoXRmaSat[i] = crossedBelowAt(aoPlot, rawSigPlot, i);
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
    histSmooth,
    scoreLong,
    scoreShort,
    aoPlot,
    rawSigPlot,
    posPlot,
    negPlot,
    scoreLongPlot,
    scoreShortPlot,
    hamPlot,
    displayPlot,
    aoXScoreAl,
    aoXRmaAl,
    aoXScoreSat,
    aoXRmaSat,
    ptXNt,
    ntXPt,
  };
}

/** Alias used by list-scan / registry naming. */
export const goldEngine = aohamJrmaEngine;
