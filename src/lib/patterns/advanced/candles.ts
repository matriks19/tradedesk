import type { Candle } from "@/lib/types";
import type { AdvancedPatternHit } from "./types";
import { drawTargets, uid } from "./draw";

function body(c: Candle) {
  return Math.abs(c.close - c.open);
}
function range(c: Candle) {
  return Math.max(1e-9, c.high - c.low);
}
function upperWick(c: Candle) {
  return c.high - Math.max(c.open, c.close);
}
function lowerWick(c: Candle) {
  return Math.min(c.open, c.close) - c.low;
}
function isBull(c: Candle) {
  return c.close > c.open;
}
function isBear(c: Candle) {
  return c.close < c.open;
}
function isDoji(c: Candle) {
  return body(c) / range(c) <= 0.1;
}

function hit(
  name: string,
  label: string,
  direction: "bull" | "bear" | "neutral",
  c: Candle,
  conf: number,
  detail: string,
  extras?: Partial<AdvancedPatternHit>
): AdvancedPatternHit {
  const bull = direction === "bull";
  const color = bull ? "#26a69a" : direction === "bear" ? "#ef5350" : "#8b95a8";
  const pad = range(c) || c.close * 0.01;
  const tp1 = bull ? c.close + pad * 1.5 : c.close - pad * 1.5;
  const tp2 = bull ? c.close + pad * 2.5 : c.close - pad * 2.5;
  const tp3 = bull ? c.close + pad * 4 : c.close - pad * 4;
  const sl = bull ? c.low - pad * 0.2 : c.high + pad * 0.2;
  return {
    id: uid(name),
    family: "candle",
    name,
    label,
    direction,
    confidence: conf,
    entry: c.close,
    tp1,
    tp2,
    tp3,
    sl,
    detail,
    tStart: c.time,
    tEnd: c.time,
    drawings: [
      {
        id: uid("m"),
        kind: "marker",
        t1: c.time,
        price1: bull ? c.low : c.high,
        label,
        color,
        position: bull ? "belowBar" : "aboveBar",
        shape: bull ? "arrowUp" : direction === "bear" ? "arrowDown" : "circle",
      },
      ...drawTargets({
        t1: c.time,
        t2: c.time + 86400,
        tp1,
        tp2,
        tp3,
        sl,
        bull: direction !== "bear",
      }),
    ],
    ...extras,
  };
}

