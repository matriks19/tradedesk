/**
 * Unit smoke: BB+RSI Div + Liquidity Grab list scan.
 * Run: npx --yes tsx scripts/smoke-bb-div-lg.ts
 */
import type { Candle } from "../src/lib/types";
import { bbDivLg } from "../src/lib/indicators/bbDivLg";
import { scanSymbol, type ListScanConfig } from "../src/lib/scanner/listScan";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Synth: mostly uptrend with a few LG-like wick bars near lower BB. */
function synth(n: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    // gentle uptrend so EMA50 < close for later bars
    const base = 90 + i * 0.08;
    const isLg = i === n - 3 || i === n - 8;
    const open = base;
    const close = isLg ? base + 0.4 : base + 0.2;
    const high = Math.max(open, close) + 0.3;
    // long lower wick piercing prior swing
    const low = isLg ? base - 4.5 : base - 0.35;
    out.push({
      time: 1_700_000_000 + i * 3600,
      open,
      high,
      low,
      close,
      volume: isLg ? 9000 : 1200,
    });
  }
  return out;
}

const candles = synth(200);
const s = bbDivLg(candles, { useTrend: false, useADX: false });
assert(s.lowerBB.length === candles.length, "len lowerBB");
assert(s.lg.length === candles.length, "len lg");
assert(s.buy.length === candles.length, "len buy");

let lgCount = 0,
  signalCount = 0,
  buyCount = 0,
  bbOsCount = 0;
for (let i = 0; i < candles.length; i++) {
  if (s.lg[i] === 1) lgCount++;
  if (s.signal[i] === 1) signalCount++;
  if (s.buy[i] === 1) buyCount++;
  if (s.bbOs[i] === 1) bbOsCount++;
}
console.log("counts", { lgCount, signalCount, buyCount, bbOsCount });
assert(lgCount >= 1, "expected at least one LG");

const cfg: ListScanConfig = {
  matchMode: "any",
  bbDivLg: {
    enabled: true,
    conds: ["lg", "div_bb", "signal", "buy", "bb_os"],
    useTrend: false,
    useADX: false,
  },
};
const hits = scanSymbol(candles, cfg, 20);
console.log(
  "hits",
  hits.map((h) => `${h.cond}@${h.barsAgo}`)
);
assert(hits.every((h) => h.kind === "bbDivLg"), "kind bbDivLg");
assert(
  hits.some((h) => h.cond === "lg"),
  "expect lg hit"
);

async function liveSmoke() {
  const syms = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  for (const sym of syms) {
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=180`;
      const r = await fetch(url);
      if (!r.ok) {
        console.log("skip live", sym, r.status);
        continue;
      }
      const raw = (await r.json()) as number[][];
      const cs: Candle[] = raw.map((k) => ({
        time: Math.floor(Number(k[0]) / 1000),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5]),
      }));
      const h = scanSymbol(
        cs,
        {
          matchMode: "any",
          bbDivLg: {
            enabled: true,
            conds: ["lg", "div_bb", "signal", "buy", "bb_os"],
            useTrend: true,
            useADX: true,
          },
        },
        30
      );
      console.log(
        sym,
        "hits",
        h.map((x) => `${x.cond}@${x.barsAgo}`)
      );
    } catch (e) {
      console.log("live err", sym, e instanceof Error ? e.message : e);
    }
  }
}

liveSmoke()
  .then(() => console.log("OK smoke-bb-div-lg"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
