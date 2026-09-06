/**
 * MAVK cluster + R² scan.
 *
 * - Multiple MAs (EMA 8/13/21/34/55/89) cluster when (max-min)/price < threshold
 * - R² of linear regression on close (lookback ~20–40): low (~0.15–0.3) then rising
 * - Hit when: cluster + R² rising from low + preferably HH structure
 *
 * Helpers also used by optional registry indicators (MAVK ribbon + R² pane).
 */
import type { Candle } from "@/lib/types";
import { ema, sma } from "@/lib/indicators/math";
import type { PatternDrawing, PatternHit } from "./types";
import { findSwings } from "./swings";
import { drawTargets } from "./advanced/draw";

const DEFAULT_PERIODS = [8, 13, 21, 34, 55, 89];
const MIN_SCORE = 55;

export type MavkOpts = {
  periods?: number[];
  useSma?: boolean;
  clusterPct?: number; // max-min / price threshold (default 0.015)
  r2Period?: number;
  r2Low?: number;
  r2RiseBars?: number;
  maxHits?: number;
};

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Coefficient of determination for last `period` closes ending at i. */
export function rSquaredAt(
  closes: number[],
  i: number,
  period: number
): number | null {
  if (i < period - 1) return null;
  const ys = closes.slice(i - period + 1, i + 1);
  const n = ys.length;
  let sumY = 0;
  let sumX = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (let j = 0; j < n; j++) {
    const x = j;
    const y = ys[j];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }
  const den = n * sumX2 - sumX * sumX;
  if (den === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / den;
  const intercept = (sumY - slope * sumX) / n;
  let ssTot = 0;
  let ssRes = 0;
  const meanY = sumY / n;
  for (let j = 0; j < n; j++) {
    const yHat = intercept + slope * j;
    ssTot += (ys[j] - meanY) ** 2;
    ssRes += (ys[j] - yHat) ** 2;
  }
  if (ssTot <= 1e-18) return 0;
  return clamp(1 - ssRes / ssTot, 0, 1);
}

export function computeRSquaredSeries(
  candles: Candle[],
  period = 30
): (number | null)[] {
  const closes = candles.map((c) => c.close);
  return closes.map((_, i) => rSquaredAt(closes, i, period));
}

export function computeMavkRibbon(
  candles: Candle[],
  periods: number[] = DEFAULT_PERIODS,
  useSma = false
): {
  lines: (number | null)[][];
  upper: (number | null)[];
  lower: (number | null)[];
  mid: (number | null)[];
  clusterPct: (number | null)[];
  clustered: (number | null)[];
} {
  const closes = candles.map((c) => c.close);
  const lines = periods.map((p) => (useSma ? sma(closes, p) : ema(closes, p)));
  const n = candles.length;
  const upper: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  const mid: (number | null)[] = new Array(n).fill(null);
  const clusterPct: (number | null)[] = new Array(n).fill(null);
  const clustered: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const vals: number[] = [];
    for (const line of lines) {
      const v = line[i];
      if (v != null) vals.push(v);
    }
    if (vals.length < Math.max(3, periods.length - 1)) continue;
    const hi = Math.max(...vals);
    const lo = Math.min(...vals);
    const px = closes[i] || 1;
    upper[i] = hi;
    lower[i] = lo;
    mid[i] = (hi + lo) / 2;
    const pct = (hi - lo) / px;
    clusterPct[i] = pct;
  }
  return { lines, upper, lower, mid, clusterPct, clustered };
}

function markClustered(
  clusterPct: (number | null)[],
  threshold: number
): (number | null)[] {
  return clusterPct.map((v) =>
    v != null && v <= threshold ? 1 : v != null ? 0 : null
  );
}

