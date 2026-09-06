/**
 * BIST 6-step cycle (approximate) using swings + volume + EMA9/21 + RSI.
 *
 * 1 Accumulation
 * 2 Shakeout (panic volume)
 * 3 Re-accum (EMA cross + volume)
 * 4 Dist prep (RSI cool)
 * 5 Low-vol squeeze
 * 6 Peak exit (vol spike + RSI peak)
 *
 * Scan flags actionable early phases: 2–3 entry watch, 4–5 caution, 6 exit.
 */
import type { Candle } from "@/lib/types";
import { ema, rsi } from "@/lib/indicators/math";
import type { PatternDrawing, PatternHit } from "./types";
import { findSwings } from "./swings";
import { drawTargets } from "./advanced/draw";

const MIN_SCORE = 50;

export type BistPhase = 1 | 2 | 3 | 4 | 5 | 6;

const PHASE_TR: Record<BistPhase, string> = {
  1: "1 Birikim",
  2: "2 Sarsıntı (shakeout)",
  3: "3 Yeniden birikim",
  4: "4 Dağıtım hazırlığı",
  5: "5 Düşük hacim sıkışma",
  6: "6 Tepe çıkış",
};

const PHASE_ACTION: Record<BistPhase, string> = {
  1: "izle",
  2: "giriş izle",
  3: "giriş izle",
  4: "temkin",
  5: "temkin",
  6: "çıkış",
};

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function detectPhase(candles: Candle[]): {
  phase: BistPhase;
  score: number;
  detail: string;
  bullWatch: boolean;
} | null {
  if (candles.length < 60) return null;
  const closes = candles.map((c) => c.close);
  const vols = candles.map((c) => c.volume ?? 0);
  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const r = rsi(closes, 14);
  const n = candles.length;
  const i = n - 1;
  const volMa = mean(vols.slice(Math.max(0, i - 20), i));
  const volNow = vols[i] || 0;
  const volPrevMax = Math.max(...vols.slice(Math.max(0, i - 8), i), 1e-9);
  const rNow = r[i];
  const rPrev = r[i - 1];
  const r5 = r.slice(Math.max(0, i - 5), i + 1).filter((x): x is number => x != null);
  const e9v = e9[i];
  const e21v = e21[i];
  const e9p = e9[i - 1];
  const e21p = e21[i - 1];
  if (rNow == null || e9v == null || e21v == null || e9p == null || e21p == null)
    return null;

  const swings = findSwings(candles, 2);
  const highs = swings.filter((s) => s.kind === "high");
  const lows = swings.filter((s) => s.kind === "low");
  const rangeSlice = candles.slice(i - 15, i + 1);
  const rng =
    (Math.max(...rangeSlice.map((c) => c.high)) -
      Math.min(...rangeSlice.map((c) => c.low))) /
    (closes[i] || 1);

  // Phase 6: vol spike + RSI peak
  if (
    volNow > volMa * 1.8 &&
    rNow >= 68 &&
    rNow >= Math.max(...r5) - 0.5 &&
    closes[i] >= Math.max(...closes.slice(i - 10, i + 1)) * 0.995
  ) {
    return {
      phase: 6,
      score: 72,
      detail: `hacim×${(volNow / Math.max(volMa, 1e-9)).toFixed(1)} · RSI ${rNow.toFixed(0)}`,
      bullWatch: false,
    };
  }

  // Phase 2: shakeout — panic vol + wick/low break then close reclaim
  const recentLow = Math.min(...candles.slice(i - 25, i).map((c) => c.low));
  const c = candles[i];
  const shake =
    c.low <= recentLow * 1.002 &&
    c.close > recentLow &&
    volNow > volMa * 1.6 &&
    (Math.min(c.open, c.close) - c.low) / (c.high - c.low || 1) > 0.35;
  if (shake || (volNow > volPrevMax * 1.3 && rNow < 38 && c.close > c.open)) {
    return {
      phase: 2,
      score: 70,
      detail: `panik hacim · RSI ${rNow.toFixed(0)}`,
      bullWatch: true,
    };
  }

  // Phase 3: re-accum — EMA9 cross above 21 + rising vol from low
  const crossUp = e9p <= e21p && e9v > e21v;
  const volRising = volNow > volMa * 0.9 && mean(vols.slice(i - 5, i + 1)) > mean(vols.slice(i - 15, i - 5));
  if (crossUp && volRising && rNow > 42 && rNow < 62) {
    return {
      phase: 3,
      score: 68,
      detail: `EMA9×21 ↑ · RSI ${rNow.toFixed(0)}`,
      bullWatch: true,
    };
  }

  // Phase 5: low-vol squeeze
  if (volNow < volMa * 0.7 && rng < 0.035 && Math.abs(e9v - e21v) / closes[i] < 0.01) {
    return {
      phase: 5,
      score: 60,
      detail: `düşük hacim · sıkışma %${(rng * 100).toFixed(1)}`,
      bullWatch: false,
    };
  }

  // Phase 4: distribution prep — RSI cool from high while price elevated
  const rPeak = Math.max(...r.slice(Math.max(0, i - 20), i + 1).filter((x): x is number => x != null));
  if (
    rPeak >= 65 &&
    rNow < rPeak - 8 &&
    rNow > 48 &&
    highs.length >= 2 &&
    highs[highs.length - 1].price >= highs[highs.length - 2].price * 0.995
  ) {
    return {
      phase: 4,
      score: 58,
      detail: `RSI soğuma ${rPeak.toFixed(0)}→${rNow.toFixed(0)}`,
      bullWatch: false,
    };
  }

  // Phase 1: accumulation — flat range, muted vol, RSI mid-low
  if (
    rng < 0.05 &&
    volNow < volMa * 1.1 &&
    rNow > 35 &&
    rNow < 55 &&
    lows.length >= 2 &&
    Math.abs(lows[lows.length - 1].price - lows[lows.length - 2].price) /
      closes[i] <
      0.025
  ) {
    return {
      phase: 1,
      score: 52,
      detail: `yatay birikim · RSI ${rNow.toFixed(0)}`,
      bullWatch: true,
    };
  }

  // Soft phase 3: already above EMA21 with constructive RSI
  if (e9v > e21v && rNow > 50 && rNow < 65 && volRising) {
    return {
      phase: 3,
      score: 56,
      detail: `EMA yığın üstü · RSI ${rNow.toFixed(0)}`,
      bullWatch: true,
    };
  }

  return null;
}

