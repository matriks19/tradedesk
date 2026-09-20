/**
 * Unit smoke: Multi-Dip + BB list scan.
 * Run: npx --yes tsx scripts/smoke-multi-dip-bb.ts
 */
import type { Candle } from "../src/lib/types";
import { multiDipBb } from "../src/lib/indicators/multiDipBb";
import { scanSymbol, type ListScanConfig } from "../src/lib/scanner/listScan";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

/** Flat-ish series with three confirmed swing lows at similar prices. */
function synthDips(n: number): Candle[] {
  const out: Candle[] = [];
  const dipAt = new Set([n - 45, n - 28, n - 11]); // spaced within min/max
  for (let i = 0; i < n; i++) {
    const base = 100 - i * 0.02;
    const isDip = dipAt.has(i);
    const low = isDip ? base - 3.2 : base - 0.25;
    const open = isDip ? low + 0.4 : base;
    const close = isDip ? low + 1.2 : base + 0.15; // bullish on dip bar
    const high = Math.max(open, close) + 0.3;
    out.push({
      time: 1_700_000_000 + i * 3600,
      open,
      high,
      low,
      close,
      volume: isDip ? 8000 : 1000,
    });
  }
  return out;
}

const candles = synthDips(200);
const s = multiDipBb(candles);
assert(s.lowerBB.length === candles.length, "len lowerBB");
assert(s.captureZone.length === candles.length, "len zone");
assert(s.doubleDip.length === candles.length, "len double");
assert(s.tripleDip.length === candles.length, "len triple");

let doubles = 0,
  triples = 0,
  both = 0;
for (let i = 0; i < candles.length; i++) {
  if (s.doubleDip[i] === 1) doubles++;
  if (s.tripleDip[i] === 1) triples++;
  if (s.doubleDip[i] === 1 && s.tripleDip[i] === 1) both++;
}
console.log("signals", { doubles, triples, both });
assert(both === 0, "triple must exclude double on same bar");

const cfg: ListScanConfig = {
  matchMode: "any",
  multiDip: {
    enabled: true,
    conds: ["double_dip_bb", "triple_dip_bb", "any_dip_bb"],
    tf: "1h",
  },
};
const hits = scanSymbol(candles, cfg, 80);
console.log(
  "hits",
  hits.map((h) => `${h.cond}@${h.barsAgo}`)
);
assert(hits.every((h) => h.kind === "multiDip"), "kind multiDip");
assert(
  hits.every((h) =>
    ["double_dip_bb", "triple_dip_bb", "any_dip_bb"].includes(h.cond)
  ),
  "known conds"
);

// Live-ish: try a few symbols if API available
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
      const h = scanSymbol(cs, cfg, 30);
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
  .then(() => console.log("OK smoke-multi-dip-bb"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
