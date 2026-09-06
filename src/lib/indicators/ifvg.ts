/**
 * IFVG chart series + IFVG-gated RSI/SMI/Jurik Stoch — shared with Formasyon IFVG scanner.
 * One detect pass via findInversionFvgSetups (full history for indicators).
 */
import type { Candle } from "@/lib/types";
import {
  findInversionFvgSetups,
  type IfvgSetup,
  type InversionFvgOpts,
} from "@/lib/patterns/inversionFvg";
import { rsi as rsiCalc, smi as smiCalc } from "./math";
import { jurikStoch } from "./jurik";

export type IfvgSeries = {
  zoneTop: (number | null)[];
  zoneBot: (number | null)[];
  bias: (number | null)[];
  inverted: (number | null)[];
  sweep: (number | null)[];
  longSignal: (number | null)[];
  shortSignal: (number | null)[];
  score: (number | null)[];
  entry: (number | null)[];
  stop: (number | null)[];
  tp1: (number | null)[];
};

export type IfvgRsiSeries = {
  rsi: (number | null)[];
  /** RSI only while IFVG bias ≠ 0 — "IFVG uygulanmış RSI" context paint */
  rsiIfvg: (number | null)[];
  longSignal: (number | null)[];
  shortSignal: (number | null)[];
  score: (number | null)[];
  os: number;
  ob: number;
};

export type IfvgSeriesOpts = InversionFvgOpts & {
  /** Bars to extend zone past entry if no later invalidate. Default 8. */
  zoneExtend?: number;
};

function fillNull(n: number): (number | null)[] {
  return new Array(n).fill(null);
}

/**
 * Bar-aligned IFVG zones + retest entry signals (TF-agnostic).
 * Full-series detect, one pass.
 */
export function computeIfvgSeries(
  candles: Candle[],
  opts: IfvgSeriesOpts = {}
): IfvgSeries {
  const n = candles.length;
  const zoneTop = fillNull(n);
  const zoneBot = fillNull(n);
  const bias = fillNull(n);
  const inverted = fillNull(n);
  const sweep = fillNull(n);
  const longSignal = fillNull(n);
  const shortSignal = fillNull(n);
  const score = fillNull(n);
  const entry = fillNull(n);
  const stop = fillNull(n);
  const tp1 = fillNull(n);

  if (n < 40) {
    return {
      zoneTop,
      zoneBot,
      bias,
      inverted,
      sweep,
      longSignal,
      shortSignal,
      score,
      entry,
      stop,
      tp1,
    };
  }

  const zoneExtend = opts.zoneExtend ?? 8;
  const setups = findInversionFvgSetups(candles, {
    ...opts,
    lookbackFvgs: opts.lookbackFvgs ?? 0,
    maxHits: opts.maxHits ?? 0,
    requireEntry: opts.requireEntry ?? false,
  });

  // Chronological paint so later setups override earlier zone/bias
  const ordered = [...setups].sort((a, b) => a.invIdx - b.invIdx);

  for (const u of ordered) {
    paintSetup(candles, u, {
      zoneTop,
      zoneBot,
      bias,
      inverted,
      sweep,
      longSignal,
      shortSignal,
      score,
      entry,
      stop,
      tp1,
      zoneExtend,
    });
  }

  return {
    zoneTop,
    zoneBot,
    bias,
    inverted,
    sweep,
    longSignal,
    shortSignal,
    score,
    entry,
    stop,
    tp1,
  };
}

