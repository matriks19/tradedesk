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
 *   6) coherence      — NON-tautological agreement (see below)
 *   7) edgeTemp       — 0–100 weighted composite, EMA-smoothed (main oscillator)
 *   8) edgeUp/edgeDown— coherence-weighted ±E directional mix (like ±DI)
 *   9) phase          — 0 cold / 1 probe / 2 armed / 3 fire / 4 exhaust (signed by bias)
 *                       with hysteresis so fire/exhaust are reachable and sticky
 *
 * Coherence (hardened):
 *   Bias is anchored on DI spread (structural lead), NOT on a majority of the
 *   same votes that later count as “coherence”. Coherence then measures whether
 *   independent energy (ER, surprise) and confirmers (flow, diAccel, bbPressure)
 *   agree with that DI lead. Previously, bias = majority(flow,da,bp,spr) and
 *   those same signs were re-counted as coherence → free votes that always fire.
 *
 * Defaults tuned for crypto 15m–1h.
 * Aliases: eliziEdge / eliziMirror (mirror = same compute; pane may mute detail)
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
  /** Coherence gate for armed/fire (default 0.6) */
  coherenceArmed?: number;
  /** edgeTemp fire threshold 0–100 (default 62) */
  fireTemp?: number;
  /** edgeTemp armed threshold (default 48) */
  armedTemp?: number;
  /** edgeTemp probe threshold (default 32) */
  probeTemp?: number;
  /** Include 2nd difference of DI spread in diAccel2 series */
  useSecondDiff?: boolean;
  /**
   * When true (default), plot math still computes all series; UI registry
   * uses detailMode separately. Kept for API symmetry with eliziMirror.
   */
  detailMode?: boolean;
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

