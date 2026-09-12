import type { Candle } from "@/lib/types";
import { atr } from "./math";

export type PivotPt = { i: number; price: number };

function isPivotHigh(candles: Candle[], i: number, L: number, R: number): boolean {
  const h = candles[i].high;
  for (let j = i - L; j <= i + R; j++) {
    if (j === i) continue;
    if (j < 0 || j >= candles.length) return false;
    if (candles[j].high >= h) return false;
  }
  return true;
}

function isPivotLow(candles: Candle[], i: number, L: number, R: number): boolean {
  const l = candles[i].low;
  for (let j = i - L; j <= i + R; j++) {
    if (j === i) continue;
    if (j < 0 || j >= candles.length) return false;
    if (candles[j].low <= l) return false;
  }
  return true;
}

function lineAt(
  i0: number,
  p0: number,
  i1: number,
  p1: number,
  i: number
): number {
  if (i1 === i0) return p1;
  const slope = (p1 - p0) / (i1 - i0);
  return p0 + slope * (i - i0);
}

/**
 * Diagonal S/R (pikusov / hilium style): connect last two pivot highs → resistance,
 * last two pivot lows → support; extrapolate to current bar.
 * Also emits double/triple bottom & top neck-break events (causal, rightBars lag).
 */
export function diagonalSr(
  candles: Candle[],
  opts: { left?: number; right?: number; twinTol?: number; minGap?: number; maxGap?: number } = {}
) {
  const L = opts.left ?? 5;
  const R = opts.right ?? 5;
  const twinTol = opts.twinTol ?? 0.015;
  const minGap = opts.minGap ?? 5;
  const maxGap = opts.maxGap ?? 80;
  const n = candles.length;

  const support: (number | null)[] = new Array(n).fill(null);
  const resistance: (number | null)[] = new Array(n).fill(null);
  const flatSup: (number | null)[] = new Array(n).fill(null);
  const flatRes: (number | null)[] = new Array(n).fill(null);

  const dbLong: boolean[] = new Array(n).fill(false);
  const dtShort: boolean[] = new Array(n).fill(false);
  const tbLong: boolean[] = new Array(n).fill(false);
  const ttShort: boolean[] = new Array(n).fill(false);
  const descSup: boolean[] = new Array(n).fill(false);
  const descRes: boolean[] = new Array(n).fill(false);
  const bounceLong: boolean[] = new Array(n).fill(false);
  const bounceShort: boolean[] = new Array(n).fill(false);
  const breakLong: boolean[] = new Array(n).fill(false);
  const breakShort: boolean[] = new Array(n).fill(false);

  const highs: PivotPt[] = [];
  const lows: PivotPt[] = [];
  let lastFlatSup: number | null = null;
  let lastFlatRes: number | null = null;
  let activeSup: { i0: number; p0: number; i1: number; p1: number } | null = null;
  let activeRes: { i0: number; p0: number; i1: number; p1: number } | null = null;

  // pending twin patterns awaiting neck break
  type Pending = { kind: "db" | "dt" | "tb" | "tt"; neck: number; troughOrPeak: number; from: number };
  const pending: Pending[] = [];
  const atrArr = atr(candles, 14);

  const near = (a: number, b: number) => Math.abs(a - b) / ((a + b) / 2) <= twinTol;

  for (let i = 0; i < n; i++) {
    // Confirm pivots at i-R
    const pi = i - R;
    if (pi >= L) {
      if (isPivotHigh(candles, pi, L, R)) {
        highs.push({ i: pi, price: candles[pi].high });
        lastFlatRes = candles[pi].high;
        if (highs.length >= 2) {
          const a = highs[highs.length - 2];
          const b = highs[highs.length - 1];
          activeRes = { i0: a.i, p0: a.price, i1: b.i, p1: b.price };
        }
        // double / triple top detect on new pivot high
        if (highs.length >= 2) {
          const b = highs[highs.length - 1];
          const a = highs[highs.length - 2];
          const gap = b.i - a.i;
          if (gap >= minGap && gap <= maxGap && near(a.price, b.price)) {
            let neck = Infinity;
            for (let k = a.i + 1; k < b.i; k++) neck = Math.min(neck, candles[k].low);
            if (Number.isFinite(neck) && (a.price - neck) / a.price >= 0.008) {
              pending.push({ kind: "dt", neck, troughOrPeak: Math.max(a.price, b.price), from: b.i });
            }
          }
        }
        if (highs.length >= 3) {
          const c = highs[highs.length - 1];
          const b = highs[highs.length - 2];
          const a = highs[highs.length - 3];
          const g1 = b.i - a.i;
          const g2 = c.i - b.i;
          if (
            g1 >= minGap &&
            g2 >= minGap &&
            g1 + g2 <= maxGap * 1.5 &&
            near(a.price, b.price) &&
            near(b.price, c.price)
          ) {
            let neck = Infinity;
            for (let k = a.i + 1; k < c.i; k++) neck = Math.min(neck, candles[k].low);
            if (Number.isFinite(neck) && (Math.max(a.price, b.price, c.price) - neck) / neck >= 0.01) {
              pending.push({
                kind: "tt",
                neck,
                troughOrPeak: Math.max(a.price, b.price, c.price),
                from: c.i,
              });
            }
          }
        }
      }
      if (isPivotLow(candles, pi, L, R)) {
        lows.push({ i: pi, price: candles[pi].low });
        lastFlatSup = candles[pi].low;
        if (lows.length >= 2) {
          const a = lows[lows.length - 2];
          const b = lows[lows.length - 1];
          activeSup = { i0: a.i, p0: a.price, i1: b.i, p1: b.price };
        }
        if (lows.length >= 2) {
          const b = lows[lows.length - 1];
          const a = lows[lows.length - 2];
          const gap = b.i - a.i;
          if (gap >= minGap && gap <= maxGap && near(a.price, b.price)) {
            let neck = -Infinity;
            for (let k = a.i + 1; k < b.i; k++) neck = Math.max(neck, candles[k].high);
            if (Number.isFinite(neck) && (neck - Math.min(a.price, b.price)) / neck >= 0.008) {
              pending.push({ kind: "db", neck, troughOrPeak: Math.min(a.price, b.price), from: b.i });
            }
          }
        }
        if (lows.length >= 3) {
          const c = lows[lows.length - 1];
          const b = lows[lows.length - 2];
          const a = lows[lows.length - 3];
          const g1 = b.i - a.i;
          const g2 = c.i - b.i;
          if (
            g1 >= minGap &&
            g2 >= minGap &&
            g1 + g2 <= maxGap * 1.5 &&
            near(a.price, b.price) &&
            near(b.price, c.price)
          ) {
            let neck = -Infinity;
            for (let k = a.i + 1; k < c.i; k++) neck = Math.max(neck, candles[k].high);
            if (Number.isFinite(neck) && (neck - Math.min(a.price, b.price, c.price)) / neck >= 0.01) {
              pending.push({
                kind: "tb",
                neck,
                troughOrPeak: Math.min(a.price, b.price, c.price),
                from: c.i,
              });
            }
          }
        }
      }
    }

    if (activeSup) {
      support[i] = lineAt(activeSup.i0, activeSup.p0, activeSup.i1, activeSup.p1, i);
      descSup[i] = activeSup.p1 < activeSup.p0;
    }
    if (activeRes) {
      resistance[i] = lineAt(activeRes.i0, activeRes.p0, activeRes.i1, activeRes.p1, i);
      descRes[i] = activeRes.p1 < activeRes.p0;
    }
    flatSup[i] = lastFlatSup;
    flatRes[i] = lastFlatRes;

    const c = candles[i];
    const a = atrArr[i];
    const band = a != null && a > 0 ? a * 0.35 : c.close * 0.003;

    // Diagonal bounce / break
    const s = support[i];
    const r = resistance[i];
    if (s != null && i > 0) {
      const touched = c.low <= s + band && c.low >= s - band * 1.5;
      if (touched && c.close > s && c.close >= c.open) bounceLong[i] = true;
      if (candles[i - 1].close >= s && c.close < s - band * 0.25) breakShort[i] = true;
    }
    if (r != null && i > 0) {
      const touched = c.high >= r - band && c.high <= r + band * 1.5;
      if (touched && c.close < r && c.close <= c.open) bounceShort[i] = true;
      if (candles[i - 1].close <= r && c.close > r + band * 0.25) breakLong[i] = true;
    }

    // Neck breaks (fire once per pending)
    for (let p = pending.length - 1; p >= 0; p--) {
      const pend = pending[p];
      if (i <= pend.from) continue;
      if (pend.kind === "db" || pend.kind === "tb") {
        if (c.close > pend.neck) {
          if (pend.kind === "db") dbLong[i] = true;
          else tbLong[i] = true;
          pending.splice(p, 1);
        } else if (c.close < pend.troughOrPeak * 0.985) {
          pending.splice(p, 1); // invalidated
        }
      } else {
        if (c.close < pend.neck) {
          if (pend.kind === "dt") dtShort[i] = true;
          else ttShort[i] = true;
          pending.splice(p, 1);
        } else if (c.close > pend.troughOrPeak * 1.015) {
          pending.splice(p, 1);
        }
      }
    }
  }

  const last = n - 1;
  const seg = (
    line: { i0: number; p0: number; i1: number; p1: number } | null,
    endPrice: number | null
  ): DiagSeg | null => {
    if (!line || last < 0) return null;
    const c0 = candles[line.i0];
    const c1 = candles[last];
    if (!c0 || !c1) return null;
    const slope = (line.p1 - line.p0) / Math.max(1, line.i1 - line.i0);
    return {
      t0: c0.time,
      p0: line.p0,
      t1: c1.time,
      p1: endPrice ?? line.p1,
      slope,
      descending: line.p1 < line.p0,
    };
  };

  return {
    support,
    resistance,
    flatSup,
    flatRes,
    descSup,
    descRes,
    dbLong,
    dtShort,
    tbLong,
    ttShort,
    bounceLong,
    bounceShort,
    breakLong,
    breakShort,
    lastSup: seg(activeSup, support[last] ?? null),
    lastRes: seg(activeRes, resistance[last] ?? null),
  };
}

