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
  bbOsCount = 0,
  lowerXUpCount = 0,
  atLowerCount = 0,
  upperXDnCount = 0,
  atUpperCount = 0;
for (let i = 0; i < candles.length; i++) {
  if (s.lg[i] === 1) lgCount++;
  if (s.signal[i] === 1) signalCount++;
  if (s.buy[i] === 1) buyCount++;
  if (s.bbOs[i] === 1) bbOsCount++;
  if (s.lowerXUp[i] === 1) lowerXUpCount++;
  if (s.atLower[i] === 1) atLowerCount++;
  if (s.upperXDn[i] === 1) upperXDnCount++;
  if (s.atUpper[i] === 1) atUpperCount++;
}
console.log("counts", {
  lgCount,
  signalCount,
  buyCount,
  bbOsCount,
  lowerXUpCount,
  atLowerCount,
  upperXDnCount,
  atUpperCount,
});
assert(lgCount >= 1, "expected at least one LG");
assert(s.lowerXUp.length === candles.length, "len lowerXUp");
assert(s.atLower.length === candles.length, "len atLower");
assert(s.upperXDn.length === candles.length, "len upperXDn");
assert(s.atUpper.length === candles.length, "len atUpper");

const cfg: ListScanConfig = {
  matchMode: "any",
  bbDivLg: {
    enabled: true,
    conds: [
      "lg",
      "div_bb",
      "signal",
      "buy",
      "bb_os",
      "lower_x_up",
      "at_lower",
      "upper_x_dn",
      "at_upper",
    ],
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


/** Synth with a clear close cross-up through BB lower. */
function synthLowerCross(): Candle[] {
  const out: Candle[] = [];
  // Flat warmup → BB mid≈100, lower≈ below; then plunge close under lower; then reclaim.
  for (let i = 0; i < 100; i++) {
    const base = 100 + Math.sin(i / 5) * 0.15;
    out.push({
      time: 1_700_000_000 + i * 3600,
      open: base,
      high: base + 0.2,
      low: base - 0.2,
      close: base + 0.05,
      volume: 1000,
    });
  }
  // plunge: close well below band
  out.push({
    time: 1_700_000_000 + 100 * 3600,
    open: 99.5,
    high: 99.6,
    low: 90,
    close: 91,
    volume: 1000,
  });
  // reclaim: close back above lower (cross up)
  out.push({
    time: 1_700_000_000 + 101 * 3600,
    open: 92,
    high: 100.5,
    low: 91.5,
    close: 100.2,
    volume: 1000,
  });
  for (let i = 102; i < 120; i++) {
    const base = 100 + (i - 102) * 0.05;
    out.push({
      time: 1_700_000_000 + i * 3600,
      open: base,
      high: base + 0.3,
      low: base - 0.2,
      close: base + 0.1,
      volume: 1000,
    });
  }
  return out;
}

{
  const cs = synthLowerCross();
  const sx = bbDivLg(cs, { useTrend: false, useADX: false });
  let x = 0;
  for (let i = 0; i < cs.length; i++) if (sx.lowerXUp[i] === 1) x++;
  console.log("lowerXUp synth count", x);
  const hx = scanSymbol(
    cs,
    {
      matchMode: "any",
      bbDivLg: {
        enabled: true,
        conds: ["lower_x_up", "at_lower"],
        useTrend: false,
        useADX: false,
      },
    },
    40
  );
  console.log(
    "lower cross hits",
    hx.map((h) => `${h.cond}@${h.barsAgo}`)
  );
  assert(
    hx.some((h) => h.cond === "lower_x_up") || x >= 1,
    "expect lower_x_up series or hit"
  );
}


/** Synth with close crossing DOWN through BB upper. */
function synthUpperCross(): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < 100; i++) {
    const base = 100 + Math.sin(i / 5) * 0.15;
    out.push({
      time: 1_700_000_000 + i * 3600,
      open: base,
      high: base + 0.2,
      low: base - 0.2,
      close: base + 0.05,
      volume: 1000,
    });
  }
  // spike above upper
  out.push({
    time: 1_700_000_000 + 100 * 3600,
    open: 100.5,
    high: 110,
    low: 100.4,
    close: 109,
    volume: 1000,
  });
  // cross down through upper
  out.push({
    time: 1_700_000_000 + 101 * 3600,
    open: 108,
    high: 108.5,
    low: 99,
    close: 99.5,
    volume: 1000,
  });
  for (let i = 102; i < 120; i++) {
    const base = 100 - (i - 102) * 0.05;
    out.push({
      time: 1_700_000_000 + i * 3600,
      open: base,
      high: base + 0.2,
      low: base - 0.3,
      close: base - 0.1,
      volume: 1000,
    });
  }
  return out;
}

{
  const cs = synthUpperCross();
  const sx = bbDivLg(cs, { useTrend: false, useADX: false });
  let x = 0;
  let touch = 0;
  for (let i = 0; i < cs.length; i++) {
    if (sx.upperXDn[i] === 1) x++;
    if (sx.atUpper[i] === 1) touch++;
  }
  console.log("upperXDn synth count", x, "atUpper", touch);
  const hx = scanSymbol(
    cs,
    {
      matchMode: "any",
      bbDivLg: {
        enabled: true,
        conds: ["upper_x_dn", "at_upper"],
        useTrend: false,
        useADX: false,
      },
    },
    40
  );
  console.log(
    "upper cross hits",
    hx.map((h) => `${h.cond}@${h.barsAgo}:${h.bias}`)
  );
  assert(
    hx.some((h) => h.cond === "upper_x_dn") || x >= 1,
    "expect upper_x_dn series or hit"
  );
  assert(
    hx.filter((h) => h.cond === "upper_x_dn" || h.cond === "at_upper").every(
      (h) => h.bias === "bear"
    ),
    "upper conds bear bias"
  );
}

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
            conds: ["lg", "div_bb", "signal", "buy", "bb_os", "lower_x_up", "at_lower", "upper_x_dn", "at_upper"],
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