function paintSetup(
  candles: Candle[],
  u: IfvgSetup,
  out: IfvgSeries & { zoneExtend: number }
) {
  const n = candles.length;
  const entryIdx = u.triggerIdx ?? u.retestIdx;
  const zoneEnd = Math.min(
    n - 1,
    (entryIdx ?? u.invIdx) + out.zoneExtend
  );

  out.inverted[u.invIdx] = 1;
  if (u.sweep) {
    const si = u.sweepIdx ?? u.invIdx;
    out.sweep[si] = 1;
  }

  for (let i = u.invIdx; i <= zoneEnd; i++) {
    // Invalidate if close fully back through zone against bias
    if (i > u.invIdx) {
      const c = candles[i];
      if (u.bull && c.close < u.fvgBot) break;
      if (!u.bull && c.close > u.fvgTop) break;
    }
    out.zoneTop[i] = u.fvgTop;
    out.zoneBot[i] = u.fvgBot;
    out.bias[i] = u.bull ? 1 : -1;
  }

  if (entryIdx != null && entryIdx < n) {
    if (u.bull) out.longSignal[entryIdx] = 1;
    else out.shortSignal[entryIdx] = 1;
    out.score[entryIdx] = u.score;
    out.entry[entryIdx] = u.entry;
    out.stop[entryIdx] = u.stop;
    out.tp1[entryIdx] = u.tp1;
    if (u.sweep) out.sweep[entryIdx] = 1;
  }
}

export type IfvgRsiOpts = IfvgSeriesOpts & {
  rsiPeriod?: number;
  os?: number;
  ob?: number;
};

/**
 * IFVG-applied RSI: full RSI + context (rsiIfvg) + entries gated by IFVG retest
 * and RSI confirm: classic OS/OB (≤os / cross-up; ≥ob / cross-down) OR
 * divergence-friendly mid zone (bull: RSI≤50 / rising below mid; bear: mirror).
 */
export function computeIfvgRsi(
  candles: Candle[],
  opts: IfvgRsiOpts = {}
): IfvgRsiSeries {
  const n = candles.length;
  const rsiPeriod = opts.rsiPeriod ?? 14;
  const os = opts.os ?? 35;
  const ob = opts.ob ?? 65;
  const closes = candles.map((c) => c.close);
  const rsi = rsiCalc(closes, rsiPeriod);
  const rsiIfvg = fillNull(n);
  const longSignal = fillNull(n);
  const shortSignal = fillNull(n);
  const score = fillNull(n);

  const ifvg = computeIfvgSeries(candles, opts);

  for (let i = 0; i < n; i++) {
    if (ifvg.bias[i] != null && ifvg.bias[i] !== 0 && rsi[i] != null) {
      rsiIfvg[i] = rsi[i];
    }
  }

  for (let i = 1; i < n; i++) {
    if (rsi[i] == null || rsi[i - 1] == null) continue;
    const r = rsi[i] as number;
    const rp = rsi[i - 1] as number;
    // Classic OS/OB OR cross from extreme OR divergence-friendly mid zone
    // (bull IFVG retest rarely lands in deep OS — allow rising RSI below mid / not OB)
    const longRsi =
      r <= os ||
      (rp < os && r >= os) ||
      (r < 50 && r > rp) ||
      (r <= 50 && r < ob);
    const shortRsi =
      r >= ob ||
      (rp > ob && r <= ob) ||
      (r > 50 && r < rp) ||
      (r >= 50 && r > os);

    if (ifvg.longSignal[i] === 1 && longRsi) {
      longSignal[i] = 1;
      const base = ifvg.score[i] ?? 60;
      const bonus = r <= os ? 10 : r < 50 ? 6 : 3;
      score[i] = Math.min(100, Math.round(base + bonus));
    }
    if (ifvg.shortSignal[i] === 1 && shortRsi) {
      shortSignal[i] = 1;
      const base = ifvg.score[i] ?? 60;
      const bonus = r >= ob ? 10 : r > 50 ? 6 : 3;
      score[i] = Math.min(100, Math.round(base + bonus));
    }
  }

  return { rsi, rsiIfvg, longSignal, shortSignal, score, os, ob };
}

export type IfvgSmiSeries = {
  smi: (number | null)[];
  signal: (number | null)[];
  /** SMI only while IFVG bias ≠ 0 — context paint */
  smiIfvg: (number | null)[];
  longSignal: (number | null)[];
  shortSignal: (number | null)[];
  score: (number | null)[];
  os: number;
  ob: number;
};

