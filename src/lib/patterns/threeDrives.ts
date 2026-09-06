import type { Candle } from "@/lib/types";
import { findSwings } from "@/lib/patterns/swings";
import {
  drawTargets,
  fibExt,
  fibRetrace,
  nearRatio,
  uid,
} from "@/lib/patterns/advanced/draw";
import type { PatternDrawing, PatternHit, SwingPoint } from "./types";

const RETRACE_TARGETS = [0.618, 0.786];
const EXT_TARGETS = [1.272, 1.618];
const RATIO_TOL = 0.12; // ~12% relative (nearRatio style)

function altZigzag(swings: SwingPoint[]): SwingPoint[] {
  if (swings.length < 2) return swings;
  const out: SwingPoint[] = [swings[0]];
  for (let i = 1; i < swings.length; i++) {
    const prev = out[out.length - 1];
    if (swings[i].kind === prev.kind) {
      if (swings[i].kind === "high" && swings[i].price >= prev.price)
        out[out.length - 1] = swings[i];
      if (swings[i].kind === "low" && swings[i].price <= prev.price)
        out[out.length - 1] = swings[i];
    } else {
      out.push(swings[i]);
    }
  }
  return out;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function bestNear(actual: number, targets: number[]): { target: number; err: number } {
  let best = targets[0];
  let bestErr = Infinity;
  for (const t of targets) {
    if (!Number.isFinite(actual) || !Number.isFinite(t) || t === 0) continue;
    const err = Math.abs(actual - t) / Math.abs(t);
    if (err < bestErr) {
      bestErr = err;
      best = t;
    }
  }
  return { target: best, err: bestErr };
}

function fmtPx(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

function scoreRatio(err: number, tol = RATIO_TOL): number {
  // 100 at exact, 0 at tol and beyond
  return clamp((1 - err / tol) * 100, 0, 100);
}

function scoreSym(ratio: number, tol = RATIO_TOL): number {
  // ideal ratio = 1
  const err = Math.abs(ratio - 1);
  return clamp((1 - err / tol) * 100, 0, 100);
}

interface DriveSeq {
  bull: boolean;
  d1: SwingPoint;
  a: SwingPoint;
  d2: SwingPoint;
  c: SwingPoint;
  d3: SwingPoint;
  /** optional origin before D1 for Drive1 length */
  origin?: SwingPoint;
}

function buildDrawings(
  seq: DriveSeq,
  przLow: number,
  przHigh: number,
  tp1: number,
  tp2: number,
  targetPrice: number,
  status: "olusum" | "kirilim",
  score: number
): PatternDrawing[] {
  const { d1, a, d2, c, d3, bull } = seq;
  const color = bull ? "#26a69a" : "#ef5350";
  const pts: { label: string; s: SwingPoint }[] = [
    { label: "D1", s: d1 },
    { label: "A", s: a },
    { label: "D2", s: d2 },
    { label: "C", s: c },
    { label: "D3", s: d3 },
  ];
  const out: PatternDrawing[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    out.push({
      id: uid("td_seg"),
      kind: "segment",
      t1: p.s.time,
      price1: p.s.price,
      t2: q.s.time,
      price2: q.s.price,
      color,
      lineWidth: 2,
    });
  }
  for (const p of pts) {
    out.push({
      id: uid("td_lbl"),
      kind: "label",
      t1: p.s.time,
      price1: p.s.price,
      label: p.label,
      color,
    });
  }

  // Fib levels at key retrace / extension prices
  const fibLevels: { level: number; price: number; tag: string }[] = [];
  // A retrace of D1→A from origin→D1
  if (seq.origin) {
    for (const lv of RETRACE_TARGETS) {
      fibLevels.push({
        level: lv,
        price: fibRetrace(seq.origin.price, d1.price, lv),
        tag: `Fib A ${lv}`,
      });
    }
  }
  // C retrace of A→D2
  for (const lv of RETRACE_TARGETS) {
    fibLevels.push({
      level: lv,
      price: fibRetrace(a.price, d2.price, lv),
      tag: `Fib C ${lv}`,
    });
  }
  // D2 / D3 extensions of prior correction
  for (const lv of EXT_TARGETS) {
    fibLevels.push({
      level: lv,
      price: fibExt(d1.price, a.price, lv),
      tag: `Ext D2 ${lv}`,
    });
    fibLevels.push({
      level: lv,
      price: fibExt(d2.price, c.price, lv),
      tag: `Ext D3 ${lv}`,
    });
  }

  const tFib1 = a.time;
  const tFib2 = d3.time + Math.max(1, d3.time - c.time);
  for (const f of fibLevels) {
    if (!Number.isFinite(f.price)) continue;
    out.push({
      id: uid("td_fib"),
      kind: "hline",
      t1: tFib1,
      t2: tFib2,
      price1: f.price,
      price2: f.price,
      color: f.level >= 1 ? "#ab47bc" : "#78909c",
      label: f.tag,
      dashed: true,
      lineWidth: 1,
    });
  }

  out.push(
    ...drawTargets({
      t1: c.time,
      t2: d3.time + Math.max(1, d3.time - c.time),
      przLow,
      przHigh,
      tp1,
      tp2,
      bull,
    })
  );

  // Explicit PRZ / HEDEF labels (Turkish)
  out.push({
    id: uid("td_przlb"),
    kind: "label",
    t1: d3.time,
    price1: (przLow + przHigh) / 2,
    label: "PRZ",
    color,
  });
  out.push({
    id: uid("td_hedef"),
    kind: "hline",
    t1: c.time,
    t2: d3.time + Math.max(1, d3.time - c.time) * 2,
    price1: targetPrice,
    price2: targetPrice,
    color: "#ffb74d",
    label: `HEDEF: ${fmtPx(targetPrice)}`,
    dashed: false,
    lineWidth: 2,
  });
  out.push({
    id: uid("td_st"),
    kind: "label",
    t1: d3.time,
    price1: d3.price,
    label:
      status === "kirilim"
        ? `Üç İtiş KIRILIM · ${score}`
        : `Üç İtiş Oluşum · ${score}`,
    color,
  });

  return out;
}

function evaluateSeq(
  candles: Candle[],
  seq: DriveSeq
): PatternHit | null {
  const { d1, a, d2, c, d3, bull, origin } = seq;
  // Structure already validated by caller

  const drive1Len =
    origin != null ? Math.abs(d1.price - origin.price) : Math.abs(d1.price - a.price);
  if (drive1Len < 1e-12) return null;

  const corrA = Math.abs(d1.price - a.price);
  const drive2 = Math.abs(d2.price - a.price);
  const corrC = Math.abs(d2.price - c.price);
  const drive3 = Math.abs(d3.price - c.price);
  if (corrA < 1e-12 || drive2 < 1e-12 || corrC < 1e-12 || drive3 < 1e-12) return null;

  // Retraces: A of Drive1; C of Drive2
  const fibRetraceA = corrA / drive1Len;
  const fibRetraceC = corrC / drive2;

  // Extensions: D2 of corr A; D3 of corr C
  const fibExtD2 = drive2 / corrA;
  const fibExtD3 = drive3 / corrC;

  // Price / time symmetry (AB=CD style: A→D2 ≈ C→D3)
  const legAD2 = drive2;
  const legCD3 = drive3;
  const priceSymRatio = legCD3 / legAD2;
  const barsAD2 = Math.max(1, d2.index - a.index);
  const barsCD3 = Math.max(1, d3.index - c.index);
  const timeSymRatio = barsCD3 / barsAD2;

  const ra = bestNear(fibRetraceA, RETRACE_TARGETS);
  const rc = bestNear(fibRetraceC, RETRACE_TARGETS);
  const e2 = bestNear(fibExtD2, EXT_TARGETS);
  const e3 = bestNear(fibExtD3, EXT_TARGETS);

  // Structure: alternating swings + progressive drives
  if (bull) {
    if (!(d1.kind === "low" && a.kind === "high" && d2.kind === "low" && c.kind === "high" && d3.kind === "low"))
      return null;
    if (!(d1.price > d2.price && d2.price > d3.price)) return null;
  } else {
    if (!(d1.kind === "high" && a.kind === "low" && d2.kind === "high" && c.kind === "low" && d3.kind === "high"))
      return null;
    if (!(d1.price < d2.price && d2.price < d3.price)) return null;
  }

  // Score components
  const sRa = scoreRatio(ra.err);
  const sRc = scoreRatio(rc.err);
  const sE2 = scoreRatio(e2.err);
  const sE3 = scoreRatio(e3.err);
  const sPrice = scoreSym(priceSymRatio);
  const sTime = scoreSym(timeSymRatio);

  // Progressive drives bonus (already required) + mild penalty if corrections deepen wrongly
  let structureScore = 70;
  if (bull) {
    // corrections should not make new extremes beyond drives oddly — A and C highs between
    if (a.price > d1.price && a.price > d2.price) structureScore += 10;
    if (c.price > d2.price && c.price > d3.price) structureScore += 10;
  } else {
    if (a.price < d1.price && a.price < d2.price) structureScore += 10;
    if (c.price < d2.price && c.price < d3.price) structureScore += 10;
  }
  structureScore = clamp(structureScore, 0, 100);

  const score = Math.round(
    clamp(
      sRa * 0.16 +
        sRc * 0.16 +
        sE2 * 0.16 +
        sE3 * 0.16 +
        sPrice * 0.14 +
        sTime * 0.12 +
        structureScore * 0.1,
      0,
      100
    )
  );

  // Fibs in tolerance bands for filterOk
  const fibsOk =
    (nearRatio(fibRetraceA, 0.618, RATIO_TOL) ||
      nearRatio(fibRetraceA, 0.786, RATIO_TOL)) &&
    (nearRatio(fibRetraceC, 0.618, RATIO_TOL) ||
      nearRatio(fibRetraceC, 0.786, RATIO_TOL)) &&
    (nearRatio(fibExtD2, 1.272, RATIO_TOL) ||
      nearRatio(fibExtD2, 1.618, RATIO_TOL)) &&
    (nearRatio(fibExtD3, 1.272, RATIO_TOL) ||
      nearRatio(fibExtD3, 1.618, RATIO_TOL));

  const filterOk = score >= 60 && fibsOk;

  // PRZ around Drive3 ± buffer (Fib cluster 1.272–1.618 of corr C)
  const ext127 = fibExt(d2.price, c.price, 1.272);
  const ext161 = fibExt(d2.price, c.price, 1.618);
  const clusterLo = Math.min(ext127, ext161, d3.price);
  const clusterHi = Math.max(ext127, ext161, d3.price);
  const pad = Math.abs(d3.price) * 0.0025;
  const przLow = Math.min(clusterLo, d3.price) - pad;
  const przHigh = Math.max(clusterHi, d3.price) + pad;

  // Targets: TP1 = C, TP2 = A (measured move back); primary hedef = C or opposite drive size
  const tp1 = c.price;
  const tp2 = a.price;
  const measured = drive3;
  const targetPrice = bull ? d3.price + measured : d3.price - measured;

  const last = candles[candles.length - 1];
  // kirilim: price reacted against drive through C
  const reacted = bull
    ? last.close > c.price
    : last.close < c.price;
  // incomplete / still at extremes near D3 → olusum
  const nearD3 =
    Math.abs(last.close - d3.price) / Math.max(1e-12, Math.abs(d3.price)) < 0.008;
  const status: "olusum" | "kirilim" =
    reacted && !nearD3 ? "kirilim" : "olusum";

  const fibs: { level: number; price: number }[] = [
    { level: ra.target, price: bull ? fibRetrace(d1.price, a.price, ra.target) : fibRetrace(d1.price, a.price, ra.target) },
    { level: rc.target, price: fibRetrace(d2.price, c.price, rc.target) },
    { level: e2.target, price: fibExt(d1.price, a.price, e2.target) },
    { level: e3.target, price: fibExt(d2.price, c.price, e3.target) },
  ];

  const drawings = buildDrawings(
    seq,
    przLow,
    przHigh,
    tp1,
    tp2,
    targetPrice,
    status,
    score
  );

  const bias = bull ? "bull" : "bear";
  const label = bull ? "Üç İtiş Al (Bull)" : "Üç İtiş Sat (Bear)";
  const detailParts = [
    status === "kirilim" ? "KIRILIM (PRZ tepki)" : "Oluşum · PRZ izle",
    `skor ${score}`,
    `A ${fibRetraceA.toFixed(3)} C ${fibRetraceC.toFixed(3)}`,
    `D2 ${fibExtD2.toFixed(3)} D3 ${fibExtD3.toFixed(3)}`,
    `sim F ${priceSymRatio.toFixed(2)} Z ${timeSymRatio.toFixed(2)}`,
  ];

  return {
    id: uid("td"),
    type: "three_drives",
    label,
    detail: detailParts.join(" · "),
    bias,
    confidence: clamp(score / 100, 0.35, 0.98),
    tStart: (origin ?? d1).time,
    tEnd: Math.max(d3.time, last.time),
    drawings,
    meta: {
      status,
      score,
      filterOk,
      targetPrice,
      fibs,
      kind: "three_drives",
      przLow,
      przHigh,
      timeSymRatio: Math.round(timeSymRatio * 1000) / 1000,
      priceSymRatio: Math.round(priceSymRatio * 1000) / 1000,
      fibRetraceA: Math.round(fibRetraceA * 1000) / 1000,
      fibRetraceC: Math.round(fibRetraceC * 1000) / 1000,
      fibExtD2: Math.round(fibExtD2 * 1000) / 1000,
      fibExtD3: Math.round(fibExtD3 * 1000) / 1000,
      breakoutPrice: status === "kirilim" ? c.price : undefined,
    },
  };
}

/**
 * Three Drives (Üç İtiş) — open harmonic-style detector.
 * Drive3 = PRZ watch zone (not auto-entry). Score down when ratios are forced.
 */
export function detectThreeDrives(
  candles: Candle[],
  swingStrength = 2
): PatternHit[] {
  if (candles.length < 50) return [];
  const zz = altZigzag(findSwings(candles, swingStrength));
  if (zz.length < 5) return [];

  const hits: PatternHit[] = [];
  const start = Math.max(0, zz.length - 28);

  for (let i = start; i <= zz.length - 5; i++) {
    const [p0, p1, p2, p3, p4] = [zz[i], zz[i + 1], zz[i + 2], zz[i + 3], zz[i + 4]];
    if (p0.kind === p1.kind || p1.kind === p2.kind || p2.kind === p3.kind || p3.kind === p4.kind)
      continue;

    // Bearish: H L H L H with rising highs
    if (p0.kind === "high") {
      const origin = i > 0 && zz[i - 1].kind === "low" ? zz[i - 1] : undefined;
      const hit = evaluateSeq(candles, {
        bull: false,
        d1: p0,
        a: p1,
        d2: p2,
        c: p3,
        d3: p4,
        origin,
      });
      if (hit) hits.push(hit);
    }

    // Bullish: L H L H L with falling lows
    if (p0.kind === "low") {
      const origin = i > 0 && zz[i - 1].kind === "high" ? zz[i - 1] : undefined;
      const hit = evaluateSeq(candles, {
        bull: true,
        d1: p0,
        a: p1,
        d2: p2,
        c: p3,
        d3: p4,
        origin,
      });
      if (hit) hits.push(hit);
    }
  }

  hits.sort((a, b) => b.confidence - a.confidence || b.tEnd - a.tEnd);
  const seen = new Set<string>();
  const out: PatternHit[] = [];
  for (const h of hits) {
    const key = `${h.bias}_${Math.round((h.meta?.przLow ?? 0) * 100)}_${Math.round((h.meta?.przHigh ?? 0) * 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
    if (out.length >= 8) break;
  }
  return out;
}

export function isThreeDrivesType(type: PatternHit["type"]): boolean {
  return type === "three_drives";
}

export function passesThreeDrivesFilter(hit: PatternHit, minScore = 60): boolean {
  if (!isThreeDrivesType(hit.type)) return false;
  const m = hit.meta;
  if (!m) return hit.confidence * 100 >= minScore;
  return Boolean(m.filterOk) || m.score >= minScore;
}