export function detectBistCycle(candles: Candle[]): PatternHit[] {
  const det = detectPhase(candles);
  if (!det) return [];
  // Prefer actionable early phases in scan (2–3), still allow 4–6
  const last = candles[candles.length - 1];
  const bull = det.bullWatch || det.phase <= 3;
  const entry = last.close;
  const atrProxy =
    Math.max(
      ...candles.slice(-14).map((c) => c.high - c.low)
    ) || entry * 0.02;
  const stop = bull ? entry - atrProxy : entry + atrProxy;
  const tp1 = bull ? entry + atrProxy : entry - atrProxy;
  const tp2 = bull ? entry + atrProxy * 2 : entry - atrProxy * 2;
  const id = uid("bist");
  const color =
    det.phase <= 3 ? "#26a69a" : det.phase === 6 ? "#ef5350" : "#ffb74d";
  const status =
    det.phase === 2 || det.phase === 3
      ? ("retest" as const)
      : det.phase === 6
        ? ("active" as const)
        : ("forming" as const);

  const drawings: PatternDrawing[] = [
    {
      id: `${id}_lb`,
      kind: "label",
      t1: last.time,
      price1: last.close,
      label: `BIST ${PHASE_TR[det.phase]}`,
      color,
    },
    {
      id: `${id}_m`,
      kind: "marker",
      t1: last.time,
      price1: last.close,
      label: `P${det.phase}`,
      color,
      shape: det.phase === 6 ? "arrowDown" : "arrowUp",
      position: det.phase === 6 ? "aboveBar" : "belowBar",
    },
    ...drawTargets({
      t1: last.time,
      t2: last.time,
      entry,
      entryTime: last.time,
      tp1,
      tp2,
      sl: stop,
      bull: det.phase !== 6,
    }),
  ];

  return [
    {
      id,
      type: "bist_cycle",
      label: `BIST Döngü · ${PHASE_TR[det.phase]}`,
      detail: `${PHASE_ACTION[det.phase]} · ${det.detail}`,
      bias: det.phase === 6 ? "bear" : bull ? "bull" : "neutral",
      confidence: det.score / 100,
      tStart: candles[Math.max(0, candles.length - 30)].time,
      tEnd: last.time,
      drawings,
      meta: {
        status,
        score: det.score,
        kind: "bist_cycle",
        model: `BIST-P${det.phase}`,
        stage: status,
        entry,
        stop,
        tp1,
        tp2,
        barsAgo: 0,
        bistPhase: det.phase,
        filterOk: det.score >= MIN_SCORE && det.phase !== 1,
      },
    },
  ];
}

export function passesBistCycleFilter(
  h: PatternHit,
  minScore = MIN_SCORE
): boolean {
  if (h.type !== "bist_cycle") return false;
  const phase = h.meta?.bistPhase ?? 0;
  // Scan should flag actionable early phases (2–3), caution 4–5, exit 6
  if (phase < 2) return false;
  return (h.meta?.score ?? h.confidence * 100) >= minScore;
}
