/**
 * Advanced Multi-Dip Scanner with Dynamic Bollinger Capture (Pine port).
 *
 * Fixes vs original Pine:
 * 1. tripleDipEnabled missing quote — N/A in TS
 * 2. No rightBars plot offset — signals fire on pivot CONFIRM bar (lbR lag)
 * 3. O(n) single pass; dip list capped (unshift/pop), no per-bar rebuild
 * 4. No request.security HTF — compute on scanned TF candles only
 * 5. Triple takes exclusive priority over double when both match
 * 6. Robust pivot lows via isPivotLow(lbL/lbR) (same as oscDivergence)
 */
import type { Candle } from "@/lib/types";
import { atr, bollinger, closes, rsi, sma } from "@/lib/indicators/math";
import { isPivotLow } from "@/lib/indicators/oscDivergence";

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
  momentumScore: (number | null)[];
};

/** Warmup: maxDip*3 + BB + ATR + lbR + buffer */
export const MULTI_DIP_MIN_BARS = 80;
export const MULTI_DIP_FETCH_LIMIT = 180;

/**
 * Pure series — double/triple dip near lower Bollinger capture zone.
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

  const n = candles.length;
  const midBB: (number | null)[] = new Array(n).fill(null);
  const lowerBB: (number | null)[] = new Array(n).fill(null);
  const captureZone: (number | null)[] = new Array(n).fill(null);
  const swingLow: (number | null)[] = new Array(n).fill(null);
  const doubleDip: (number | null)[] = new Array(n).fill(null);
  const tripleDip: (number | null)[] = new Array(n).fill(null);
  const anyDip: (number | null)[] = new Array(n).fill(null);
  const momentumScore: (number | null)[] = new Array(n).fill(null);

  if (n < MULTI_DIP_MIN_BARS) {
    return {
      midBB,
      lowerBB,
      captureZone,
      swingLow,
      doubleDip,
      tripleDip,
      anyDip,
      momentumScore,
    };
  }

  const c = closes(candles);
  const bb = bollinger(c, bbLength, bbMult);
  const atrVals = atr(candles, atrLen);
  const rsiVals = rsi(c, rsiPeriod);
  const vols = candles.map((x) => x.volume);
  const volMA = sma(vols, volumeMaLen);
  const lows: (number | null)[] = candles.map((x) => x.low);

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
    if (atrV == null || zone == null) continue;

    // Dip itself near BB; momentum scored on CONFIRM bar
    const nearBB = (lows[pi] as number) <= zone;
    if (!nearBB || score < 1) continue;

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

    // Exclusive: triple wins over double (no dual noise)
    if (isTriple) {
      tripleDip[i] = 1;
      anyDip[i] = 1;
    } else if (isDouble) {
      doubleDip[i] = 1;
      anyDip[i] = 1;
    }
  }

  return {
    midBB,
    lowerBB,
    captureZone,
    swingLow,
    doubleDip,
    tripleDip,
    anyDip,
    momentumScore,
  };
}