export type IfvgSmiOpts = IfvgSeriesOpts & {
  /** SMI %K length (qLength). Default 14. */
  k?: number;
  /** SMI smoothing (rLength). Default 20. */
  d?: number;
  /** Signal EMA period. Default 5. */
  ema?: number;
  /** Oversold guide (e.g. -40). */
  os?: number;
  /** Overbought guide (e.g. 40). */
  ob?: number;
};

/**
 * IFVG-applied SMI: full SMI + signal + context (smiIfvg) + entries gated by
 * IFVG retest × SMI confirm. Playbook style: prefer smi/signal cross as primary
 * (like smiLongOnly), with soft level filter (smi ≤ 0 long / ≥ 0 short) so
 * mid-trend retests still fire; also rising/falling from OS/OB extremes.
 */
export function computeIfvgSmi(
  candles: Candle[],
  opts: IfvgSmiOpts = {}
): IfvgSmiSeries {
  const n = candles.length;
  const k = opts.k ?? 14;
  const d = opts.d ?? 20;
  const emaPeriod = opts.ema ?? 5;
  const os = opts.os ?? -40;
  const ob = opts.ob ?? 40;
  const { smi: smiLine, signal } = smiCalc(candles, k, d, emaPeriod);
  const smiIfvg = fillNull(n);
  const longSignal = fillNull(n);
  const shortSignal = fillNull(n);
  const score = fillNull(n);

  const ifvg = computeIfvgSeries(candles, opts);

  for (let i = 0; i < n; i++) {
    if (ifvg.bias[i] != null && ifvg.bias[i] !== 0 && smiLine[i] != null) {
      smiIfvg[i] = smiLine[i];
    }
  }

  for (let i = 1; i < n; i++) {
    if (
      smiLine[i] == null ||
      smiLine[i - 1] == null ||
      signal[i] == null ||
      signal[i - 1] == null
    ) {
      continue;
    }
    const s = smiLine[i] as number;
    const sp = smiLine[i - 1] as number;
    const sig = signal[i] as number;
    const sigp = signal[i - 1] as number;
    const crossUp = sp <= sigp && s > sig;
    const crossDn = sp >= sigp && s < sig;
    const rising = s > sp;
    const falling = s < sp;

    // Primary: cross smi/signal with soft mid-level (≤0 / ≥0).
    // Alt: rising/falling from OS/OB, or leave extreme.
    const longSmi =
      (crossUp && s <= 0) ||
      (s < os && rising) ||
      (sp < os && s >= os) ||
      (s < 0 && rising && s >= sig);
    const shortSmi =
      (crossDn && s >= 0) ||
      (s > ob && falling) ||
      (sp > ob && s <= ob) ||
      (s > 0 && falling && s <= sig);

    if (ifvg.longSignal[i] === 1 && longSmi) {
      longSignal[i] = 1;
      const base = ifvg.score[i] ?? 60;
      const bonus = crossUp ? 10 : s < os ? 8 : s < 0 ? 5 : 3;
      score[i] = Math.min(100, Math.round(base + bonus));
    }
    if (ifvg.shortSignal[i] === 1 && shortSmi) {
      shortSignal[i] = 1;
      const base = ifvg.score[i] ?? 60;
      const bonus = crossDn ? 10 : s > ob ? 8 : s > 0 ? 5 : 3;
      score[i] = Math.min(100, Math.round(base + bonus));
    }
  }

  return {
    smi: smiLine,
    signal,
    smiIfvg,
    longSignal,
    shortSignal,
    score,
    os,
    ob,
  };
}

export type IfvgJurikStochSeries = {
  k: (number | null)[];
  d: (number | null)[];
  /** K only while IFVG bias ≠ 0 — context paint */
  kIfvg: (number | null)[];
  longSignal: (number | null)[];
  shortSignal: (number | null)[];
  score: (number | null)[];
  os: number;
  ob: number;
};

