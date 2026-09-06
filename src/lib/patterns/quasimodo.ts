/**
 * Quasimodo (QM) — Institutional PA cheat sheet.
 *
 * Classic bearish: H → L → HH → LL then retest QML (first H)
 * Classic bullish: L → H → LL → HH then retest QML (first L)
 *
 * Prefer Quick Retest (D/QML touch soon after LL/HH) for scan freshness.
 * Optional: 2R/2S fakeout into S/D zone (score boost).
 * ENTRY on QML retest, SL beyond HH/LL, TP structure (L / H).
 */
import type { Candle } from "@/lib/types";
import type { PatternDrawing, PatternHit, SwingPoint } from "./types";
import { findSwings } from "./swings";
import { drawTargets } from "./advanced/draw";

const MIN_SCORE = 55;
const MAX_QUICK_RETEST = 18;
const MAX_RETEST = 36;

export type QmOpts = {
  swingStrength?: number;
  maxHits?: number;
  preferQuickRetest?: boolean;
};

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function box(
  id: string,
  t1: number,
  t2: number,
  lo: number,
  hi: number,
  color: string,
  label?: string
): PatternDrawing {
  return { id, kind: "box", t1, price1: lo, t2, price2: hi, color, label };
}

function hline(
  id: string,
  t1: number,
  t2: number,
  price: number,
  color: string,
  label?: string,
  dashed = true
): PatternDrawing {
  return {
    id,
    kind: "hline",
    t1,
    price1: price,
    t2,
    price2: price,
    color,
    label,
    dashed,
    lineWidth: 1.5,
  };
}

function labelDraw(
  id: string,
  t: number,
  price: number,
  text: string,
  color: string
): PatternDrawing {
  return { id, kind: "label", t1: t, price1: price, label: text, color };
}

function marker(
  id: string,
  t: number,
  price: number,
  bias: "bull" | "bear",
  text: string
): PatternDrawing {
  return {
    id,
    kind: "marker",
    t1: t,
    price1: price,
    label: text,
    color: bias === "bull" ? "#26a69a" : "#ef5350",
    position: bias === "bull" ? "belowBar" : "aboveBar",
    shape: bias === "bull" ? "arrowUp" : "arrowDown",
  };
}

type Leg = {
  bull: boolean; // trade bias after pattern (bull QM = buy at QML)
  h1: SwingPoint; // left shoulder / first high (bear) OR first low stored in h1 for bull via naming
  l1: SwingPoint;
  h2: SwingPoint;
  l2: SwingPoint;
  qml: number;
  qmlTime: number;
  qmlIndex: number;
  sdTop: number;
  sdBot: number;
  fakeout?: boolean;
  retestIdx?: number;
  triggerIdx?: number;
  quick: boolean;
};

/**
 * Bearish QM structure on alternating swings:
 *   H1 (QML) → L1 → H2 (HH > H1) → L2 (LL < L1) → retest H1
 * Bullish mirror:
 *   L1 (QML) → H1 → L2 (LL < L1) → H2 (HH > H1) → retest L1
 */
function findBearLegs(
  highs: SwingPoint[],
  lows: SwingPoint[]
): Omit<Leg, "retestIdx" | "triggerIdx" | "quick" | "fakeout">[] {
  const out: Omit<Leg, "retestIdx" | "triggerIdx" | "quick" | "fakeout">[] = [];
  for (let i = 0; i < highs.length - 1; i++) {
    const h1 = highs[i];
    const h2 = highs[i + 1];
    if (!(h2.price > h1.price)) continue;
    const midLows = lows.filter(
      (l) => l.index > h1.index && l.index < h2.index
    );
    if (!midLows.length) continue;
    const l1 = midLows.reduce((m, x) => (x.price < m.price ? x : m));
    const afterLows = lows.filter((l) => l.index > h2.index);
    if (!afterLows.length) continue;
    // Prefer first clear LL after HH
    for (const l2 of afterLows.slice(0, 4)) {
      if (!(l2.price < l1.price)) continue;
      if (l2.index - h2.index < 2 || l2.index - h1.index > 80) continue;
      const body = Math.abs(h1.price) * 0.004;
      out.push({
        bull: false,
        h1,
        l1,
        h2,
        l2,
        qml: h1.price,
        qmlTime: h1.time,
        qmlIndex: h1.index,
        sdTop: h1.price,
        sdBot: Math.min(h1.price - body * 3, (h1.price + l1.price) / 2),
      });
      break;
    }
  }
  return out;
}

