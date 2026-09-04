import type { Candle } from "@/lib/types";
import type { SwingPoint } from "@/lib/patterns/types";
import { findSwings } from "@/lib/patterns/swings";
import type { AdvancedPatternHit, XABCDPoint } from "./types";
import { drawTargets, drawXABCD, nearRatio, uid } from "./draw";

type Leg = { XA: number; AB: number; BC: number; CD: number; AD: number; XC: number };

function legLens(X: SwingPoint, A: SwingPoint, B: SwingPoint, C: SwingPoint, D: SwingPoint): Leg {
  return {
    XA: Math.abs(A.price - X.price),
    AB: Math.abs(B.price - A.price),
    BC: Math.abs(C.price - B.price),
    CD: Math.abs(D.price - C.price),
    AD: Math.abs(D.price - A.price),
    XC: Math.abs(C.price - X.price),
  };
}

function altZigzag(swings: SwingPoint[]): SwingPoint[] {
  if (swings.length < 2) return swings;
  const out: SwingPoint[] = [swings[0]];
  for (let i = 1; i < swings.length; i++) {
    const prev = out[out.length - 1];
    if (swings[i].kind === prev.kind) {
      if (swings[i].kind === "high" && swings[i].price >= prev.price) out[out.length - 1] = swings[i];
      if (swings[i].kind === "low" && swings[i].price <= prev.price) out[out.length - 1] = swings[i];
    } else {
      out.push(swings[i]);
    }
  }
  return out;
}

function toPoints(pts: { label: XABCDPoint["label"]; s: SwingPoint }[]): XABCDPoint[] {
  return pts.map((p) => ({
    label: p.label,
    time: p.s.time,
    price: p.s.price,
    index: p.s.index,
  }));
}

interface HarmonicSpec {
  name: string;
  label: string;
  /** bullish = long at D (X low start), bearish = short at D */
  check: (r: { AB_XA: number; BC_AB: number; CD_BC: number; AD_XA: number; XC_XA?: number }) => boolean;
  /** PRZ as fraction of XA from A toward X-side extension */
  przPad: number;
}

const SPECS: HarmonicSpec[] = [
  {
    name: "gartley",
    label: "Gartley",
    przPad: 0.008,
    check: (r) =>
      nearRatio(r.AB_XA, 0.618, 0.07) &&
      nearRatio(r.BC_AB, 0.618, 0.12) &&
      (nearRatio(r.CD_BC, 1.272, 0.1) || nearRatio(r.CD_BC, 1.618, 0.1)) &&
      nearRatio(r.AD_XA, 0.786, 0.08),
  },
  {
    name: "bat",
    label: "Bat",
    przPad: 0.008,
    check: (r) =>
      (nearRatio(r.AB_XA, 0.382, 0.08) || nearRatio(r.AB_XA, 0.5, 0.08)) &&
      nearRatio(r.BC_AB, 0.5, 0.15) &&
      (nearRatio(r.CD_BC, 1.618, 0.12) || nearRatio(r.CD_BC, 2.0, 0.12)) &&
      nearRatio(r.AD_XA, 0.886, 0.08),
  },
  {
    name: "butterfly",
    label: "Butterfly",
    przPad: 0.01,
    check: (r) =>
      nearRatio(r.AB_XA, 0.786, 0.08) &&
      nearRatio(r.BC_AB, 0.618, 0.15) &&
      (nearRatio(r.CD_BC, 1.618, 0.12) || nearRatio(r.CD_BC, 2.24, 0.12)) &&
      nearRatio(r.AD_XA, 1.27, 0.1),
  },
  {
    name: "crab",
    label: "Crab",
    przPad: 0.01,
    check: (r) =>
      (nearRatio(r.AB_XA, 0.382, 0.1) || nearRatio(r.AB_XA, 0.618, 0.1)) &&
      nearRatio(r.BC_AB, 0.618, 0.15) &&
      nearRatio(r.AD_XA, 1.618, 0.1),
  },
  {
    name: "shark",
    label: "Shark",
    przPad: 0.01,
    check: (r) =>
      (nearRatio(r.AB_XA, 0.446, 0.12) || nearRatio(r.AB_XA, 0.618, 0.12)) &&
      (nearRatio(r.BC_AB, 1.13, 0.12) || nearRatio(r.BC_AB, 1.618, 0.12)) &&
      (nearRatio(r.AD_XA, 0.886, 0.1) || nearRatio(r.AD_XA, 1.13, 0.1)),
  },
  {
    name: "cypher",
    label: "Cypher",
    przPad: 0.01,
    check: (r) =>
      nearRatio(r.AB_XA, 0.382, 0.12) &&
      (nearRatio(r.BC_AB, 1.13, 0.12) || nearRatio(r.BC_AB, 1.414, 0.12)) &&
      nearRatio(r.AD_XA, 0.786, 0.1),
  },
];

