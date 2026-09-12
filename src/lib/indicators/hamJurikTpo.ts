import type { Candle } from "@/lib/types";
import { atr, ema, sma, stdev } from "./math";

export type HamJurikEvent = "setup" | "histTurning" | "histCross" | "histPos" | "rawUp" | "rawCrossHist" | "confirm" | "al" | "rawDown" | "histNeg" | "histCrossDown" | "rawCrossHistDown" | "rawCrossOsc" | "rawCrossOscDown" | "dualUp" | "dualDown" | "rawDualUp" | "rawDualDown";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function safeDiv(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

function lowest(values: (number | null)[], i: number, len: number): number {
  let lo = Infinity;
  const start = Math.max(0, i - len + 1);
  for (let j = start; j <= i; j++) {
    const v = values[j];
    if (v != null && v < lo) lo = v;
  }
  return Number.isFinite(lo) ? lo : 0;
}

function highest(values: (number | null)[], i: number, len: number): number {
  let hi = -Infinity;
  const start = Math.max(0, i - len + 1);
  for (let j = start; j <= i; j++) {
    const v = values[j];
    if (v != null && v > hi) hi = v;
  }
  return Number.isFinite(hi) ? hi : 0;
}

function normalize100(values: (number | null)[], len: number): (number | null)[] {
  return values.map((x, i) => {
    if (x == null || i + 1 < len) return null;
    const lo = lowest(values, i, len);
    const hi = highest(values, i, len);
    return 100 * safeDiv(x - lo, Math.max(hi - lo, 1e-10));
  });
}

/** Pine jurikRmaStyle — triple EMA + phase, not community JMA. */
function jurikRmaStyle(src: (number | null)[], len: number, phase: number): (number | null)[] {
  const n = src.length;
  const out: (number | null)[] = new Array(n).fill(null);
  const alpha = 2 / (len + 1);
  const phaseRatio = clamp((phase + 100) / 200, 0, 1);
  let e1: number | null = null;
  let e2: number | null = null;
  let e3: number | null = null;
  for (let i = 0; i < n; i++) {
    const x = src[i];
    if (x == null) continue;
    e1 = e1 == null ? x : e1 + alpha * (x - e1);
    e2 = e2 == null ? e1 : e2 + alpha * (e1 - e2);
    const pred = e1 + phaseRatio * (e1 - e2);
    e3 = e3 == null ? pred : e3 + alpha * (pred - e3);
    out[i] = e3;
  }
  return out;
}

function hamCore(
  src: number[],
  vol: number[],
  hamLen: number,
  momSpan: number,
  rawSmoothLen: number,
  volClampHi: number
): (number | null)[] {
  const n = src.length;
  const volBase = sma(vol, hamLen);
  const momRaw: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ref = i >= momSpan ? src[i - momSpan]! : src[i]!;
    momRaw[i] = safeDiv(src[i]! - ref, Math.abs(ref) + 1e-10) * 100;
  }
  const momSm = ema(momRaw, rawSmoothLen);
  const weighted: number[] = momSm.map((v, i) => {
    if (v == null) return 0;
    const base = volBase[i] ?? 0;
    const vr = clamp(safeDiv(vol[i]!, base + 1e-10), 0, volClampHi);
    return v * vr;
  });
  const weightedSm = ema(weighted, rawSmoothLen);
  const filled = weightedSm.map((v) => v ?? 0);
  const dev = stdev(filled, hamLen);
  return filled.map((v, i) => {
    if (weightedSm[i] == null || dev[i] == null) return null;
    return safeDiv(v, (dev[i] as number) + 1e-10);
  });
}

