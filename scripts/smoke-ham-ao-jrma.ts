/** Smoke: HAM+AO JRMA Z edge crosses + PT gates. npx tsx scripts/smoke-ham-ao-jrma.ts */
import type { Candle } from "../src/lib/types";
import {
  crossedAboveAt,
  hamAoJrmaZ,
  lineZeroCrossUp,
} from "../src/lib/indicators/hamAoJrmaZ";
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
assert(!crossedAboveAt([3, 4], [2, 2], 1), "already above not edge");
assert(lineZeroCrossUp([-1, 0.5], 1), "zero up");
assert(!lineZeroCrossUp([0.1, 0.2], 1), "sticky positive no edge");

const candles = synth(260);
const s = hamAoJrmaZ(candles);
assert(s.aoSmooth.length === candles.length, "len ao");
assert(s.rmaSignal.length === candles.length, "len rma");
assert(s.posTrend.length === candles.length, "len pos");

let aoEdges = 0,
  rmaEdges = 0,
  ptEdges = 0,
  ntEdges = 0;
for (let i = 1; i < candles.length; i++) {
  if (s.aoUp[i]) aoEdges++;
  if (s.rmaUp[i]) rmaEdges++;
  if (s.ptXNt[i]) ptEdges++;
  if (s.ntXPt[i]) ntEdges++;
  if (s.pt[i] && s.nt[i]) throw new Error(`pt&&nt at ${i}`);
}
console.log("edges", { aoEdges, rmaEdges, ptEdges, ntEdges });

const cfg: ListScanConfig = {
  matchMode: "any",
  hamAo: {
    enabled: true,
    conds: ["rma_up_pt", "ao_up_pt", "ao_up_nt", "pt_x_nt", "nt_x_pt"],
  },
};
const hits = scanSymbol(candles, cfg, 50);
console.log("hits", hits.map((h) => `${h.cond}@${h.barsAgo}`));
assert(hits.every((h) => h.kind === "hamAo"), "kind");
assert(hits.length < 40, "edge-only should not flood");
console.log("OK smoke-ham-ao-jrma");