export type IfvgJurikStochOpts = IfvgSeriesOpts & {
  /** Stochastic %K lookback. Default 28 (2× jurikStoch preset — slower IFVG gate). */
  kLen?: number;
  /** %D SMA of smoothed K. Default 6 (2×). */
  dLen?: number;
  /** JMA smooth length on raw K. Default 20 (Jurik smooth contribution). */
  jmaLen?: number;
  phase?: number;
  power?: number;
  /** Oversold guide (0–100). Default 20. */
  os?: number;
  /** Overbought guide (0–100). Default 80. */
  ob?: number;
  /**
   * Soft mid filter: require K<50 on long cross / K>50 on short cross
   * (SMI-analogue of ≤0 / ≥0). Default true.
   */
  softMid?: boolean;
};

/**
 * IFVG-applied Jurik Stochastic.
 *
 * Oscillator choice: **`jurikStoch`** (not `jurikKaseStoch`). Both expose k/d-like
 * lines; IFVG gate uses 2× %K/%D of the "Jurik Stochastic" registry preset
 * (kLen=28, dLen=6) plus jmaLen=20 on a classic 0–100 scale — natural for OS≈20 / OB≈80 and
 * mid-50 soft filter. Kase variant adds permission-OHLC / dual-cycle richness
 * but different defaults; keep confluence gates aligned with plain Jurik Stoch.
 *
 * Long: IFVG bull retest AND (K cross above D [soft K<50] OR K rising from OS
 * / leave OS). Short: mirror (cross below D / from OB).
 */
export function computeIfvgJurikStoch(
  candles: Candle[],
  opts: IfvgJurikStochOpts = {}
): IfvgJurikStochSeries {
  const n = candles.length;
  const kLen = opts.kLen ?? 28;
  const dLen = opts.dLen ?? 6;
  const jmaLen = opts.jmaLen ?? 20;
  const phase = opts.phase ?? 50;
  const power = opts.power ?? 2;
  const os = opts.os ?? 20;
  const ob = opts.ob ?? 80;
  const softMid = opts.softMid ?? true;

  const { k, d } = jurikStoch(candles, kLen, dLen, jmaLen, phase, power, "jma");
  const kIfvg = fillNull(n);
  const longSignal = fillNull(n);
  const shortSignal = fillNull(n);
  const score = fillNull(n);

  const ifvg = computeIfvgSeries(candles, opts);

  for (let i = 0; i < n; i++) {
    if (ifvg.bias[i] != null && ifvg.bias[i] !== 0 && k[i] != null) {
      kIfvg[i] = k[i];
    }
  }

  for (let i = 1; i < n; i++) {
    if (
      k[i] == null ||
      k[i - 1] == null ||
      d[i] == null ||
      d[i - 1] == null
    ) {
      continue;
    }
    const kv = k[i] as number;
    const kp = k[i - 1] as number;
    const dv = d[i] as number;
    const dp = d[i - 1] as number;
    const crossUp = kp <= dp && kv > dv;
    const crossDn = kp >= dp && kv < dv;
    const rising = kv > kp;
    const falling = kv < kp;

    // Primary: K/D cross with optional soft mid (K<50 / >50).
    // Alt: rising/falling from OS/OB, or leave extreme.
    const midOkLong = !softMid || kv < 50;
    const midOkShort = !softMid || kv > 50;
    const longJ =
      (crossUp && midOkLong) ||
      (kv < os && rising) ||
      (kp < os && kv >= os) ||
      (kv < 50 && rising && kv >= dv);
    const shortJ =
      (crossDn && midOkShort) ||
      (kv > ob && falling) ||
      (kp > ob && kv <= ob) ||
      (kv > 50 && falling && kv <= dv);

    if (ifvg.longSignal[i] === 1 && longJ) {
      longSignal[i] = 1;
      const base = ifvg.score[i] ?? 60;
      const bonus = crossUp ? 10 : kv < os ? 8 : kv < 50 ? 5 : 3;
      score[i] = Math.min(100, Math.round(base + bonus));
    }
    if (ifvg.shortSignal[i] === 1 && shortJ) {
      shortSignal[i] = 1;
      const base = ifvg.score[i] ?? 60;
      const bonus = crossDn ? 10 : kv > ob ? 8 : kv > 50 ? 5 : 3;
      score[i] = Math.min(100, Math.round(base + bonus));
    }
  }

  return { k, d, kIfvg, longSignal, shortSignal, score, os, ob };
}
