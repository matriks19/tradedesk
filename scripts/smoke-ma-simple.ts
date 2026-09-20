/**
 * Unit smoke: MA Basit (SMA 20-50-100-200) list scan.
 * Run: npx --yes tsx scripts/smoke-ma-simple.ts
 */
import type { Candle } from "../src/lib/types";
import { maSimple } from "../src/lib/indicators/maSimple";
import {
  scanSymbol,
  alertScanHits,
  type ListScanConfig,
} from "../src/lib/scanner/listScan";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Rising close path → bull stack near end; inject a 20↑50 cross mid-way. */
function synth(): Candle[] {
  const out: Candle[] = [];
  // Warmup flat-ish then steadily rising so SMAs stack bullishly
  for (let i = 0; i < 250; i++) {
    // Early: soft down so later 20 can cross 50; late: strong up for stack
    let base: number;
    if (i < 80) {
      base = 100 - i * 0.15;
    } else if (i < 140) {
      base = 100 - 80 * 0.15 + (i - 80) * 0.05; // slow grind
    } else {
      base = 88 + (i - 140) * 0.55; // strong rally → stack
    }
    out.push({
      time: 1_700_000_000 + i * 3600,
      open: base,
      high: base + 0.8,
      low: base - 0.8,
      close: base + 0.2,
      volume: 1000,
    });
  }
  return out;
}

function main() {
  const cs = synth();
  const s = maSimple(cs);
  assert(s.sma20.length === cs.length, "len sma20");
  assert(s.sma200.length === cs.length, "len sma200");

  let stackN = 0;
  let x2050 = 0;
  let px20 = 0;
  for (let i = 0; i < cs.length; i++) {
    if (s.stack_bull[i] === 1) stackN++;
    if (s.x_20_50[i] === 1) x2050++;
    if (s.price_x_20[i] === 1) px20++;
  }
  assert(stackN > 0, `expected stack_bull hits, got ${stackN}`);
  assert(s.sma20[cs.length - 1] != null, "sma20 ready");
  assert(s.sma200[cs.length - 1] != null, "sma200 ready");

  const last = cs.length - 1;
  const v20 = s.sma20[last]!;
  const v50 = s.sma50[last]!;
  const v100 = s.sma100[last]!;
  const v200 = s.sma200[last]!;
  assert(
    cs[last]!.close > v20 && v20 > v50 && v50 > v100 && v100 > v200,
    "last bar should be bull stack"
  );

  const cfg: ListScanConfig = {
    matchMode: "any",
    maSimple: {
      enabled: true,
      conds: ["stack_bull", "x_20_50", "price_x_20"],
    },
  };
  const hits = scanSymbol(cs, cfg, 5);
  assert(hits.some((h) => h.kind === "maSimple"), "scan hits");
  assert(
    hits.some((h) => h.cond === "stack_bull"),
    "stack_bull hit"
  );

  // State conds must not fire phone alerts
  const alerts = alertScanHits(cs, cfg, 1);
  assert(
    !alerts.some((h) => h.cond === "stack_bull"),
    "stack_bull should be STATE (no alert)"
  );

  // Cross-only cfg can alert
  const cfgX: ListScanConfig = {
    maSimple: { enabled: true, conds: ["x_20_50"] },
  };
  // Place a fresh cross on last bar by mutating a short series
  const short: Candle[] = [];
  for (let i = 0; i < 220; i++) {
    const base = i < 180 ? 100 + i * 0.01 : 100 + 180 * 0.01 - (i - 180) * 0.4;
    short.push({
      time: 1_700_000_000 + i * 3600,
      open: base,
      high: base + 0.5,
      low: base - 0.5,
      close: base,
      volume: 1000,
    });
  }
  // Force 20 below 50 then cross up on last bars
  for (let i = 0; i < 30; i++) {
    const base = 90 - i * 0.3;
    short.push({
      time: 1_700_000_000 + (220 + i) * 3600,
      open: base,
      high: base + 0.4,
      low: base - 0.4,
      close: base - 0.1,
      volume: 1000,
    });
  }
  for (let i = 0; i < 25; i++) {
    const base = 81 + i * 1.2;
    short.push({
      time: 1_700_000_000 + (250 + i) * 3600,
      open: base,
      high: base + 1,
      low: base - 0.5,
      close: base + 0.8,
      volume: 1000,
    });
  }
  const sx = maSimple(short);
  let foundX = false;
  for (let i = 0; i < short.length; i++) {
    if (sx.x_20_50[i] === 1) foundX = true;
  }
  assert(foundX, "synthetic should produce x_20_50");
  const hx = scanSymbol(short, cfgX, 30);
  assert(hx.some((h) => h.cond === "x_20_50"), "scan x_20_50");

  console.log("OK smoke-ma-simple", {
    stackN,
    x2050,
    px20,
    hits: hits.map((h) => `${h.cond}@${h.barsAgo}`),
    alerts: alerts.map((h) => h.cond),
    xHits: hx.map((h) => `${h.cond}@${h.barsAgo}`),
  });
}

main();
