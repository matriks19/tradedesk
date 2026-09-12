import type { Candle } from "@/lib/types";

/**
 * pikusov Support Resistance Diagonal (Pine v6 port, 1:1 geometry)
 * + user's ikili/üçlü dip-tepe trend-line touch scanner.
 *
 * Pivots are NOT symmetric local extrema. ta.lowestbars(low, x1) == -x2
 * with x2 = int(x1/2) (v4 truncating division). Confirmation lag is x2 bars;
 * the window min/max is taken, not a strict pivot.
 */

export type DiagSeg = {
  t0: number;
  p0: number;
  t1: number;
  p1: number;
  slope: number;
  descending: boolean;
  i0: number;
  i1: number;
};

export type DiagEvent = "bounce" | "break" | "twin" | "triple" | "any";

export type RawLine = { i0: number; p0: number; i1: number; p1: number };

function priceAt(t1: number, p1: number, t2: number, p2: number, t3: number): number {
  if (t2 === t1) return p2;
  return p1 + ((p2 - p1) * (t3 - t1)) / (t2 - t1);
}

/** TV ta.lowestbars — offset of the most recent lowest in the window. */
function lowestbars(values: number[], i: number, len: number): number {
  let best = 0;
  let bestVal = values[i]!;
  const start = Math.max(0, i - len + 1);
  for (let j = i - 1; j >= start; j--) {
    if (values[j]! < bestVal) {
      bestVal = values[j]!;
      best = j - i;
    }
  }
  return best;
}

function highestbars(values: number[], i: number, len: number): number {
  let best = 0;
  let bestVal = values[i]!;
  const start = Math.max(0, i - len + 1);
  for (let j = i - 1; j >= start; j--) {
    if (values[j]! > bestVal) {
      bestVal = values[j]!;
      best = j - i;
    }
  }
  return best;
}

function toSeg(candles: Candle[], last: number, ln: RawLine): DiagSeg {
  const p1 = priceAt(ln.i0, ln.p0, ln.i1, ln.p1, last);
  const slope = (ln.p1 - ln.p0) / Math.max(1, ln.i1 - ln.i0);
  return {
    t0: candles[ln.i0]!.time,
    p0: ln.p0,
    t1: candles[last]!.time,
    p1,
    slope,
    descending: ln.p1 < ln.p0,
    i0: ln.i0,
    i1: ln.i1,
  };
}

