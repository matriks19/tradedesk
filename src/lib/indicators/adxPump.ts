/**
 * ADX Pump Radar — 4 ADX + Bollinger + karışım DI
 *
 * Classic ADX alone is late for pumps (Wilder DX of smoothed DI). Pane shows:
 *   1) Saf ADX              — classic Wilder ADX
 *   2) ADX×CCI              — CCI-adaptive smooth of ADX/DX
 *   3) ADX×Median           — median-filtered ADX (spike-resistant)
 *   4) ADX×Momentum         — momentum-weighted faster ADX wake
 * Plus: plusDIMix / minusDIMix — directional blend of the four views
 * Plus: BB %B / bandwidth gates
 *
 * Stages: Early (mom-ADX + CCI wake + %B) → Mid (mix DI align) →
 *         Confirm (Saf and/or median ADX ≥25 + mix DI)
 *
 * Aliases: adxPumpRadar / diPumpRadar / adxPumpStages
 */
import type { Candle } from "@/lib/types";
import {
  adx,
  bbPercentB,
  bbWidth,
  cci,
  closes,
  momentum,
  roc,
  volumeOsc,
} from "./math";

export interface AdxPumpParams {
  adxPeriod?: number;
  momPeriod?: number;
  cciPeriod?: number;
  bbPeriod?: number;
  bbMult?: number;
  /** Median window on ADX (default 5) */
  medianLen?: number;
  /** Fast DX EMA for momentum / CCI adaptive path (default 3) */
  fastSmooth?: number;
  /** Composite osc EMA (default 3) */
  smoothLen?: number;
  adxConfirm?: number;
  adxWake?: number;
  useVolume?: boolean;
  volShort?: number;
  volLong?: number;
}