/** Scan last N bars for multi-candle formations */
export function detectCandleFormations(
  candles: Candle[],
  lookback = 8
): AdvancedPatternHit[] {
  if (candles.length < 5) return [];
  const hits: AdvancedPatternHit[] = [];
  const start = Math.max(2, candles.length - lookback);
  for (let i = start; i < candles.length; i++) {
    const c = candles[i];
    const p = candles[i - 1];
    const pp = candles[i - 2];

    if (isDoji(c)) {
      hits.push(hit("doji", "Doji", "neutral", c, 0.55, "Doji — kararsızlık"));
    }
    // Hammer / shooting star
    if (
      lowerWick(c) >= body(c) * 2 &&
      upperWick(c) <= body(c) * 0.5 &&
      body(c) / range(c) < 0.4
    ) {
      hits.push(hit("hammer", "Çekiç", "bull", c, 0.65, "Hammer / çekiç"));
    }
    if (
      upperWick(c) >= body(c) * 2 &&
      lowerWick(c) <= body(c) * 0.5 &&
      body(c) / range(c) < 0.4
    ) {
      hits.push(
        hit("shooting_star", "Kayan yıldız", "bear", c, 0.65, "Shooting star")
      );
    }
    // Engulfing
    if (
      isBear(p) &&
      isBull(c) &&
      c.open <= p.close &&
      c.close >= p.open &&
      body(c) > body(p)
    ) {
      hits.push(
        hit("engulfing", "Yutan (bull)", "bull", c, 0.72, "Bullish engulfing")
      );
    }
    if (
      isBull(p) &&
      isBear(c) &&
      c.open >= p.close &&
      c.close <= p.open &&
      body(c) > body(p)
    ) {
      hits.push(
        hit("engulfing", "Yutan (bear)", "bear", c, 0.72, "Bearish engulfing")
      );
    }
    // Harami
    if (
      isBear(p) &&
      isBull(c) &&
      c.open >= p.close &&
      c.close <= p.open &&
      body(c) < body(p) * 0.7
    ) {
      hits.push(hit("harami", "Harami bull", "bull", c, 0.58, "Bullish harami"));
    }
    if (
      isBull(p) &&
      isBear(c) &&
      c.open <= p.close &&
      c.close >= p.open &&
      body(c) < body(p) * 0.7
    ) {
      hits.push(hit("harami", "Harami bear", "bear", c, 0.58, "Bearish harami"));
    }
    // Piercing / dark cloud
    if (
      isBear(p) &&
      isBull(c) &&
      c.open < p.low &&
      c.close > (p.open + p.close) / 2 &&
      c.close < p.open
    ) {
      hits.push(hit("piercing", "Piercing", "bull", c, 0.66, "Piercing line"));
    }
    if (
      isBull(p) &&
      isBear(c) &&
      c.open > p.high &&
      c.close < (p.open + p.close) / 2 &&
      c.close > p.open
    ) {
      hits.push(
        hit("dark_cloud", "Dark cloud", "bear", c, 0.66, "Dark cloud cover")
      );
    }
    // Morning / evening star
    if (
      isBear(pp) &&
      body(p) / range(p) < 0.35 &&
      isBull(c) &&
      c.close > (pp.open + pp.close) / 2
    ) {
      hits.push(
        hit("morning_star", "Morning star", "bull", c, 0.7, "Morning star")
      );
    }
    if (
      isBull(pp) &&
      body(p) / range(p) < 0.35 &&
      isBear(c) &&
      c.close < (pp.open + pp.close) / 2
    ) {
      hits.push(
        hit("evening_star", "Evening star", "bear", c, 0.7, "Evening star")
      );
    }
    // Three soldiers / crows
    if (i >= 2) {
      const a = candles[i - 2];
      const b = candles[i - 1];
      if (isBull(a) && isBull(b) && isBull(c) && c.close > b.close && b.close > a.close) {
        hits.push(
          hit("three_soldiers", "3 Asker", "bull", c, 0.68, "Three white soldiers")
        );
      }
      if (isBear(a) && isBear(b) && isBear(c) && c.close < b.close && b.close < a.close) {
        hits.push(
          hit("three_crows", "3 Karga", "bear", c, 0.68, "Three black crows")
        );
      }
    }
    // Tweezer
    if (nearHigh(p, c) && isBull(p) && isBear(c)) {
      hits.push(
        hit("tweezer_top", "Tweezer tepe", "bear", c, 0.6, "Tweezer top")
      );
    }
    if (nearLow(p, c) && isBear(p) && isBull(c)) {
      hits.push(
        hit("tweezer_bottom", "Tweezer dip", "bull", c, 0.6, "Tweezer bottom")
      );
    }
  }
  // Keep last occurrences per name
  hits.sort((a, b) => b.tEnd - a.tEnd);
  const seen = new Set<string>();
  const out: AdvancedPatternHit[] = [];
  for (const h of hits) {
    const k = `${h.name}_${h.direction}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h);
  }
  return out.slice(0, 12);
}

function nearHigh(a: Candle, b: Candle) {
  const mid = (a.high + b.high) / 2 || 1;
  return Math.abs(a.high - b.high) / mid <= 0.0025;
}
function nearLow(a: Candle, b: Candle) {
  const mid = (a.low + b.low) / 2 || 1;
  return Math.abs(a.low - b.low) / mid <= 0.0025;
}
