import type { Candle } from "@/lib/types";
import type { SwingPoint } from "@/lib/patterns/types";
import { findSwings } from "@/lib/patterns/swings";
import type { AdvancedPatternHit, PatternStage, XABCDPoint } from "./types";
import { ACTIVE_PATTERN_STAGES } from "./types";
import { drawTargets, drawWolfe, drawXABCD, nearRatio, uid } from "./draw";

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
  /** Ideal AD/XA for PRZ projection (forming) */
  idealAD: number;
  przPad: number;
  check: (r: { AB_XA: number; BC_AB: number; CD_BC: number; AD_XA: number; XC_XA?: number }) => boolean;
  /** X–A–B–C only (pre-D) */
  checkPartial: (r: { AB_XA: number; BC_AB: number }) => boolean;
}

const SPECS: HarmonicSpec[] = [
  {
    name: "gartley",
    label: "Gartley",
    idealAD: 0.786,
    przPad: 0.008,
    check: (r) =>
      nearRatio(r.AB_XA, 0.618, 0.07) &&
      nearRatio(r.BC_AB, 0.618, 0.14) &&
      (nearRatio(r.CD_BC, 1.272, 0.18) ||
        nearRatio(r.CD_BC, 1.618, 0.18) ||
        (r.CD_BC >= 1.13 && r.CD_BC <= 1.72)) &&
      nearRatio(r.AD_XA, 0.786, 0.08),
    checkPartial: (r) => nearRatio(r.AB_XA, 0.618, 0.08) && nearRatio(r.BC_AB, 0.618, 0.14),
  },
  {
    name: "bat",
    label: "Bat",
    idealAD: 0.886,
    przPad: 0.008,
    check: (r) =>
      (nearRatio(r.AB_XA, 0.382, 0.08) || nearRatio(r.AB_XA, 0.5, 0.08)) &&
      nearRatio(r.BC_AB, 0.5, 0.15) &&
      (nearRatio(r.CD_BC, 1.618, 0.12) || nearRatio(r.CD_BC, 2.0, 0.12)) &&
      nearRatio(r.AD_XA, 0.886, 0.08),
    checkPartial: (r) =>
      (nearRatio(r.AB_XA, 0.382, 0.1) || nearRatio(r.AB_XA, 0.5, 0.1)) &&
      nearRatio(r.BC_AB, 0.5, 0.18),
  },
  {
    name: "butterfly",
    label: "Butterfly",
    idealAD: 1.27,
    przPad: 0.01,
    check: (r) =>
      nearRatio(r.AB_XA, 0.786, 0.08) &&
      nearRatio(r.BC_AB, 0.618, 0.15) &&
      (nearRatio(r.CD_BC, 1.618, 0.12) || nearRatio(r.CD_BC, 2.24, 0.12)) &&
      nearRatio(r.AD_XA, 1.27, 0.1),
    checkPartial: (r) => nearRatio(r.AB_XA, 0.786, 0.1) && nearRatio(r.BC_AB, 0.618, 0.18),
  },
  {
    name: "crab",
    label: "Crab",
    idealAD: 1.618,
    przPad: 0.01,
    check: (r) =>
      (nearRatio(r.AB_XA, 0.382, 0.1) || nearRatio(r.AB_XA, 0.618, 0.1)) &&
      nearRatio(r.BC_AB, 0.618, 0.15) &&
      nearRatio(r.AD_XA, 1.618, 0.1),
    checkPartial: (r) =>
      (nearRatio(r.AB_XA, 0.382, 0.12) || nearRatio(r.AB_XA, 0.618, 0.12)) &&
      nearRatio(r.BC_AB, 0.618, 0.18),
  },
  {
    name: "shark",
    label: "Shark",
    idealAD: 0.886,
    przPad: 0.01,
    check: (r) =>
      (nearRatio(r.AB_XA, 0.446, 0.12) || nearRatio(r.AB_XA, 0.618, 0.12)) &&
      (nearRatio(r.BC_AB, 1.13, 0.12) || nearRatio(r.BC_AB, 1.618, 0.12)) &&
      (nearRatio(r.AD_XA, 0.886, 0.1) || nearRatio(r.AD_XA, 1.13, 0.1)),
    checkPartial: (r) =>
      (nearRatio(r.AB_XA, 0.446, 0.14) || nearRatio(r.AB_XA, 0.618, 0.14)) &&
      (nearRatio(r.BC_AB, 1.13, 0.14) || nearRatio(r.BC_AB, 1.618, 0.14)),
  },
  {
    name: "cypher",
    label: "Cypher",
    idealAD: 0.786,
    przPad: 0.01,
    check: (r) =>
      nearRatio(r.AB_XA, 0.382, 0.12) &&
      (nearRatio(r.BC_AB, 1.13, 0.12) || nearRatio(r.BC_AB, 1.414, 0.12)) &&
      nearRatio(r.AD_XA, 0.786, 0.1),
    checkPartial: (r) =>
      nearRatio(r.AB_XA, 0.382, 0.14) &&
      (nearRatio(r.BC_AB, 1.13, 0.14) || nearRatio(r.BC_AB, 1.414, 0.14)),
  },
];

