/**
 * Smoke: synthetic bearish Three Drives should score high + filterOk.
 * Run: npx --yes tsx scripts/smoke-three-drives.ts
 */
import { detectThreeDrives } from "../src/lib/patterns/threeDrives";
import { detectPatterns } from "../src/lib/patterns/detect";
import type { Candle } from "../src/lib/types";

function buildSeries(
  n: number,
  swings: { i: number; kind: "high" | "low"; price: number }[]
): Candle[] {
  const marks = [...swings].sort((a, b) => a.i - b.i);
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    let prev = marks[0];
    let next = marks[marks.length - 1];
    for (const m of marks) {
      if (m.i <= i) prev = m;
      if (m.i >= i) {
        next = m;
        break;
      }
    }
    const mid =
      prev.i === next.i
        ? prev.price
        : prev.price +
          ((next.price - prev.price) * (i - prev.i)) / (next.i - prev.i);
    out.push({
      time: 1_700_000_000 + i * 3600,
      open: mid,
      high: mid + 0.3,
      low: mid - 0.3,
      close: mid,
      volume: 1000,
    });
  }
  for (const s of swings) {
    const i = s.i;
    if (s.kind === "high") {
      out[i].high = s.price;
      out[i].low = s.price - 0.5;
      out[i].close = s.price - 0.1;
      out[i].open = s.price - 0.2;
      for (let j = 1; j <= 2; j++) {
        out[i - j].high = s.price - 2 - j;
        out[i + j].high = s.price - 2 - j;
      }
    } else {
      out[i].low = s.price;
      out[i].high = s.price + 0.5;
      out[i].close = s.price + 0.1;
      out[i].open = s.price + 0.2;
      for (let j = 1; j <= 2; j++) {
        out[i - j].low = s.price + 2 + j;
        out[i + j].low = s.price + 2 + j;
      }
    }
  }
  return out;
}

const origin = 100;
const d1 = 110;
const a = d1 - (d1 - origin) * 0.618;
const d2 = a + (d1 - a) * 1.618;
const c = d2 - (d2 - a) * 0.618;
const d3 = c + (d2 - c) * 1.618;

const candles = buildSeries(80, [
  { i: 8, kind: "low", price: origin },
  { i: 18, kind: "high", price: d1 },
  { i: 28, kind: "low", price: a },
  { i: 40, kind: "high", price: d2 },
  { i: 52, kind: "low", price: c },
  { i: 66, kind: "high", price: d3 },
]);

const hits = detectThreeDrives(candles, 2);
const bear = hits.find((h) => h.bias === "bear");
if (!bear || !bear.meta?.filterOk || (bear.meta.score ?? 0) < 60) {
  console.error("FAIL", hits.map((h) => h.meta));
  process.exit(1);
}
const wired = detectPatterns(candles, {
  enable: {
    three_drives: true,
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
}).filter((h) => h.type === "three_drives");
if (!wired.length) {
  console.error("FAIL: not wired into detectPatterns");
  process.exit(1);
}
console.log("OK", {
  score: bear.meta.score,
  filterOk: bear.meta.filterOk,
  fibA: bear.meta.fibRetraceA,
  fibC: bear.meta.fibRetraceC,
  extD2: bear.meta.fibExtD2,
  extD3: bear.meta.fibExtD3,
  drawings: bear.drawings.length,
  wired: wired.length,
});
