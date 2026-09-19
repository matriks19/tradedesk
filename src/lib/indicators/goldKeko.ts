/**
 * GOLD / KEKO — Kutuplu Enerji Kırılım Osilatörü (Pine GOLD.pine port).
 * jurikLike = 2*EMA - EMA(EMA); display = atanSigned100 (−100..+100).
 *
 * Edge-only list-scan conds (earliest→latest):
 * - raw_x_rma_al/sat:  crossover/under(kineticRaw, kineticSignal)
 * - core_x_rma_al/sat: crossover/under(kineticCore, kineticSignal)
 * - disp_x_rma_al/sat: crossover/under(oscDisplay, oscSignal)
 * Optional: breakout_*_aligned/counter, charge_full_*, polarity_flip_*
 */
import type { Candle } from "@/lib/types";
import {
  atr,
  ema,
  priceSeries,
  sma,
  smma,
  stdev,
} from "@/lib/indicators/math";

export type GoldKekoOpts = {
  hamMomLen?: number;
  volBaseLen?: number;
  hamPower?: number;
  aoFast?: number;
  aoSlow?: number;
  hamWeight?: number;
  aoWeight?: number;
  bbLen?: number;
  bbMult?: number;
  kcLen?: number;
  kcMult?: number;
  peLen?: number;
  compressionThresh?: number;
  cmfLen?: number;
  polarWeightCMF?: number;
  polarWeightHam?: number;
  preSmoothLen?: number;
  jurikLen?: number;
  rmaLen?: number;
  postSmoothLen?: number;
  kineticQuietThresh?: number;
  chargeRate?: number;
  idleDischarge?: number;
  breakoutDischarge?: number;
  minChargeForSignal?: number;
  zLen?: number;
  displaySignalLen?: number;
  histScale?: number;
  useTrendFilter?: boolean;
  requireRelease?: boolean;
  flagCounterBreakouts?: boolean;
};

export const GOLD_KEKO_DEFAULTS = {
  hamMomLen: 21,
  volBaseLen: 34,
  hamPower: 1.2,
  aoFast: 5,
  aoSlow: 34,
  hamWeight: 0.6,
  aoWeight: 0.4,
  bbLen: 20,
  bbMult: 2.0,
  kcLen: 20,
  kcMult: 1.5,
  peLen: 100,
  compressionThresh: 0.5,
  cmfLen: 21,
  polarWeightCMF: 0.6,
  polarWeightHam: 0.4,
  preSmoothLen: 3,
  jurikLen: 8,
  rmaLen: 13,
  postSmoothLen: 2,
  kineticQuietThresh: 0.35,
  chargeRate: 1.4,
  idleDischarge: 0.15,
  breakoutDischarge: 35.0,
  minChargeForSignal: 30.0,
  zLen: 89,
  displaySignalLen: 5,
  histScale: 18.0,
  useTrendFilter: true,
  requireRelease: true,
  flagCounterBreakouts: true,
} as const;

/** Warmup: peLen(100) + zLen(89) + smooth cushions */
export const GOLD_KEKO_MIN_BARS = 220;
export const GOLD_KEKO_FETCH_LIMIT = 300;

/** Pine: num / math.max(math.abs(den), 1e-10) — abs(den) floor (sign of den discarded). */
export function safeDivPine(num: number, den: number): number {
  return num / Math.max(Math.abs(den), 1e-10);
}

