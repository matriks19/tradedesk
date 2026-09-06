/**
 * Quick Crypto10 bakeoff: median/PLI presets vs playbook refs (1h + 4h).
 * Signal-exit, long-only. Net ≈ sum of 10 coins.
 */
import {
  runBacktest,
  recommendedWarmup,
  PRESET_LABELS,
  type BacktestParams,
  type StrategyPresetId,
} from "../src/lib/backtest";
import type { Candle } from "../src/lib/types";

const PRESETS: StrategyPresetId[] = [
  "pliDeltaHybridLong",
  "pliBreakLong",
  "madBandsLong",
  "medianCrossLong",
  "smiLongOnly",
  "stDivFireflyLong",
  "bbBreak",
];

const SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "NEARUSDT",
];

async function fetchCandles(
  symbol: string,
  timeframe: "1h" | "4h"
): Promise<Candle[]> {
  const url = `http://127.0.0.1:3000/api/klines?symbol=${symbol}&exchange=binance&timeframe=${timeframe}&limit=1000`;
  const res = await fetch(url);
  const json = await res.json();
  return json.candles ?? [];
}

function runOne(
  candles: Candle[],
  preset: StrategyPresetId,
  timeframe: "1h" | "4h"
) {
  const base = {
    symbol: "X",
    exchange: "binance" as const,
    timeframe,
    preset,
    allowShort: false,
    useAtrStops: false,
    useSignalExits: true,
    slAtrMult: 1.5,
    tpAtrMult: 2.5,
    positionSize: 1000,
    commissionBps: 4,
    warmup: 80,
    candleLimit: 1000,
    fast: 9,
    slow: 21,
    rsiPeriod: 14,
    rsiOs: 30,
    rsiOb: 70,
    atrPeriod: 14,
    stMult: 3,
    bbPeriod: 20,
    bbMult: 2,
    adxPeriod: 14,
    adxMin: 25,
  } satisfies Partial<BacktestParams>;
  const params = {
    ...base,
    warmup: recommendedWarmup(preset, base as BacktestParams),
    allowShort: false,
  } as BacktestParams;
  const r = runBacktest(candles, params);
  const s = r.summary;
  return {
    trades: s.trades,
    wr: +(s.winRate * 100).toFixed(1),
    pnl: +s.netPnl.toFixed(2),
    pf: Number.isFinite(s.profitFactor) ? +s.profitFactor.toFixed(2) : "inf",
    exp: +s.expectancy.toFixed(2),
    dd: +s.maxDrawdown.toFixed(2),
  };
}

async function runTf(timeframe: "1h" | "4h") {
  type Agg = {
    preset: StrategyPresetId;
    label: string;
    trades: number;
    pnl: number;
    wrSum: number;
    n: number;
  };
  const agg = new Map<StrategyPresetId, Agg>();
  for (const preset of PRESETS) {
    agg.set(preset, {
      preset,
      label: PRESET_LABELS[preset],
      trades: 0,
      pnl: 0,
      wrSum: 0,
      n: 0,
    });
  }

  for (const symbol of SYMBOLS) {
    const candles = await fetchCandles(symbol, timeframe);
    if (candles.length < 250) {
      console.error(`skip ${symbol} ${timeframe} n=${candles.length}`);
      continue;
    }
    for (const preset of PRESETS) {
      const row = runOne(candles, preset, timeframe);
      const a = agg.get(preset)!;
      a.trades += row.trades;
      a.pnl += row.pnl;
      a.wrSum += row.wr;
      a.n += 1;
    }
  }

  const rows = [...agg.values()]
    .map((a) => ({
      tf: timeframe,
      preset: a.preset,
      label: a.label,
      trades: a.trades,
      net: +a.pnl.toFixed(1),
      wr: a.n ? +(a.wrSum / a.n).toFixed(1) : 0,
    }))
    .sort((x, y) => y.net - x.net);

  console.log(`\n=== Crypto10 ${timeframe} (signal-exit, long-only) ===`);
  console.table(rows);
  return rows;
}

async function main() {
  const h1 = await runTf("1h");
  const h4 = await runTf("4h");
  console.log(
    JSON.stringify(
      {
        "1h": h1,
        "4h": h4,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
