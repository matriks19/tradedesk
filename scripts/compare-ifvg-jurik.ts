/**
 * Crypto10 bakeoff: IFVG gates — Jurik Kase Stoch (2×) vs SMI vs RSI (1h + 4h).
 * Signal-exit. Playbook TF focus: 4h verdict.
 * Run: npx --yes tsx scripts/compare-ifvg-jurik.ts
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
  "ifvgSmiLong",
  "ifvgJurikStochLong",
  "ifvgJurikStochBi",
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
  const allowShort = preset === "ifvgJurikStochBi";
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
    warmup: 100,
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
    const rsiG = pick(rows, "ifvgRsiLong");
    const smiG = pick(rows, "ifvgSmiLong");
    const jurikG = pick(rows, "ifvgJurikStochLong");
    const jurikBi = pick(rows, "ifvgJurikStochBi");
    const smi = pick(rows, "smiLongOnly");
    lines.push(`--- ${tf} ---`);
    if (jurikG && smiG) {
      const dWr = +(jurikG.wr - smiG.wr).toFixed(1);
      const dNet = +(jurikG.net - smiG.net).toFixed(1);
      lines.push(
        `IFVG×Jurik Long vs IFVG×SMI Long: WR ${dWr >= 0 ? "+" : ""}${dWr}pp, net ${dNet >= 0 ? "+" : ""}${dNet} (trades ${jurikG.trades} vs ${smiG.trades})`
      );
    }
    if (jurikG && rsiG) {
      const dWr = +(jurikG.wr - rsiG.wr).toFixed(1);
      const dNet = +(jurikG.net - rsiG.net).toFixed(1);
      lines.push(
        `IFVG×Jurik Long vs IFVG×RSI Long: WR ${dWr >= 0 ? "+" : ""}${dWr}pp, net ${dNet >= 0 ? "+" : ""}${dNet} (trades ${jurikG.trades} vs ${rsiG.trades})`
      );
    }
    if (jurikG && ifvg) {
      const dWr = +(jurikG.wr - ifvg.wr).toFixed(1);
      const dNet = +(jurikG.net - ifvg.net).toFixed(1);
      lines.push(
        `IFVG×Jurik Long vs IFVG alone: WR ${dWr >= 0 ? "+" : ""}${dWr}pp, net ${dNet >= 0 ? "+" : ""}${dNet} (trades ${jurikG.trades} vs ${ifvg.trades})`
      );
    }
    if (smi) lines.push(`Ref SMI Long WR ${smi.wr}% net ${smi.net} trades ${smi.trades}`);
    if (jurikBi)
      lines.push(
        `IFVG×Jurik Bi WR ${jurikBi.wr}% net ${jurikBi.net} trades ${jurikBi.trades}`
      );
  }

  const j4 = pick(rows4h, "ifvgJurikStochLong");
  const s4 = pick(rows4h, "ifvgSmiLong");
  const r4 = pick(rows4h, "ifvgRsiLong");

  lines.push("");
  lines.push("--- 4h playbook TF gate ranking (Long) ---");
  const gates = [
    j4 && { id: "Jurik", ...j4 },
    s4 && { id: "SMI", ...s4 },
    r4 && { id: "RSI", ...r4 },
  ].filter(Boolean) as {
    id: string;
    wr: number;
    net: number;
    trades: number;
  }[];
  gates.sort((a, b) => b.wr - a.wr || b.net - a.net);
  gates.forEach((g, i) =>
    lines.push(
      `${i + 1}. IFVG×${g.id}: WR ${g.wr}% net ${g.net} trades ${g.trades}`
    )
  );

  let verdictLine =
    "VERDICT (4h): inconclusive — need all three gates.";
  if (j4 && s4 && r4) {
    const best = gates[0]?.id ?? "?";
    const jurikVsSmi =
      j4.wr > s4.wr || (j4.wr === s4.wr && j4.net > s4.net)
        ? "beats"
        : j4.wr === s4.wr && j4.net === s4.net
          ? "ties"
          : "trails";
    const jurikVsRsi =
      j4.wr > r4.wr || (j4.wr === r4.wr && j4.net > r4.net)
        ? "beats"
        : j4.wr === r4.wr && j4.net === r4.net
          ? "ties"
          : "trails";
    verdictLine = `VERDICT (4h playbook): Jurik Kase as IFVG gate ${jurikVsSmi} SMI and ${jurikVsRsi} RSI on WR/net. Best gate on 4h: ${best}. Chart stack: IFVG Bölgeler + IFVG×${best === "Jurik" ? "Jurik Kase" : best === "SMI" ? "SMI" : "RSI"}; presets ifvgJurikStochLong / ifvgSmiLong / ifvgRsiLong.`;
  }
  lines.push("");
  lines.push(verdictLine);
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