function checkSwan(r: { AB_XA: number; AD_XA: number; BC_AB: number }): boolean {
  return (
    nearRatio(r.AB_XA, 0.786, 0.1) &&
    r.AD_XA >= 1.13 &&
    r.AD_XA <= 1.618 * 1.12 &&
    r.BC_AB >= 0.382 &&
    r.BC_AB <= 0.886
  );
}

/** Loose 5-point XABCD structure (not a named harmonic) */
function checkGenericXabcd(r: {
  AB_XA: number;
  BC_AB: number;
  CD_BC: number;
  AD_XA: number;
}): boolean {
  return (
    r.AB_XA >= 0.318 &&
    r.AB_XA <= 0.886 &&
    r.BC_AB >= 0.382 &&
    r.BC_AB <= 1.272 &&
    r.CD_BC >= 0.886 &&
    r.CD_BC <= 2.618 &&
    r.AD_XA >= 0.618 &&
    r.AD_XA <= 1.786
  );
}

function targetTimes(
  candles: Candle[],
  C: SwingPoint,
  D: SwingPoint
): { t1: number; t2: number } {
  const lastT = candles[candles.length - 1]?.time ?? D.time;
  const cdDur = Math.max(1, D.time - C.time);
  const t2 = Math.max(lastT, D.time + cdDur * 2);
  return { t1: C.time, t2 };
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
  detail: string,
  candles: Candle[],
  ratios?: { AB_XA: number; BC_AB: number; CD_BC: number; AD_XA: number },
  stageOverride?: PatternStage
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
  const pad = XA * 0.01;
  const przLow = Math.min(D.price - pad, D.price + pad * 0.25);
  const przHigh = Math.max(D.price + pad, D.price - pad * 0.25);
  const AD = Math.abs(D.price - A.price) || XA;
  const tp1 = bull ? D.price + AD * 0.382 : D.price - AD * 0.382;
  const tp2 = bull ? D.price + AD * 0.618 : D.price - AD * 0.618;
  const tp3 = bull ? D.price + AD : D.price - AD;
  const sl = bull ? D.price - XA * 0.12 : D.price + XA * 0.12;
  const { t1, t2 } = targetTimes(candles, C, D);
  const forming = stageOverride === "forming";
  const drawings = [
    ...drawXABCD(points, color, name, {
      legLabels: true,
      ratios,
      projected: forming,
    }),
    ...drawTargets({
      t1,
      t2,
      przLow: Math.min(przLow, przHigh),
      przHigh: Math.max(przLow, przHigh),
      tp1,
      tp2,
      tp3,
      sl,
      entry: D.price,
      entryTime: D.time,
      bull,
    }),
  ];
  const hit: AdvancedPatternHit = {
    id: uid(name),
    family: "harmonic",
    name,
    label: forming
      ? `${label} ${bull ? "Bull" : "Bear"} · PRZ izle`
      : `${label} ${bull ? "Bull" : "Bear"}`,
    direction,
    confidence: conf,
    points,
    prz: {
      low: Math.min(przLow, przHigh),
      high: Math.max(przLow, przHigh),
      tStart: C.time,
      tEnd: D.time,
    },
    entry: D.price,
    tp1,
    tp2,
    tp3,
    sl,
    detail,
    tStart: X.time,
    tEnd: D.time,
    drawings,
    legLabels: true,
  };
  return annotateStage(hit, candles, D.index, stageOverride);
}