export interface AdxPumpResult {
  /** 1) Saf ADX — classic Wilder */
  adx: (number | null)[];
  /** 2) ADX smoothed with CCI */
  adxCci: (number | null)[];
  /** 3) ADX smoothed with Median */
  adxMedian: (number | null)[];
  /** 4) ADX smoothed with Momentum */
  adxMom: (number | null)[];
  /** Classic DI passthrough */
  plusDI: (number | null)[];
  minusDI: (number | null)[];
  /** Karışım +DI / −DI from four-view blend */
  plusDIMix: (number | null)[];
  minusDIMix: (number | null)[];
  diSpread: (number | null)[];
  pctB: (number | null)[];
  bbWidth: (number | null)[];
  early: (number | null)[];
  mid: (number | null)[];
  confirm: (number | null)[];
  /** Signed stage 0 / ±1 / ±2 / ±3 */
  stage: (number | null)[];
  bias: (number | null)[];
  osc: (number | null)[];
  dx: (number | null)[];
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function softNorm(x: number, scale: number): number {
  const z = x / scale;
  const e2 = Math.exp(2 * clamp(z, -20, 20));
  return 100 * ((e2 - 1) / (e2 + 1));
}

function fillNull(n: number): (number | null)[] {
  return new Array(n).fill(null);
}

function medianFilter(
  values: (number | null)[],
  len: number
): (number | null)[] {
  const n = values.length;
  const out = fillNull(n);
  if (len <= 1) return values.slice();
  for (let i = 0; i < n; i++) {
    if (values[i] == null) continue;
    const buf: number[] = [];
    for (let j = Math.max(0, i - len + 1); j <= i; j++) {
      if (values[j] != null) buf.push(values[j] as number);
    }
    if (!buf.length) continue;
    buf.sort((a, b) => a - b);
    const m = Math.floor(buf.length / 2);
    out[i] =
      buf.length % 2 === 1 ? buf[m] : (buf[m - 1] + buf[m]) / 2;
  }
  return out;
}

function emaNullable(
  values: (number | null)[],
  period: number
): (number | null)[] {
  const n = values.length;
  const out = fillNull(n);
  if (period < 1) return values.slice();
  const k = 2 / (period + 1);
  let prev: number | null = null;
  let seedSum = 0;
  let seedCount = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v == null) {
      out[i] = prev;
      continue;
    }
    if (prev == null) {
      seedSum += v;
      seedCount++;
      if (seedCount >= period) {
        prev = seedSum / seedCount;
        out[i] = prev;
      }
    } else {
      prev = v * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function rising(series: (number | null)[], i: number): boolean {
  if (i < 1) return false;
  const a = series[i];
  const b = series[i - 1];
  return a != null && b != null && (a as number) > (b as number);
}

/**
 * Four ADX views + mix DI + Bollinger-aware stage scores.
 * Defaults for crypto / intraday (5m–15m).
 */
export function adxPumpRadar(
  candles: Candle[],
  params: AdxPumpParams = {}
): AdxPumpResult {
  const adxPeriod = params.adxPeriod ?? 14;
  const momPeriod = params.momPeriod ?? 7;
  const cciPeriod = params.cciPeriod ?? 10;
  const bbPeriod = params.bbPeriod ?? 20;
  const bbMult = params.bbMult ?? 2;
  const medianLen = params.medianLen ?? 5;
  const fastSmooth = params.fastSmooth ?? 3;
  const smoothLen = params.smoothLen ?? 3;
  const adxConfirm = params.adxConfirm ?? 25;
  const adxWake = params.adxWake ?? 15;
  const useVolume = params.useVolume !== false;
  const volShort = params.volShort ?? 5;
  const volLong = params.volLong ?? 10;

  const n = candles.length;
  const early = fillNull(n);
  const mid = fillNull(n);
  const confirm = fillNull(n);
  const stage = fillNull(n);
  const biasArr = fillNull(n);
  const osc = fillNull(n);
  const diSpreadOut = fillNull(n);
  const dx = fillNull(n);
  const adxCci = fillNull(n);
  const adxMom = fillNull(n);
  const plusDIMix = fillNull(n);
  const minusDIMix = fillNull(n);

  const empty = (): AdxPumpResult => ({
    adx: fillNull(n),
    adxCci,
    adxMedian: fillNull(n),
    adxMom,
    plusDI: fillNull(n),
    minusDI: fillNull(n),
    plusDIMix,
    minusDIMix,
    diSpread: diSpreadOut,
    pctB: fillNull(n),
    bbWidth: fillNull(n),
    early,
    mid,
    confirm,
    stage,
    bias: biasArr,
    osc,
    dx,
  });

  if (n === 0) return empty();

  const c = closes(candles);
  // 1) Saf ADX + classic DI
  const dmi = adx(candles, adxPeriod);

  for (let i = 0; i < n; i++) {
    const p = dmi.plusDI[i];
    const m = dmi.minusDI[i];
    if (p == null || m == null) continue;
    const s = p + m;
    dx[i] = s === 0 ? 0 : (100 * Math.abs(p - m)) / s;
  }

  const dxFast = emaNullable(dx, Math.max(2, fastSmooth));
  // 3) ADX×Median — spike-resistant median of Saf ADX
  const adxMedian = medianFilter(dmi.adx, Math.max(3, medianLen));

  const rocSeries = roc(c, momPeriod);
  const momSeries = momentum(c, momPeriod);
  const cciSeries = cci(candles, cciPeriod);
  const pctB = bbPercentB(c, bbPeriod, bbMult);
  const width = bbWidth(c, bbPeriod, bbMult);
  const vol = useVolume
    ? volumeOsc(candles, volShort, volLong)
    : fillNull(n);

  // Median-filtered classic DI (for mix)
  const plusDIMed = medianFilter(dmi.plusDI, Math.max(3, medianLen));
  const minusDIMed = medianFilter(dmi.minusDI, Math.max(3, medianLen));

  const widthSlope = fillNull(n);
  for (let i = 1; i < n; i++) {
    if (width[i] != null && width[i - 1] != null) {
      const base = Math.max(Math.abs(width[i - 1] as number), 1e-8);
      widthSlope[i] =
        ((width[i] as number) - (width[i - 1] as number)) / base;
    }
  }

  // Build ADX×CCI, ADX×Mom, and mix DI bar-by-bar
  for (let i = 0; i < n; i++) {
    const saf = dmi.adx[i];
    const fast = dxFast[i];
    const cc = cciSeries[i];
    const r = rocSeries[i];
    const mAbs = momSeries[i];
    const pDI = dmi.plusDI[i];
    const mDI = dmi.minusDI[i];
    if (saf == null || fast == null || pDI == null || mDI == null) continue;

    // —— 2) ADX×CCI: blend Saf ↔ fast DX by |CCI| agreement with DI
    // wCci high when |CCI| large and CCI sign matches DI spread
    const diSpreadRaw = (pDI as number) - (mDI as number);
    let wCci = 0.35;
    if (cc != null) {
      const agree =
        Math.sign(cc) === 0 ||
        Math.sign(diSpreadRaw) === 0 ||
        Math.sign(cc) === Math.sign(diSpreadRaw)
          ? 1
          : 0.35;
      wCci = clamp((Math.abs(cc) / 150) * agree, 0.15, 0.85);
    }
    adxCci[i] = (1 - wCci) * (saf as number) + wCci * (fast as number);

    // —— 4) ADX×Momentum: momentum weight pulls toward fast DX on impulse
    const momPct =
      r != null
        ? r
        : mAbs != null && c[i - momPeriod] != null && c[i - momPeriod] !== 0
          ? (100 * mAbs) / Math.abs(c[i - momPeriod])
          : 0;
    const wMom = clamp(Math.abs(momPct) / 5, 0.2, 0.9);
    // Directional: if mom against DI, damp pull
    const momAgree =
      Math.sign(momPct) === 0 ||
      Math.sign(diSpreadRaw) === 0 ||
      Math.sign(momPct) === Math.sign(diSpreadRaw)
        ? 1
        : 0.4;
    const wM = wMom * momAgree;
    adxMom[i] = (1 - wM) * (saf as number) + wM * (fast as number);

    // —— Karışım +DI / −DI
    // Classic DI + median DI + CCI tilt + momentum tilt
    const pMed = plusDIMed[i] ?? pDI;
    const mMed = minusDIMed[i] ?? mDI;
    const cciTilt = cc != null ? softNorm(cc, 100) / 100 : 0; // ~[-1,1]
    const momTilt = softNorm(momPct, 4) / 100;
    // Four-view ADX agreement boosts the leading DI side
    const medV = adxMedian[i];
    const views = [saf as number, adxCci[i] as number, adxMom[i] as number];
    if (medV != null) views.push(medV as number);
    const avgAdx =
      views.reduce((a, b) => a + b, 0) / Math.max(views.length, 1);
    const bullVotes =
      (diSpreadRaw > 0 ? 1 : 0) +
      (cciTilt > 0.05 ? 1 : 0) +
      (momTilt > 0.05 ? 1 : 0) +
      ((pMed as number) > (mMed as number) ? 1 : 0);
    const bearVotes = 4 - bullVotes;
    const mixBull = bullVotes / 4;
    const mixBear = bearVotes / 4;
    // Blend absolute DI levels with vote-weighted split of avgAdx-scaled magnitude
    const baseP =
      0.4 * (pDI as number) + 0.3 * (pMed as number) + 0.3 * avgAdx * mixBull;
    const baseM =
      0.4 * (mDI as number) + 0.3 * (mMed as number) + 0.3 * avgAdx * mixBear;
    // Small CCI/mom nudges (keep sum-ish stable)
    const nudge = 8 * (0.5 * cciTilt + 0.5 * momTilt);
    plusDIMix[i] = clamp(baseP + nudge, 0, 100);
    minusDIMix[i] = clamp(baseM - nudge, 0, 100);
  }

  const diSpread = emaNullable(
    plusDIMix.map((p, i) => {
      const m = minusDIMix[i];
      if (p == null || m == null) return null;
      return p - m;
    }),
    Math.max(2, smoothLen)
  );

  // Stage scores
  for (let i = 0; i < n; i++) {
    diSpreadOut[i] = diSpread[i];
    const saf = dmi.adx[i];
    const aCci = adxCci[i];
    const aMed = adxMedian[i];
    const aMom = adxMom[i];
    const spr = diSpread[i];
    const pb = pctB[i];
    const cc = cciSeries[i];
    const r = rocSeries[i];
    const pMix = plusDIMix[i];
    const mMix = minusDIMix[i];

    if (
      saf == null ||
      aCci == null ||
      aMed == null ||
      aMom == null ||
      spr == null ||
      pb == null ||
      pMix == null ||
      mMix == null
    )
      continue;

    const momPct = r ?? 0;
    const momN = softNorm(momPct, 4);
    const cciN = cc != null ? softNorm(cc, 100) : 0;
    const pbN = softNorm((pb as number) - 0.5, 0.5);
    const widthExpanding =
      widthSlope[i] != null && (widthSlope[i] as number) > 0.02;

    // Bias from mix DI + mom/CCI agreement
    const mixSign = Math.sign((pMix as number) - (mMix as number));
    const impulseSign = Math.sign(momN + cciN + pbN);
    let bias = 0;
    if (mixSign !== 0 && impulseSign !== 0 && mixSign === impulseSign)
      bias = mixSign;
    else if (mixSign !== 0) bias = mixSign;
    else if (impulseSign !== 0) bias = impulseSign;
    biasArr[i] = bias;

    const mixAligned =
      bias !== 0 &&
      Math.sign((pMix as number) - (mMix as number)) === bias;

    // —— Early: ADX×Mom rising/wake + ADX×CCI wake + %B expand
    //    (Saf ADX often still low)
    const earlyWake =
      (rising(adxMom, i) || (aMom as number) >= adxWake * 0.75) &&
      (rising(adxCci, i) ||
        (aCci as number) >= adxWake * 0.7 ||
        Math.abs(cciN) > 25) &&
      (widthExpanding ||
        (bias >= 0 && (pb as number) > 0.55) ||
        (bias <= 0 && (pb as number) < 0.45) ||
        Math.abs(momN) > 30);
    const earlyMag = clamp(
      0.4 * softNorm(aMom as number, 20) +
        0.3 * softNorm(aCci as number, 20) +
        0.3 * Math.abs(0.5 * momN + 0.3 * cciN + 0.2 * pbN),
      0,
      100
    );
    early[i] = earlyWake
      ? earlyMag * (bias || impulseSign || 1)
      : clamp(0.2 * (momN + cciN) * 0.5, -30, 30);

    // —— Mid: mix +DI/−DI aligned + ADX×CCI or Saf in wake zone
    const midGate =
      mixAligned &&
      ((aCci as number) >= adxWake ||
        (saf as number) >= adxWake ||
        rising(diSpread, i));
    const spreadN = softNorm(spr as number, 25);
    const midMag = clamp(
      0.5 * Math.abs(spreadN) + 0.5 * softNorm(aCci as number, 22),
      0,
      100
    );
    mid[i] = midGate
      ? midMag * bias
      : mixAligned
        ? clamp(0.3 * spreadN, -40, 40)
        : clamp(0.12 * spreadN, -20, 20);

    // —— Confirm: Saf and/or Median ADX ≥25 + mix DI + %B/width
    const volV = vol[i];
    const volOk =
      !useVolume ||
      volV == null ||
      (bias > 0 && (volV as number) > -5) ||
      (bias < 0 && (volV as number) < 5);
    const pctBExtreme =
      (bias > 0 && (pb as number) >= 0.65) ||
      (bias < 0 && (pb as number) <= 0.35) ||
      widthExpanding;
    const adxStrong =
      (saf as number) >= adxConfirm || (aMed as number) >= adxConfirm;
    const confirmGate = mixAligned && adxStrong && pctBExtreme && volOk;
    const confirmMag = clamp(
      0.45 * softNorm(Math.max(saf as number, aMed as number), 30) +
        0.35 * Math.abs(pbN) +
        0.2 * (volV != null ? Math.abs(softNorm(volV as number, 40)) : 0),
      0,
      100
    );
    confirm[i] = confirmGate
      ? confirmMag * bias
      : adxStrong && mixAligned
        ? clamp(0.35 * spreadN, -45, 45)
        : 0;

    let st = 0;
    if (confirmGate) st = 3;
    else if (midGate && Math.abs(mid[i] as number) > 15) st = 2;
    else if (earlyWake && Math.abs(early[i] as number) > 18) st = 1;
    const sign = bias !== 0 ? bias : impulseSign || 0;
    stage[i] = st === 0 ? 0 : st * (sign || 1);
  }

  const composite = fillNull(n);
  for (let i = 0; i < n; i++) {
    if (early[i] == null || mid[i] == null || confirm[i] == null) continue;
    composite[i] = clamp(
      0.35 * (early[i] as number) +
        0.35 * (mid[i] as number) +
        0.3 * (confirm[i] as number),
      -100,
      100
    );
  }
  const smoothed = emaNullable(composite, Math.max(2, smoothLen));
  for (let i = 0; i < n; i++) osc[i] = smoothed[i];

  return {
    adx: dmi.adx,
    adxCci,
    adxMedian,
    adxMom,
    plusDI: dmi.plusDI,
    minusDI: dmi.minusDI,
    plusDIMix,
    minusDIMix,
    diSpread: diSpreadOut,
    pctB,
    bbWidth: width,
    early,
    mid,
    confirm,
    stage,
    bias: biasArr,
    osc,
    dx,
  };
}

export const diPumpRadar = adxPumpRadar;
export const adxPumpStages = adxPumpRadar;