/**
 * Swan (anti-Gartley style): AB≈0.786 XA, AD deep extension beyond 1.13 XA,
 * opposing impulse after a failed Gartley-like retrace. Documented rule-set.
 */
function checkSwan(r: { AB_XA: number; AD_XA: number; BC_AB: number }): boolean {
  return (
    nearRatio(r.AB_XA, 0.786, 0.1) &&
    r.AD_XA >= 1.13 &&
    r.AD_XA <= 1.618 * 1.12 &&
    r.BC_AB >= 0.382 &&
    r.BC_AB <= 0.886
  );
}

function buildHit(
  name: string,
  label: string,
  bull: boolean,
  X: SwingPoint,
  A: SwingPoint,
  B: SwingPoint,
  C: SwingPoint,
  D: SwingPoint,
  conf: number,
  detail: string
): AdvancedPatternHit {
  const points = toPoints([
    { label: "X", s: X },
    { label: "A", s: A },
    { label: "B", s: B },
    { label: "C", s: C },
    { label: "D", s: D },
  ]);
  const XA = Math.abs(A.price - X.price) || 1;
  const direction = bull ? "bull" : "bear";
  const color = bull ? "#26a69a" : "#ef5350";
  // PRZ around D with pad
  const pad = XA * 0.01;
  const przLow = Math.min(D.price, D.price - (bull ? pad : -pad));
  const przHigh = Math.max(D.price, D.price + (bull ? pad : -pad));
  // Measured-move / Fib targets from D toward A (0.382/0.618/1.0 of AD or XA)
  const AD = Math.abs(D.price - A.price) || XA;
  const tp1 = bull ? D.price + AD * 0.382 : D.price - AD * 0.382;
  const tp2 = bull ? D.price + AD * 0.618 : D.price - AD * 0.618;
  const tp3 = bull ? D.price + AD : D.price - AD;
  const sl = bull ? D.price - XA * 0.12 : D.price + XA * 0.12;
  const drawings = [
    ...drawXABCD(points, color, name),
    ...drawTargets({
      t1: C.time,
      t2: D.time + Math.max(1, D.time - C.time),
      przLow: Math.min(przLow, przHigh),
      przHigh: Math.max(przLow, przHigh),
      tp1,
      tp2,
      tp3,
      sl,
      bull,
    }),
  ];
  return {
    id: uid(name),
    family: "harmonic",
    name,
    label: `${label} ${bull ? "Bull" : "Bear"}`,
    direction,
    confidence: conf,
    points,
    prz: { low: Math.min(przLow, przHigh), high: Math.max(przLow, przHigh), tStart: C.time, tEnd: D.time },
    entry: D.price,
    tp1,
    tp2,
    tp3,
    sl,
    detail,
    tStart: X.time,
    tEnd: D.time,
    drawings,
  };
}