export function hamJurikTpo(
  candles: Candle[],
  opts: {
    hamLen?: number;
    hamLenSlow?: number;
    rawLen?: number;
    rawLenSlow?: number;
    momSpan?: number;
    normLen?: number;
    rawSmoothLen?: number;
    rawDisplayLen?: number;
    volClampHi?: number;
    jLen?: number;
    jPhase?: number;
    postSmooth?: number;
    pivLen?: number;
    bandMin?: number;
    bandMax?: number;
    bandMult?: number;
  } = {}
) {
  const n = candles.length;
  const hamLen = opts.hamLen ?? 21;
  const hamLenSlow = opts.hamLenSlow ?? 34;
  const rawLen = opts.rawLen ?? 10;
  const rawLenSlow = opts.rawLenSlow ?? 21;
  const momSpan = opts.momSpan ?? 10;
  const normLen = opts.normLen ?? 80;
  const rawSmoothLen = opts.rawSmoothLen ?? 4;
  const rawDisplayLen = opts.rawDisplayLen ?? 2;
  const volClampHi = opts.volClampHi ?? 2.2;
  const jLen = opts.jLen ?? 20;
  const jPhase = opts.jPhase ?? 0;
  const postSmooth = opts.postSmooth ?? 5;
  const pivLen = opts.pivLen ?? 5;
  const bandMin = opts.bandMin ?? 5;
  const bandMax = opts.bandMax ?? 50;
  const bandMult = opts.bandMult ?? 1;

  const osc: (number | null)[] = new Array(n).fill(null);
  const oscSlow: (number | null)[] = new Array(n).fill(null);
  const oscDisplay: (number | null)[] = new Array(n).fill(null);
  const rawSlow: (number | null)[] = new Array(n).fill(null);
  const hist: (number | null)[] = new Array(n).fill(null);
  const band: (number | null)[] = new Array(n).fill(null);
  const regime: number[] = new Array(n).fill(0);
  const rawUp: boolean[] = new Array(n).fill(false);
  const histTurning: boolean[] = new Array(n).fill(false);
  const histPos: boolean[] = new Array(n).fill(false);
  const histCross: boolean[] = new Array(n).fill(false);
  const rawCrossHist: boolean[] = new Array(n).fill(false);
  const rawDown: boolean[] = new Array(n).fill(false);
  const histNeg: boolean[] = new Array(n).fill(false);
  const histCrossDown: boolean[] = new Array(n).fill(false);
  const rawCrossHistDown: boolean[] = new Array(n).fill(false);
  const rawCrossOsc: boolean[] = new Array(n).fill(false);
  const rawCrossOscDown: boolean[] = new Array(n).fill(false);
  const dualCrossUp: boolean[] = new Array(n).fill(false);
  const dualCrossDown: boolean[] = new Array(n).fill(false);
  const rawDualUp: boolean[] = new Array(n).fill(false);
  const rawDualDown: boolean[] = new Array(n).fill(false);
  const bullFlip: boolean[] = new Array(n).fill(false);
  const bearFlip: boolean[] = new Array(n).fill(false);
  const histColor: (string | null)[] = new Array(n).fill(null);

  if (n < 30) {
    return {
      osc,
      oscSlow,
      oscDisplay,
      rawSlow,
      hist,
      band,
      regime,
      rawUp,
      rawDown,
      histTurning,
      histPos,
      histNeg,
      histCross,
      histCrossDown,
      rawCrossHist,
      rawCrossHistDown,
      rawCrossOsc,
      rawCrossOscDown,
      dualCrossUp,
      dualCrossDown,
      rawDualUp,
      rawDualDown,
      bullFlip,
      bearFlip,
      histColor,
    };
  }

  const src = candles.map((c) => c.close);
  const vol = candles.map((c) => c.volume || 0);
  const hamRaw = hamCore(src, vol, hamLen, momSpan, rawSmoothLen, volClampHi);
  const hamSmooth = jurikRmaStyle(hamRaw, jLen, jPhase);
  const hamFinal = ema(
    hamSmooth.map((v) => v ?? 0),
    postSmooth
  );

  const nFinal = normalize100(hamFinal, normLen);
  for (let i = 0; i < n; i++) {
    if (nFinal[i] != null) osc[i] = ((nFinal[i] as number) - 50) * 2;
  }

  const rawFastCore = hamCore(src, vol, rawLen, momSpan, rawSmoothLen, volClampHi);
  const rawSlowCore = hamCore(src, vol, rawLenSlow, momSpan, rawSmoothLen, volClampHi);
  const rawFastDisp = ema(rawFastCore.map((v) => v ?? 0), rawDisplayLen);
  const rawSlowDisp = ema(rawSlowCore.map((v) => v ?? 0), rawDisplayLen);
  const nRawF = normalize100(rawFastDisp, normLen);
  const nRawS = normalize100(rawSlowDisp, normLen);
  for (let i = 0; i < n; i++) {
    if (nRawF[i] != null) oscDisplay[i] = ((nRawF[i] as number) - 50) * 2;
    if (nRawS[i] != null) rawSlow[i] = ((nRawS[i] as number) - 50) * 2;
  }

  const hamRawSlow = hamCore(src, vol, hamLenSlow, momSpan, rawSmoothLen, volClampHi);
  const hamSmoothSlow = jurikRmaStyle(hamRawSlow, jLen, jPhase);
  const hamFinalSlow = ema(
    hamSmoothSlow.map((v) => v ?? 0),
    postSmooth
  );
  const nFinalSlow = normalize100(hamFinalSlow, normLen);
  for (let i = 0; i < n; i++) {
    if (nFinalSlow[i] != null) oscSlow[i] = ((nFinalSlow[i] as number) - 50) * 2;
  }

  const oscFilled = osc.map((v, i) => {
    if (v != null) return v;
    for (let j = i - 1; j >= 0; j--) if (osc[j] != null) return osc[j] as number;
    return 0;
  });
  const oscEma = ema(oscFilled, Math.max(2, postSmooth * 2));
  for (let i = 0; i < n; i++) {
    if (osc[i] != null && oscEma[i] != null) hist[i] = (osc[i] as number) - (oscEma[i] as number);
  }

  // Trend pulse regime (Pine, without barstate.isconfirmed — last bar still live)
  const atr50 = atr(candles, 50);
  const atrNorm = normalize100(atr50, normLen);
  let pivot: number | null = null;
  let reg = 0;
  let dynLen = bandMin;
  for (let i = 0; i < n; i++) {
    const o = osc[i];
    if (o == null) {
      regime[i] = reg;
      continue;
    }
    if (i >= pivLen * 2) {
      const pi = i - pivLen;
      const pv = osc[pi];
      if (pv != null) {
        let isLow = true;
        for (let k = pi - pivLen; k <= pi + pivLen; k++) {
          if (k === pi || k < 0 || k > i) continue;
          if (osc[k] != null && (osc[k] as number) <= pv) isLow = false;
        }
        if (isLow) pivot = pv;
      }
    }
    if (pivot != null && i >= 1 && osc[i - 1] != null) {
      const prev = osc[i - 1] as number;
      if (prev >= pivot && o < pivot) reg = -1;
    }
    if (reg === -1 && dynLen < bandMax) dynLen += 1;

    let smaOsc = 0;
    let cnt = 0;
    const from = Math.max(0, i - dynLen + 1);
    for (let j = from; j <= i; j++) {
      if (osc[j] != null) {
        smaOsc += osc[j] as number;
        cnt += 1;
      }
    }
    const offset = (atrNorm[i] ?? 0) * bandMult * 0.25;
    const b = (cnt ? smaOsc / cnt : o) + offset;
    band[i] = b;
    if (i >= 1 && osc[i - 1] != null && (osc[i - 1] as number) <= b && o > b) {
      reg = 1;
      dynLen = bandMin;
    }
    if (reg === 0) reg = o >= 0 ? 1 : -1;
    const prevReg = i >= 1 ? regime[i - 1] : 0;
    regime[i] = reg;
    if (reg === 1 && prevReg === -1) bullFlip[i] = true;
    if (reg === -1 && prevReg === 1) bearFlip[i] = true;
  }

  const UP = "#00c878";
  const UP_FADE = "#006446";
  const DN = "#dc283c";
  const DN_FADE = "#8c1e28";
  for (let i = 0; i < n; i++) {
    const h = hist[i];
    const h1 = i >= 1 ? hist[i - 1] : null;
    const d = oscDisplay[i];
    const d1 = i >= 1 ? oscDisplay[i - 1] : null;
    if (d != null && d1 != null && d > d1) rawUp[i] = true;
    if (d != null && d1 != null && d < d1) rawDown[i] = true;
    const o = osc[i];
    const o1 = i >= 1 ? osc[i - 1] : null;
    if (d != null && d1 != null && h != null && h1 != null) {
      if (d1 <= h1 && d > h) rawCrossHist[i] = true;
      if (d1 >= h1 && d < h) rawCrossHistDown[i] = true;
    }
    if (d != null && d1 != null && o != null && o1 != null) {
      if (d1 <= o1 && d > o) rawCrossOsc[i] = true;
      if (d1 >= o1 && d < o) rawCrossOscDown[i] = true;
    }
    const s0 = oscSlow[i];
    const s1 = i >= 1 ? oscSlow[i - 1] : null;
    if (o != null && o1 != null && s0 != null && s1 != null) {
      if (o1 <= s1 && o > s0) dualCrossUp[i] = true;
      if (o1 >= s1 && o < s0) dualCrossDown[i] = true;
    }
    const rs = rawSlow[i];
    const rs1 = i >= 1 ? rawSlow[i - 1] : null;
    if (d != null && d1 != null && rs != null && rs1 != null) {
      if (d1 <= rs1 && d > rs) rawDualUp[i] = true;
      if (d1 >= rs1 && d < rs) rawDualDown[i] = true;
    }
    if (h != null) {
      histPos[i] = h >= 0;
      histNeg[i] = h < 0;
      if (h1 != null) {
        if (h < 0 && h >= h1) histTurning[i] = true;
        if (h >= 0 && h1 < 0) histCross[i] = true;
        if (h < 0 && h1 >= 0) histCrossDown[i] = true;
        const rising = h >= h1;
        histColor[i] =
          h >= 0 ? (rising ? UP : UP_FADE) : rising ? DN_FADE : DN;
      }
    }
  }

  return {
    osc,
    oscSlow,
    oscDisplay,
    rawSlow,
    hist,
    band,
    regime,
    rawUp,
    rawDown,
    histTurning,
    histPos,
    histNeg,
    histCross,
    histCrossDown,
    rawCrossHist,
    rawCrossHistDown,
    rawCrossOsc,
    rawCrossOscDown,
    dualCrossUp,
    dualCrossDown,
    rawDualUp,
    rawDualDown,
    bullFlip,
    bearFlip,
    histColor,
  };
}

