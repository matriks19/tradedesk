/** Smoke: MACD BB Trend list scan — separate chips + soft AL window.
 *  npx tsx scripts/smoke-macd-bb-list-scan.ts
 */
import type { Candle } from "../src/lib/types";
import {
  scanSymbol,
  ALL_MACD_BB_CONDS,
  MACD_BB_MIN_BARS,
  MACD_BB_FETCH_LIMIT,
  type ListScanConfig,
} from "../src/lib/scanner/listScan";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/**
 * Slow decline then two rallies — plants BB×EMA and MACD×sig on
 * different bars within a 40-bar window (verified with fast params).
 */
function synthPlanted(n: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    let px = 100 - (i / n) * 8;
    if (i >= n - 30) px = 92 + (i - (n - 30)) * 1.2;
    if (i >= n - 10) px = px + (i - (n - 10)) * 2.0;
    out.push({
      time: 1_700_000_000 + i * 3600,
      open: px * 0.999,
      high: px * 1.002,
      low: px * 0.998,
      close: px,
      volume: 1000,
    });
  }
  return out;
}

assert(ALL_MACD_BB_CONDS.includes("macd_x_sig"), "default has macd_x_sig");
assert(ALL_MACD_BB_CONDS.includes("bb_x_ema"), "default has bb_x_ema");
assert(ALL_MACD_BB_CONDS.includes("al"), "default has al");
assert(ALL_MACD_BB_CONDS.length === 3, "three default chips");
assert(MACD_BB_MIN_BARS >= 280, "min bars ≥280");
assert(MACD_BB_FETCH_LIMIT >= 500, "fetch ≥500");

const n = Math.max(MACD_BB_MIN_BARS + 40, 320);
const candles = synthPlanted(n);

// Fast params so planted rallies create real edges within 40 bars
const baseMacdBb = {
  enabled: true as const,
  fast: 12,
  slow: 26,
  signal: 9,
  bbPeriod: 20,
  bbMult: 2,
  emaPeriod: 50,
};

const cfgMacd: ListScanConfig = {
  matchMode: "any",
  macdBb: { ...baseMacdBb, conds: ["macd_x_sig"] },
};
const cfgBb: ListScanConfig = {
  matchMode: "any",
  macdBb: { ...baseMacdBb, conds: ["bb_x_ema"] },
};
const cfgAl: ListScanConfig = {
  matchMode: "any",
  macdBb: { ...baseMacdBb, conds: ["al"] },
};
const cfgAll: ListScanConfig = {
  matchMode: "any",
  macdBb: { ...baseMacdBb, conds: [...ALL_MACD_BB_CONDS] },
};

const maxBars = 40;
const hMacd = scanSymbol(candles, cfgMacd, maxBars);
const hBb = scanSymbol(candles, cfgBb, maxBars);
const hAl = scanSymbol(candles, cfgAl, maxBars);
const hAll = scanSymbol(candles, cfgAll, maxBars);

console.log("macd-only", hMacd.map((h) => `${h.cond}@${h.barsAgo}`));
console.log("bb-only", hBb.map((h) => `${h.cond}@${h.barsAgo}`));
console.log("al-only", hAl.map((h) => `${h.cond}@${h.barsAgo} ${h.note}`));
console.log(
  "all-chips",
  hAll.map((h) => `${h.cond}@${h.barsAgo}`)
);

assert(hMacd.length >= 1, "macd_x_sig chip fires independently");
assert(hMacd.every((h) => h.cond === "macd_x_sig"), "macd-only cond");
assert(hBb.length >= 1, "bb_x_ema chip fires independently");
assert(hBb.every((h) => h.cond === "bb_x_ema"), "bb-only cond");

assert(hAl.length >= 1, "AL fires when both edges in same window");
assert(hAl[0]!.note.includes("MACD↑ + BB×EMA"), "AL note format");
assert(/−\d+\/−\d+/.test(hAl[0]!.note), "AL note shows (−a/−b)");

const macdAgo = hMacd[0]!.barsAgo;
const bbAgo = hBb[0]!.barsAgo;
assert(
  macdAgo !== bbAgo,
  `expected different bars for soft AL (got both @${macdAgo})`
);
console.log(`soft AL OK — different bars (macd −${macdAgo}, bb −${bbAgo})`);

const allConds = new Set(hAll.map((h) => h.cond));
assert(allConds.has("macd_x_sig"), "all scan includes macd");
assert(allConds.has("bb_x_ema"), "all scan includes bb");
assert(allConds.has("al"), "all scan includes al");

// Empty conds while enabled → ALL defaults
const cfgEmpty: ListScanConfig = {
  matchMode: "any",
  macdBb: { ...baseMacdBb, conds: [] },
};
const hEmpty = scanSymbol(candles, cfgEmpty, maxBars);
assert(
  hEmpty.every((h) => (ALL_MACD_BB_CONDS as string[]).includes(h.cond)),
  "empty conds use ALL_MACD_BB_CONDS"
);
assert(hEmpty.length >= 1, "empty conds still produce hits");

console.log("OK smoke-macd-bb-list-scan");