function pikusovLines(
  candles: Candle[],
  last: number,
  historyBars: number,
  x1: number
): { supports: RawLine[]; resistances: RawLine[] } {
  const n = last + 1;
  if (n < x1 + 2 || last < 1) return { supports: [], resistances: [] };

  const lows = new Array<number>(n);
  const highs = new Array<number>(n);
  const opens = new Array<number>(n);
  const closes = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const c = candles[i]!;
    lows[i] = c.low;
    highs[i] = c.high;
    opens[i] = c.open;
    closes[i] = c.close;
  }

  // v4 int/int truncation — do not use Math.round(x1/2)
  const x2 = Math.trunc(x1 / 2);
  const minimums = new Array<number>(n);
  const maximums = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    if (i + 1 < x1) {
      minimums[i] = i > 0 ? minimums[i - 1]! + 1 : 1;
      maximums[i] = i > 0 ? maximums[i - 1]! + 1 : 1;
      continue;
    }
    minimums[i] =
      lowestbars(lows, i, x1) === -x2 ? x2 : i > 0 ? minimums[i - 1]! + 1 : 1;
    maximums[i] =
      highestbars(highs, i, x1) === -x2 ? x2 : i > 0 ? maximums[i - 1]! + 1 : 1;
  }

  const hop = (series: number[], offset: number): number => {
    const idx = last - offset;
    if (idx < 0 || idx >= n) return 1;
    return Math.max(1, series[idx]!);
  };

  const supports: RawLine[] = [];
  let lastSup: RawLine | null = null;
  let minimum1 = 0;
  for (let k1 = 0; k1 <= 50; k1++) {
    if (minimum1 >= historyBars) break;
    minimum1 += hop(minimums, minimum1);
    let minimum2 = minimum1 * 2;
    for (let k2 = 0; k2 <= 50; k2++) {
      if (minimum2 >= minimum1 * 8 || minimum2 >= historyBars) break;
      minimum2 += hop(minimums, minimum2);
      if (minimum1 >= historyBars || minimum2 >= historyBars) break;
      const bar1 = last - minimum1;
      const bar2 = last - minimum2;
      if (bar1 < 0 || bar2 < 0) break;
      const price1 = lows[bar1]!;
      const price2 = lows[bar2]!;
      const current = priceAt(bar2, price2, bar1, price1, last);
      if (!(current < highs[last - 1]!)) continue;
      let crossed = false;
      let medium = 0;
      for (let k3 = 0; k3 <= 50; k3++) {
        if (medium >= minimum2) break;
        medium += hop(minimums, medium);
        if (medium >= minimum2) break;
        const mid = last - medium;
        if (mid < 0) break;
        const lp = priceAt(bar2, price2, bar1, price1, mid);
        if (lp > Math.min(opens[mid]!, closes[mid]!)) {
          crossed = true;
          break;
        }
      }
      if (crossed) continue;
      if (lastSup && lastSup.i1 === bar1) {
        const prev = priceAt(lastSup.i0, lastSup.p0, lastSup.i1, lastSup.p1, last);
        if (current > prev) {
          lastSup.i0 = bar2;
          lastSup.p0 = price2;
          lastSup.i1 = bar1;
          lastSup.p1 = price1;
        }
      } else {
        lastSup = { i0: bar2, p0: price2, i1: bar1, p1: price1 };
        supports.push(lastSup);
      }
    }
  }

  const resistances: RawLine[] = [];
  let lastRes: RawLine | null = null;
  let maximum1 = 0;
  for (let k1 = 0; k1 <= 100; k1++) {
    if (maximum1 >= historyBars) break;
    maximum1 += hop(maximums, maximum1);
    let maximum2 = maximum1 * 2;
    for (let k2 = 0; k2 <= 50; k2++) {
      if (maximum2 >= maximum1 * 8 || maximum2 >= historyBars) break;
      maximum2 += hop(maximums, maximum2);
      if (maximum1 >= historyBars || maximum2 >= historyBars) break;
      const bar1 = last - maximum1;
      const bar2 = last - maximum2;
      if (bar1 < 0 || bar2 < 0) break;
      const price1 = highs[bar1]!;
      const price2 = highs[bar2]!;
      const current = priceAt(bar2, price2, bar1, price1, last);
      if (!(current > lows[last - 1]!)) continue;
      let crossed = false;
      let medium = 0;
      for (let k3 = 0; k3 <= 100; k3++) {
        if (medium >= maximum2) break;
        medium += hop(maximums, medium);
        if (medium >= maximum2) break;
        const mid = last - medium;
        if (mid < 0) break;
        const lp = priceAt(bar2, price2, bar1, price1, mid);
        if (lp < Math.max(opens[mid]!, closes[mid]!)) {
          crossed = true;
          break;
        }
      }
      if (crossed) continue;
      if (lastRes && lastRes.i1 === bar1) {
        const prev = priceAt(lastRes.i0, lastRes.p0, lastRes.i1, lastRes.p1, last);
        if (current < prev) {
          lastRes.i0 = bar2;
          lastRes.p0 = price2;
          lastRes.i1 = bar1;
          lastRes.p1 = price1;
        }
      } else {
        lastRes = { i0: bar2, p0: price2, i1: bar1, p1: price1 };
        resistances.push(lastRes);
      }
    }
  }

  return { supports, resistances };
}