function findBullLegs(
  highs: SwingPoint[],
  lows: SwingPoint[]
): Omit<Leg, "retestIdx" | "triggerIdx" | "quick" | "fakeout">[] {
  const out: Omit<Leg, "retestIdx" | "triggerIdx" | "quick" | "fakeout">[] = [];
  for (let i = 0; i < lows.length - 1; i++) {
    const l1 = lows[i];
    const l2 = lows[i + 1];
    if (!(l2.price < l1.price)) continue;
    const midHighs = highs.filter(
      (h) => h.index > l1.index && h.index < l2.index
    );
    if (!midHighs.length) continue;
    const h1 = midHighs.reduce((m, x) => (x.price > m.price ? x : m));
    const afterHighs = highs.filter((h) => h.index > l2.index);
    if (!afterHighs.length) continue;
    for (const h2 of afterHighs.slice(0, 4)) {
      if (!(h2.price > h1.price)) continue;
      if (h2.index - l2.index < 2 || h2.index - l1.index > 80) continue;
      const body = Math.abs(l1.price) * 0.004;
      out.push({
        bull: true,
        h1, // right-side naming: store mid high as h1, final HH as h2, L1/L2 as lows
        l1,
        h2,
        l2,
        qml: l1.price,
        qmlTime: l1.time,
        qmlIndex: l1.index,
        sdTop: Math.max(l1.price + body * 3, (l1.price + h1.price) / 2),
        sdBot: l1.price,
      });
      break;
    }
  }
  return out;
}

function findRetest(
  candles: Candle[],
  leg: Omit<Leg, "retestIdx" | "triggerIdx" | "quick" | "fakeout">
): Pick<Leg, "retestIdx" | "triggerIdx" | "quick" | "fakeout"> {
  const start = leg.bull ? leg.h2.index : leg.l2.index;
  const end = Math.min(candles.length - 1, start + MAX_RETEST);
  const tol = Math.abs(leg.qml) * 0.0025;
  let retestIdx: number | undefined;
  let triggerIdx: number | undefined;
  let fakeout = false;

  // Optional 2R/2S: wick beyond QML into SD then close back
  for (let i = start + 1; i <= end; i++) {
    const c = candles[i];
    if (leg.bull) {
      if (c.low < leg.qml - tol && c.close >= leg.qml - tol) fakeout = true;
      const touch =
        c.low <= leg.qml + tol && c.high >= leg.sdBot - tol;
      if (touch && retestIdx == null) retestIdx = i;
      if (retestIdx != null && c.close > leg.qml) {
        triggerIdx = i;
        break;
      }
    } else {
      if (c.high > leg.qml + tol && c.close <= leg.qml + tol) fakeout = true;
      const touch =
        c.high >= leg.qml - tol && c.low <= leg.sdTop + tol;
      if (touch && retestIdx == null) retestIdx = i;
      if (retestIdx != null && c.close < leg.qml) {
        triggerIdx = i;
        break;
      }
    }
  }

  const signal = retestIdx ?? start;
  const quick = signal - start <= MAX_QUICK_RETEST;
  return { retestIdx, triggerIdx, quick, fakeout };
}

function stageOf(
  leg: Leg,
  candles: Candle[],
  tp1: number
): "forming" | "retest" | "active" | "target_hit" {
  const last = candles[candles.length - 1];
  if (leg.triggerIdx != null) {
    if (leg.bull && last.high >= tp1) return "target_hit";
    if (!leg.bull && last.low <= tp1) return "target_hit";
    return "active";
  }
  if (leg.retestIdx != null) return "retest";
  return "forming";
}

