import type { PatternHit } from "./types";

/** Derive a stable swing high/low pair from pattern geometry for auto Fib. */
export function swingAnchorsFromPattern(
  hit: PatternHit
): { time: number; price: number }[] | null {
  type Pt = { time: number; price: number };
  const pts: Pt[] = [];
  for (const d of hit.drawings ?? []) {
    if (d.t1 != null && d.price1 != null && Number.isFinite(d.price1)) {
      pts.push({ time: d.t1, price: d.price1 });
    }
    if (d.t2 != null && d.price2 != null && Number.isFinite(d.price2)) {
      pts.push({ time: d.t2, price: d.price2 });
    }
  }
  if (hit.meta?.fibs?.length) {
    for (const f of hit.meta.fibs) {
      if (f?.price != null && Number.isFinite(f.price)) {
        // fib levels lack time — use earliest/latest from drawings as anchors later
        pts.push({ time: pts[0]?.time ?? 0, price: f.price });
      }
    }
  }
  if (pts.length < 2) return null;
  let hi = pts[0]!;
  let lo = pts[0]!;
  for (const p of pts) {
    if (p.price > hi.price) hi = p;
    if (p.price < lo.price) lo = p;
  }
  if (Math.abs(hi.price - lo.price) / ((Math.abs(hi.price) + Math.abs(lo.price)) / 2 || 1) < 1e-6) {
    return null;
  }
  // Prefer chronological order: earlier swing first
  if (lo.time <= hi.time) return [hi, lo]; // often swing high → low for retrace
  return [hi, lo];
}
