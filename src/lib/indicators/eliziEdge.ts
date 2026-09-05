/**
 * Elizi Edge — cross-signal coherence + surprise + acceleration
 *
 * Thesis: one oscillator alone lies. Ask instead:
 *   “Is the market agreeing with itself, exploding vs ATR, and accelerating
 *    before classic ADX ≥25 confirms?”
 *
 * Components (OHLCV only):
 *   1) pathEfficiency — Kaufman ER: |close−close[n]| / Σ|Δclose| over erLen
 *   2) volSurprise    — |close−open| / ATR(atrLen)  (bar shock vs typical range)
 *   3) flowAgree      — candle direction × volume expansion (+1/−1/0), EMA-smoothed
 *   4) diAccel        — Δ(+DI − −DI) from adx(); optional 2nd diff diAccel2
 *   5) bbPressure     — Δ(%B) — band pressure velocity
 *   6) coherence      — fraction of {eff↑, surprise↑, flow, diAccel, bbPressure}
 *                       voting together (0–1)
 *   7) edgeTemp       — 0–100 weighted composite, EMA-smoothed (main oscillator)
 *   8) edgeUp/edgeDown— coherence-weighted ±E directional mix (like ±DI)
 *   9) phase          — 0 cold / 1 probe / 2 armed / 3 fire / 4 exhaust (signed by bias)
 *
 * Defaults tuned for crypto 15m–1h.
 * Aliases: eliziEdge / eliziMirror (mirror = same compute; pane can mute raws)
 */
import type { Candle } from "@/lib/types";
import { adx, atr, bbPercentB, closes, sma, volumeOsc } from "./math";

export interface EliziEdgeParams {
  /** Kaufman ER window (default 10) */
  erLen?: number;
  /** ATR for surprise (default 14) */
  atrLen?: number;
  /** ADX/DI period for diAccel (default 14) */
  adxPeriod?: number;
  /** BB %B period (default 20) */
  bbPeriod?: number;
  bbMult?: number;
  /** Volume SMA / osc short (default 5) */
  volLen?: number;
  /** Volume osc long (default 10) */
  volLong?: number;
  /** flowAgree EMA smooth (default 3) */
  flowSmooth?: number;
  /** edgeTemp EMA smooth (default 4) */
  tempSmooth?: number;
  /** Efficiency “high” vote threshold (default 0.45) */
  effHigh?: number;
  /** Surprise “elevated” vote threshold in ATR units (default 0.85) */
  surpriseHigh?: number;
  /** Coherence vote weight mix / probe gates */
  coherenceArmed?: number;
  /** edgeTemp fire threshold 0–100 (default 62) */
  fireTemp?: number;
  /** edgeTemp armed threshold (default 48) */
  armedTemp?: number;
  /** edgeTemp probe threshold (default 32) */
  probeTemp?: number;
  /** Include 2nd difference of DI spread in diAccel2 series */
  useSecondDiff?: boolean;
}

export interface EliziEdgeResult {
  pathEfficiency: (number | null)[];
  volSurprise: (number | null)[];
  flowAgree: (number | null)[];
  diSpread: (number | null)[];
  diAccel: (number | null)[];
  diAccel2: (number | null)[];
  bbPressure: (number | null)[];
  pctB: (number | null)[];
  coherence: (number | null)[];
  /** Main 0–100 oscillator */
  edgeTemp: (number | null)[];
  /** Elizi +E / −E */
  edgeUp: (number | null)[];
  edgeDown: (number | null)[];
  /**
   * Phase magnitude 0–4, signed by bias:
   * 0 cold, ±1 probe, ±2 armed, ±3 fire, ±4 exhaust
   */
  phase: (number | null)[];
  bias: (number | null)[];
  plusDI: (number | null)[];
  minusDI: (number | null)[];
  adx: (number | null)[];
}

