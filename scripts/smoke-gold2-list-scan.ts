/** Smoke: Gold2 KEKO GOLD edges. npx tsx scripts/smoke-gold2-list-scan.ts */
import type { Candle } from "../src/lib/types";
import {
  goldKeko,
  jurikLike,
  softsign,
  atanSigned100,
  crossedAboveAt,
  crossedBelowAt,
  GOLD_KEKO_MIN_BARS,
} from "../src/lib/indicators/goldKeko";
import { scanSymbol, type ListScanConfig } from "../src/lib/scanner/listScan";

function synth(n: number): Candle[] {
  const out: Candle[] = [];
  let px = 100;
  for (let i = 0; i < n; i++) {
    const wave = Math.sin(i / 11) * 4 + Math.sin(i / 29) * 2;
    // squeeze / expansion phases for tank charging
    const squeeze = Math.sin(i / 37) > 0.4 ? 0.3 : 1.0;
    px = Math.max(1, px + wave * 0.15 * squeeze + (i % 47 === 0 ? 1.2 : 0));
    const span = px * 0.004 * (squeeze < 1 ? 0.4 : 1.2);
    out.push({
      time: 1_700_000_000 + i * 3600,
      open: px,
      high: px + span,
      low: px - span,
      close: px + wave * 0.02,
      volume: 1000 + (i % 20) * 50 + Math.abs(wave) * 80,
    });
  }
  return out;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(softsign(0) === 0, "softsign 0");
assert(Math.abs(softsign(1) - 0.5) < 1e-9, "softsign 1");
assert(!crossedAboveAt([1, 2], [2, 3], 0), "cross needs i>=1");
assert(crossedAboveAt([1, 3], [2, 2], 1), "cross up");
assert(crossedBelowAt([3, 1], [2, 2], 1), "cross down");

const j = jurikLike([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3);
assert(j.length === 10, "jurikLike len");
assert(j.some((v) => v != null), "jurikLike values");

const an = atanSigned100([0, 1, -1, 2, -2, 0, 0.5, 1, -0.5], 3);
assert(
  an.some((v) => v != null && v > -60 && v < 60),
  "atanSigned ~ mid"
);

const candles = synth(Math.max(GOLD_KEKO_MIN_BARS + 80, 320));
const s = goldKeko(candles);
assert(s.oscMain.length === candles.length, "len oscMain");
assert(s.oscDisplay.length === candles.length, "len oscDisplay");
assert(s.kineticSignal.length === candles.length, "len signal");
assert(s.energyTank.some((v) => v != null), "tank has values");

let rawAl = 0,
  rawSat = 0,
  coreAl = 0,
  coreSat = 0,
  dispAl = 0,
  dispSat = 0,
  brk = 0,
  charge = 0,
  polar = 0;
for (let i = 1; i < candles.length; i++) {
  if (s.rawXRmaAl[i]) rawAl++;
  if (s.rawXRmaSat[i]) rawSat++;
  if (s.coreXRmaAl[i]) coreAl++;
  if (s.coreXRmaSat[i]) coreSat++;
  if (s.dispXRmaAl[i]) dispAl++;
  if (s.dispXRmaSat[i]) dispSat++;
  if (
    s.breakoutUpAligned[i] ||
    s.breakoutDownAligned[i] ||
    s.breakoutUpCounter[i] ||
    s.breakoutDownCounter[i]
  )
    brk++;
  if (s.chargeFullBull[i] || s.chargeFullBear[i]) charge++;
  if (s.polarityFlipUp[i] || s.polarityFlipDown[i]) polar++;
}
console.log("edges", {
  rawAl,
  rawSat,
  coreAl,
  coreSat,
  dispAl,
  dispSat,
  brk,
  charge,
  polar,
});
assert(rawAl + rawSat + coreAl + coreSat + dispAl + dispSat > 0, "some cross edges");

const cfg: ListScanConfig = {
  matchMode: "any",
  gold2: {
    enabled: true,
    conds: [
      "raw_x_rma_al",
      "raw_x_rma_sat",
      "core_x_rma_al",
      "core_x_rma_sat",
      "disp_x_rma_al",
      "disp_x_rma_sat",
      "breakout_up_aligned",
      "breakout_down_aligned",
      "breakout_up_counter",
      "breakout_down_counter",
      "charge_full_bull",
      "charge_full_bear",
      "polarity_flip_up",
      "polarity_flip_down",
    ],
  },
};
const hits = scanSymbol(candles, cfg, 80);
console.log(
  "hits",
  hits.map((h) => `${h.cond}@${h.barsAgo}`)
);
assert(hits.every((h) => h.kind === "gold2"), "kind gold2");
assert(hits.length < 80, "edge-only should not flood");
assert(hits.length > 0, "expect some hits in 80-bar lookback");

// Gold empty fix regression: with floor 40, gold should find edges on same synth
const goldHits = scanSymbol(
  candles,
  {
    matchMode: "any",
    gold: {
      enabled: true,
      conds: [
        "ao_x_score_al",
        "ao_x_rma_al",
        "ao_x_score_sat",
        "ao_x_rma_sat",
        "pt_x_nt",
        "nt_x_pt",
      ],
    },
  },
  40
);
console.log(
  "gold@40",
  goldHits.map((h) => `${h.cond}@${h.barsAgo}`)
);

console.log("OK smoke-gold2-list-scan");
