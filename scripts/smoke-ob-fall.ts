/**
 * Unit smoke: Order Block + Düşen Kırılımı list scan.
 * Run: npx --yes tsx scripts/smoke-ob-fall.ts
 */
import type { Candle } from "../src/lib/types";
import { obFall } from "../src/lib/indicators/obFall";
import { computeDescendingBreak } from "../src/lib/indicators/descendingBreak";
import { scanSymbol, type ListScanConfig } from "../src/lib/scanner/listScan";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Flat warmup → two descending pivot highs → breakout; also OB-friendly dips. */
function synthDescBreak(): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < 100; i++) {
    const base = 100;
    out.push({
      time: 1_700_000_000 + i * 3600,
      open: base,
      high: base + 0.5,
      low: base - 0.5,
      close: base + 0.1,
      volume: 1000,
    });
  }
  // pivot high #1 around 120
  for (let i = 0; i < 12; i++) {
    const base = 100 + i * 1.5;
    out.push({
      time: 1_700_000_000 + (100 + i) * 3600,
      open: base,
      high: base + 1,
      low: base - 0.5,
      close: base + 0.5,
      volume: 1000,
    });
  }
  // drop then recover (creates swing low + impulse → bull OB)
  out.push({
    time: 1_700_000_000 + 112 * 3600,
    open: 116,
    high: 116.5,
    low: 108,
    close: 109,
    volume: 2000,
  });
  out.push({
    time: 1_700_000_000 + 113 * 3600,
    open: 109,
    high: 118,
    low: 108.5,
    close: 117,
    volume: 4000,
  });
  // drift down toward second lower high
  for (let i = 0; i < 12; i++) {
    const base = 116 - i * 0.8;
    out.push({
      time: 1_700_000_000 + (114 + i) * 3600,
      open: base,
      high: base + 0.6,
      low: base - 0.6,
      close: base - 0.2,
      volume: 1000,
    });
  }
  // pivot high #2 lower than #1, then breakout
  out.push({
    time: 1_700_000_000 + 126 * 3600,
    open: 106,
    high: 112,
    low: 105.5,
    close: 111,
    volume: 1500,
  });
  for (let i = 0; i < 8; i++) {
    const base = 110 - i * 0.4;
    out.push({
      time: 1_700_000_000 + (127 + i) * 3600,
      open: base,
      high: base + 0.4,
      low: base - 0.4,
      close: base,
      volume: 1000,
    });
  }
  // close crosses above descending resistance
  out.push({
    time: 1_700_000_000 + 135 * 3600,
    open: 107,
    high: 120,
    low: 106.5,
    close: 119,
    volume: 5000,
  });
  // revisit OB zone (tap)
  out.push({
    time: 1_700_000_000 + 136 * 3600,
    open: 118,
    high: 118.5,
    low: 108.2,
    close: 110,
    volume: 2000,
  });
  return out;
}

{
  const cs = synthDescBreak();
  assert(cs.length >= 100, "synth length");
  const s = obFall(cs, { pivotLookback: 5, swing: 2, comboBars: 8 });
  assert(s.obBull.length === cs.length, "len obBull");
  assert(s.fallBreak.length === cs.length, "len fallBreak");
  assert(s.obFall.length === cs.length, "len obFall");

  let fb = 0,
    ob = 0,
    combo = 0,
    bear = 0;
  for (let i = 0; i < cs.length; i++) {
    if (s.fallBreak[i] === 1) fb++;
    if (s.obBull[i] === 1) ob++;
    if (s.obFall[i] === 1) combo++;
    if (s.obBear[i] === 1) bear++;
  }
  console.log("synth counts", { fb, ob, combo, bear });

  const db = computeDescendingBreak(cs, { lookback: 5, srBoxes: false });
  let dbBreak = 0;
  for (let i = 0; i < cs.length; i++) if (db.breakOut[i] === 1) dbBreak++;
  console.log("raw descendingBreak count", dbBreak);
  assert(dbBreak >= 1 || fb >= 1, "expect at least one fall break on synth or raw");

  const cfg: ListScanConfig = {
    matchMode: "any",
    obFall: {
      enabled: true,
      conds: ["ob_bull", "fall_break", "ob_fall", "ob_bear"],
      pivotLookback: 5,
      swing: 2,
      comboBars: 8,
    },
  };
  const hits = scanSymbol(cs, cfg, 40);
  console.log(
    "hits",
    hits.map((h) => `${h.cond}@${h.barsAgo}:${h.bias}`)
  );
  assert(hits.every((h) => h.kind === "obFall"), "kind obFall");
}

async function liveSmoke() {
  const syms = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
  for (const sym of syms) {
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=220`;
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
          obFall: {
            enabled: true,
            conds: ["ob_bull", "fall_break", "ob_fall", "ob_bear"],
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
  .then(() => console.log("OK smoke-ob-fall"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
