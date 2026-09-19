/** Smoke: Gold AOHAM JRMA display crosses. npx tsx scripts/smoke-gold-list-scan.ts */
import type { Candle } from "../src/lib/types";
import {
  aohamJrmaEngine,
  crossedAboveAt,
  crossedBelowAt,
  jurik,
  minmax01,
  atanNormalize100,
} from "../src/lib/indicators/aohamJrmaEngine";
import { scanSymbol, type ListScanConfig } from "../src/lib/scanner/listScan";

function synth(n: number): Candle[] {
  const out: Candle[] = [];
  let px = 100;
  for (let i = 0; i < n; i++) {
    const wave = Math.sin(i / 11) * 4 + Math.sin(i / 29) * 2;
    px = Math.max(1, px + wave * 0.15 + (i % 47 === 0 ? 1.2 : 0));
    out.push({
      time: 1_700_000_000 + i * 3600,
      open: px,
      high: px * 1.004,
      low: px * 0.996,
      close: px + wave * 0.02,
      volume: 1000 + (i % 20) * 50 + Math.abs(wave) * 80,
    });
  }
  return out;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(!crossedAboveAt([1, 2], [2, 3], 0), "cross needs i>=1");
assert(crossedAboveAt([1, 3], [2, 2], 1), "cross up");
assert(crossedBelowAt([3, 1], [2, 2], 1), "cross down");
assert(!crossedAboveAt([3, 4], [2, 2], 1), "already above not edge");

const j = jurik([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, 0, 2);
assert(j.length === 10, "jurik len");
assert(j.some((v) => v != null), "jurik produces values");

const mm = minmax01([1, 2, 3, 4, 5], 3);
assert(mm[4] === 1, "minmax hi=1");
assert(mm[2] != null && (mm[2] as number) >= 0, "minmax >=0");

const an = atanNormalize100([0, 1, -1, 2, -2, 0, 0.5], 3);
assert(an.some((v) => v != null && v > 40 && v < 60), "atan ~ mid");

const candles = synth(280);
const s = aohamJrmaEngine(candles);
assert(s.aoPlot.length === candles.length, "len aoPlot");
assert(s.rawSigPlot.length === candles.length, "len rawSig");
assert(s.scoreLongPlot.length === candles.length, "len score");

let alScore = 0,
  alRma = 0,
  satScore = 0,
  satRma = 0,
  pt = 0,
  nt = 0;
for (let i = 1; i < candles.length; i++) {
  if (s.aoXScoreAl[i]) alScore++;
  if (s.aoXRmaAl[i]) alRma++;
  if (s.aoXScoreSat[i]) satScore++;
  if (s.aoXRmaSat[i]) satRma++;
  if (s.ptXNt[i]) pt++;
  if (s.ntXPt[i]) nt++;
}
console.log("edges", { alScore, alRma, satScore, satRma, pt, nt });

const cfg: ListScanConfig = {
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
};
const hits = scanSymbol(candles, cfg, 80);
console.log(
  "hits",
  hits.map((h) => `${h.cond}@${h.barsAgo}`)
);
assert(hits.every((h) => h.kind === "gold"), "kind gold");
assert(hits.length < 50, "edge-only should not flood");
console.log("OK smoke-gold-list-scan");
