/**
 * Crypto10 bakeoff: IFVG vs IFVG×RSI vs RSI OS/OB vs SMI (1h + 4h).
 * Signal-exit. Answers: does stacking IFVG+RSI improve WR?
 * Run: npx --yes tsx scripts/compare-ifvg-rsi.ts
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
  "ifvgLong",
  "ifvgRsiLong",
  "ifvgRsiBi",
  "rsiOsOb",
  "smiLongOnly",
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
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.candles?.length) return json.candles;
  } catch {
    /* fall through */
  }
  // Direct Binance public API fallback (no local server)
  const interval = timeframe;
  const burl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=1000`;
  const res = await fetch(burl);
  const raw = (await res.json()) as unknown[];
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as (string | number)[];
    return {
      time: Math.floor(Number(r[0]) / 1000),
      open: +r[1],
      high: +r[2],
      low: +r[3],
      close: +r[4],
      volume: +r[5],
    };
  });
}

function runOne(
  candles: Candle[],
  preset: StrategyPresetId,
  timeframe: "1h" | "4h"
) {
  const allowShort = preset === "ifvgRsiBi" || preset === "rsiOsOb";
  const base = {
    symbol: "X",
    exchange: "binance" as const,
    timeframe,
    preset,
    allowShort,
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
    rsiOs: preset.startsWith("ifvg") ? 35 : 30,
    rsiOb: preset.startsWith("ifvg") ? 65 : 70,
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
    allowShort,
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
    process.stdout.write(`.`);
  }
  console.log("");

  const rows = [...agg.values()]
    .map((a) => ({
      tf: timeframe,
      preset: a.preset,
      label: a.label,
      trades: a.trades,
      net: +a.pnl.toFixed(1),
      wr: a.n ? +(a.wrSum / a.n).toFixed(1) : 0,
    }))
    .sort((x, y) => y.wr - x.wr || y.net - x.net);

  console.log(`\n=== Crypto10 ${timeframe} (signal-exit) ===`);
  console.table(rows);
  return rows;
}

function verdict(
  rows1h: { preset: string; wr: number; net: number; trades: number }[],
  rows4h: { preset: string; wr: number; net: number; trades: number }[]
) {
  const pick = (
    rows: { preset: string; wr: number; net: number; trades: number }[],
    id: string
  ) => rows.find((r) => r.preset === id);

  const lines: string[] = [];
  for (const [tf, rows] of [
    ["1h", rows1h],
    ["4h", rows4h],
  ] as const) {
    const ifvg = pick(rows, "ifvgLong");
    const gated = pick(rows, "ifvgRsiLong");
    const bi = pick(rows, "ifvgRsiBi");
    const rsi = pick(rows, "rsiOsOb");
    const smi = pick(rows, "smiLongOnly");
    lines.push(`--- ${tf} ---`);
    if (ifvg && gated) {
      const dWr = +(gated.wr - ifvg.wr).toFixed(1);
      const dNet = +(gated.net - ifvg.net).toFixed(1);
      lines.push(
        `IFVG×RSI Long vs IFVG alone: WR ${dWr >= 0 ? "+" : ""}${dWr}pp, net ${dNet >= 0 ? "+" : ""}${dNet} (trades ${gated.trades} vs ${ifvg.trades})`
      );
    }
    if (gated && rsi) {
      const dWr = +(gated.wr - rsi.wr).toFixed(1);
      lines.push(
        `IFVG×RSI Long vs RSI alone: WR ${dWr >= 0 ? "+" : ""}${dWr}pp (RSI trades ${rsi.trades})`
      );
    }
    if (smi) lines.push(`Ref SMI Long WR ${smi.wr}% net ${smi.net}`);
    if (bi) lines.push(`IFVG×RSI Bi WR ${bi.wr}% net ${bi.net} trades ${bi.trades}`);
  }
  const g1 = pick(rows1h, "ifvgRsiLong");
  const i1 = pick(rows1h, "ifvgLong");
  const r1 = pick(rows1h, "rsiOsOb");
  const g4 = pick(rows4h, "ifvgRsiLong");
  const i4 = pick(rows4h, "ifvgLong");
  const improve =
    (g1 && i1 && g1.wr > i1.wr) || (g4 && i4 && g4.wr > i4.wr);
  const vsRsi =
    (g1 && r1 && g1.wr >= r1.wr) || (g4 && pick(rows4h, "rsiOsOb") && g4.wr >= pick(rows4h, "rsiOsOb")!.wr);
  lines.push("");
  lines.push(
    `VERDICT: Stacking IFVG+RSI ${improve ? "improves" : "does NOT clearly improve"} WR vs IFVG alone on at least one TF; vs RSI alone ${vsRsi ? "competitive/better" : "not better"} on WR. Use chart stack (IFVG Bölgeler + IFVG×RSI) + preset ifvgRsiLong for AND confluence.`
  );
  console.log("\n=== Verdict ===\n" + lines.join("\n"));
  return lines;
}

async function main() {
  const h1 = await runTf("1h");
  const h4 = await runTf("4h");
  const v = verdict(h1, h4);
  console.log(
    JSON.stringify(
      {
        "1h": h1,
        "4h": h4,
        verdict: v,
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