export function detectMavkCluster(
  candles: Candle[],
  opts: MavkOpts = {}
): PatternHit[] {
  if (candles.length < 90) return [];
  const periods = opts.periods ?? DEFAULT_PERIODS;
  const clusterThresh = opts.clusterPct ?? 0.015;
  const r2Period = opts.r2Period ?? 30;
  const r2Low = opts.r2Low ?? 0.28;
  const riseBars = opts.r2RiseBars ?? 5;
  const maxHits = opts.maxHits ?? 4;

  const ribbon = computeMavkRibbon(candles, periods, opts.useSma);
  ribbon.clustered = markClustered(ribbon.clusterPct, clusterThresh);
  const r2 = computeRSquaredSeries(candles, r2Period);
  const swings = findSwings(candles, 2);
  const highs = swings.filter((s) => s.kind === "high");
  const lows = swings.filter((s) => s.kind === "low");
  const last = candles[candles.length - 1];
  const hits: PatternHit[] = [];

  // Scan recent bars for cluster + R² turn-up
  const from = Math.max(r2Period + 5, candles.length - 40);
  for (let i = from; i < candles.length; i++) {
    if (ribbon.clustered[i] !== 1) continue;
    const cur = r2[i];
    if (cur == null) continue;
    // Look back for a low R² trough then rising
    let trough: number | null = null;
    let troughIdx = -1;
    for (let j = i - riseBars - 8; j <= i - 2; j++) {
      if (j < 0 || r2[j] == null) continue;
      const v = r2[j] as number;
      if (v <= r2Low && (trough == null || v <= trough)) {
        trough = v;
        troughIdx = j;
      }
    }
    if (trough == null || troughIdx < 0) continue;
    const prev = r2[i - 1];
    if (prev == null) continue;
    const rising = cur > prev && cur > trough + 0.04;
    if (!rising) continue;

    // Structure preference: recent HH for bull / LL for bear
    let bull = true;
    if (highs.length >= 2 && lows.length >= 2) {
      const h1 = highs[highs.length - 2];
      const h2 = highs[highs.length - 1];
      const l1 = lows[lows.length - 2];
      const l2 = lows[lows.length - 1];
      const up = h2.price > h1.price && l2.price >= l1.price * 0.998;
      const dn = h2.price < h1.price && l2.price < l1.price;
      if (dn && !up) bull = false;
      else if (up) bull = true;
      else bull = candles[i].close >= (ribbon.mid[i] ?? candles[i].close);
    }

    const upper = ribbon.upper[i] ?? last.close;
    const lower = ribbon.lower[i] ?? last.close;
    const entry = candles[i].close;
    const stop = bull ? lower * 0.995 : upper * 1.005;
    const risk = Math.abs(entry - stop) || Math.abs(entry) * 0.01;
    const tp1 = bull ? entry + risk : entry - risk;
    const tp2 = bull ? entry + risk * 1.8 : entry - risk * 1.8;
    const barsAgo = candles.length - 1 - i;
    // Only keep near-end signals
    if (barsAgo > 12) continue;

    let score = 45;
    score += clamp((clusterThresh - (ribbon.clusterPct[i] ?? 1)) * 800, 4, 16);
    score += clamp((cur - trough) * 80, 4, 18);
    if (highs.length >= 2) {
      const hh =
        highs[highs.length - 1].price > highs[highs.length - 2].price;
      if ((bull && hh) || (!bull && !hh)) score += 10;
    }
    score = Math.round(clamp(score, 0, 100));
    if (score < MIN_SCORE) continue;

    const id = uid("mavk");
    const color = bull ? "#26a69a" : "#ef5350";
    const drawings: PatternDrawing[] = [
      {
        id: `${id}_ribbon`,
        kind: "box",
        t1: candles[Math.max(0, i - 8)].time,
        t2: last.time,
        price1: lower,
        price2: upper,
        color: "rgba(171,71,188,0.18)",
        label: "MAVK",
      },
      {
        id: `${id}_m`,
        kind: "marker",
        t1: candles[i].time,
        price1: entry,
        label: "MAVK",
        color,
        shape: bull ? "arrowUp" : "arrowDown",
        position: bull ? "belowBar" : "aboveBar",
      },
      {
        id: `${id}_lb`,
        kind: "label",
        t1: candles[i].time,
        price1: entry,
        label: `MAVK+R² (${bull ? "Boğa" : "Ayı"})`,
        color,
      },
      ...drawTargets({
        t1: candles[i].time,
        t2: last.time,
        entry,
        entryTime: candles[i].time,
        tp1,
        tp2,
        sl: stop,
        bull,
      }),
    ];

    hits.push({
      id,
      type: "mavk_cluster",
      label: `MAVK Küme + R² (${bull ? "Boğa" : "Ayı"})`,
      detail: `küme %${((ribbon.clusterPct[i] ?? 0) * 100).toFixed(2)} · R² ${cur.toFixed(2)}↑ (dip ${trough.toFixed(2)})`,
      bias: bull ? "bull" : "bear",
      confidence: score / 100,
      tStart: candles[Math.max(0, troughIdx)].time,
      tEnd: last.time,
      drawings,
      meta: {
        status: barsAgo <= 2 ? "active" : "retest",
        score,
        kind: "mavk_cluster",
        model: "MAVK",
        stage: barsAgo <= 2 ? "active" : "retest",
        entry,
        stop,
        tp1,
        tp2,
        barsAgo,
        r2: cur,
        clusterPct: ribbon.clusterPct[i] ?? undefined,
        filterOk: true,
      },
    });
  }

  // Keep freshest unique
  hits.sort(
    (a, b) =>
      (a.meta?.barsAgo ?? 999) - (b.meta?.barsAgo ?? 999) ||
      (b.meta?.score ?? 0) - (a.meta?.score ?? 0)
  );
  return hits.slice(0, maxHits);
}

export function passesMavkFilter(h: PatternHit, minScore = MIN_SCORE): boolean {
  if (h.type !== "mavk_cluster") return false;
  return (h.meta?.score ?? h.confidence * 100) >= minScore;
}