export function detectHarmonics(candles: Candle[], swingStrength = 2): AdvancedPatternHit[] {
  if (candles.length < 60) return [];
  const zz = altZigzag(findSwings(candles, swingStrength));
  if (zz.length < 5) return [];
  const hits: AdvancedPatternHit[] = [];
  // Take last windows of 5 alternating swings
  const start = Math.max(0, zz.length - 24);
  for (let i = start; i <= zz.length - 5; i++) {
    const [X, A, B, C, D] = [zz[i], zz[i + 1], zz[i + 2], zz[i + 3], zz[i + 4]];
    // Must alternate kinds
    if (X.kind === A.kind || A.kind === B.kind || B.kind === C.kind || C.kind === D.kind) continue;
    const L = legLens(X, A, B, C, D);
    if (L.XA < 1e-9) continue;
    const ratios = {
      AB_XA: L.AB / L.XA,
      BC_AB: L.AB > 0 ? L.BC / L.AB : 0,
      CD_BC: L.BC > 0 ? L.CD / L.BC : 0,
      AD_XA: L.AD / L.XA,
      XC_XA: L.XC / L.XA,
    };
    const bull = X.kind === "low"; // classic: X low → bullish completion at D
    // structure sanity: B between X-A, D beyond or at A depending on pattern
    for (const spec of SPECS) {
      if (!spec.check(ratios)) continue;
      const conf = Math.max(
        0.45,
        1 -
          (Math.abs(ratios.AB_XA - 0.618) + Math.abs(ratios.AD_XA - 0.786)) * 0.35
      );
      hits.push(
        buildHit(
          spec.name,
          spec.label,
          bull,
          X,
          A,
          B,
          C,
          D,
          Math.min(0.95, conf),
          `AB/XA=${ratios.AB_XA.toFixed(3)} AD/XA=${ratios.AD_XA.toFixed(3)} BC/AB=${ratios.BC_AB.toFixed(3)}`
        )
      );
    }
    if (checkSwan(ratios)) {
      hits.push(
        buildHit(
          "swan",
          "Swan",
          !bull, // anti-Gartley: opposite bias
          X,
          A,
          B,
          C,
          D,
          0.55,
          `Anti-Gartley Swan AB/XA=${ratios.AB_XA.toFixed(3)} AD/XA=${ratios.AD_XA.toFixed(3)}`
        )
      );
    }
    // Generic AB=CD
    if (nearRatio(L.AB, L.CD, 0.12) && ratios.BC_AB >= 0.382 && ratios.BC_AB <= 0.886) {
      hits.push(
        buildHit(
          "abcd",
          "AB=CD",
          bull,
          X,
          A,
          B,
          C,
          D,
          0.6,
          `AB≈CD (${L.AB.toFixed(2)}≈${L.CD.toFixed(2)})`
        )
      );
    }
  }

  // W / M double structures (approx from last 5 swings)
  for (let i = Math.max(0, zz.length - 12); i <= zz.length - 5; i++) {
    const s = zz.slice(i, i + 5);
    // W: low-high-low-high-low with lows near
    if (
      s[0].kind === "low" &&
      s[2].kind === "low" &&
      s[4].kind === "low" &&
      nearRatio(s[0].price, s[2].price, 0.02) &&
      s[4].price <= Math.max(s[0].price, s[2].price) * 1.01
    ) {
      const lo = Math.min(s[0].price, s[2].price, s[4].price);
      const hi = Math.max(s[1].price, s[3].price);
      const mid = (lo + hi) / 2;
      const points = toPoints([
        { label: "X", s: s[0] },
        { label: "A", s: s[1] },
        { label: "B", s: s[2] },
        { label: "C", s: s[3] },
        { label: "D", s: s[4] },
      ]);
      const tp1 = mid;
      const tp2 = hi;
      const tp3 = hi + (hi - lo) * 0.27;
      const sl = lo - (hi - lo) * 0.1;
      hits.push({
        id: uid("w"),
        family: "harmonic",
        name: "w_bottom",
        label: "W Dip",
        direction: "bull",
        confidence: 0.62,
        points,
        entry: s[4].price,
        tp1,
        tp2,
        tp3,
        sl,
        detail: "Çift/üçlü dip W yapısı",
        tStart: s[0].time,
        tEnd: s[4].time,
        drawings: [
          ...drawXABCD(points, "#26a69a", "w"),
          ...drawTargets({ t1: s[2].time, t2: s[4].time, tp1, tp2, tp3, sl, bull: true, przLow: lo, przHigh: lo * 1.005 }),
        ],
      });
    }
    // M: high-low-high-low-high
    if (
      s[0].kind === "high" &&
      s[2].kind === "high" &&
      s[4].kind === "high" &&
      nearRatio(s[0].price, s[2].price, 0.02) &&
      s[4].price >= Math.min(s[0].price, s[2].price) * 0.99
    ) {
      const hi = Math.max(s[0].price, s[2].price, s[4].price);
      const lo = Math.min(s[1].price, s[3].price);
      const mid = (lo + hi) / 2;
      const points = toPoints([
        { label: "X", s: s[0] },
        { label: "A", s: s[1] },
        { label: "B", s: s[2] },
        { label: "C", s: s[3] },
        { label: "D", s: s[4] },
      ]);
      const tp1 = mid;
      const tp2 = lo;
      const tp3 = lo - (hi - lo) * 0.27;
      const sl = hi + (hi - lo) * 0.1;
      hits.push({
        id: uid("m"),
        family: "harmonic",
        name: "m_top",
        label: "M Tepe",
        direction: "bear",
        confidence: 0.62,
        points,
        entry: s[4].price,
        tp1,
        tp2,
        tp3,
        sl,
        detail: "Çift/üçlü tepe M yapısı",
        tStart: s[0].time,
        tEnd: s[4].time,
        drawings: [
          ...drawXABCD(points, "#ef5350", "m"),
          ...drawTargets({ t1: s[2].time, t2: s[4].time, tp1, tp2, tp3, sl, bull: false, przLow: hi * 0.995, przHigh: hi }),
        ],
      });
    }
  }

  // Rising / falling impulse legs (measured move)
  for (let i = Math.max(0, zz.length - 8); i < zz.length - 1; i++) {
    const a = zz[i];
    const b = zz[i + 1];
    const move = b.price - a.price;
    const bars = b.index - a.index;
    if (bars < 3 || bars > 40) continue;
    const atrApprox =
      candles.slice(a.index, b.index + 1).reduce((s, c) => s + (c.high - c.low), 0) /
      Math.max(1, bars);
    if (Math.abs(move) < atrApprox * 2.2) continue;
    const bull = move > 0;
    const tp1 = b.price + move * 0.382;
    const tp2 = b.price + move * 0.618;
    const tp3 = b.price + move;
    const sl = a.price;
    const points = toPoints([
      { label: "X", s: a },
      { label: "A", s: b },
    ]);
    hits.push({
      id: uid(bull ? "rise" : "fall"),
      family: "harmonic",
      name: bull ? "rising_leg" : "falling_leg",
      label: bull ? "Yükselen bacak" : "Düşen bacak",
      direction: bull ? "bull" : "bear",
      confidence: 0.5,
      points,
      entry: b.price,
      tp1,
      tp2,
      tp3,
      sl,
      detail: `Measured move ${(Math.abs(move) / a.price * 100).toFixed(1)}%`,
      tStart: a.time,
      tEnd: b.time,
      drawings: [
        ...drawXABCD(points, bull ? "#26a69a" : "#ef5350", "leg"),
        ...drawTargets({ t1: a.time, t2: b.time, tp1, tp2, tp3, sl, bull }),
      ],
    });
  }

  // Wolfe Waves approx: 5-point converging channel
  for (let i = Math.max(0, zz.length - 16); i <= zz.length - 5; i++) {
    const p = zz.slice(i, i + 5);
    const bull = p[0].kind === "low";
    // rough: points 1-3-5 and 2-4 trendlines converging
    const s13 = (p[2].price - p[0].price) / Math.max(1, p[2].index - p[0].index);
    const s24 = (p[3].price - p[1].price) / Math.max(1, p[3].index - p[1].index);
    if (bull && !(s13 > 0 && s24 < 0)) continue;
    if (!bull && !(s13 < 0 && s24 > 0)) continue;
    const target = p[0].price + s13 * (p[4].index - p[0].index); // EPA approx along 1-3-5? use 1→4 projection common
    const epa = p[1].price + ((p[3].price - p[1].price) / Math.max(1, p[3].index - p[1].index)) * (p[4].index - p[1].index);
    const points = toPoints([
      { label: "1", s: p[0] },
      { label: "2", s: p[1] },
      { label: "3", s: p[2] },
      { label: "4", s: p[3] },
      { label: "5", s: p[4] },
    ]);
    const tp1 = bull ? Math.max(p[4].price, epa) : Math.min(p[4].price, epa);
    const tp2 = target;
    const tp3 = bull ? tp2 + Math.abs(tp2 - p[4].price) * 0.5 : tp2 - Math.abs(tp2 - p[4].price) * 0.5;
    const sl = bull ? Math.min(p[4].price, p[2].price) : Math.max(p[4].price, p[2].price);
    hits.push({
      id: uid("wolfe"),
      family: "harmonic",
      name: "wolfe",
      label: `Wolfe ${bull ? "Bull" : "Bear"}`,
      direction: bull ? "bull" : "bear",
      confidence: 0.52,
      points,
      entry: p[4].price,
      tp1,
      tp2,
      tp3,
      sl,
      detail: "Wolfe Waves (yaklaşık 5 nokta)",
      tStart: p[0].time,
      tEnd: p[4].time,
      drawings: [
        ...drawXABCD(points, bull ? "#26a69a" : "#ef5350", "wolfe"),
        ...drawTargets({ t1: p[3].time, t2: p[4].time, tp1, tp2, tp3, sl, bull }),
      ],
    });
  }

  // Prefer recent + high confidence; dedupe by name+direction near same D
  hits.sort((a, b) => b.confidence - a.confidence || b.tEnd - a.tEnd);
  const seen = new Set<string>();
  const out: AdvancedPatternHit[] = [];
  for (const h of hits) {
    const key = `${h.name}_${h.direction}_${Math.round((h.entry ?? 0) * 100)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
    if (out.length >= 16) break;
  }
  return out;
}
