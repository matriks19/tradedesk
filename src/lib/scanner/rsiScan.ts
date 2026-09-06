import type { Candle } from "@/lib/types";
import { closes, rsi } from "@/lib/indicators/math";

export type RsiBreakDirection = "up" | "down";

/** Soft bias / zone hint for UI labels */
export type RsiBiasHint =
  | "os_exit_al"
  | "os_entry"
  | "mid_bull"
  | "mid_bear"
  | "ob_entry"
  | "ob_exit_sat"
  | "custom_up"
  | "custom_down";

export type RsiBreakHit = {
  level: number;
  direction: RsiBreakDirection;
  /** Bars since break (0 = current/last closed bar) */
  barsAgo: number;
  rsi: number;
  hint: RsiBiasHint;
  /** Turkish UI label */
  labelTr: string;
};

export type DetectRsiBreakOpts = {
  period?: number;
  /** Levels to watch (default 30 / 50 / 70) */
  levels?: number[];
  /** Look back this many bars for the most recent break (default 20) */
  maxBarsAgo?: number;
  /** Filter directions; omit / empty = both */
  directions?: RsiBreakDirection[];
};

const DEFAULT_LEVELS = [30, 50, 70];

export function rsiBreakLabelTr(
  level: number,
  direction: RsiBreakDirection
): { hint: RsiBiasHint; labelTr: string } {
  if (level === 30 && direction === "up")
    return { hint: "os_exit_al", labelTr: "OS çıkış / AL soft" };
  if (level === 30 && direction === "down")
    return { hint: "os_entry", labelTr: "OS giriş" };
  if (level === 50 && direction === "up")
    return { hint: "mid_bull", labelTr: "mid bull" };
  if (level === 50 && direction === "down")
    return { hint: "mid_bear", labelTr: "mid bear" };
  if (level === 70 && direction === "up")
    return { hint: "ob_entry", labelTr: "OB giriş" };
  if (level === 70 && direction === "down")
    return { hint: "ob_exit_sat", labelTr: "OB çıkış / SAT soft" };
  return {
    hint: direction === "up" ? "custom_up" : "custom_down",
    labelTr: `${level}${direction === "up" ? "↑" : "↓"}`,
  };
}

/** Extreme levels (30/70) rank above mid (50) when multiple break on the same bar. */
function breakStrength(level: number): number {
  return Math.abs(level - 50);
}

function crossedLevelUp(
  series: (number | null)[],
  level: number,
  i: number
): boolean {
  if (i < 1) return false;
  const prev = series[i - 1];
  const curr = series[i];
  if (prev == null || curr == null) return false;
  return prev <= level && curr > level;
}

function crossedLevelDown(
  series: (number | null)[],
  level: number,
  i: number
): boolean {
  if (i < 1) return false;
  const prev = series[i - 1];
  const curr = series[i];
  if (prev == null || curr == null) return false;
  return prev >= level && curr < level;
}

function collectBreaksAt(
  series: (number | null)[],
  i: number,
  last: number,
  levels: number[],
  allowUp: boolean,
  allowDown: boolean
): RsiBreakHit[] {
  const rv = series[i];
  if (rv == null) return [];
  const hits: RsiBreakHit[] = [];
  for (const level of levels) {
    if (allowUp && crossedLevelUp(series, level, i)) {
      const { hint, labelTr } = rsiBreakLabelTr(level, "up");
      hits.push({
        level,
        direction: "up",
        barsAgo: last - i,
        rsi: rv,
        hint,
        labelTr,
      });
    }
    if (allowDown && crossedLevelDown(series, level, i)) {
      const { hint, labelTr } = rsiBreakLabelTr(level, "down");
      hits.push({
        level,
        direction: "down",
        barsAgo: last - i,
        rsi: rv,
        hint,
        labelTr,
      });
    }
  }
  return hits;
}

function pickStrongest(hits: RsiBreakHit[]): RsiBreakHit {
  return hits.reduce((best, h) =>
    breakStrength(h.level) > breakStrength(best.level) ? h : best
  );
}

/**
 * Find the most recent RSI level break within maxBarsAgo.
 * Up: prev ≤ L, curr > L; Down: prev ≥ L, curr < L.
 * If several levels break on the same freshest bar, pick the strongest (extreme > mid).
 */
export function detectRsiBreak(
  candles: Candle[],
  opts: DetectRsiBreakOpts = {}
): RsiBreakHit | null {
  const hits = detectRsiBreaks(candles, opts);
  return hits[0] ?? null;
}

/**
 * All RSI level breaks within maxBarsAgo, newest first.
 * Same-bar multi-level breaks are ordered by strength (extreme first).
 */
export function detectRsiBreaks(
  candles: Candle[],
  opts: DetectRsiBreakOpts = {}
): RsiBreakHit[] {
  const period = opts.period ?? 14;
  const levels = (opts.levels?.length ? opts.levels : DEFAULT_LEVELS).slice();
  const maxBarsAgo = opts.maxBarsAgo ?? 20;
  const dirs = opts.directions;
  const allowUp = !dirs?.length || dirs.includes("up");
  const allowDown = !dirs?.length || dirs.includes("down");

  if (candles.length < period + 2) return [];

  const series = rsi(closes(candles), period);
  const last = series.length - 1;
  const lookFrom = Math.max(1, last - maxBarsAgo);
  const out: RsiBreakHit[] = [];

  for (let i = last; i >= lookFrom; i--) {
    const at = collectBreaksAt(series, i, last, levels, allowUp, allowDown);
    if (!at.length) continue;
    at.sort((a, b) => breakStrength(b.level) - breakStrength(a.level));
    out.push(...at);
  }
  return out;
}

/**
 * Single best hit: freshest bar, then strongest level on that bar.
 * Convenience alias used by the scan panel (one row per symbol×TF).
 */
export function detectRsiBreakFreshest(
  candles: Candle[],
  opts: DetectRsiBreakOpts = {}
): RsiBreakHit | null {
  const period = opts.period ?? 14;
  const levels = (opts.levels?.length ? opts.levels : DEFAULT_LEVELS).slice();
  const maxBarsAgo = opts.maxBarsAgo ?? 20;
  const dirs = opts.directions;
  const allowUp = !dirs?.length || dirs.includes("up");
  const allowDown = !dirs?.length || dirs.includes("down");

  if (candles.length < period + 2) return null;

  const series = rsi(closes(candles), period);
  const last = series.length - 1;
  const lookFrom = Math.max(1, last - maxBarsAgo);

  for (let i = last; i >= lookFrom; i--) {
    const at = collectBreaksAt(series, i, last, levels, allowUp, allowDown);
    if (!at.length) continue;
    return pickStrongest(at);
  }
  return null;
}