function buildHit(candles: Candle[], leg: Leg): PatternHit {
  const last = candles[candles.length - 1];
  const bull = leg.bull;
  const entry = leg.qml;
  const stop = bull
    ? Math.min(leg.l2.price, leg.qml) * 0.998
    : Math.max(leg.h2.price, leg.qml) * 1.002;
  // For bull QM: L2 is the LL; SL beyond LL. For bear: SL beyond HH (h2).
  const sl = bull ? leg.l2.price * 0.997 : leg.h2.price * 1.003;
  const stopFinal = bull ? Math.min(stop, sl) : Math.max(stop, sl);
  const risk = Math.abs(entry - stopFinal) || Math.abs(entry) * 0.01;
  const structureTp = bull ? leg.h1.price : leg.l1.price;
  const tp1Ok = bull ? structureTp > entry : structureTp < entry;
  const tp1 = tp1Ok
    ? structureTp
    : bull
      ? entry + risk
      : entry - risk;
  const tp2 = bull ? entry + risk * 1.5 : entry - risk * 1.5;
  const tp3 = bull ? entry + risk * 2.2 : entry - risk * 2.2;

  const stage = stageOf(leg, candles, tp1);
  let score = 40;
  score += 14; // structure complete
  if (leg.retestIdx != null) score += 16;
  if (leg.triggerIdx != null) score += 8;
  if (leg.quick) score += 12;
  if (leg.fakeout) score += 8;
  if (stage === "retest") score += 4;
  score = Math.round(clamp(score, 0, 100));

  const signalIdx =
    leg.triggerIdx ?? leg.retestIdx ?? (bull ? leg.h2.index : leg.l2.index);
  const barsAgo = Math.max(0, candles.length - 1 - signalIdx);
  const id = uid("qm");
  const color = bull ? "#26a69a" : "#ef5350";
  const tEnd = last.time;

  const drawings: PatternDrawing[] = [
    hline(`${id}_qml`, leg.qmlTime, tEnd, leg.qml, "#ffb74d", "QML", false),
    box(
      `${id}_sd`,
      leg.qmlTime,
      tEnd,
      leg.sdBot,
      leg.sdTop,
      bull ? "rgba(38,166,154,0.16)" : "rgba(239,83,80,0.16)",
      bull ? "Demand" : "Supply"
    ),
    marker(`${id}_a`, leg.qmlTime, leg.qml, bull ? "bull" : "bear", "QML"),
    marker(
      `${id}_hh`,
      bull ? leg.h2.time : leg.h2.time,
      bull ? leg.h2.price : leg.h2.price,
      "bear",
      bull ? "HH" : "HH"
    ),
    marker(
      `${id}_ll`,
      bull ? leg.l2.time : leg.l2.time,
      bull ? leg.l2.price : leg.l2.price,
      "bull",
      "LL"
    ),
    ...drawTargets({
      t1: candles[signalIdx].time,
      t2: tEnd,
      entry,
      entryTime: candles[signalIdx].time,
      tp1,
      tp2,
      tp3,
      sl: stopFinal,
      bull,
    }),
    labelDraw(
      `${id}_lb`,
      candles[signalIdx].time,
      entry,
      leg.quick ? `QM Quick Retest (${bull ? "Boğa" : "Ayı"})` : `QM (${bull ? "Boğa" : "Ayı"})`,
      color
    ),
  ];

  const status =
    stage === "forming"
      ? ("forming" as const)
      : stage === "retest"
        ? ("retest" as const)
        : stage === "target_hit"
          ? ("target_hit" as const)
          : bull
            ? ("al_tetiklendi" as const)
            : ("sat_tetiklendi" as const);

  return {
    id,
    type: "quasimodo",
    label: leg.quick
      ? `QM Quick Retest (${bull ? "Boğa" : "Ayı"})`
      : `Quasimodo (${bull ? "Boğa" : "Ayı"})`,
    detail: `${stage}${leg.fakeout ? " · 2R/2S" : ""} · QML ${leg.qml.toPrecision(6)}`,
    bias: bull ? "bull" : "bear",
    confidence: score / 100,
    tStart: leg.qmlTime,
    tEnd,
    drawings,
    meta: {
      status,
      score,
      kind: "quasimodo",
      model: leg.quick ? "QM-Quick" : "QM",
      stage,
      entry,
      stop: stopFinal,
      tp1,
      tp2,
      tp3,
      qml: leg.qml,
      barsAgo,
      filterOk: score >= MIN_SCORE && stage !== "target_hit",
      riskR: risk > 0 ? Math.abs(tp1 - entry) / risk : undefined,
    },
  };
}

export function detectQuasimodo(
  candles: Candle[],
  opts: QmOpts = {}
): PatternHit[] {
  if (candles.length < 40) return [];
  const swingStrength = opts.swingStrength ?? 2;
  const maxHits = opts.maxHits ?? 6;
  const preferQuick = opts.preferQuickRetest !== false;
  const swings = findSwings(candles, swingStrength);
  const highs = swings.filter((s) => s.kind === "high");
  const lows = swings.filter((s) => s.kind === "low");

  const raw = [...findBearLegs(highs, lows), ...findBullLegs(highs, lows)];
  const legs: Leg[] = raw.map((r) => ({ ...r, ...findRetest(candles, r) }));

  // Freshness: structure completed relatively recently
  const n = candles.length;
  const fresh = legs.filter((l) => {
    const endIdx = l.bull ? l.h2.index : l.l2.index;
    return n - 1 - endIdx <= 70;
  });

  let hits = fresh.map((l) => buildHit(candles, l));
  if (preferQuick) {
    hits.sort((a, b) => {
      const aq = a.meta?.model === "QM-Quick" ? 0 : 1;
      const bq = b.meta?.model === "QM-Quick" ? 0 : 1;
      const ar = a.meta?.stage === "retest" ? 0 : 1;
      const br = b.meta?.stage === "retest" ? 0 : 1;
      return (
        ar - br ||
        aq - bq ||
        (a.meta?.barsAgo ?? 999) - (b.meta?.barsAgo ?? 999) ||
        (b.meta?.score ?? 0) - (a.meta?.score ?? 0)
      );
    });
  }

  const kept: PatternHit[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if ((h.meta?.stage ?? "") === "target_hit") continue;
    const key = `${h.bias}_${Math.round((h.meta?.qml ?? 0) * 200)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(h);
    if (kept.length >= maxHits) break;
  }
  return kept;
}

export function passesQuasimodoFilter(
  h: PatternHit,
  minScore = MIN_SCORE
): boolean {
  if (h.type !== "quasimodo") return false;
  const score = h.meta?.score ?? h.confidence * 100;
  if (score < minScore) return false;
  const st = h.meta?.stage ?? h.meta?.status;
  if (st === "target_hit") return false;
  return true;
}
