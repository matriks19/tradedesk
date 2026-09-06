/**
 * IFVG chart series + IFVG-gated RSI — shared with Formasyon IFVG scanner.
 * One detect pass via findInversionFvgSetups (full history for indicators).
 */
import type { Candle } from "@/lib/types";
import {
  findInversionFvgSetups,
  type IfvgSetup,
  type InversionFvgOpts,
} from "@/lib/patterns/inversionFvg";
import { rsi as rsiCalc } from "./math";

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