/**
 * Scan candles after D to assign stage / barsAgo.
 * signalBar = D.index, or first PRZ retest bar after D when applicable.
 */
export function annotateStage(
  hit: AdvancedPatternHit,
  candles: Candle[],
  dIndex: number,
  stageOverride?: PatternStage
): AdvancedPatternHit {
  const n = candles.length;
  if (n < 1) {
    return { ...hit, stage: stageOverride ?? "prz", barsAgo: 0 };
  }

  if (stageOverride === "forming") {
    return {
      ...hit,
      stage: "forming",
      barsAgo: Math.max(0, n - 1 - dIndex),
    };
  }

  const bull = hit.direction === "bull";
  const tp1 = hit.tp1;
  const sl = hit.sl;
  const prz = hit.prz;
  let stage: PatternStage = "prz";
  let signalBar = Math.max(0, Math.min(dIndex, n - 1));

  // Hard invalid / target from D forward
  for (let i = dIndex + 1; i < n; i++) {
    const c = candles[i];
    if (tp1 != null) {
      if (bull && c.high >= tp1) {
        stage = "target_hit";
        break;
      }
      if (!bull && c.low <= tp1) {
        stage = "target_hit";
        break;
      }
    }
    if (sl != null) {
      // hard pierce beyond SL
      if (bull && c.low <= sl * 0.997) {
        stage = "invalid";
        break;
      }
      if (!bull && c.high >= sl * 1.003) {
        stage = "invalid";
        break;
      }
    }
  }

  if (stage !== "target_hit" && stage !== "invalid") {
    const last = candles[n - 1];
    const midPrz = prz ? (prz.low + prz.high) / 2 : hit.entry ?? last.close;
    const nearPct = midPrz * 0.01; // ~1%
    const halfPct = midPrz * 0.005;
    const touching =
      prz != null && last.low <= prz.high + halfPct && last.high >= prz.low - halfPct;
    const closeIn =
      prz != null &&
      last.close >= prz.low - nearPct &&
      last.close <= prz.high + nearPct;

    // First PRZ retest after D
    let retestBar: number | undefined;
    if (prz) {
      for (let i = dIndex + 1; i < n; i++) {
        const c = candles[i];
        if (c.low <= prz.high && c.high >= prz.low) {
          retestBar = i;
          break;
        }
      }
    }

    if (touching || closeIn) {
      if (retestBar != null && retestBar < n - 1) {
        stage = "retest";
        signalBar = retestBar;
      } else if (retestBar != null) {
        stage = "retest";
        signalBar = retestBar;
      } else {
        stage = "prz";
        signalBar = dIndex;
      }
    } else {
      // Moved toward TP but not hit
      const entry = hit.entry ?? midPrz;
      if (bull && last.close > entry + halfPct) stage = "active";
      else if (!bull && last.close < entry - halfPct) stage = "active";
      else stage = "prz";
      if (retestBar != null) signalBar = retestBar;
      else signalBar = dIndex;
    }
  }

  const barsAgo = Math.max(0, n - 1 - signalBar);
  const stageTr: Record<PatternStage, string> = {
    forming: "oluşuyor",
    prz: "PRZ",
    retest: "retest",
    active: "aktif",
    target_hit: "hedef dolmuş",
    invalid: "geçersiz",
  };
  return {
    ...hit,
    stage,
    barsAgo,
    detail: `${hit.detail} · ${stageTr[stage]} · ${barsAgo} mum önce`,
  };
}