export function softsign(x: number): number {
  return x / (1.0 + Math.abs(x));
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

/** Rolling z-score; null until source + period ready. */
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

/** Pine atanSigned100: 100 * atan(z) / (pi/2) → ≈ −100..+100 */
export function atanSigned100(
  values: (number | null)[],
  period: number
): (number | null)[] {
  const z = zscore(values, period);
  const halfPi = 1.57079632679;
  return z.map((v) => (v == null ? null : (100.0 * Math.atan(v)) / halfPi));
}

/** Jurik-like: 2*EMA − EMA(EMA) */
export function jurikLike(
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

export type GoldKekoSeries = {
  kineticRaw: (number | null)[];
  kineticCore: (number | null)[];
  kineticSignal: (number | null)[];
  releaseSmooth: (number | null)[];
  polarBias: (number | null)[];
  energyTank: (number | null)[];
  oscMain: (number | null)[];
  oscDisplay: (number | null)[];
  oscSignal: (number | null)[];
  oscRawDebug: (number | null)[];
  histPlot: (number | null)[];
  /** Edge flags */
  rawXRmaAl: boolean[];
  rawXRmaSat: boolean[];
  coreXRmaAl: boolean[];
  coreXRmaSat: boolean[];
  dispXRmaAl: boolean[];
  dispXRmaSat: boolean[];
  breakoutUpAligned: boolean[];
  breakoutDownAligned: boolean[];
  breakoutUpCounter: boolean[];
  breakoutDownCounter: boolean[];
  chargeFullBull: boolean[];
  chargeFullBear: boolean[];
  polarityFlipUp: boolean[];
  polarityFlipDown: boolean[];
};

export function goldKeko(
  candles: Candle[],
  opts: GoldKekoOpts = {}
): GoldKekoSeries {
  const d = GOLD_KEKO_DEFAULTS;
  const hamMomLen = opts.hamMomLen ?? d.hamMomLen;
  const volBaseLen = opts.volBaseLen ?? d.volBaseLen;
  const hamPower = opts.hamPower ?? d.hamPower;
  const aoFast = opts.aoFast ?? d.aoFast;
  const aoSlow = opts.aoSlow ?? d.aoSlow;
  const hamWeight = opts.hamWeight ?? d.hamWeight;
  const aoWeight = opts.aoWeight ?? d.aoWeight;
  const bbLen = opts.bbLen ?? d.bbLen;
  const bbMult = opts.bbMult ?? d.bbMult;
  const kcLen = opts.kcLen ?? d.kcLen;
  const kcMult = opts.kcMult ?? d.kcMult;
  const peLen = opts.peLen ?? d.peLen;
  const compressionThresh = opts.compressionThresh ?? d.compressionThresh;
  const cmfLen = opts.cmfLen ?? d.cmfLen;
  const polarWeightCMF = opts.polarWeightCMF ?? d.polarWeightCMF;
  const polarWeightHam = opts.polarWeightHam ?? d.polarWeightHam;
  const preSmoothLen = opts.preSmoothLen ?? d.preSmoothLen;
  const jurikLen = opts.jurikLen ?? d.jurikLen;
  const rmaLen = opts.rmaLen ?? d.rmaLen;
  const postSmoothLen = opts.postSmoothLen ?? d.postSmoothLen;
  const kineticQuietThresh = opts.kineticQuietThresh ?? d.kineticQuietThresh;
  const chargeRate = opts.chargeRate ?? d.chargeRate;
  const idleDischarge = opts.idleDischarge ?? d.idleDischarge;
  const breakoutDischarge = opts.breakoutDischarge ?? d.breakoutDischarge;
  const minChargeForSignal = opts.minChargeForSignal ?? d.minChargeForSignal;
  const zLen = opts.zLen ?? d.zLen;
  const displaySignalLen = opts.displaySignalLen ?? d.displaySignalLen;
  const histScale = opts.histScale ?? d.histScale;
  const useTrendFilter = opts.useTrendFilter ?? d.useTrendFilter;
  const requireRelease = opts.requireRelease ?? d.requireRelease;
  const flagCounterBreakouts =
    opts.flagCounterBreakouts ?? d.flagCounterBreakouts;

  const n = candles.length;
  const src = priceSeries(candles, "hlc3");
  const hl2 = priceSeries(candles, "hl2");
  const vol = candles.map((c) => c.volume);
  const high = candles.map((c) => c.high);
  const low = candles.map((c) => c.low);
  const close = candles.map((c) => c.close);

  // 1) Squeeze magnitude
  const bbBasis = sma(src, bbLen);
  const bbSd = stdev(src, bbLen);
  const bbWidth: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (bbBasis[i] == null || bbSd[i] == null) continue;
    const basis = bbBasis[i] as number;
    const dev = bbMult * (bbSd[i] as number);
    bbWidth[i] = safeDivPine(2 * dev, basis);
  }

  const kcBasis = ema(src, kcLen);
  const kcAtr = atr(candles, kcLen);
  const kcWidth: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (kcBasis[i] == null || kcAtr[i] == null) continue;
    const basis = kcBasis[i] as number;
    const half = kcMult * (kcAtr[i] as number);
    kcWidth[i] = safeDivPine(2 * half, basis);
  }

  const squeezeRatio: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (bbWidth[i] == null || kcWidth[i] == null) continue;
    squeezeRatio[i] = safeDivPine(bbWidth[i] as number, kcWidth[i] as number);
  }
  const peCompression = zscore(squeezeRatio, peLen).map((v) =>
    v == null ? null : -v
  );
  const isCompressed = peCompression.map(
    (v) => v != null && v > compressionThresh
  );

  // 2) Kinetic (HAM + AO)
  const volBase = smma(vol, volBaseLen);
  const hamRaw: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i < hamMomLen) continue;
    const ref = src[i - hamMomLen]!;
    const mom = 100.0 * safeDivPine(src[i]! - ref, ref);
    const vb = volBase[i];
    const volRatio =
      vb == null || vb === 0
        ? 1
        : Math.pow(safeDivPine(vol[i]!, vb), hamPower);
    hamRaw[i] = mom * volRatio;
  }
  const hamZ = zscore(hamRaw, volBaseLen);
  const hamSmooth = emaNullable(hamZ, preSmoothLen);

  const aoSmaFast = sma(hl2, aoFast);
  const aoSmaSlow = sma(hl2, aoSlow);
  const aoRaw: (number | null)[] = hl2.map((_, i) =>
    aoSmaFast[i] != null && aoSmaSlow[i] != null
      ? (aoSmaFast[i] as number) - (aoSmaSlow[i] as number)
      : null
  );
  const aoZ = zscore(aoRaw, aoSlow);
  const aoSmooth = emaNullable(aoZ, preSmoothLen);

  const kWeightSum = Math.max(hamWeight + aoWeight, 1e-10);
  const kineticRaw0: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (hamSmooth[i] == null || aoSmooth[i] == null) continue;
    kineticRaw0[i] =
      ((hamSmooth[i] as number) * hamWeight +
        (aoSmooth[i] as number) * aoWeight) /
      kWeightSum;
  }
  const kineticRaw = kineticRaw0.map((v) =>
    v == null ? null : softsign(v)
  );

  const kineticPre = emaNullable(kineticRaw, preSmoothLen);
  const kineticCore0 = jurikLike(kineticPre, jurikLen);
  const kineticCore = emaNullable(kineticCore0, postSmoothLen);
  const kineticSignal0 = rmaNullable(kineticCore, rmaLen);
  const kineticSignal = emaNullable(kineticSignal0, postSmoothLen);

  // 3) Release
  const releaseRaw: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (kineticCore[i] == null || kineticSignal[i] == null) continue;
    releaseRaw[i] =
      (kineticCore[i] as number) - (kineticSignal[i] as number);
  }
  const releaseZ = zscore(releaseRaw, Math.max(zLen, 10));
  const releaseSmooth = emaNullable(releaseZ, 2);

  // 4) Polarity (CMF-like + HAM)
  const mfv: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const hl = high[i]! - low[i]!;
    const mfm = safeDivPine(
      close[i]! - low[i]! - (high[i]! - close[i]!),
      hl
    );
    mfv[i] = mfm * vol[i]!;
  }
  const mfvSmooth = rmaNullable(mfv, cmfLen);
  const volSmooth = rmaNullable(
    vol.map((v) => v as number | null),
    cmfLen
  );
  const cmfRatio: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (mfvSmooth[i] == null || volSmooth[i] == null) continue;
    cmfRatio[i] = safeDivPine(
      mfvSmooth[i] as number,
      volSmooth[i] as number
    );
  }
  const polarWeightSum = Math.max(polarWeightCMF + polarWeightHam, 1e-10);
  const polarRaw: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (cmfRatio[i] == null || hamSmooth[i] == null) continue;
    polarRaw[i] =
      ((cmfRatio[i] as number) * polarWeightCMF +
        softsign(hamSmooth[i] as number) * polarWeightHam) /
      polarWeightSum;
  }
  const polarBias = emaNullable(polarRaw, preSmoothLen);

  // 5–8) Stateful energy tank + edges
  const energyTank: (number | null)[] = new Array(n).fill(null);
  const energyTankPreDischarge: (number | null)[] = new Array(n).fill(null);
  const rawXRmaAl = new Array(n).fill(false);
  const rawXRmaSat = new Array(n).fill(false);
  const coreXRmaAl = new Array(n).fill(false);
  const coreXRmaSat = new Array(n).fill(false);
  const dispXRmaAl = new Array(n).fill(false);
  const dispXRmaSat = new Array(n).fill(false);
  const breakoutUpAligned = new Array(n).fill(false);
  const breakoutDownAligned = new Array(n).fill(false);
  const breakoutUpCounter = new Array(n).fill(false);
  const breakoutDownCounter = new Array(n).fill(false);
  const chargeFullBull = new Array(n).fill(false);
  const chargeFullBear = new Array(n).fill(false);
  const polarityFlipUp = new Array(n).fill(false);
  const polarityFlipDown = new Array(n).fill(false);

  let tank = 0.0;
  let prevChargedBull = false;
  let prevChargedBear = false;
  let prevTankFinal = 0.0;
  let tankPrimed = false;

  for (let i = 0; i < n; i++) {
    const core = kineticCore[i];
    const sig = kineticSignal[i];
    const rel = releaseSmooth[i];
    const polar = polarBias[i];
    const ready =
      core != null && sig != null && rel != null && polar != null;

    if (!ready) {
      energyTank[i] = tankPrimed ? tank : null;
      energyTankPreDischarge[i] = energyTank[i];
      continue;
    }

    // Trend slope vs signal[3]
    let trendUpOk = true;
    let trendDownOk = true;
    if (useTrendFilter) {
      const sig3 = i >= 3 ? kineticSignal[i - 3] : null;
      if (sig3 != null) {
        const slope = (sig as number) - (sig3 as number);
        trendUpOk = slope >= 0;
        trendDownOk = slope <= 0;
      }
    }

    const kineticQuiet = Math.abs(core as number) < kineticQuietThresh;
    const chargeAmount = chargeRate * (polar as number);

    if (isCompressed[i] && kineticQuiet) {
      tank = Math.max(-100.0, Math.min(100.0, tank + chargeAmount));
    } else {
      tank =
        tank > 0
          ? Math.max(0.0, tank - idleDischarge)
          : Math.min(0.0, tank + idleDischarge);
    }
    tankPrimed = true;
    energyTankPreDischarge[i] = tank;

    const chargedBull = tank >= minChargeForSignal;
    const chargedBear = tank <= -minChargeForSignal;
    chargeFullBull[i] = chargedBull && !prevChargedBull;
    chargeFullBear[i] = chargedBear && !prevChargedBear;

    // Polarity flip vs previous bar's FINAL tank (after any discharge)
    polarityFlipUp[i] = prevTankFinal <= 0 && tank > 0;
    polarityFlipDown[i] = prevTankFinal >= 0 && tank < 0;

    const releaseUpOk = !requireRelease || (rel as number) > 0;
    const releaseDownOk = !requireRelease || (rel as number) < 0;

    const coreUp = crossedAboveAt(kineticCore, kineticSignal, i);
    const coreDn = crossedBelowAt(kineticCore, kineticSignal, i);

    breakoutUpAligned[i] =
      coreUp && chargedBull && trendUpOk && releaseUpOk;
    breakoutDownAligned[i] =
      coreDn && chargedBear && trendDownOk && releaseDownOk;
    breakoutUpCounter[i] =
      flagCounterBreakouts &&
      coreUp &&
      chargedBear &&
      trendUpOk &&
      releaseUpOk;
    breakoutDownCounter[i] =
      flagCounterBreakouts &&
      coreDn &&
      chargedBull &&
      trendDownOk &&
      releaseDownOk;

    const anyBreakout =
      breakoutUpAligned[i] ||
      breakoutDownAligned[i] ||
      breakoutUpCounter[i] ||
      breakoutDownCounter[i];
    if (anyBreakout) {
      tank =
        tank > 0
          ? Math.max(0.0, tank - breakoutDischarge)
          : Math.min(0.0, tank + breakoutDischarge);
    }

    energyTank[i] = tank;
    prevChargedBull = chargedBull;
    prevChargedBear = chargedBear;
    prevTankFinal = tank;

    rawXRmaAl[i] = crossedAboveAt(kineticRaw, kineticSignal, i);
    rawXRmaSat[i] = crossedBelowAt(kineticRaw, kineticSignal, i);
    coreXRmaAl[i] = coreUp;
    coreXRmaSat[i] = coreDn;
  }

  // 10) Visual normalization
  const oscMain = atanSigned100(kineticCore, zLen);
  const oscDisplay = emaNullable(oscMain, displaySignalLen);
  const oscSignal = atanSigned100(kineticSignal, zLen);
  const oscRawDebug = atanSigned100(kineticRaw, zLen);

  const halfPi = 1.57079632679;
  const histPlot = releaseSmooth.map((v) =>
    v == null ? null : histScale * (Math.atan(v) / halfPi)
  );

  for (let i = 1; i < n; i++) {
    dispXRmaAl[i] = crossedAboveAt(oscDisplay, oscSignal, i);
    dispXRmaSat[i] = crossedBelowAt(oscDisplay, oscSignal, i);
  }

  return {
    kineticRaw,
    kineticCore,
    kineticSignal,
    releaseSmooth,
    polarBias,
    energyTank,
    oscMain,
    oscDisplay,
    oscSignal,
    oscRawDebug,
    histPlot,
    rawXRmaAl,
    rawXRmaSat,
    coreXRmaAl,
    coreXRmaSat,
    dispXRmaAl,
    dispXRmaSat,
    breakoutUpAligned,
    breakoutDownAligned,
    breakoutUpCounter,
    breakoutDownCounter,
    chargeFullBull,
    chargeFullBear,
    polarityFlipUp,
    polarityFlipDown,
  };
}

/** Alias */
export const gold2Engine = goldKeko;
