/**
 * Advanced Multi-Dip Scanner with Dynamic Bollinger Capture (Pine port)
 * + S/R proximity (diagonal pikusov / touch + horizontal pivot lows).
 *
 * Fixes vs original Pine:
 * 1. tripleDipEnabled missing quote — N/A in TS
 * 2. No rightBars plot offset — signals fire on pivot CONFIRM bar (lbR lag)
 * 3. O(n) single pass; dip list capped (unshift/pop), no per-bar rebuild
 * 4. No request.security HTF — compute on scanned TF candles only
 * 5. Triple takes exclusive priority over double when both match
 * 6. Robust pivot lows via isPivotLow(lbL/lbR) (same as oscDivergence)
 *
 * S/R chips (scan + chart):
 * - dip_sr: structural ikili/üçlü near diagonal OR horizontal support
 * - dip_bb_sr: BB-capture multi-dip + near S/R (combo)
 * Existing BB chips unchanged (double_dip_bb / triple_dip_bb / any_dip_bb).
 */
import type { Candle } from "@/lib/types";
import { atr, bollinger, closes, rsi, sma } from "@/lib/indicators/math";
import { isPivotLow } from "@/lib/indicators/oscDivergence";
import {
  diagonalSr,
  type DiagSeg,
} from "@/lib/indicators/diagonalSr";

export type MultiDipBbOpts = {
  /** Pivot left bars (Pine leftBars / lbL). Default 3. */
  lbL?: number;
  /** Pivot right bars (Pine rightBars / lbR) — confirm lag. Default 3. */
  lbR?: number;
  bbLength?: number;
  bbMult?: number;
  /** Percent above lower BB for capture zone (Pine bbProximity default 0.5) */
  bbProximity?: number;
  dipSensitivity?: number;
  minDipDistance?: number;
  maxDipDistance?: number;
  rsiPeriod?: number;
  rsiOversold?: number;
  volumeMaLen?: number;
  atrLen?: number;
  volumeFilter?: boolean;
  rsiFilter?: boolean;
  /** ATR multiple for dip↔support proximity (default 0.75). */
  srTolAtr?: number;
  /** Also accept % distance if ATR is tiny (default 0.35%). */
  srTolPct?: number;
  /** How many recent pivot-low flat levels to keep (default 8). */
  flatLevelCount?: number;
  /** Diagonal history for pikusov lines (default 300, capped by n). */
  srHistoryBars?: number;
  srPivotWindow?: number;
};

export type MultiDipFlatLevel = {
  price: number;
  i0: number;
  t0: number;
};

export type MultiDipBbResult = {
  midBB: (number | null)[];
  lowerBB: (number | null)[];
  captureZone: (number | null)[];
  /** 1 on pivot CONFIRM bar (not offset to past) */
  swingLow: (number | null)[];
  /** 1 on confirm bar when double-dip + BB + momentum (and not triple) */
  doubleDip: (number | null)[];
  /** 1 on confirm bar when triple-dip + BB + momentum (wins over double) */
  tripleDip: (number | null)[];
  /** 1 when either signal (triple preferred in labeling) */
  anyDip: (number | null)[];
  /** Structural ikili/üçlü near diagonal or horizontal support (BB not required) */
  dipSr: (number | null)[];
  /** BB multi-dip + near S/R */
  dipBbSr: (number | null)[];
  momentumScore: (number | null)[];
  /** Active diagonal supports (pikusov + nearest) for chart */
  linesSup: DiagSeg[];
  /** Active diagonal resistances for chart */
  linesRes: DiagSeg[];
  /** Horizontal pivot-low levels used for proximity (chart as flat segments) */
  flatSupports: MultiDipFlatLevel[];
};

/** Warmup: maxDip*3 + BB + ATR + lbR + buffer + S/R */
export const MULTI_DIP_MIN_BARS = 80;
export const MULTI_DIP_FETCH_LIMIT = 180;

function segPriceAt(seg: DiagSeg, i: number, last: number): number {
  if (last === seg.i0) return seg.p0;
  return seg.p0 + ((seg.p1 - seg.p0) * (i - seg.i0)) / (last - seg.i0);
}

function nearLevel(
  price: number,
  level: number,
  atrV: number,
  tolAtr: number,
  tolPct: number
): boolean {
  const abs = Math.abs(price - level);
  if (atrV > 0 && abs <= atrV * tolAtr) return true;
  if (level > 0 && abs / level <= tolPct / 100) return true;
  return false;
}

