/**
 * Crypto10 bakeoff: IFVG gates on LTF — 15m, 30m, 1h (Binance interval 1h = 60dk).
 * Same presets as compare-ifvg-jurik. Signal-exit. Warmup from recommendedWarmup.
 * Run: npx --yes tsx scripts/compare-ifvg-ltf.ts
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

const TFS = ["15m", "30m", "1h"] as const;
type Ltf = (typeof TFS)[number];

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

async function fetchCandles(symbol: string, timeframe: Ltf): Promise<Candle[]> {
  const url = `http://127.0.0.1:3000/api/klines?symbol=${symbol}&exchange=binance&timeframe=${timeframe}&limit=1000`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.candles?.length) return json.candles;
  } catch {
    /* fall through to Binance */
  }
  const burl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=1000`;
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

function runOne(candles: Candle[], preset: StrategyPresetId, timeframe: Ltf) {
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
  };
}

type Row = {
  tf: Ltf;
  preset: StrategyPresetId;
  label: string;
  trades: number;
  net: number;
  wr: number;
};

async function runTf(timeframe: Ltf): Promise<Row[]> {
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
  console.table(
    rows.map((r) => ({
      preset: r.preset,
      trades: r.trades,
      net: r.net,
      "WR%": r.wr,
    }))
  );
  return rows;
}

function gateRank(rows: Row[], tf: Ltf): string[] {
  const pick = (id: string) => rows.find((r) => r.preset === id);
  const ifvg = pick("ifvgLong");
  const rsiG = pick("ifvgRsiLong");
  const smiG = pick("ifvgSmiLong");
  const jurikG = pick("ifvgJurikStochLong");
  const jurikBi = pick("ifvgJurikStochBi");
  const smi = pick("smiLongOnly");

  const lines: string[] = [`--- ${tf} ---`];
  const gates = [
    jurikG && { id: "Jurik", ...jurikG },
    smiG && { id: "SMI", ...smiG },
    rsiG && { id: "RSI", ...rsiG },
  ].filter(Boolean) as { id: string; wr: number; net: number; trades: number }[];
  gates.sort((a, b) => b.wr - a.wr || b.net - a.net);
  gates.forEach((g, i) =>
    lines.push(
      `${i + 1}. IFVG×${g.id}: WR ${g.wr}% net ${g.net} trades ${g.trades}`
    )
  );
  if (ifvg)
    lines.push(`IFVG alone: WR ${ifvg.wr}% net ${ifvg.net} trades ${ifvg.trades}`);
  if (smi)
    lines.push(`Ref SMI Long: WR ${smi.wr}% net ${smi.net} trades ${smi.trades}`);
  if (jurikBi)
    lines.push(
      `IFVG×Jurik Bi: WR ${jurikBi.wr}% net ${jurikBi.net} trades ${jurikBi.trades}`
    );
  const best = gates[0]?.id ?? "?";
  lines.push(`WINNER ${tf}: IFVG×${best}`);
  return lines;
}

async function main() {
  const byTf: Record<string, Row[]> = {};
  const verdictLines: string[] = [];

  for (const tf of TFS) {
    const rows = await runTf(tf);
    byTf[tf] = rows;
    verdictLines.push(...gateRank(rows, tf), "");
  }

  const winners = TFS.map((tf) => {
    const rows = byTf[tf];
    const gates = (
      ["ifvgJurikStochLong", "ifvgSmiLong", "ifvgRsiLong"] as const
    )
      .map((id) => {
        const r = rows.find((x) => x.preset === id);
        const label =
          id === "ifvgJurikStochLong"
            ? "Jurik"
            : id === "ifvgSmiLong"
              ? "SMI"
              : "RSI";
        return r ? { id: label, wr: r.wr, net: r.net, trades: r.trades } : null;
      })
      .filter(Boolean) as { id: string; wr: number; net: number; trades: number }[];
    gates.sort((a, b) => b.wr - a.wr || b.net - a.net);
    return { tf, best: gates[0]?.id ?? "?", gates };
  });

  const summary =
    `VERDICT (LTF): ` +
    winners
      .map((w) => `${w.tf}→IFVG×${w.best}`)
      .join("; ") +
    `. Chart stack per TF: IFVG Bölgeler + winning gate preset.`;

  verdictLines.push(summary);
  console.log("\n=== Verdict ===\n" + verdictLines.join("\n"));

  console.log(
    JSON.stringify(
      {
        "15m": byTf["15m"],
        "30m": byTf["30m"],
        "1h": byTf["1h"],
        winners: winners.map((w) => ({
          tf: w.tf,
          best: w.best,
          ranking: w.gates.map((g) => ({
            gate: g.id,
            wr: g.wr,
            net: g.net,
            trades: g.trades,
          })),
        })),
        verdict: summary,
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