/** Soft map |x|/scale → [0,1] via tanh; NaN-safe. */
function softAbs01(x: number, scale: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(scale) || scale <= 0) return 0;
  const z = Math.abs(x) / scale;
  const e2 = Math.exp(2 * clamp(z, 0, 20));
  return (e2 - 1) / (e2 + 1);
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
    if (v == null || !Number.isFinite(v)) {
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
  const erLen = Math.max(2, Math.floor(params.erLen ?? 10));
  const atrLen = Math.max(1, Math.floor(params.atrLen ?? 14));
  const adxPeriod = Math.max(2, Math.floor(params.adxPeriod ?? 14));
  const bbPeriod = Math.max(2, Math.floor(params.bbPeriod ?? 20));
  const bbMult = params.bbMult ?? 2;
  const volLen = Math.max(1, Math.floor(params.volLen ?? 5));
  const volLong = Math.max(volLen + 1, Math.floor(params.volLong ?? 10));
  const flowSmooth = Math.max(1, Math.floor(params.flowSmooth ?? 3));
  const tempSmooth = Math.max(1, Math.floor(params.tempSmooth ?? 4));
  const effHigh = clamp(params.effHigh ?? 0.45, 0.05, 1);
  const surpriseHigh = Math.max(0.05, params.surpriseHigh ?? 0.85);
  const coherenceArmed = clamp(params.coherenceArmed ?? 0.6, 0.1, 1);
  const fireTemp = clamp(params.fireTemp ?? 62, 10, 100);
  const armedTemp = clamp(params.armedTemp ?? 48, 5, fireTemp - 1);
  const probeTemp = clamp(params.probeTemp ?? 32, 1, armedTemp - 1);
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

  // —— 1) pathEfficiency (Kaufman ER) — closed-bar, no look-ahead
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
    if (a == null || !(a > 0) || !Number.isFinite(a)) continue;
    const body = Math.abs(candles[i].close - candles[i].open);
    if (!Number.isFinite(body)) continue;
    volSurprise[i] = body / a;
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
    // Oscillator override only when clearly expanded/contracted
    if (vo != null && Number.isFinite(vo) && Math.abs(vo) > 5) {
      volExpand = vo > 0 ? 1 : -1;
    }
    if (dir === 0 || volExpand === 0) flowRaw[i] = 0;
    else if (dir === volExpand) flowRaw[i] = dir;
    else flowRaw[i] = 0; // conflict → neutral (no fake agreement)
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

  // —— 6–8) coherence, edgeTemp, ±E  (bias = DI-anchored, not circular)
  const FLOW_EPS = 0.12;
  const DA_EPS = 0.35; // DI-spread points per bar
  const BP_EPS = 0.02; // %B velocity

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
    if (
      !Number.isFinite(eff) ||
      !Number.isFinite(sur) ||
      !Number.isFinite(flow) ||
      !Number.isFinite(da) ||
      !Number.isFinite(bp) ||
      !Number.isFinite(spr)
    )
      continue;

    // Bias: DI spread is the structural lead. Flow/da only break a near-flat DI.
    // Track biasSource so the tie-break confirmer is NOT double-counted in coherence.
    const sprDead = Math.abs(spr) < 1.5;
    let bias = 0;
    let biasSource: "di" | "flow" | "da" | "none" = "none";
    if (!sprDead) {
      bias = Math.sign(spr);
      biasSource = "di";
    } else if (Math.abs(flow) >= FLOW_EPS) {
      bias = Math.sign(flow);
      biasSource = "flow";
    } else if (Math.abs(da) >= DA_EPS) {
      bias = Math.sign(da);
      biasSource = "da";
    }
    biasArr[i] = bias;

    // Coherence votes:
    // energy: ER + surprise (always independent);
    // confirmers: flow / diAccel / bb vs bias — skip the source that defined bias
    // when DI is flat (avoids tautology).
    const effVote = eff >= effHigh ? 1 : 0;
    const surVote = sur >= surpriseHigh ? 1 : 0;
    let flowVote = 0;
    let daVote = 0;
    let bpVote = 0;
    if (bias !== 0) {
      if (
        biasSource !== "flow" &&
        Math.abs(flow) >= FLOW_EPS &&
        Math.sign(flow) === bias
      )
        flowVote = 1;
      if (
        biasSource !== "da" &&
        Math.abs(da) >= DA_EPS &&
        Math.sign(da) === bias
      )
        daVote = 1;
      if (Math.abs(bp) >= BP_EPS && Math.sign(bp) === bias) bpVote = 1;
      // When DI leads, all three confirmers may vote — that is real agreement.
    } else {
      // No lead: directional coherence = pairwise agreement among confirmers
      const signs = [
        Math.abs(flow) >= FLOW_EPS ? Math.sign(flow) : 0,
        Math.abs(da) >= DA_EPS ? Math.sign(da) : 0,
        Math.abs(bp) >= BP_EPS ? Math.sign(bp) : 0,
      ].filter((s) => s !== 0);
      if (signs.length >= 2) {
        const up = signs.filter((s) => s > 0).length;
        const agree = Math.max(up, signs.length - up) / signs.length;
        const conf = agree >= 0.66 ? 1 : 0;
        flowVote = conf;
        daVote = conf;
        bpVote = conf;
      }
    }
    const voteSum = effVote + surVote + flowVote + daVote + bpVote;
    const coh = voteSum / 5;
    coherence[i] = coh;

    // edgeTemp 0–100 — stable soft norms (not raw unbounded DI/%B)
    // Weights: efficiency 0.22, surprise 0.22, |flow| 0.18, |diAccel| 0.22, |bbPressure| 0.16
    const effN = clamp(eff, 0, 1);
    const surN = clamp(sur / 2.0, 0, 1);
    const flowN = clamp(Math.abs(flow), 0, 1);
    const daN = softAbs01(da, 3.5);
    const bpN = softAbs01(bp, 0.07);
    const heat =
      100 *
      (0.22 * effN +
        0.22 * surN +
        0.18 * flowN +
        0.22 * daN +
        0.16 * bpN);
    // Mild coherence lift (was 0.7+0.5*coh with tautological coh → chronic overheat)
    const boosted = clamp(heat * (0.82 + 0.28 * coh), 0, 100);
    edgeTempRaw[i] = boosted;

    // ±E: coherence-weighted directional mix
    const mag = boosted * (0.4 + 0.6 * coh);
    if (bias > 0) {
      edgeUp[i] = mag;
      edgeDown[i] = mag * (1 - coh) * 0.3;
    } else if (bias < 0) {
      edgeDown[i] = mag;
      edgeUp[i] = mag * (1 - coh) * 0.3;
    } else {
      edgeUp[i] = mag * 0.3;
      edgeDown[i] = mag * 0.3;
    }
  }

  const edgeTemp = emaNullable(edgeTempRaw, Math.max(2, tempSmooth));
  const edgeUpS = emaNullable(edgeUp, Math.max(2, tempSmooth));
  const edgeDownS = emaNullable(edgeDown, Math.max(2, tempSmooth));
  for (let i = 0; i < n; i++) {
    edgeUp[i] = edgeUpS[i];
    edgeDown[i] = edgeDownS[i];
  }

  // —— 9) Phase machine with hysteresis (fire holds; exhaust is a real exit state)
  for (let i = 0; i < n; i++) {
    const temp = edgeTemp[i];
    const coh = coherence[i];
    const bias = biasArr[i];
    const da = diAccel[i];
    const eff = pathEfficiency[i];
    const sur = volSurprise[i];
    if (
      temp == null ||
      coh == null ||
      bias == null ||
      da == null ||
      eff == null ||
      !Number.isFinite(temp) ||
      !Number.isFinite(coh)
    )
      continue;

    const sign = bias !== 0 ? bias : 1;
    const prevPh = i > 0 && phase[i - 1] != null ? (phase[i - 1] as number) : 0;
    const prevAbs = Math.abs(prevPh);
    const tempPrev =
      i > 0 && edgeTemp[i - 1] != null ? (edgeTemp[i - 1] as number) : temp;
    const risingTemp = temp > tempPrev + 0.15;
    const fallingTemp = temp < tempPrev - 0.35;

    const daPrev = i > 0 ? diAccel[i - 1] : null;
    const effPrev = i > 0 ? pathEfficiency[i - 1] : null;
    const surPrev = i > 0 ? volSurprise[i - 1] : null;

    const daFade =
      daPrev != null &&
      Number.isFinite(daPrev) &&
      Math.abs(da) < Math.abs(daPrev) * 0.55;
    const daOppose = Math.sign(da) !== 0 && Math.sign(da) !== sign;
    const effDrop =
      effPrev != null &&
      Number.isFinite(effPrev) &&
      (eff < effPrev - 0.06 || eff < effHigh * 0.75);
    const surpriseClimax =
      (sur != null && sur >= surpriseHigh * 0.85) ||
      (surPrev != null && surPrev >= surpriseHigh * 0.85);

    // Exhaust: was hot (armed/fire or high temp), heat rolling over, accel dying, ER collapsing.
    // Surprise climax is confirmatory, not mandatory — missing it was making exhaust nearly unreachable.
    const wasHot = prevAbs >= 2 || tempPrev >= armedTemp || temp >= fireTemp * 0.88;
    const exhaust =
      wasHot &&
      fallingTemp &&
      (daFade || daOppose) &&
      effDrop &&
      (surpriseClimax || tempPrev >= fireTemp * 0.9);

    let ph = 0;
    if (exhaust) {
      ph = 4;
    } else {
      // Hold fire: once in fire, stay while heat/coh remain (don't require rising every bar)
      const holdFire =
        prevAbs === 3 &&
        temp >= fireTemp * 0.9 &&
        coh >= coherenceArmed * 0.8;
      // Enter/re-enter fire: hot + coherent; rising OR already armed/fire
      const enterFire =
        temp >= fireTemp &&
        coh >= coherenceArmed &&
        (risingTemp || prevAbs >= 2);
      if (holdFire || enterFire) ph = 3;
      else if (temp >= armedTemp && coh >= coherenceArmed * 0.85) ph = 2;
      else if (temp >= probeTemp) ph = 1;
      else ph = 0;

      // Hysteresis: don't collapse more than one level per bar (exhaust already handled)
      if (prevAbs > 0 && ph < prevAbs - 1) ph = prevAbs - 1;
      // Leaving fire into armed if still warm
      if (prevAbs === 3 && ph < 3 && temp >= armedTemp && coh >= coherenceArmed * 0.75) {
        ph = 2;
      }
    }

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

/** Lightweight alias — same math; UI may plot fewer series via detailMode. */
export const eliziMirror = eliziEdge;
