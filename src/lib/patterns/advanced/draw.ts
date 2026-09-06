import type { PatternDrawing } from "@/lib/patterns/types";
import type { XABCDPoint } from "./types";

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function nearRatio(
  actual: number,
  target: number,
  tol = 0.06
): boolean {
  if (!Number.isFinite(actual) || !Number.isFinite(target) || target === 0)
    return false;
  return Math.abs(actual - target) / Math.abs(target) <= tol;
}

export function fibRetrace(a: number, b: number, ratio: number): number {
  return b + (a - b) * ratio;
}

export function fibExt(a: number, b: number, ratio: number): number {
  return b + (b - a) * ratio;
}

export interface DrawXABCDOpts {
  legLabels?: boolean;
  /** Ratios for mid-leg text: AB/XA, BC/AB, CD/BC, AD/XA */
  ratios?: {
    AB_XA?: number;
    BC_AB?: number;
    CD_BC?: number;
    AD_XA?: number;
  };
  /** Projected / dashed final leg (forming D) */
  projected?: boolean;
}

function fmtRatio(r: number | undefined): string {
  if (r == null || !Number.isFinite(r)) return "";
  return ` ${r.toFixed(3)}`;
}

/** Midpoint in time/price for segment labels */
function mid(
  a: XABCDPoint,
  b: XABCDPoint
): { time: number; price: number } {
  return {
    time: Math.round((a.time + b.time) / 2),
    price: (a.price + b.price) / 2,
  };
}

export function drawXABCD(
  points: XABCDPoint[],
  color: string,
  prefix: string,
  opts: DrawXABCDOpts = {}
): PatternDrawing[] {
  const out: PatternDrawing[] = [];
  const legNames =
    points.length >= 5 && points[0]?.label === "1"
      ? ["1-2", "2-3", "3-4", "4-5"]
      : ["XA", "AB", "BC", "CD"];
  const ratioKeys: (keyof NonNullable<DrawXABCDOpts["ratios"]>)[] = [
    "AB_XA",
    "BC_AB",
    "CD_BC",
  ];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const isLast = i === points.length - 2;
    out.push({
      id: uid(`${prefix}_seg`),
      kind: "segment",
      t1: a.time,
      price1: a.price,
      t2: b.time,
      price2: b.price,
      color,
      lineWidth: 2,
      dashed: opts.projected && isLast,
    });
    if (opts.legLabels !== false) {
      const m = mid(a, b);
      let text = legNames[i] ?? `${a.label}-${b.label}`;
      if (i === 0 && opts.ratios?.AD_XA != null && points.length >= 5) {
        // XA leg: show name only; ratios go on AB/BC/CD
      }
      if (i >= 1 && i <= 3) {
        const rk = ratioKeys[i - 1];
        const rv = rk ? opts.ratios?.[rk] : undefined;
        if (rv != null) text = `${legNames[i]}${fmtRatio(rv)}`;
      }
      if (i === 0 && opts.ratios?.AB_XA == null) {
        text = legNames[0] ?? "XA";
      }
      out.push({
        id: uid(`${prefix}_leglbl`),
        kind: "label",
        t1: m.time,
        price1: m.price,
        label: text,
        color,
      });
    }
  }
  // AD ratio label near D if available
  if (opts.legLabels !== false && opts.ratios?.AD_XA != null && points.length >= 5) {
    const d = points[points.length - 1];
    out.push({
      id: uid(`${prefix}_ad`),
      kind: "label",
      t1: d.time,
      price1: d.price,
      label: `AD ${opts.ratios.AD_XA.toFixed(3)}`,
      color,
    });
  }
  for (const p of points) {
    out.push({
      id: uid(`${prefix}_lbl`),
      kind: "label",
      t1: p.time,
      price1: p.price,
      label: opts.projected && p.label === "D" ? "D?" : p.label,
      color,
    });
  }
  return out;
}

/**
 * Wolfe: clear 1-3-5 and 2-4 channel lines + EPA target.
 */
