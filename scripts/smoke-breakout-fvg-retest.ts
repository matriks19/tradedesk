/**
 * Smoke: synthetic consolid + breakout + FVG + retest + confirm → AL.
 * Run: npx --yes tsx scripts/smoke-breakout-fvg-retest.ts
 */
import { detectBreakoutFvgRetest } from "../src/lib/patterns/breakoutFvgRetest";
import { detectPatterns } from "../src/lib/patterns/detect";
import type { Candle } from "../src/lib/types";

function c(
  i: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 1000
): Candle {
  return {
    time: 1_700_000_000 + i * 3600,
    open,
    high,
    low,
    close,
    volume,
  };
}

/** Build A+ bullish path: flat box → impulse BO+FVG → retest RH → confirm AL */
function buildBullPath(): Candle[] {
  const out: Candle[] = [];
  // Warmup + consolidation ~20 bars around 100–102
  for (let i = 0; i < 45; i++) {
    const mid = 100 + (i % 5) * 0.3;
    out.push(c(i, mid, 102, 100, mid + 0.1, 800 + (i % 3) * 50));
  }
  // Force tight box highs/lows on last 20 of cons (indices 25..44)
  for (let i = 25; i <= 44; i++) {
    out[i] = c(i, 100.5, 102.0, 100.0, 101.0, 900);
  }
  // Breakout bar 45: strong close above RH=102, volume spike
  out.push(c(45, 101.5, 105.5, 101.4, 105.2, 3500));
  // Impulse middle candle 46 (FVG middle)
  out.push(c(46, 105.2, 106.8, 105.0, 106.5, 2800));
  // Candle 47 completes bullish FVG: low[47] > high[45]
  // Wait — classic FVG is low[i] > high[i-2], so for i=47: high[45]=105.5, need low[47]>105.5
  // But we need FVG overlapping RH~102. Better: FVG formed at breakout with i=boIdx or boIdx+1
  // For i=45: need high[43] < low[45]. high[43]=102, low[45]=101.4 — no gap.
  // Rebuild: BO candle itself creates gap vs cons: high[43]=102, set low[45]=102.4, close 105
  out[45] = c(45, 102.2, 105.8, 102.4, 105.5, 4000);
  out[46] = c(46, 105.5, 107.2, 105.2, 106.8, 3200);
  // FVG at i=47: high[45]=105.8 < low[47] — actually for gap near RH use i=45:
  // high[43]=102 < low[45]=102.4 → FVG bot=102 top=102.4 — tiny but overlaps RH
  // Also FVG at i=47: high[45]=105.8 < low[47]=106.0
  out.push(c(47, 106.8, 108.0, 106.0, 107.5, 2500));
  // Retest: dip to RH/FVG (~102.2), hold close above
  out.push(c(48, 106.5, 106.8, 102.15, 103.2, 1800));
  // Confirmation bullish close above retest mid
  out.push(c(49, 103.0, 105.5, 102.8, 105.2, 2200));
  // A few more bars
  out.push(c(50, 105.2, 106.0, 104.8, 105.6, 1500));
  out.push(c(51, 105.6, 106.5, 105.0, 106.2, 1400));
  return out;
}

const candles = buildBullPath();
const hits = detectBreakoutFvgRetest(candles);
const al = hits.find(
  (h) =>
    h.bias === "bull" &&
    (h.meta?.status === "al_tetiklendi" || h.meta?.status === "retest")
);

if (!al) {
  console.error(
    "FAIL: no bull AL/retest hit",
    hits.map((h) => ({
      bias: h.bias,
      status: h.meta?.status,
      score: h.meta?.score,
      detail: h.detail,
    }))
  );
  process.exit(1);
}

if ((al.meta?.score ?? 0) < 50) {
  console.error("FAIL: score too low", al.meta);
  process.exit(1);
}

const wired = detectPatterns(candles, {
  enable: {
    breakout_fvg_retest: true,
    three_drives: false,
    flag: false,
    pennant: false,
    triangle_asc: false,
    triangle_desc: false,
    triangle_sym: false,
    hh_hl: false,
    lh_ll: false,
    double_top: false,
    double_bottom: false,
    head_shoulders: false,
    inv_head_shoulders: false,
    breakout_box: false,
    engulfing: false,
  },
}).filter((h) => h.type === "breakout_fvg_retest");

if (!wired.length) {
  console.error("FAIL: not wired into detectPatterns");
  process.exit(1);
}

console.log("OK", {
  status: al.meta?.status,
  score: al.meta?.score,
  filterOk: al.meta?.filterOk,
  rangeHigh: al.meta?.rangeHigh,
  rangeLow: al.meta?.rangeLow,
  fvg: [al.meta?.fvgBot, al.meta?.fvgTop],
  retest: al.meta?.retestPrice,
  entry: al.meta?.entry,
  stop: al.meta?.stop,
  tp: [al.meta?.tp1, al.meta?.tp2, al.meta?.tp3],
  barsAgo: al.meta?.barsAgo,
  volOk: al.meta?.volOk,
  drawings: al.drawings.length,
  wired: wired.length,
});
