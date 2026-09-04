import type { Candle } from "@/lib/types";
import { findSwings } from "@/lib/patterns/swings";
import type { AdvancedPatternHit } from "./types";
import { drawTargets, nearRatio, uid } from "./draw";

export function detectLiquidity(candles: Candle[], swingStrength = 2): AdvancedPatternHit[] {
  if (candles.length < 40) return [];
  const hits: AdvancedPatternHit[] = [];
  const swings = findSwings(candles, swingStrength);
  const highs = swings.filter((s) => s.kind === "high");
  const lows = swings.filter((s) => s.kind === "low");
  const last = candles[candles.length - 1];
  const look = candles.slice(-8);

  // Liquidity grab / stop hunt: wick beyond recent swing then close back inside
  const recentHigh = Math.max(...candles.slice(-30, -1).map((c) => c.high));
  const recentLow = Math.min(...candles.slice(-30, -1).map((c) => c.low));
  for (const c of look) {
    const rng = c.high - c.low || 1;
    if (c.high > recentHigh * 1.0005 && c.close < recentHigh && (c.high - Math.max(c.open, c.close)) / rng > 0.45) {
      const tp1 = c.close - rng * 0.5;
      const tp2 = c.close - rng;
      const tp3 = recentLow;
      const sl = c.high;
      hits.push({
        id: uid("lg_h"),
        family: "liquidity",
        name: "liquidity_grab",
        label: "Likidite grab (üst)",
        direction: "bear",
        confidence: 0.7,
        entry: c.close,
        tp1, tp2, tp3, sl,
        detail: "Üst swing ötesi fitil + içerde kapanış (stop hunt)",
        tStart: c.time,
        tEnd: c.time,
        drawings: [
          { id: uid("b"), kind: "box", t1: c.time - 1, t2: c.time + 1, price1: recentHigh, price2: c.high, color: "#ef5350", label: "LQ↑" },
          ...drawTargets({ t1: c.time, t2: c.time + 86400, tp1, tp2, tp3, sl, bull: false }),
        ],
      });
    }
    if (c.low < recentLow * 0.9995 && c.close > recentLow && (Math.min(c.open, c.close) - c.low) / rng > 0.45) {
      const tp1 = c.close + rng * 0.5;
      const tp2 = c.close + rng;
      const tp3 = recentHigh;
      const sl = c.low;
      hits.push({
        id: uid("lg_l"),
        family: "liquidity",
        name: "stop_hunt",
        label: "Stop hunt (alt)",
        direction: "bull",
        confidence: 0.7,
        entry: c.close,
        tp1, tp2, tp3, sl,
        detail: "Alt swing ötesi fitil + içerde kapanış",
        tStart: c.time,
        tEnd: c.time,
        drawings: [
          { id: uid("b"), kind: "box", t1: c.time - 1, t2: c.time + 1, price1: c.low, price2: recentLow, color: "#26a69a", label: "LQ↓" },
          ...drawTargets({ t1: c.time, t2: c.time + 86400, tp1, tp2, tp3, sl, bull: true }),
        ],
      });
    }
  }

  // Equal highs / lows liquidity pools
  for (let i = highs.length - 1; i >= 1 && i >= highs.length - 8; i--) {
    for (let j = i - 1; j >= 0 && j >= i - 6; j--) {
      if (!nearRatio(highs[i].price, highs[j].price, 0.004)) continue;
      const price = (highs[i].price + highs[j].price) / 2;
      hits.push({
        id: uid("eqh"),
        family: "liquidity",
        name: "equal_highs",
        label: "Eşit tepeler",
        direction: "bear",
        confidence: 0.58,
        entry: last.close,
        tp1: price * 0.99,
        tp2: price * 0.98,
        sl: price * 1.008,
        detail: `Equal highs @ ${price.toFixed(4)}`,
        tStart: highs[j].time,
        tEnd: highs[i].time,
        drawings: [
          { id: uid("h"), kind: "hline", t1: highs[j].time, t2: highs[i].time + 86400, price1: price, price2: price, color: "#ffa726", label: "EQH", dashed: true },
        ],
      });
      break;
    }
  }
  for (let i = lows.length - 1; i >= 1 && i >= lows.length - 8; i--) {
    for (let j = i - 1; j >= 0 && j >= i - 6; j--) {
      if (!nearRatio(lows[i].price, lows[j].price, 0.004)) continue;
      const price = (lows[i].price + lows[j].price) / 2;
      hits.push({
        id: uid("eql"),
        family: "liquidity",
        name: "equal_lows",
        label: "Eşit dipler",
        direction: "bull",
        confidence: 0.58,
        entry: last.close,
        tp1: price * 1.01,
        tp2: price * 1.02,
        sl: price * 0.992,
        detail: `Equal lows @ ${price.toFixed(4)}`,
        tStart: lows[j].time,
        tEnd: lows[i].time,
        drawings: [
          { id: uid("h"), kind: "hline", t1: lows[j].time, t2: lows[i].time + 86400, price1: price, price2: price, color: "#29b6f6", label: "EQL", dashed: true },
        ],
      });
      break;
    }
  }

  // BOS / CHOCH sketch from last swings
  if (highs.length >= 2 && lows.length >= 2) {
    const h1 = highs[highs.length - 2];
    const h2 = highs[highs.length - 1];
    const l1 = lows[lows.length - 2];
    const l2 = lows[lows.length - 1];
    // BOS bull: close above prior swing high after HL
    if (l2.price > l1.price && last.close > h1.price) {
      hits.push({
        id: uid("bos_b"),
        family: "structure",
        name: "bos",
        label: "BOS ↑",
        direction: "bull",
        confidence: 0.64,
        entry: last.close,
        tp1: last.close + (last.close - l2.price) * 0.5,
        tp2: last.close + (last.close - l2.price),
        sl: l2.price,
        detail: "Break of structure (bullish)",
        tStart: h1.time,
        tEnd: last.time,
        drawings: [
          { id: uid("h"), kind: "hline", t1: h1.time, t2: last.time, price1: h1.price, price2: h1.price, color: "#26a69a", label: "BOS", dashed: false },
          ...drawTargets({ t1: last.time, t2: last.time + 86400, tp1: last.close + (last.close - l2.price) * 0.5, tp2: last.close + (last.close - l2.price), sl: l2.price, bull: true }),
        ],
      });
    }
    if (h2.price < h1.price && last.close < l1.price) {
      hits.push({
        id: uid("bos_s"),
        family: "structure",
        name: "bos",
        label: "BOS ↓",
        direction: "bear",
        confidence: 0.64,
        entry: last.close,
        tp1: last.close - (h2.price - last.close) * 0.5,
        tp2: last.close - (h2.price - last.close),
        sl: h2.price,
        detail: "Break of structure (bearish)",
        tStart: l1.time,
        tEnd: last.time,
        drawings: [
          { id: uid("h"), kind: "hline", t1: l1.time, t2: last.time, price1: l1.price, price2: l1.price, color: "#ef5350", label: "BOS", dashed: false },
        ],
      });
    }
    // CHOCH: change of character — break against prior trend
    const wasBull = h2.price > h1.price && l2.price > l1.price;
    const wasBear = h2.price < h1.price && l2.price < l1.price;
    if (wasBull && last.close < l2.price) {
      hits.push({
        id: uid("choch_b"),
        family: "structure",
        name: "choch",
        label: "CHOCH ↓",
        direction: "bear",
        confidence: 0.6,
        entry: last.close,
        tp1: l1.price,
        sl: h2.price,
        detail: "Change of character against uptrend",
        tStart: l2.time,
        tEnd: last.time,
        drawings: [
          { id: uid("h"), kind: "hline", t1: l2.time, t2: last.time, price1: l2.price, price2: l2.price, color: "#ab47bc", label: "CHOCH" },
        ],
      });
    }
    if (wasBear && last.close > h2.price) {
      hits.push({
        id: uid("choch_b2"),
        family: "structure",
        name: "choch",
        label: "CHOCH ↑",
        direction: "bull",
        confidence: 0.6,
        entry: last.close,
        tp1: h1.price,
        sl: l2.price,
        detail: "Change of character against downtrend",
        tStart: h2.time,
        tEnd: last.time,
        drawings: [
          { id: uid("h"), kind: "hline", t1: h2.time, t2: last.time, price1: h2.price, price2: h2.price, color: "#ab47bc", label: "CHOCH" },
        ],
      });
    }
  }

  hits.sort((a, b) => b.confidence - a.confidence || b.tEnd - a.tEnd);
  return hits.slice(0, 12);
}