/** User scanner: last two descending highs / ascending lows + touch counts. */
function trendTouchScan(candles: Candle[], lb: number, rb: number) {
  const n = candles.length;
  const mb = lb + rb + 1;
  const dbLong: boolean[] = new Array(n).fill(false);
  const dtShort: boolean[] = new Array(n).fill(false);
  const tbLong: boolean[] = new Array(n).fill(false);
  const ttShort: boolean[] = new Array(n).fill(false);
  const bounceLong: boolean[] = new Array(n).fill(false);
  const bounceShort: boolean[] = new Array(n).fill(false);
  const breakLong: boolean[] = new Array(n).fill(false);
  const breakShort: boolean[] = new Array(n).fill(false);
  const descSup: boolean[] = new Array(n).fill(false);
  const descRes: boolean[] = new Array(n).fill(false);
  const support: (number | null)[] = new Array(n).fill(null);
  const resistance: (number | null)[] = new Array(n).fill(null);

  if (n < mb + 2) {
    return {
      dbLong,
      dtShort,
      tbLong,
      ttShort,
      bounceLong,
      bounceShort,
      breakLong,
      breakShort,
      descSup,
      descRes,
      support,
      resistance,
      upLine: null as RawLine | null,
      dnLine: null as RawLine | null,
    };
  }

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const topCond: boolean[] = new Array(n).fill(false);
  const botCond: boolean[] = new Array(n).fill(false);
  const topVal: (number | null)[] = new Array(n).fill(null);
  const botVal: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i + 1 < mb) continue;
    if (highestbars(highs, i, mb) === -rb) {
      topCond[i] = true;
      topVal[i] = highs[i - rb]!;
    }
    if (lowestbars(lows, i, mb) === -rb) {
      botCond[i] = true;
      botVal[i] = lows[i - rb]!;
    }
  }

  let bst = 0;
  let bsb = 0;
  let lastTop: number | null = null;
  let lastBot: number | null = null;
  let up: RawLine | null = null;
  let dn: RawLine | null = null;
  let upKey = "";
  let dnKey = "";
  let supTouches = 0;
  let resTouches = 0;
  let lastSupTouch = -1;
  let lastResTouch = -1;

  for (let i = 0; i < n; i++) {
    const prevBst = bst;
    const prevBsb = bsb;
    bst = topCond[i] ? 1 : bst + 1;
    bsb = botCond[i] ? 1 : bsb + 1;

    if (topCond[i] && topVal[i] != null) {
      const ltop = lastTop;
      const top = topVal[i]!;
      if (ltop != null && ltop > top) {
        const i0 = i - prevBst - rb;
        const i1 = i - rb;
        if (i0 >= 0 && i1 > i0) {
          const key = `${i0}:${i1}`;
          if (key !== dnKey) {
            resTouches = 0;
            lastResTouch = -1;
            dnKey = key;
          }
          dn = { i0, p0: highs[i0]!, i1, p1: highs[i1]! };
        }
      }
      lastTop = top;
    }

    if (botCond[i] && botVal[i] != null) {
      const lbot = lastBot;
      const bot = botVal[i]!;
      if (lbot != null && lbot < bot) {
        const i0 = i - prevBsb - rb;
        const i1 = i - rb;
        if (i0 >= 0 && i1 > i0) {
          const key = `${i0}:${i1}`;
          if (key !== upKey) {
            supTouches = 0;
            lastSupTouch = -1;
            upKey = key;
          }
          up = { i0, p0: lows[i0]!, i1, p1: lows[i1]! };
        }
      }
      lastBot = bot;
    }

    if (up) {
      const px = priceAt(up.i0, up.p0, up.i1, up.p1, i);
      support[i] = px;
      descSup[i] = up.p1 < up.p0;
      const c = candles[i]!;
      if (c.low <= px && c.high >= px && i !== lastSupTouch) {
        supTouches += 1;
        lastSupTouch = i;
        bounceLong[i] = true;
        // Pine reset at 2 killed triple — fire 2 then 3 without reset-at-2
        if (supTouches === 2) dbLong[i] = true;
        if (supTouches >= 3) {
          tbLong[i] = true;
          supTouches = 0;
        }
      }
      if (i >= 1) {
        const px1 = priceAt(up.i0, up.p0, up.i1, up.p1, i - 1);
        if (candles[i - 1]!.low > px1 && c.close < px) breakShort[i] = true;
      }
    }

    if (dn) {
      const px = priceAt(dn.i0, dn.p0, dn.i1, dn.p1, i);
      resistance[i] = px;
      descRes[i] = dn.p1 < dn.p0;
      const c = candles[i]!;
      if (c.low <= px && c.high >= px && i !== lastResTouch) {
        resTouches += 1;
        lastResTouch = i;
        bounceShort[i] = true;
        if (resTouches === 2) dtShort[i] = true;
        if (resTouches >= 3) {
          ttShort[i] = true;
          resTouches = 0;
        }
      }
      if (i >= 1) {
        const px1 = priceAt(dn.i0, dn.p0, dn.i1, dn.p1, i - 1);
        if (candles[i - 1]!.high < px1 && c.close > px) breakLong[i] = true;
      }
    }
  }

  return {
    dbLong,
    dtShort,
    tbLong,
    ttShort,
    bounceLong,
    bounceShort,
    breakLong,
    breakShort,
    descSup,
    descRes,
    support,
    resistance,
    upLine: up,
    dnLine: dn,
  };
}

