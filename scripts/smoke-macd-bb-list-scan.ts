/** Smoke: MACD Uzun + BB Trend — independent list-scan kinds.
 *  npx tsx scripts/smoke-macd-bb-list-scan.ts
 */
import type { Candle } from "../src/lib/types";
import {
  scanSymbol,
  DEFAULT_MACD_LONG_CONDS,
  DEFAULT_BB_TREND_CONDS,
  MACD_LONG_MIN_BARS,
  MACD_LONG_FETCH_LIMIT,
  BB_TREND_MIN_BARS,
  BB_TREND_FETCH_LIMIT,
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

assert(DEFAULT_MACD_LONG_CONDS.includes("cross_up"), "macdLong default cross_up");
assert(DEFAULT_BB_TREND_CONDS.includes("bb_x_ema"), "bbTrend default bb_x_ema");
assert(MACD_LONG_MIN_BARS >= 280, "macdLong min bars ≥280");
assert(MACD_LONG_FETCH_LIMIT >= 500, "macdLong fetch ≥500");
assert(BB_TREND_MIN_BARS >= 250, "bbTrend min bars ≥250");
assert(BB_TREND_FETCH_LIMIT >= 300, "bbTrend fetch ≥300");

const n = Math.max(MACD_LONG_MIN_BARS + 40, 320);
const candles = synthPlanted(n);

// Fast params so planted rallies create real edges within 40 bars
const cfgMacd: ListScanConfig = {
  matchMode: "any",
  macdLong: {
    enabled: true,
    conds: ["cross_up"],
    fast: 12,
    slow: 26,
    signal: 9,
  },
};
const cfgBb: ListScanConfig = {
  matchMode: "any",
  bbTrend: {
    enabled: true,
    conds: ["bb_x_ema"],
    bbPeriod: 20,
    bbMult: 2,
    emaPeriod: 50,
  },
};
const cfgBoth: ListScanConfig = {
  matchMode: "any",
  macdLong: {
    enabled: true,
    conds: ["cross_up"],
    fast: 12,
    slow: 26,
    signal: 9,
  },
  bbTrend: {
    enabled: true,
    conds: ["bb_x_ema"],
    bbPeriod: 20,
    bbMult: 2,
    emaPeriod: 50,
  },
};
const cfgEmptyMacd: ListScanConfig = {
  matchMode: "any",
  macdLong: {
    enabled: true,
    conds: [],
    fast: 12,
    slow: 26,
    signal: 9,
  },
};
const cfgEmptyBb: ListScanConfig = {
  matchMode: "any",
  bbTrend: {
    enabled: true,
    conds: [],
    bbPeriod: 20,
    bbMult: 2,
    emaPeriod: 50,
  },
};

const maxBars = 40;
const hMacd = scanSymbol(candles, cfgMacd, maxBars);
const hBb = scanSymbol(candles, cfgBb, maxBars);
const hBoth = scanSymbol(candles, cfgBoth, maxBars);
const hEmptyMacd = scanSymbol(candles, cfgEmptyMacd, maxBars);
const hEmptyBb = scanSymbol(candles, cfgEmptyBb, maxBars);

console.log("macdLong-only", hMacd.map((h) => `${h.kind}:${h.cond}@${h.barsAgo}`));
console.log("bbTrend-only", hBb.map((h) => `${h.kind}:${h.cond}@${h.barsAgo}`));
console.log("both", hBoth.map((h) => `${h.kind}:${h.cond}@${h.barsAgo}`));
console.log(
  "empty defaults",
  hEmptyMacd.map((h) => h.cond),
  hEmptyBb.map((h) => h.cond)
);

assert(hMacd.length >= 1, "macdLong fires alone");
assert(hMacd.every((h) => h.kind === "macdLong" && h.cond === "cross_up"), "macdLong-only kind/cond");
assert(hBb.length >= 1, "bbTrend fires alone");
assert(hBb.every((h) => h.kind === "bbTrend" && h.cond === "bb_x_ema"), "bbTrend-only kind/cond");

assert(
  hBoth.some((h) => h.kind === "macdLong") && hBoth.some((h) => h.kind === "bbTrend"),
  "both kinds independent under matchMode any"
);

assert(hEmptyMacd.length >= 1, "empty macdLong conds → DEFAULT_MACD_LONG_CONDS");
assert(hEmptyMacd.every((h) => h.cond === "cross_up"), "empty macdLong → cross_up");
assert(hEmptyBb.length >= 1, "empty bbTrend conds → DEFAULT_BB_TREND_CONDS");
assert(hEmptyBb.every((h) => h.cond === "bb_x_ema"), "empty bbTrend → bb_x_ema");

// Too-short candles must not hit
const short = synthPlanted(100);
assert(
  scanSymbol(short, cfgMacd, maxBars).length === 0,
  "macdLong rejects short series"
);
assert(
  scanSymbol(short, {
    matchMode: "any",
    bbTrend: {
      enabled: true,
      conds: ["bb_x_ema"],
      bbPeriod: 20,
      bbMult: 2,
      emaPeriod: 200,
    },
  }, maxBars).length === 0,
  "bbTrend rejects short series for EMA200"
);

console.log("smoke-macd-uzun-bb-trend: OK");
