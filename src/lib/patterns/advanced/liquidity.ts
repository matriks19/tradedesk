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


  // Order Blocks (swing + impulse) — boxes for PatternOverlay
  const atrApprox = (() => {
    let s = 0;
    const m = Math.min(20, candles.length);
    for (let i = candles.length - m; i < candles.length; i++) s += candles[i].high - candles[i].low;
    return s / m || 1;
  })();
  for (let i = highs.length - 1; i >= Math.max(0, highs.length - 5); i--) {
    const h = highs[i];
    const idx = candles.findIndex((c) => c.time === h.time);
    if (idx < 0 || idx >= candles.length - 2) continue;
    let impulse = false;
    for (let j = idx + 1; j <= Math.min(candles.length - 1, idx + 4); j++) {
      if (h.price - candles[j].close > 1.2 * atrApprox) {
        impulse = true;
        break;
      }
    }
    if (!impulse) continue;
    const c = candles[idx];
    const top = c.high;
    const bot = Math.min(c.open, c.close);
    hits.push({
      id: uid("ob_bear"),
      family: "liquidity",
      name: "order_block",
      label: "Order Block ↓",
      direction: "bear",
      confidence: 0.62,
      entry: last.close,
      tp1: bot - atrApprox,
      sl: top,
      detail: "Bearish OB from swing high + impulse",
      tStart: c.time,
      tEnd: last.time,
      drawings: [
        { id: uid("b"), kind: "box", t1: c.time, t2: last.time, price1: top, price2: bot, color: "#ef5350", label: "OB↓" },
      ],
    });
    break;
  }
  for (let i = lows.length - 1; i >= Math.max(0, lows.length - 5); i--) {
    const l = lows[i];
    const idx = candles.findIndex((c) => c.time === l.time);
    if (idx < 0 || idx >= candles.length - 2) continue;
    let impulse = false;
    for (let j = idx + 1; j <= Math.min(candles.length - 1, idx + 4); j++) {
      if (candles[j].close - l.price > 1.2 * atrApprox) {
        impulse = true;
        break;
      }
    }
    if (!impulse) continue;
    const c = candles[idx];
    const top = Math.max(c.open, c.close);
    const bot = c.low;
    hits.push({
      id: uid("ob_bull"),
      family: "liquidity",
      name: "order_block",
      label: "Order Block ↑",
      direction: "bull",
      confidence: 0.62,
      entry: last.close,
      tp1: top + atrApprox,
      sl: bot,
      detail: "Bullish OB from swing low + impulse",
      tStart: c.time,
      tEnd: last.time,
      drawings: [
        { id: uid("b"), kind: "box", t1: c.time, t2: last.time, price1: top, price2: bot, color: "#26a69a", label: "OB↑" },
      ],
    });
    break;
  }

  // Fair Value Gaps (3-candle) — recent unfilled
  for (let i = candles.length - 2; i >= Math.max(2, candles.length - 40); i--) {
    const c0 = candles[i - 2];
    const c2 = candles[i];
    if (c0.high < c2.low) {
      const top = c2.low;
      const bot = c0.high;
      let filled = false;
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].low <= bot) {
          filled = true;
          break;
        }
      }
      if (!filled) {
        hits.push({
          id: uid("fvg_b"),
          family: "liquidity",
          name: "fair_value_gap",
          label: "FVG ↑",
          direction: "bull",
          confidence: 0.6,
          entry: last.close,
          tp1: top,
          sl: bot - atrApprox * 0.5,
          detail: "Bullish fair value gap",
          tStart: c0.time,
          tEnd: last.time,
          drawings: [
            { id: uid("b"), kind: "box", t1: c0.time, t2: last.time, price1: top, price2: bot, color: "#26a69a", label: "FVG↑" },
          ],
        });
        break;
      }
    }
  }
  for (let i = candles.length - 2; i >= Math.max(2, candles.length - 40); i--) {
    const c0 = candles[i - 2];
    const c2 = candles[i];
    if (c0.low > c2.high) {
      const top = c0.low;
      const bot = c2.high;
      let filled = false;
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].high >= top) {
          filled = true;
          break;
        }
      }
      if (!filled) {
        hits.push({
          id: uid("fvg_s"),
          family: "liquidity",
          name: "fair_value_gap",
          label: "FVG ↓",
          direction: "bear",
          confidence: 0.6,
          entry: last.close,
          tp1: bot,
          sl: top + atrApprox * 0.5,
          detail: "Bearish fair value gap",
          tStart: c0.time,
          tEnd: last.time,
          drawings: [
            { id: uid("b"), kind: "box", t1: c0.time, t2: last.time, price1: top, price2: bot, color: "#ef5350", label: "FVG↓" },
          ],
        });
        break;
      }
    }
  }

  // Premium / discount sketch from last 50-bar range
  if (candles.length >= 50) {
    const slice = candles.slice(-50);
    const hi = Math.max(...slice.map((c) => c.high));
    const lo = Math.min(...slice.map((c) => c.low));
    const mid = (hi + lo) / 2;
    const prem = lo + (hi - lo) * 0.7;
    const disc = lo + (hi - lo) * 0.3;
    hits.push({
      id: uid("pd"),
      family: "structure",
      name: "premium_discount",
      label: last.close > prem ? "Premium zone" : last.close < disc ? "Discount zone" : "Equilibrium",
      direction: last.close < disc ? "bull" : last.close > prem ? "bear" : "neutral",
      confidence: 0.55,
      entry: last.close,
      tp1: mid,
      sl: last.close > mid ? hi : lo,
      detail: "Range premium/discount",
      tStart: slice[0].time,
      tEnd: last.time,
      drawings: [
        { id: uid("h"), kind: "hline", t1: slice[0].time, t2: last.time, price1: mid, price2: mid, color: "#2962ff", label: "EQ", dashed: true },
        { id: uid("h"), kind: "hline", t1: slice[0].time, t2: last.time, price1: prem, price2: prem, color: "#ef535088", label: "Prem", dashed: true },
        { id: uid("h"), kind: "hline", t1: slice[0].time, t2: last.time, price1: disc, price2: disc, color: "#26a69a88", label: "Disc", dashed: true },
      ],
    });
  }


    hits.sort((a, b) => b.confidence - a.confidence || b.tEnd - a.tEnd);
  return hits.slice(0, 12);
}