export function diagonalSr(
  candles: Candle[],
  opts: {
    historyBars?: number;
    pivotWindow?: number;
    left?: number;
    right?: number;
    twinTol?: number;
    minGap?: number;
    maxGap?: number;
  } = {}
) {
  const n = candles.length;
  const historyBars = opts.historyBars ?? 300;
  const x1 = opts.pivotWindow ?? 6;
  const lb = opts.left ?? 30;
  const rb = opts.right ?? 30;

  const touch = trendTouchScan(candles, lb, rb);
  const last = n - 1;
  const pik =
    last >= 0
      ? pikusovLines(candles, last, Math.min(historyBars, last), x1)
      : { supports: [] as RawLine[], resistances: [] as RawLine[] };

  // Pikusov cross on the last bar (and last-1 lines) — scan freshness
  if (last >= 2) {
    const prev = pikusovLines(candles, last - 1, Math.min(historyBars, last - 1), x1);
    const c = candles[last]!;
    const p = candles[last - 1]!;
    for (const ln of prev.supports) {
      const px0 = priceAt(ln.i0, ln.p0, ln.i1, ln.p1, last - 1);
      const px1 = priceAt(ln.i0, ln.p0, ln.i1, ln.p1, last);
      if (p.low > px0 && c.close < px1) touch.breakShort[last] = true;
    }
    for (const ln of prev.resistances) {
      const px0 = priceAt(ln.i0, ln.p0, ln.i1, ln.p1, last - 1);
      const px1 = priceAt(ln.i0, ln.p0, ln.i1, ln.p1, last);
      if (p.high < px0 && c.close > px1) touch.breakLong[last] = true;
    }
  }

  const support: (number | null)[] = new Array(n).fill(null);
  const resistance: (number | null)[] = new Array(n).fill(null);
  const descSup = touch.descSup.slice();
  const descRes = touch.descRes.slice();
  const flatSup: (number | null)[] = new Array(n).fill(null);
  const flatRes: (number | null)[] = new Array(n).fill(null);

  let nearestSup: RawLine | null = null;
  let nearestRes: RawLine | null = null;
  let bestSup = -Infinity;
  let bestRes = Infinity;
  if (last >= 0) {
    for (const ln of pik.supports) {
      const px = priceAt(ln.i0, ln.p0, ln.i1, ln.p1, last);
      if (px > bestSup) {
        bestSup = px;
        nearestSup = ln;
      }
    }
    for (const ln of pik.resistances) {
      const px = priceAt(ln.i0, ln.p0, ln.i1, ln.p1, last);
      if (px < bestRes) {
        bestRes = px;
        nearestRes = ln;
      }
    }
    if (nearestSup) {
      for (let i = nearestSup.i0; i <= last; i++) {
        support[i] = priceAt(nearestSup.i0, nearestSup.p0, nearestSup.i1, nearestSup.p1, i);
        descSup[i] = nearestSup.p1 < nearestSup.p0;
      }
    }
    if (nearestRes) {
      for (let i = nearestRes.i0; i <= last; i++) {
        resistance[i] = priceAt(nearestRes.i0, nearestRes.p0, nearestRes.i1, nearestRes.p1, i);
        descRes[i] = nearestRes.p1 < nearestRes.p0;
      }
    }
  }

  // Drawings / plots: pikusov fan only. Touch lines stay in the scanner.
  const linesSup = pik.supports.slice(0, 12).map((ln) => toSeg(candles, last, ln));
  const linesRes = pik.resistances.slice(0, 12).map((ln) => toSeg(candles, last, ln));

  return {
    support,
    resistance,
    flatSup,
    flatRes,
    descSup,
    descRes,
    dbLong: touch.dbLong,
    dtShort: touch.dtShort,
    tbLong: touch.tbLong,
    ttShort: touch.ttShort,
    bounceLong: touch.bounceLong,
    bounceShort: touch.bounceShort,
    breakLong: touch.breakLong,
    breakShort: touch.breakShort,
    lastSup: nearestSup && last >= 0 ? toSeg(candles, last, nearestSup) : null,
    lastRes: nearestRes && last >= 0 ? toSeg(candles, last, nearestRes) : null,
    linesSup,
    linesRes,
  };
}

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
      hits.push({ kind: "bounceL", note: "diag destek temas", long: true });
    if ((event === "bounce" || event === "any") && d.bounceShort[i] && descOkShort)
      hits.push({ kind: "bounceS", note: "diag direnç temas", long: false });
    if ((event === "break" || event === "any") && d.breakLong[i] && descOkShort)
      hits.push({ kind: "breakL", note: "diag direnç kırılım", long: true });
    if ((event === "break" || event === "any") && d.breakShort[i] && descOkLong)
      hits.push({ kind: "breakS", note: "diag destek kırılım", long: false });
    if ((event === "twin" || event === "any") && d.dbLong[i])
      hits.push({ kind: "db", note: "ikili dip (2. temas)", long: true });
    if ((event === "twin" || event === "any") && d.dtShort[i])
      hits.push({ kind: "dt", note: "ikili tepe (2. temas)", long: false });
    if ((event === "triple" || event === "any") && d.tbLong[i])
      hits.push({ kind: "tb", note: "üçlü dip (3. temas)", long: true });
    if ((event === "triple" || event === "any") && d.ttShort[i])
      hits.push({ kind: "tt", note: "üçlü tepe (3. temas)", long: false });
    const hit = hits.find((h) =>
      dir === "any" ? true : dir === "bull" ? h.long : !h.long
    );
    if (hit) return { ok: true, kind: hit.kind, barsAgo: ago, note: `${hit.note} (−${ago})` };
  }
  return { ok: false, kind: "", barsAgo: -1, note: "" };
}