export interface DetectHarmonicsOptions {
  swingStrength?: number;
  /** Keep target_hit / invalid in results (default false) */
  includeCompleted?: boolean;
  /** Drop hits older than this many bars (default 55) */
  maxBarsAgo?: number;
}

export function detectHarmonics(
  candles: Candle[],
  swingStrengthOrOpts: number | DetectHarmonicsOptions = 2
): AdvancedPatternHit[] {
  const opts: DetectHarmonicsOptions =
    typeof swingStrengthOrOpts === "number"
      ? { swingStrength: swingStrengthOrOpts }
      : swingStrengthOrOpts;
  const swingStrength = opts.swingStrength ?? 2;
  const includeCompleted = opts.includeCompleted ?? false;
  const maxBarsAgo = opts.maxBarsAgo ?? 55;

  if (candles.length < 60) return [];
  const zz = altZigzag(findSwings(candles, swingStrength));
  if (zz.length < 4) return [];
  const hits: AdvancedPatternHit[] = [];
  const last = candles[candles.length - 1];
  const n = candles.length;

  // Completed XABCD (5 swings)
  const start = Math.max(0, zz.length - 24);
  for (let i = start; i <= zz.length - 5; i++) {
    const [X, A, B, C, D] = [zz[i], zz[i + 1], zz[i + 2], zz[i + 3], zz[i + 4]];
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
    const bull = X.kind === "low";
    let named = false;
    for (const spec of SPECS) {
      if (!spec.check(ratios)) continue;
      named = true;
      const conf = Math.max(
        0.45,
        1 - (Math.abs(ratios.AB_XA - 0.618) + Math.abs(ratios.AD_XA - spec.idealAD)) * 0.35
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
          `AB/XA=${ratios.AB_XA.toFixed(3)} AD/XA=${ratios.AD_XA.toFixed(3)} BC/AB=${ratios.BC_AB.toFixed(3)}`,
          candles,
          ratios
        )
      );
    }
    if (checkSwan(ratios)) {
      named = true;
      hits.push(
        buildHit(
          "swan",
          "Swan",
          !bull,
          X,
          A,
          B,
          C,
          D,
          0.55,
          `Anti-Gartley Swan AB/XA=${ratios.AB_XA.toFixed(3)} AD/XA=${ratios.AD_XA.toFixed(3)}`,
          candles,
          ratios
        )
      );
    }
    if (nearRatio(L.AB, L.CD, 0.12) && ratios.BC_AB >= 0.382 && ratios.BC_AB <= 0.886) {
      named = true;
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
          `AB≈CD (${L.AB.toFixed(2)}≈${L.CD.toFixed(2)})`,
          candles,
          ratios
        )
      );
    }
    if (!named && checkGenericXabcd(ratios)) {
      hits.push(
        buildHit(
          "xabcd",
          "XABCD",
          bull,
          X,
          A,
          B,
          C,
          D,
          0.48,
          `Genel XABCD AB/XA=${ratios.AB_XA.toFixed(3)} AD/XA=${ratios.AD_XA.toFixed(3)}`,
          candles,
          ratios
        )
      );
    }
  }

  // Early FORMING: X–A–B–C match, D projected, price near PRZ
  for (let i = Math.max(0, zz.length - 20); i <= zz.length - 4; i++) {
    const [X, A, B, C] = [zz[i], zz[i + 1], zz[i + 2], zz[i + 3]];
    // Skip if a confirmed D swing already follows this window (handled above)
    if (i + 4 < zz.length) continue;
    if (X.kind === A.kind || A.kind === B.kind || B.kind === C.kind) continue;
    const XA = Math.abs(A.price - X.price);
    if (XA < 1e-9) continue;
    const AB = Math.abs(B.price - A.price);
    const BC = Math.abs(C.price - B.price);
    const partial = {
      AB_XA: AB / XA,
      BC_AB: AB > 0 ? BC / AB : 0,
    };
    const bull = X.kind === "low";
    for (const spec of SPECS) {
      if (!spec.checkPartial(partial)) continue;
      // Project ideal D along A→X direction
      const dPrice = A.price + (X.price - A.price) * spec.idealAD;
      const pad = XA * (spec.przPad || 0.01);
      const przLo = Math.min(dPrice - pad, dPrice + pad * 0.2);
      const przHi = Math.max(dPrice + pad, dPrice - pad * 0.2);
      const mid = (przLo + przHi) / 2;
      const distPct = Math.abs(last.close - mid) / Math.max(Math.abs(mid), 1e-9);
      const touching = last.low <= przHi && last.high >= przLo;
      if (!touching && distPct > 0.02) continue; // not approaching PRZ

      // Synthetic D at last bar / projected price
      const D: SwingPoint = {
        index: n - 1,
        time: last.time,
        price: dPrice,
        kind: bull ? "low" : "high",
      };
      const L = {
        AB_XA: partial.AB_XA,
        BC_AB: partial.BC_AB,
        CD_BC: BC > 0 ? Math.abs(dPrice - C.price) / BC : 0,
        AD_XA: Math.abs(dPrice - A.price) / XA,
      };
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
          0.5,
          `FORMING PRZ izle · ideal AD/XA=${spec.idealAD}`,
          candles,
          L,
          "forming"
        )
      );
    }
  }

  // W / M double structures
  for (let i = Math.max(0, zz.length - 12); i <= zz.length - 5; i++) {
    const s = zz.slice(i, i + 5);
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
      const lastT = candles[n - 1]?.time ?? s[4].time;
      const t2 = Math.max(lastT, s[4].time + Math.max(1, s[4].time - s[2].time) * 2);
      const raw: AdvancedPatternHit = {
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
        prz: { low: lo, high: lo * 1.005, tStart: s[2].time, tEnd: s[4].time },
        detail: "Çift/üçlü dip W yapısı",
        tStart: s[0].time,
        tEnd: s[4].time,
        legLabels: true,
        drawings: [
          ...drawXABCD(points, "#26a69a", "w", { legLabels: true }),
          ...drawTargets({
            t1: s[2].time,
            t2,
            tp1,
            tp2,
            tp3,
            sl,
            bull: true,
            przLow: lo,
            przHigh: lo * 1.005,
            entry: s[4].price,
            entryTime: s[4].time,
          }),
        ],
      };
      hits.push(annotateStage(raw, candles, s[4].index));
    }
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
      const lastT = candles[n - 1]?.time ?? s[4].time;
      const t2 = Math.max(lastT, s[4].time + Math.max(1, s[4].time - s[2].time) * 2);
      const raw: AdvancedPatternHit = {
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
        prz: { low: hi * 0.995, high: hi, tStart: s[2].time, tEnd: s[4].time },
        detail: "Çift/üçlü tepe M yapısı",
        tStart: s[0].time,
        tEnd: s[4].time,
        legLabels: true,
        drawings: [
          ...drawXABCD(points, "#ef5350", "m", { legLabels: true }),
          ...drawTargets({
            t1: s[2].time,
            t2,
            tp1,
            tp2,
            tp3,
            sl,
            bull: false,
            przLow: hi * 0.995,
            przHigh: hi,
            entry: s[4].price,
            entryTime: s[4].time,
          }),
        ],
      };
      hits.push(annotateStage(raw, candles, s[4].index));
    }
  }

  // Rising / falling impulse legs
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
    const lastT = candles[n - 1]?.time ?? b.time;
    const t2 = Math.max(lastT, b.time + Math.max(1, b.time - a.time) * 2);
    const raw: AdvancedPatternHit = {
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
      detail: `Measured move ${((Math.abs(move) / a.price) * 100).toFixed(1)}%`,
      tStart: a.time,
      tEnd: b.time,
      drawings: [
        ...drawXABCD(points, bull ? "#26a69a" : "#ef5350", "leg"),
        ...drawTargets({
          t1: a.time,
          t2,
          tp1,
          tp2,
          tp3,
          sl,
          bull,
          entry: b.price,
          entryTime: b.time,
        }),
      ],
    };
    hits.push(annotateStage(raw, candles, b.index));
  }

  // Wolfe Waves: 5-point converging channel + EPA
  for (let i = Math.max(0, zz.length - 16); i <= zz.length - 5; i++) {
    const p = zz.slice(i, i + 5);
    const bull = p[0].kind === "low";
    const s13 = (p[2].price - p[0].price) / Math.max(1, p[2].index - p[0].index);
    const s24 = (p[3].price - p[1].price) / Math.max(1, p[3].index - p[1].index);
    if (bull && !(s13 > 0 && s24 < 0)) continue;
    if (!bull && !(s13 < 0 && s24 > 0)) continue;
    const target =
      p[0].price + s13 * (p[4].index - p[0].index);
    const epa =
      p[1].price +
      ((p[3].price - p[1].price) / Math.max(1, p[3].index - p[1].index)) *
        (p[4].index - p[1].index);
    const points = toPoints([
      { label: "1", s: p[0] },
      { label: "2", s: p[1] },
      { label: "3", s: p[2] },
      { label: "4", s: p[3] },
      { label: "5", s: p[4] },
    ]);
    const tp1 = bull ? Math.max(p[4].price, epa) : Math.min(p[4].price, epa);
    const tp2 = target;
    const tp3 = bull
      ? tp2 + Math.abs(tp2 - p[4].price) * 0.5
      : tp2 - Math.abs(tp2 - p[4].price) * 0.5;
    const sl = bull ? Math.min(p[4].price, p[2].price) : Math.max(p[4].price, p[2].price);
    const lastT = candles[n - 1]?.time ?? p[4].time;
    const t2 = Math.max(lastT, p[4].time + Math.max(1, p[4].time - p[3].time) * 2);
    const raw: AdvancedPatternHit = {
      id: uid("wolfe"),
      family: "harmonic",
      name: "wolfe",
      label: `Wolfe ${bull ? "Bull" : "Bear"}`,
      direction: bull ? "bull" : "bear",
      confidence: 0.55,
      points,
      entry: p[4].price,
      tp1,
      tp2,
      tp3,
      sl,
      prz: {
        low: Math.min(p[4].price, sl),
        high: Math.max(p[4].price, sl),
        tStart: p[3].time,
        tEnd: p[4].time,
      },
      detail: "Wolfe Waves · 1-3-5 + 2-4 + EPA",
      tStart: p[0].time,
      tEnd: p[4].time,
      legLabels: true,
      drawings: [
        ...drawWolfe(points, bull ? "#26a69a" : "#ef5350", "wolfe", {
          epa,
          tEnd: t2,
          bull,
        }),
        ...drawTargets({
          t1: p[3].time,
          t2,
          tp1,
          tp2,
          tp3,
          sl,
          bull,
          entry: p[4].price,
          entryTime: p[4].time,
        }),
      ],
    };
    hits.push(annotateStage(raw, candles, p[4].index));
  }

  // Prefer active stages, newest D, higher confidence
  const stageRank = (s?: PatternStage) => {
    const order: Record<PatternStage, number> = {
      forming: 0,
      prz: 1,
      retest: 1,
      active: 2,
      target_hit: 8,
      invalid: 9,
    };
    return s != null ? order[s] : 5;
  };
  hits.sort(
    (a, b) =>
      stageRank(a.stage) - stageRank(b.stage) ||
      (a.barsAgo ?? 999) - (b.barsAgo ?? 999) ||
      b.confidence - a.confidence ||
      b.tEnd - a.tEnd
  );

  const seen = new Set<string>();
  const out: AdvancedPatternHit[] = [];
  for (const h of hits) {
    if ((h.barsAgo ?? 0) > maxBarsAgo) continue;
    if (!includeCompleted && h.stage && !ACTIVE_PATTERN_STAGES.includes(h.stage)) continue;
    const key = `${h.name}_${h.direction}_${Math.round((h.entry ?? 0) * 100)}_${h.stage ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
    if (out.length >= 16) break;
  }
  return out;
}