/**
 * Pure series — double/triple dip near lower Bollinger capture zone,
 * plus optional S/R proximity filters and line segments for plotting.
 * Signals only on confirmed swing-low bars (edge), not sticky zones.
 */
export function multiDipBb(
  candles: Candle[],
  opts: MultiDipBbOpts = {}
): MultiDipBbResult {
  const lbL = opts.lbL ?? 3;
  const lbR = opts.lbR ?? 3;
  const bbLength = opts.bbLength ?? 20;
  const bbMult = opts.bbMult ?? 2;
  const bbProximity = opts.bbProximity ?? 0.5;
  const dipSensitivity = opts.dipSensitivity ?? 1.5;
  const minDipDistance = opts.minDipDistance ?? 5;
  const maxDipDistance = opts.maxDipDistance ?? 30;
  const rsiPeriod = opts.rsiPeriod ?? 14;
  const rsiOversold = opts.rsiOversold ?? 40;
  const volumeMaLen = opts.volumeMaLen ?? 20;
  const atrLen = opts.atrLen ?? 14;
  const volumeFilter = opts.volumeFilter !== false;
  const rsiFilter = opts.rsiFilter !== false;
  const srTolAtr = opts.srTolAtr ?? 0.75;
  const srTolPct = opts.srTolPct ?? 0.35;
  const flatLevelCount = opts.flatLevelCount ?? 8;

  const n = candles.length;
  const midBB: (number | null)[] = new Array(n).fill(null);
  const lowerBB: (number | null)[] = new Array(n).fill(null);
  const captureZone: (number | null)[] = new Array(n).fill(null);
  const swingLow: (number | null)[] = new Array(n).fill(null);
  const doubleDip: (number | null)[] = new Array(n).fill(null);
  const tripleDip: (number | null)[] = new Array(n).fill(null);
  const anyDip: (number | null)[] = new Array(n).fill(null);
  const dipSr: (number | null)[] = new Array(n).fill(null);
  const dipBbSr: (number | null)[] = new Array(n).fill(null);
  const momentumScore: (number | null)[] = new Array(n).fill(null);

  const empty = (): MultiDipBbResult => ({
    midBB,
    lowerBB,
    captureZone,
    swingLow,
    doubleDip,
    tripleDip,
    anyDip,
    dipSr,
    dipBbSr,
    momentumScore,
    linesSup: [],
    linesRes: [],
    flatSupports: [],
  });

  if (n < MULTI_DIP_MIN_BARS) return empty();

  const c = closes(candles);
  const bb = bollinger(c, bbLength, bbMult);
  const atrVals = atr(candles, atrLen);
  const rsiVals = rsi(c, rsiPeriod);
  const vols = candles.map((x) => x.volume);
  const volMA = sma(vols, volumeMaLen);
  const lows: (number | null)[] = candles.map((x) => x.low);
  const last = n - 1;

  // Diagonal S/R once — used for proximity + chart segments
  const diag = diagonalSr(candles, {
    historyBars: opts.srHistoryBars ?? 300,
    pivotWindow: opts.srPivotWindow ?? 6,
  });
  const linesSup = diag.linesSup.slice(0, 8);
  const linesRes = diag.linesRes.slice(0, 6);

  // Horizontal supports from recent confirmed pivot lows (dedupe by ATR cluster)
  const flatRaw: MultiDipFlatLevel[] = [];
  for (let pi = lbL; pi <= last - lbR; pi++) {
    if (!isPivotLow(lows, pi, lbL, lbR)) continue;
    flatRaw.push({
      price: lows[pi] as number,
      i0: pi,
      t0: candles[pi]!.time,
    });
  }
  const flatSupports: MultiDipFlatLevel[] = [];
  for (let k = flatRaw.length - 1; k >= 0 && flatSupports.length < flatLevelCount; k--) {
    const cand = flatRaw[k]!;
    const atrAt = atrVals[Math.min(cand.i0 + lbR, last)] ?? atrVals[last] ?? 0;
    const dup = flatSupports.some((f) =>
      nearLevel(cand.price, f.price, atrAt || cand.price * 0.01, srTolAtr, srTolPct)
    );
    if (!dup) flatSupports.push(cand);
  }

  const nearSupportAt = (price: number, barIdx: number, atrV: number): boolean => {
    // Nearest pikusov / touch support series
    const sup = diag.support[barIdx];
    if (sup != null && nearLevel(price, sup, atrV, srTolAtr, srTolPct)) return true;
    for (const seg of linesSup) {
      if (barIdx < seg.i0) continue;
      const px = segPriceAt(seg, barIdx, last);
      if (nearLevel(price, px, atrV, srTolAtr, srTolPct)) return true;
    }
    for (const flat of flatSupports) {
      if (barIdx < flat.i0) continue;
      if (nearLevel(price, flat.price, atrV, srTolAtr, srTolPct)) return true;
    }
    return false;
  };

  // Newest first — capped; no rebuild per bar
  const dipPrices: number[] = [];
  const dipBars: number[] = [];

  for (let i = 0; i < n; i++) {
    midBB[i] = bb.mid[i];
    lowerBB[i] = bb.lower[i];
    const loBand = bb.lower[i];
    captureZone[i] =
      loBand != null ? loBand * (1 + bbProximity / 100) : null;

    let score = 0;
    const rsiV = rsiVals[i];
    const vma = volMA[i];
    if (rsiFilter && rsiV != null && rsiV < rsiOversold) score += 1;
    if (volumeFilter && vma != null && vols[i]! > vma * 1.2) score += 1;
    if (candles[i]!.close > candles[i]!.open) score += 1;
    momentumScore[i] = score;

    const pi = i - lbR;
    if (pi < lbL) continue;
    if (!isPivotLow(lows, pi, lbL, lbR)) continue;

    // Confirm bar = i; pivot bar = pi (no misleading plot offset)
    swingLow[i] = 1;
    dipPrices.unshift(lows[pi] as number);
    dipBars.unshift(pi);
    if (dipPrices.length > 10) {
      dipPrices.pop();
      dipBars.pop();
    }

    const atrV = atrVals[i];
    // Zone at pivot (dip) — not confirm bar, which may have already bounced
    const zone = captureZone[pi] ?? captureZone[i];
    if (atrV == null) continue;

    const dipPx = lows[pi] as number;
    const nearBB = zone != null && dipPx <= zone;
    const nearSr = nearSupportAt(dipPx, pi, atrV);

    let isDouble = false;
    let isTriple = false;

    if (dipPrices.length >= 2) {
      const d1 = dipPrices[0]!;
      const d2 = dipPrices[1]!;
      const barsBetween = dipBars[0]! - dipBars[1]!;
      if (
        barsBetween >= minDipDistance &&
        barsBetween <= maxDipDistance
      ) {
        if (Math.abs(d1 - d2) < dipSensitivity * atrV) {
          if (d1 <= d2 * 1.02) isDouble = true;
        }
      }
    }

    if (dipPrices.length >= 3) {
      const d1 = dipPrices[0]!;
      const d2 = dipPrices[1]!;
      const d3 = dipPrices[2]!;
      const bars12 = dipBars[0]! - dipBars[1]!;
      const bars23 = dipBars[1]! - dipBars[2]!;
      if (
        bars12 >= minDipDistance &&
        bars12 <= maxDipDistance &&
        bars23 >= minDipDistance &&
        bars23 <= maxDipDistance
      ) {
        const avgDip = (d1 + d2 + d3) / 3;
        const maxDev = Math.max(d1, d2, d3) - Math.min(d1, d2, d3);
        if (maxDev < dipSensitivity * atrV * 1.5) {
          if (d1 <= avgDip * 1.01) isTriple = true;
        }
      }
    }

    const structural = isTriple || isDouble;
    if (!structural) continue;

    // Exclusive: triple wins over double for BB chips (no dual noise)
    if (nearBB && score >= 1) {
      if (isTriple) {
        tripleDip[i] = 1;
        anyDip[i] = 1;
      } else if (isDouble) {
        doubleDip[i] = 1;
        anyDip[i] = 1;
      }
      if (nearSr) dipBbSr[i] = 1;
    }

    // dip_sr: structure near S/R (BB optional)
    if (nearSr) dipSr[i] = 1;
  }

  return {
    midBB,
    lowerBB,
    captureZone,
    swingLow,
    doubleDip,
    tripleDip,
    anyDip,
    dipSr,
    dipBbSr,
    momentumScore,
    linesSup,
    linesRes,
    flatSupports,
  };
}
