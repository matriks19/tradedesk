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
function synthBull(gap: number, lbL = 5, lbR = 3): {
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

function synthBear(gap: number, lbL = 5, lbR = 3): {
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

// --- Bull fires when gap in [rangeLower, rangeUpper] ---
{
  const { candles, osc, confirmIdx } = synthBull(25);
  const r = computeOscDivergence(candles, osc, LIST_SCAN_DIV_OPTS);
  assert(r.bull[confirmIdx] != null, "bull fires at confirm when gap>=rangeLower");
  assert(r.bear.every((v) => v == null), "no bear on bull synth");
  console.log("OK bull gap=25 @", confirmIdx, "val", r.bull[confirmIdx]);
}

// --- Bear fires when gap in [rangeLower, rangeUpper] ---
{
  const { candles, osc, confirmIdx } = synthBear(25);
  const r = computeOscDivergence(candles, osc, LIST_SCAN_DIV_OPTS);
  assert(r.bear[confirmIdx] != null, "bear fires at confirm when gap>=rangeLower");
  assert(r.bull.every((v) => v == null), "no bull on bear synth");
  console.log("OK bear gap=25 @", confirmIdx, "val", r.bear[confirmIdx]);
}

// --- Bars between pivots < rangeLower (5) → no fire ---
{
  const { candles, osc, confirmIdx } = synthBull(3);
  const r = computeOscDivergence(candles, osc, LIST_SCAN_DIV_OPTS);
  assert(r.bull[confirmIdx] == null, "bull must NOT fire when gap<rangeLower");
  assert(r.bull.every((v) => v == null), "no bull markers when gap<rangeLower");
  console.log("OK no-fire gap=3");
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


function synthHiddenBull(gap: number, lbL = 5, lbR = 3): {
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
    let o = 80;
    let low = 100;
    let high = 110;

    if (i === p0) {
      o = 20; // deeper osc low
      low = 80; // lower price low
      high = 95;
    } else if (i === p1) {
      o = 10; // lower osc low (hidden)
      low = 90; // higher price low
      high = 100;
    } else if (Math.abs(i - p0) <= lbR || Math.abs(i - p1) <= lbR) {
      o = 60;
    } else if (Math.abs(i - p0) <= lbL || Math.abs(i - p1) <= lbL) {
      o = 60;
    }

    candles.push(candle(i, low, high));
    osc.push(o);
  }
  return { candles, osc, confirmIdx: p1 + lbR };
}

function synthHiddenBear(gap: number, lbL = 5, lbR = 3): {
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
    let o = 20;
    let low = 100;
    let high = 110;

    if (i === p0) {
      o = 70;
      low = 100;
      high = 130; // higher price high first
    } else if (i === p1) {
      o = 85; // higher osc high (hidden)
      low = 95;
      high = 120; // lower price high
    } else if (
      Math.abs(i - p0) <= lbL ||
      Math.abs(i - p0) <= lbR ||
      Math.abs(i - p1) <= lbL ||
      Math.abs(i - p1) <= lbR
    ) {
      o = 40;
    }

    candles.push(candle(i, low, high));
    osc.push(o);
  }
  return { candles, osc, confirmIdx: p1 + lbR };
}

// --- Hidden bull: price HL + osc LL ---
{
  const { candles, osc, confirmIdx } = synthHiddenBull(55);
  const r = computeOscDivergence(candles, osc, LIST_SCAN_DIV_OPTS);
  assert(r.hiddenBull[confirmIdx] != null, "hiddenBull fires at confirm");
  assert(r.bull.every((v) => v == null), "no regular bull on hiddenBull synth");
  assert(r.bear.every((v) => v == null), "no bear on hiddenBull synth");
  console.log("OK hiddenBull gap=55 @", confirmIdx, "val", r.hiddenBull[confirmIdx]);
}

// --- Hidden bear: price LH + osc HH ---
{
  const { candles, osc, confirmIdx } = synthHiddenBear(55);
  const r = computeOscDivergence(candles, osc, LIST_SCAN_DIV_OPTS);
  assert(r.hiddenBear[confirmIdx] != null, "hiddenBear fires at confirm");
  assert(r.bear.every((v) => v == null), "no regular bear on hiddenBear synth");
  assert(r.bull.every((v) => v == null), "no bull on hiddenBear synth");
  console.log("OK hiddenBear gap=55 @", confirmIdx, "val", r.hiddenBear[confirmIdx]);
}

// --- Regular bull must not set hiddenBull ---
{
  const { candles, osc, confirmIdx } = synthBull(55);
  const r = computeOscDivergence(candles, osc, LIST_SCAN_DIV_OPTS);
  assert(r.bull[confirmIdx] != null, "regular bull still fires");
  assert(r.hiddenBull.every((v) => v == null), "no hiddenBull on regular bull synth");
  console.log("OK regular vs hidden separation (bull)");
}

// --- Gold2 accepts hidden div conds ---
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
    gold2: {
      enabled: true,
      conds: ["div_hid_bull", "div_hid_bear"],
    },
  };
  const hits = scanSymbol(candles, cfg, 80);
  assert(hits.every((h) => h.kind === "gold2"), "kind gold2 hidden");
  assert(
    hits.every((h) => h.cond === "div_hid_bull" || h.cond === "div_hid_bear"),
    "only hidden div conds"
  );
  console.log(
    "OK gold2 hidden div scan",
    hits.map((h) => `${h.cond}@${h.barsAgo}`)
  );
}


// --- divScan multi-osc kind ---
{
  const { candles, osc, confirmIdx } = synthBull(55);
  // Feed price/osc so RSI can diverge: reuse synth candles but scan with RSI-only
  // may not fire on flat synth — instead verify wiring + cond format with gold-style random
  const n = 220;
  const candles2: Candle[] = [];
  let px = 100;
  for (let i = 0; i < n; i++) {
    px = Math.max(1, px + Math.sin(i / 9) * 0.8 + Math.cos(i / 17) * 0.3);
    candles2.push(candle(i, px - 1, px + 1, px));
  }
  const cfg: ListScanConfig = {
    matchMode: "any",
    divScan: {
      enabled: true,
      oscillators: ["rsi", "mfi", "cci", "roc"],
      types: ["reg_bull", "reg_bear", "hid_bull", "hid_bear"],
    },
  };
  const hits = scanSymbol(candles2, cfg, 80);
  assert(hits.every((h) => h.kind === "divScan"), "kind divScan");
  assert(
    hits.every((h) => /^[a-z_]+\|(reg_bull|reg_bear|hid_bull|hid_bear)$/.test(h.cond)),
    "cond format osc|type"
  );
  assert(
    hits.every((h) => h.bias === "bull" || h.bias === "bear"),
    "bias bull/bear"
  );
  // Disabled by default path: empty when enabled=false
  const off = scanSymbol(
    candles2,
    { matchMode: "any", divScan: { enabled: false, oscillators: ["rsi"], types: ["reg_bull"] } },
    80
  );
  assert(off.length === 0, "divScan off → no hits");
  // Only selected osc computed — macd_hist not in list → no macd conds
  assert(
    hits.every((h) => !h.cond.startsWith("macd_hist|")),
    "no unselected osc"
  );
  console.log(
    "OK divScan",
    hits.length,
    "hits",
    hits.slice(0, 6).map((h) => `${h.cond}@${h.barsAgo}`)
  );
  void candles;
  void osc;
  void confirmIdx;
}

console.log("OK smoke-osc-divergence");