export function recentHamJurik(
  candles: Candle[],
  event: HamJurikEvent,
  maxBarsAgo = 2,
  opts: Parameters<typeof hamJurikTpo>[1] = {}
): { ok: boolean; barsAgo: number; note: string } {
  if (candles.length < 80) return { ok: false, barsAgo: -1, note: "" };
  const h = hamJurikTpo(candles, opts);
  const n = candles.length;
  for (let ago = 0; ago <= maxBarsAgo; ago++) {
    const i = n - 1 - ago;
    if (i < 1) break;
    if (event === "rawUp" && h.rawUp[i])
      return { ok: true, barsAgo: ago, note: `HAM raw↑ (−${ago})` };
    if (event === "rawDown" && h.rawDown[i])
      return { ok: true, barsAgo: ago, note: `HAM raw↓ (−${ago})` };
    if (event === "histTurning" && h.histTurning[i])
      return { ok: true, barsAgo: ago, note: `hist→0 (−${ago})` };
    if (event === "histPos" && h.histPos[i])
      return { ok: true, barsAgo: ago, note: `hist+ (−${ago})` };
    if (event === "histNeg" && h.histNeg[i])
      return { ok: true, barsAgo: ago, note: `hist− (−${ago})` };
    if (event === "histCross" && h.histCross[i])
      return { ok: true, barsAgo: ago, note: `hist+ kesişim (−${ago})` };
    if (event === "histCrossDown" && h.histCrossDown[i])
      return { ok: true, barsAgo: ago, note: `hist− kesişim (−${ago})` };
    if (event === "rawCrossHist" && h.rawCrossHist[i])
      return { ok: true, barsAgo: ago, note: `raw×hist alttan (−${ago})` };
    if (event === "rawCrossHistDown" && h.rawCrossHistDown[i])
      return { ok: true, barsAgo: ago, note: `raw×hist üstten (−${ago})` };
    if (event === "rawCrossOsc" && h.rawCrossOsc[i])
      return { ok: true, barsAgo: ago, note: `raw×osc↑ (−${ago})` };
    if (event === "rawCrossOscDown" && h.rawCrossOscDown[i])
      return { ok: true, barsAgo: ago, note: `raw×osc↓ (−${ago})` };
    if (event === "dualUp" && h.dualCrossUp[i])
      return { ok: true, barsAgo: ago, note: `HAM hızlı×yavaş↑ (−${ago})` };
    if (event === "dualDown" && h.dualCrossDown[i])
      return { ok: true, barsAgo: ago, note: `HAM hızlı×yavaş↓ (−${ago})` };
    if (event === "rawDualUp" && h.rawDualUp[i])
      return { ok: true, barsAgo: ago, note: `raw hızlı×yavaş↑ (−${ago})` };
    if (event === "rawDualDown" && h.rawDualDown[i])
      return { ok: true, barsAgo: ago, note: `raw hızlı×yavaş↓ (−${ago})` };
    if (event === "confirm" && (h.histCross[i] || h.rawCrossHist[i]))
      return { ok: true, barsAgo: ago, note: h.rawCrossHist[i] ? `raw×hist (−${ago})` : `hist+ (−${ago})` };
    if (event === "setup" && h.rawUp[i] && h.histTurning[i])
      return { ok: true, barsAgo: ago, note: `HAM↑ hist dönüyor (−${ago})` };
    if (event === "al" && h.rawUp[i] && (h.histPos[i] || h.histCross[i] || h.rawCrossHist[i]))
      return { ok: true, barsAgo: ago, note: `HAM AL (−${ago})` };
  }
  return { ok: false, barsAgo: -1, note: "" };
}
