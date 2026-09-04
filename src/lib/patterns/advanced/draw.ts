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

export function drawXABCD(
  points: XABCDPoint[],
  color: string,
  prefix: string
): PatternDrawing[] {
  const out: PatternDrawing[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    out.push({
      id: uid(`${prefix}_seg`),
      kind: "segment",
      t1: a.time,
      price1: a.price,
      t2: b.time,
      price2: b.price,
      color,
      lineWidth: 2,
    });
  }
  for (const p of points) {
    out.push({
      id: uid(`${prefix}_lbl`),
      kind: "label",
      t1: p.time,
      price1: p.price,
      label: p.label,
      color,
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
  bull: boolean;
}): PatternDrawing[] {
  const out: PatternDrawing[] = [];
  const { t1, t2 } = opts;
  if (opts.przLow != null && opts.przHigh != null) {
    out.push({
      id: uid("prz"),
      kind: "box",
      t1,
      t2,
      price1: opts.przLow,
      price2: opts.przHigh,
      color: opts.bull ? "#26a69a" : "#ef5350",
      label: "PRZ",
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
      t2: t2 + Math.max(1, (t2 - t1) || 1),
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
