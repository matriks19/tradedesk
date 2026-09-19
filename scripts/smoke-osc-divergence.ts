/**
 * Unit smoke: oscillator divergence (list-scan uyumsuzluk).
 * Run: npx --yes tsx scripts/smoke-osc-divergence.ts
 */
import type { Candle } from "../src/lib/types";
import {
  computeOscDivergence,
  LIST_SCAN_DIV_OPTS,
} from "../src/lib/indicators/oscDivergence";
import { computeRsiPuNu } from "../src/lib/indicators/rsiPuNu";
import { scanSymbol, type ListScanConfig } from "../src/lib/scanner/listScan";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function candle(i: number, low: number, high: number, close?: number): Candle {
  const c = close ?? (low + high) / 2;
  return {
    time: 1_700_000_000 + i * 3600,
    open: c,
    high,
    low,
    close: c,
    volume: 1000,
  };
}

/**
 * Flat-high oscillator with exactly two valleys (or peaks).
 * Ensures no intermediate pivots between p0 and p1.
 */
function synthBull(gap: number, lbL = 5, lbR = 2): {
  candles: Candle[];
  osc: (number | null)[];
  confirmIdx: number;
} {
  const p0 = lbL + 10;
  const p1 = p0 + gap;
  const n = p1 + lbR + 10;
  const candles: Candle[] = [];
  const osc: (number | null)[] = [];

  for (let i = 0; i < n; i++) {
    // Default: high plateau — no local lows
    let o = 80;
    // Price mostly flat-high; punch lower lows only at pivot bars
    let low = 100;
    let high = 110;

    if (i === p0) {
      o = 20;
      low = 90;
      high = 100;
    } else if (i === p1) {
      o = 35; // higher osc low
      low = 80; // lower price low
      high = 95;
    } else if (Math.abs(i - p0) <= lbR || Math.abs(i - p1) <= lbR) {
      // right-side neighbors must be > pivot
      o = 60;
    } else if (Math.abs(i - p0) <= lbL || Math.abs(i - p1) <= lbL) {
      // left-side neighbors must be > pivot
      o = 60;
    }

    candles.push(candle(i, low, high));
    osc.push(o);
  }
  return { candles, osc, confirmIdx: p1 + lbR };
}

function synthBear(gap: number, lbL = 5, lbR = 2): {
  candles: Candle[];
  osc: (number | null)[];
  confirmIdx: number;
} {
  const p0 = lbL + 10;
  const p1 = p0 + gap;
  const n = p1 + lbR + 10;
  const candles: Candle[] = [];
  const osc: (number | null)[] = [];

  for (let i = 0; i < n; i++) {
    let o = 20; // low plateau — no local highs
    let low = 100;
    let high = 110;

    if (i === p0) {
      o = 80;
      low = 100;
      high = 120;
    } else if (i === p1) {
      o = 65; // lower osc high
      low = 105;
      high = 135; // higher price high
    } else if (Math.abs(i - p0) <= lbL || Math.abs(i - p0) <= lbR ||
               Math.abs(i - p1) <= lbL || Math.abs(i - p1) <= lbR) {
      o = 40;
    }

    candles.push(candle(i, low, high));
    osc.push(o);
  }
  return { candles, osc, confirmIdx: p1 + lbR };
}

// --- Bull fires when gap >= 50 ---
{
  const { candles, osc, confirmIdx } = synthBull(55);
  const r = computeOscDivergence(candles, osc, LIST_SCAN_DIV_OPTS);
  assert(r.bull[confirmIdx] != null, "bull fires at confirm when gap>=50");
  assert(r.bear.every((v) => v == null), "no bear on bull synth");
  console.log("OK bull gap=55 @", confirmIdx, "val", r.bull[confirmIdx]);
}

// --- Bear fires when gap >= 50 ---
{
  const { candles, osc, confirmIdx } = synthBear(55);
  const r = computeOscDivergence(candles, osc, LIST_SCAN_DIV_OPTS);
  assert(r.bear[confirmIdx] != null, "bear fires at confirm when gap>=50");
  assert(r.bull.every((v) => v == null), "no bull on bear synth");
  console.log("OK bear gap=55 @", confirmIdx, "val", r.bear[confirmIdx]);
}

// --- Bars between pivots < 50 → no fire ---
{
  const { candles, osc, confirmIdx } = synthBull(40);
  const r = computeOscDivergence(candles, osc, LIST_SCAN_DIV_OPTS);
  assert(r.bull[confirmIdx] == null, "bull must NOT fire when gap<50");
  assert(r.bull.every((v) => v == null), "no bull markers when gap<50");
  console.log("OK no-fire gap=40");
}

// --- computeRsiPuNu still works (wrapper) ---
{
  const n = 120;
  const candles: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const px = 100 + Math.sin(i / 8) * 5 + i * 0.01;
    candles.push(candle(i, px - 1, px + 1, px));
  }
  const r = computeRsiPuNu(candles);
  assert(r.rsi.length === n, "rsi len");
  assert(r.pu.length === n && r.nu.length === n, "marker lens");
  console.log("OK computeRsiPuNu wrapper");
}

// --- Gold2 list-scan accepts div_bull/div_bear conds ---
{
  const n = 320;
  const candles: Candle[] = [];
  let px = 100;
  for (let i = 0; i < n; i++) {
    px = Math.max(1, px + Math.sin(i / 11) * 0.4);
    candles.push(candle(i, px - 0.5, px + 0.5, px));
  }
  const cfg: ListScanConfig = {
    matchMode: "any",
    gold2: { enabled: true, conds: ["div_bull", "div_bear"] },
  };
  const hits = scanSymbol(candles, cfg, 80);
  assert(hits.every((h) => h.kind === "gold2"), "kind gold2");
  assert(
    hits.every((h) => h.cond === "div_bull" || h.cond === "div_bear"),
    "only div conds"
  );
  console.log(
    "OK gold2 div scan",
    hits.map((h) => `${h.cond}@${h.barsAgo}`)
  );
}

console.log("OK smoke-osc-divergence");