function fillNull(n: number): (number | null)[] {
  return new Array(n).fill(null);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function softNorm(x: number, scale: number): number {
  const z = x / Math.max(scale, 1e-9);
  const e2 = Math.exp(2 * clamp(z, -20, 20));
  return (e2 - 1) / (e2 + 1); // [-1,1]
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

/**
 * Elizi Edge — coherence / surprise / acceleration composite.
 */
export function eliziEdge(
  candles: Candle[],
  params: EliziEdgeParams = {}
): EliziEdgeResult {
  const erLen = params.erLen ?? 10;
  const atrLen = params.atrLen ?? 14;
  const adxPeriod = params.adxPeriod ?? 14;
  const bbPeriod = params.bbPeriod ?? 20;
  const bbMult = params.bbMult ?? 2;
  const volLen = params.volLen ?? 5;
  const volLong = params.volLong ?? 10;
  const flowSmooth = params.flowSmooth ?? 3;
  const tempSmooth = params.tempSmooth ?? 4;
  const effHigh = params.effHigh ?? 0.45;
  const surpriseHigh = params.surpriseHigh ?? 0.85;
  const coherenceArmed = params.coherenceArmed ?? 0.6;
  const fireTemp = params.fireTemp ?? 62;
  const armedTemp = params.armedTemp ?? 48;
  const probeTemp = params.probeTemp ?? 32;
  const useSecondDiff = params.useSecondDiff !== false;

  const n = candles.length;
  const pathEfficiency = fillNull(n);
  const volSurprise = fillNull(n);
  const flowRaw = fillNull(n);
  const diAccel = fillNull(n);
  const diAccel2 = fillNull(n);
  const bbPressure = fillNull(n);
  const coherence = fillNull(n);
  const edgeTempRaw = fillNull(n);
  const edgeUp = fillNull(n);
  const edgeDown = fillNull(n);
  const phase = fillNull(n);
  const biasArr = fillNull(n);
  const diSpread = fillNull(n);

  const empty = (): EliziEdgeResult => ({
    pathEfficiency,
    volSurprise,
    flowAgree: fillNull(n),
    diSpread,
    diAccel,
    diAccel2,
    bbPressure,
    pctB: fillNull(n),
    coherence,
    edgeTemp: fillNull(n),
    edgeUp,
    edgeDown,
    phase,
    bias: biasArr,
    plusDI: fillNull(n),
    minusDI: fillNull(n),
    adx: fillNull(n),
  });

  if (n === 0) return empty();

  const c = closes(candles);
  const atrSeries = atr(candles, atrLen);
  const dmi = adx(candles, adxPeriod);
  const pctB = bbPercentB(c, bbPeriod, bbMult);
  const vols = candles.map((x) => x.volume);
  const volSma = sma(vols, volLen);
  const volOsc = volumeOsc(candles, volLen, volLong);

  // —— 1) pathEfficiency (Kaufman ER)
  for (let i = 0; i < n; i++) {
    if (i < erLen) continue;
    const net = Math.abs(c[i] - c[i - erLen]);
    let path = 0;
    for (let j = i - erLen + 1; j <= i; j++) {
      path += Math.abs(c[j] - c[j - 1]);
    }
    pathEfficiency[i] = path > 1e-12 ? clamp(net / path, 0, 1) : 0;
  }

  // —— 2) volSurprise = |close−open| / ATR
  for (let i = 0; i < n; i++) {
    const a = atrSeries[i];
    if (a == null || a <= 0) continue;
    volSurprise[i] = Math.abs(candles[i].close - candles[i].open) / a;
  }

  // —— 3) flowAgree raw: direction vs volume expansion
  for (let i = 0; i < n; i++) {
    const dir =
      candles[i].close > candles[i].open
        ? 1
        : candles[i].close < candles[i].open
          ? -1
          : 0;
    const vs = volSma[i];
    const vo = volOsc[i];
    let volExpand = 0;
    if (vs != null && vs > 0) {
      volExpand = vols[i] > vs ? 1 : vols[i] < vs * 0.85 ? -1 : 0;
    }
    if (vo != null && Math.abs(vo) > 5) {
      volExpand = vo > 0 ? 1 : -1;
    }
    if (dir === 0 || volExpand === 0) flowRaw[i] = 0;
    else if (dir === volExpand) flowRaw[i] = dir;
    else flowRaw[i] = 0;
  }
  const flowAgree = emaNullable(flowRaw, Math.max(2, flowSmooth));

  // —— 4) diAccel = Δ(DI spread); diAccel2 = Δ(diAccel)
  for (let i = 0; i < n; i++) {
    const p = dmi.plusDI[i];
    const m = dmi.minusDI[i];
    if (p == null || m == null) continue;
    diSpread[i] = (p as number) - (m as number);
  }
  for (let i = 1; i < n; i++) {
    if (diSpread[i] == null || diSpread[i - 1] == null) continue;
    diAccel[i] = (diSpread[i] as number) - (diSpread[i - 1] as number);
  }
  if (useSecondDiff) {
    for (let i = 2; i < n; i++) {
      if (diAccel[i] == null || diAccel[i - 1] == null) continue;
      diAccel2[i] = (diAccel[i] as number) - (diAccel[i - 1] as number);
    }
  }

  // —— 5) bbPressure = Δ(%B)
  for (let i = 1; i < n; i++) {
    if (pctB[i] == null || pctB[i - 1] == null) continue;
    bbPressure[i] = (pctB[i] as number) - (pctB[i - 1] as number);
  }

  // —— 6–9) coherence, edgeTemp, ±E, phase
  for (let i = 0; i < n; i++) {
    const eff = pathEfficiency[i];
    const sur = volSurprise[i];
    const flow = flowAgree[i];
    const da = diAccel[i];
    const bp = bbPressure[i];
    const spr = diSpread[i];
    if (
      eff == null ||
      sur == null ||
      flow == null ||
      da == null ||
      bp == null ||
      spr == null
    )
      continue;

    // Bias from DI spread + flow + bb pressure
    const flowSign = Math.sign(flow);
    const daSign = Math.sign(da);
    const bpSign = Math.sign(bp);
    const sprSign = Math.sign(spr);
    let bias = 0;
    const votes =
      (sprSign !== 0 ? sprSign : 0) +
      (flowSign !== 0 ? flowSign : 0) +
      (daSign !== 0 ? daSign : 0) +
      (bpSign !== 0 ? bpSign : 0);
    if (votes > 0) bias = 1;
    else if (votes < 0) bias = -1;
    else if (sprSign !== 0) bias = sprSign;
    biasArr[i] = bias;

    // Coherence votes (5 binary)
    const effVote = (eff as number) >= effHigh ? 1 : 0;
    const surVote = (sur as number) >= surpriseHigh ? 1 : 0;
    const flowVote =
      bias !== 0 && flowSign === bias ? 1 : flowSign === 0 ? 0 : 0;
    const daVote = bias !== 0 && daSign === bias ? 1 : 0;
    const bpVote = bias !== 0 && bpSign === bias ? 1 : 0;
    const voteSum = effVote + surVote + flowVote + daVote + bpVote;
    const coh = voteSum / 5;
    coherence[i] = coh;

    // edgeTemp 0–100 composite (unsigned heat), then signed by bias for ±E
    // Weights: efficiency 0.22, surprise 0.22, |flow| 0.18, |diAccel| 0.22, |bbPressure| 0.16
    const effN = clamp(eff as number, 0, 1);
    const surN = clamp((sur as number) / 2.2, 0, 1);
    const flowN = clamp(Math.abs(flow as number), 0, 1);
    const daN = clamp(Math.abs(softNorm(da as number, 4)), 0, 1);
    const bpN = clamp(Math.abs(softNorm(bp as number, 0.08)), 0, 1);
    const heat =
      100 *
      (0.22 * effN +
        0.22 * surN +
        0.18 * flowN +
        0.22 * daN +
        0.16 * bpN);
    // Coherence boost: high agreement lifts temp
    const boosted = clamp(heat * (0.7 + 0.5 * coh), 0, 100);
    edgeTempRaw[i] = boosted;

    // ±E: coherence-weighted directional mix (split like ±DI)
    const mag = boosted * (0.35 + 0.65 * coh);
    if (bias > 0) {
      edgeUp[i] = mag;
      edgeDown[i] = mag * (1 - coh) * 0.35;
    } else if (bias < 0) {
      edgeDown[i] = mag;
      edgeUp[i] = mag * (1 - coh) * 0.35;
    } else {
      edgeUp[i] = mag * 0.35;
      edgeDown[i] = mag * 0.35;
    }
  }

  const edgeTemp = emaNullable(edgeTempRaw, Math.max(2, tempSmooth));
  // Smooth ±E lightly
  const edgeUpS = emaNullable(edgeUp, Math.max(2, tempSmooth));
  const edgeDownS = emaNullable(edgeDown, Math.max(2, tempSmooth));
  for (let i = 0; i < n; i++) {
    edgeUp[i] = edgeUpS[i];
    edgeDown[i] = edgeDownS[i];
  }

  // Phase machine
  for (let i = 0; i < n; i++) {
    const temp = edgeTemp[i];
    const coh = coherence[i];
    const bias = biasArr[i];
    const da = diAccel[i];
    const eff = pathEfficiency[i];
    const sur = volSurprise[i];
    if (temp == null || coh == null || bias == null || da == null || eff == null)
      continue;

    const sign = (bias as number) !== 0 ? (bias as number) : 1;
    let ph = 0; // cold

    const risingTemp =
      i > 0 &&
      edgeTemp[i - 1] != null &&
      (temp as number) > (edgeTemp[i - 1] as number);

    // Exhaust: high heat but diAccel fades + efficiency drops (trap)
    const daFade =
      i > 0 &&
      diAccel[i - 1] != null &&
      Math.abs(da as number) < Math.abs(diAccel[i - 1] as number) * 0.65;
    const effDrop =
      i > 0 &&
      pathEfficiency[i - 1] != null &&
      (eff as number) < (pathEfficiency[i - 1] as number) - 0.05;
    const exhaust =
      (temp as number) >= fireTemp * 0.9 &&
      (daFade || Math.sign(da as number) !== sign) &&
      (effDrop || (eff as number) < effHigh * 0.85) &&
      (sur == null || (sur as number) >= surpriseHigh * 0.7);

    if (exhaust) ph = 4;
    else if (
      (temp as number) >= fireTemp &&
      (coh as number) >= coherenceArmed &&
      risingTemp
    )
      ph = 3;
    else if (
      (temp as number) >= armedTemp &&
      (coh as number) >= coherenceArmed * 0.85
    )
      ph = 2;
    else if ((temp as number) >= probeTemp) ph = 1;
    else ph = 0;

    phase[i] = ph === 0 ? 0 : ph * sign;
  }

  return {
    pathEfficiency,
    volSurprise,
    flowAgree,
    diSpread,
    diAccel,
    diAccel2,
    bbPressure,
    pctB,
    coherence,
    edgeTemp,
    edgeUp,
    edgeDown,
    phase,
    bias: biasArr,
    plusDI: dmi.plusDI,
    minusDI: dmi.minusDI,
    adx: dmi.adx,
  };
}

/** Lightweight alias — same math; UI may plot fewer series. */
export const eliziMirror = eliziEdge;
