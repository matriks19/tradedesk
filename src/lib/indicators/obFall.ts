/**
 * Order Block + Düşen Kırılımı — light list-scan helper.
 *
 * Reuses:
 * - orderBlocks (beluga) for bullTop/bullBot / bear zones
 * - computeDescendingBreak — close crosses above descending resistance
 *   from last 2 confirmed pivot highs (NOT TV preset EMA5>20>50 stack)
 *
 * Chips:
 * - ob_bull: price taps/enters active bullish OB
 * - fall_break: descending resistance breakout
 * - ob_fall: both within combo proximity (same/nearby bars)
 * - ob_bear (optional): tap bearish OB
 */
import type { Candle } from "@/lib/types";
import { orderBlocks } from "@/lib/indicators/beluga";
import { computeDescendingBreak } from "@/lib/indicators/descendingBreak";

export type ObFallOpts = {
  swing?: number;
  impulseMult?: number;
  /** Pivot lookback for descendingBreak (default 20) */
  pivotLookback?: number;
  /** Bars of proximity for combo OB + fall break (default 5) */
  comboBars?: number;
};

export type ObFallResult = {
  bullTop: (number | null)[];
  bullBot: (number | null)[];
  bearTop: (number | null)[];
  bearBot: (number | null)[];
  trend: (number | null)[];
  /** 1 when candle range overlaps active bull OB */
  obBull: (number | null)[];
  /** 1 when candle range overlaps active bear OB */
  obBear: (number | null)[];
  /** 1 on descending-resistance breakout bar */
  fallBreak: (number | null)[];
  /** 1 when fall break and bull OB tap within comboBars of each other */
  obFall: (number | null)[];
};

export const OB_FALL_MIN_BARS = 80;
export const OB_FALL_FETCH_LIMIT = 220;

function overlaps(
  low: number,
  high: number,
  top: number | null,
  bot: number | null
): boolean {
  if (top == null || bot == null) return false;
  const hi = Math.max(top, bot);
  const lo = Math.min(top, bot);
  return low <= hi && high >= lo;
}

/**
 * Pure series for Liste OB + düşen kırılım scan.
 */
export function obFall(candles: Candle[], opts: ObFallOpts = {}): ObFallResult {
  const swing = opts.swing ?? 3;
  const impulseMult = opts.impulseMult ?? 1.2;
  const pivotLookback = opts.pivotLookback ?? 20;
  const comboBars = opts.comboBars ?? 5;

  const n = candles.length;
  const empty = (): (number | null)[] => new Array(n).fill(null);

  const ob = orderBlocks(candles, swing, impulseMult);
  const db = computeDescendingBreak(candles, {
    lookback: pivotLookback,
    srBoxes: false,
  });

  const obBull = empty();
  const obBear = empty();
  const fallBreak = empty();
  const obFallSeries = empty();

  const bullTapBars: number[] = [];
  const breakBars: number[] = [];

  for (let i = 0; i < n; i++) {
    const c = candles[i]!;
    if (overlaps(c.low, c.high, ob.bullTop[i], ob.bullBot[i])) {
      obBull[i] = 1;
      bullTapBars.push(i);
    }
    if (overlaps(c.low, c.high, ob.bearTop[i], ob.bearBot[i])) {
      obBear[i] = 1;
    }
    if (db.breakOut[i] === 1) {
      fallBreak[i] = 1;
      breakBars.push(i);
    }
  }

  // Combo: mark both the break bar and the OB tap bar when within proximity
  for (const bi of breakBars) {
    for (const ti of bullTapBars) {
      if (Math.abs(bi - ti) <= comboBars) {
        obFallSeries[bi] = 1;
        obFallSeries[ti] = 1;
      }
    }
  }

  return {
    bullTop: ob.bullTop,
    bullBot: ob.bullBot,
    bearTop: ob.bearTop,
    bearBot: ob.bearBot,
    trend: db.trend,
    obBull,
    obBear,
    fallBreak,
    obFall: obFallSeries,
  };
}