export type DiagSeg = {
  t0: number;
  p0: number;
  t1: number;
  p1: number;
  slope: number;
  descending: boolean;
};

export type DiagEvent =
  | "bounce"
  | "break"
  | "twin"
  | "triple"
  | "any";

export function recentDiagonalSr(
  candles: Candle[],
  opts: {
    event?: DiagEvent;
    direction?: "bull" | "bear" | "any";
    slope?: "desc" | "any";
    maxBarsAgo?: number;
  } = {}
): { ok: boolean; kind: string; barsAgo: number; note: string } {
  const event = opts.event ?? "any";
  const dir = opts.direction ?? "any";
  const slope = opts.slope ?? "any";
  const max = opts.maxBarsAgo ?? 2;
  if (candles.length < 40) return { ok: false, kind: "", barsAgo: -1, note: "" };
  const d = diagonalSr(candles);
  const n = candles.length;
  for (let ago = 0; ago <= max; ago++) {
    const i = n - 1 - ago;
    if (i < 0) break;
    const descOkLong = slope !== "desc" || d.descSup[i];
    const descOkShort = slope !== "desc" || d.descRes[i];
    const hits: { kind: string; note: string; long: boolean }[] = [];
    if ((event === "bounce" || event === "any") && d.bounceLong[i] && descOkLong)
      hits.push({ kind: "bounceL", note: "diag destek sekme", long: true });
    if ((event === "bounce" || event === "any") && d.bounceShort[i] && descOkShort)
      hits.push({ kind: "bounceS", note: "diag direnç sekme", long: false });
    if ((event === "break" || event === "any") && d.breakLong[i] && descOkShort)
      hits.push({ kind: "breakL", note: "diag direnç kırılım", long: true });
    if ((event === "break" || event === "any") && d.breakShort[i] && descOkLong)
      hits.push({ kind: "breakS", note: "diag destek kırılım", long: false });
    if ((event === "twin" || event === "any") && d.dbLong[i])
      hits.push({ kind: "db", note: "ikili dip boyun", long: true });
    if ((event === "twin" || event === "any") && d.dtShort[i])
      hits.push({ kind: "dt", note: "ikili tepe boyun", long: false });
    if ((event === "triple" || event === "any") && d.tbLong[i])
      hits.push({ kind: "tb", note: "üçlü dip boyun", long: true });
    if ((event === "triple" || event === "any") && d.ttShort[i])
      hits.push({ kind: "tt", note: "üçlü tepe boyun", long: false });
    const hit = hits.find((h) =>
      dir === "any" ? true : dir === "bull" ? h.long : !h.long
    );
    if (hit) return { ok: true, kind: hit.kind, barsAgo: ago, note: `${hit.note} (−${ago})` };
  }
  return { ok: false, kind: "", barsAgo: -1, note: "" };
}
