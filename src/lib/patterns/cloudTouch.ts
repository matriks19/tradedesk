/**
 * Cloud / ribbon touch — lighter detector.
 * Price touches lower/upper envelope (Donchian or multi-MA) + OS/OB multi-RSI cluster.
 */
import type { Candle } from "@/lib/types";
import { donchian, ema, rsi } from "@/lib/indicators/math";
import type { PatternDrawing, PatternHit } from "./types";
import { drawTargets } from "./advanced/draw";

const MIN_SCORE = 55;

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function detectCloudTouch(candles: Candle[]): PatternHit[] {
  if (candles.length < 50) return [];
  const closes = candles.map((c) => c.close);
  const dc = donchian(candles, 20);
  const e8 = ema(closes, 8);
  const e21 = ema(closes, 21);
  const e55 = ema(closes, 55);
  const r14 = rsi(closes, 14);
  const r7 = rsi(closes, 7);
  const r21 = rsi(closes, 21);
  const last = candles[candles.length - 1];
  const hits: PatternHit[] = [];

  const from = Math.max(55, candles.length - 16);
  for (let i = from; i < candles.length; i++) {
    const c = candles[i];
    const up = dc.upper[i];
    const lo = dc.lower[i];
    const mids = [e8[i], e21[i], e55[i]].filter((v): v is number => v != null);
    if (up == null || lo == null || mids.length < 2) continue;
    const ribbonLo = Math.min(...mids);
    const ribbonHi = Math.max(...mids);
    const touchLower =
      c.low <= lo * 1.002 || c.low <= ribbonLo * 1.003;
    const touchUpper =
      c.high >= up * 0.998 || c.high >= ribbonHi * 0.997;
    if (!touchLower && !touchUpper) continue;

    const rs = [r7[i], r14[i], r21[i]].filter((v): v is number => v != null);
    if (rs.length < 2) continue;
    const avgR = rs.reduce((a, b) => a + b, 0) / rs.length;
    const osCluster = avgR <= 35 && rs.every((v) => v <= 42);
    const obCluster = avgR >= 65 && rs.every((v) => v >= 58);
    if (touchLower && !osCluster) continue;
    if (touchUpper && !obCluster) continue;

    const bull = touchLower && osCluster;
    const entry = c.close;
    const stop = bull ? Math.min(c.low, lo) * 0.996 : Math.max(c.high, up) * 1.004;
    const risk = Math.abs(entry - stop) || entry * 0.01;
    const tp1 = bull ? entry + risk : entry - risk;
    const tp2 = bull ? entry + risk * 1.6 : entry - risk * 1.6;
    const barsAgo = candles.length - 1 - i;
    let score = 50;
    score += clamp(Math.abs(50 - avgR) * 0.5, 4, 16);
    score += 10;
    if (barsAgo <= 3) score += 8;
    score = Math.round(clamp(score, 0, 100));
    if (score < MIN_SCORE) continue;

    const id = uid("cloud");
    const color = bull ? "#26a69a" : "#ef5350";
    hits.push({
      id,
      type: "cloud_touch",
      label: `Cloud Touch (${bull ? "alt·OS" : "üst·OB"})`,
      detail: `RSI küme ~${avgR.toFixed(0)} · Donchian/MA zarf`,
      bias: bull ? "bull" : "bear",
      confidence: score / 100,
      tStart: candles[Math.max(0, i - 5)].time,
      tEnd: last.time,
      drawings: [
        {
          id: `${id}_env`,
          kind: "box",
          t1: candles[Math.max(0, i - 10)].time,
          t2: last.time,
          price1: lo,
          price2: up,
          color: "rgba(41,98,255,0.1)",
          label: "Cloud",
        },
        {
          id: `${id}_m`,
          kind: "marker",
          t1: c.time,
          price1: entry,
          label: "CLOUD",
          color,
          shape: bull ? "arrowUp" : "arrowDown",
          position: bull ? "belowBar" : "aboveBar",
        },
        ...drawTargets({
          t1: c.time,
          t2: last.time,
          entry,
          entryTime: c.time,
          tp1,
          tp2,
          sl: stop,
          bull,
        }),
      ] as PatternDrawing[],
      meta: {
        status: barsAgo <= 2 ? "active" : "retest",
        score,
        kind: "cloud_touch",
        model: "Cloud",
        stage: barsAgo <= 2 ? "active" : "retest",
        entry,
        stop,
        tp1,
        tp2,
        barsAgo,
        cloudSide: bull ? "lower" : "upper",
        filterOk: true,
      },
    });
  }

  hits.sort(
    (a, b) =>
      (a.meta?.barsAgo ?? 999) - (b.meta?.barsAgo ?? 999) ||
      (b.meta?.score ?? 0) - (a.meta?.score ?? 0)
  );
  const seen = new Set<string>();
  const out: PatternHit[] = [];
  for (const h of hits) {
    const key = `${h.bias}_${h.meta?.cloudSide}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
    if (out.length >= 3) break;
  }
  return out;
}

export function passesCloudTouchFilter(
  h: PatternHit,
  minScore = MIN_SCORE
): boolean {
  if (h.type !== "cloud_touch") return false;
  return (h.meta?.score ?? h.confidence * 100) >= minScore;
}