export function drawWolfe(
  points: XABCDPoint[],
  color: string,
  prefix: string,
  opts: { epa?: number; tEnd?: number; bull?: boolean } = {}
): PatternDrawing[] {
  const out: PatternDrawing[] = [];
  if (points.length < 5) return drawXABCD(points, color, prefix);
  const [p1, p2, p3, p4, p5] = points;
  // Consecutive path (lighter)
  out.push(...drawXABCD(points, color, prefix, { legLabels: true }));
  // 1-3-5 trendline (thicker)
  out.push({
    id: uid(`${prefix}_135a`),
    kind: "trendline",
    t1: p1.time,
    price1: p1.price,
    t2: p3.time,
    price2: p3.price,
    color,
    lineWidth: 2.5,
  });
  out.push({
    id: uid(`${prefix}_135b`),
    kind: "trendline",
    t1: p3.time,
    price1: p3.price,
    t2: p5.time,
    price2: p5.price,
    color,
    lineWidth: 2.5,
  });
  out.push({
    id: uid(`${prefix}_135lbl`),
    kind: "label",
    t1: Math.round((p1.time + p5.time) / 2),
    price1: (p1.price + p5.price) / 2,
    label: "1-3-5",
    color,
  });
  // 2-4 line
  out.push({
    id: uid(`${prefix}_24`),
    kind: "trendline",
    t1: p2.time,
    price1: p2.price,
    t2: p4.time,
    price2: p4.price,
    color: "#ffa726",
    lineWidth: 2.5,
    dashed: true,
  });
  out.push({
    id: uid(`${prefix}_24lbl`),
    kind: "label",
    t1: Math.round((p2.time + p4.time) / 2),
    price1: (p2.price + p4.price) / 2,
    label: "2-4",
    color: "#ffa726",
  });
  if (opts.epa != null && Number.isFinite(opts.epa)) {
    const t2 = opts.tEnd ?? p5.time + Math.max(1, p5.time - p4.time) * 2;
    out.push({
      id: uid(`${prefix}_epa`),
      kind: "hline",
      t1: p5.time,
      t2,
      price1: opts.epa,
      price2: opts.epa,
      color: "#ab47bc",
      label: "EPA",
      dashed: true,
      lineWidth: 1.5,
    });
  }
  return out;
}

export function drawTargets(opts: {
  t1: number;
  t2: number;
  przLow?: number;
  przHigh?: number;
  tp1?: number;
  tp2?: number;
  tp3?: number;
  sl?: number;
  entry?: number;
  entryTime?: number;
  bull: boolean;
}): PatternDrawing[] {
  const out: PatternDrawing[] = [];
  const { t1, t2 } = opts;
  const span = Math.max(1, t2 - t1);
  const tFar = t2 + span; // extend further right

  if (opts.przLow != null && opts.przHigh != null) {
    out.push({
      id: uid("prz"),
      kind: "box",
      t1,
      t2: tFar,
      price1: opts.przLow,
      price2: opts.przHigh,
      color: opts.bull ? "#26a69a" : "#ef5350",
      label: "PRZ",
    });
  }

  if (opts.entry != null && Number.isFinite(opts.entry)) {
    const et = opts.entryTime ?? t1;
    out.push({
      id: uid("entry_h"),
      kind: "hline",
      t1: et,
      t2: tFar,
      price1: opts.entry,
      price2: opts.entry,
      color: "#42a5f5",
      label: "ENTRY",
      lineWidth: 1.5,
    });
    out.push({
      id: uid("entry_m"),
      kind: "marker",
      t1: et,
      price1: opts.entry,
      label: "ENTRY",
      color: "#42a5f5",
      shape: opts.bull ? "arrowUp" : "arrowDown",
      position: opts.bull ? "belowBar" : "aboveBar",
    });
  }

  const lines: [number | undefined, string, string][] = [
    [opts.tp1, "TP1", "#26a69a"],
    [opts.tp2, "TP2", "#42a5f5"],
    [opts.tp3, "TP3", "#ab47bc"],
    [opts.sl, "SL", "#ef5350"],
  ];
  for (const [price, label, color] of lines) {
    if (price == null || !Number.isFinite(price)) continue;
    out.push({
      id: uid(label.toLowerCase()),
      kind: "hline",
      t1,
      t2: tFar,
      price1: price,
      price2: price,
      color,
      label,
      dashed: label !== "SL",
      lineWidth: 1,
    });
  }
  return out;
}
