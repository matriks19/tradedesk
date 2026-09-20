/**
 * Unit smoke: Multi-Dip + BB (+ S/R + majör düşen kırılım) list scan.
 * Run: npx --yes tsx scripts/smoke-multi-dip-bb.ts
 */
import type { Candle } from "../src/lib/types";
import { multiDipBb } from "../src/lib/indicators/multiDipBb";
import { computeBuiltin } from "../src/lib/indicators/registry";
import type { IndicatorInstance } from "../src/lib/types";
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
assert(s.dipSr.length === candles.length, "len dipSr");
assert(s.dipBbSr.length === candles.length, "len dipBbSr");
assert(s.majResBreak.length === candles.length, "len majResBreak");
assert(s.dipBbBreak.length === candles.length, "len dipBbBreak");
assert(s.majResTrend.length === candles.length, "len majResTrend");
assert(Array.isArray(s.linesSup), "linesSup array");
assert(Array.isArray(s.linesRes), "linesRes array");
assert(Array.isArray(s.flatSupports), "flatSupports array");

let doubles = 0,
  triples = 0,
  both = 0,
  dipSrN = 0,
  dipBbSrN = 0,
  majBreakN = 0,
  dipBbBreakN = 0;
for (let i = 0; i < candles.length; i++) {
  if (s.doubleDip[i] === 1) doubles++;
  if (s.tripleDip[i] === 1) triples++;
  if (s.doubleDip[i] === 1 && s.tripleDip[i] === 1) both++;
  if (s.dipSr[i] === 1) dipSrN++;
  if (s.dipBbSr[i] === 1) dipBbSrN++;
  if (s.majResBreak[i] === 1) majBreakN++;
  if (s.dipBbBreak[i] === 1) dipBbBreakN++;
}
console.log("signals", {
  doubles,
  triples,
  both,
  dipSrN,
  dipBbSrN,
  majBreakN,
  dipBbBreakN,
});
assert(both === 0, "triple must exclude double on same bar");
// dip_bb_sr implies structural BB hit on that bar
for (let i = 0; i < candles.length; i++) {
  if (s.dipBbSr[i] === 1) {
    assert(
      s.anyDip[i] === 1,
      `dipBbSr@${i} requires anyDip`
    );
  }
  if (s.dipBbBreak[i] === 1) {
    assert(
      s.majResBreak[i] === 1,
      `dipBbBreak@${i} requires majResBreak`
    );
  }
}

const cfg: ListScanConfig = {
  matchMode: "any",
  multiDip: {
    enabled: true,
    conds: [
      "double_dip_bb",
      "triple_dip_bb",
      "any_dip_bb",
      "dip_sr",
      "dip_bb_sr",
      "maj_res_break",
      "dip_bb_break",
    ],
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
    [
      "double_dip_bb",
      "triple_dip_bb",
      "any_dip_bb",
      "dip_sr",
      "dip_bb_sr",
      "maj_res_break",
      "dip_bb_break",
    ].includes(h.cond)
  ),
  "known conds"
);

// Registry plotSeries must include S/R line segments (sup*/flatSup*)
const inst: IndicatorInstance = {
  id: "test-md",
  type: "multiDipBb",
  name: "Çoklu Dip + BB",
  visible: true,
  params: { showMarkers: 1, showSr: 1 },
};
const plots = computeBuiltin(inst, candles);
const keys = plots.map((p) => p.seriesKey ?? p.id);
console.log("plot keys sample", keys.slice(0, 24), "total", keys.length);
assert(
  keys.some((k) => k.includes("lowerBB") || k.includes("BB")),
  "has BB plot"
);
if (s.flatSupports.length > 0) {
  assert(
    keys.some((k) => k.includes("flatSup")),
    "flatSup segments in computeBuiltin"
  );
}
if (s.linesSup.length > 0) {
  assert(
    keys.some((k) => k.includes("sup")),
    "diagonal sup segments in computeBuiltin"
  );
}
assert(Array.isArray(s.supportLine), "supportLine array");
assert(Array.isArray(s.resistanceLine), "resistanceLine array");
assert(
  keys.some((k) => k === "support" || k.includes("sup") || k.includes("flatSup")),
  "S/R plot keys present when showSr=1"
);
const valued = (key: string) => {
  const pl = plots.find((x) => (x.seriesKey ?? "") === key || x.id.endsWith("-" + key));
  if (!pl) return 0;
  return pl.data.filter((pt) => "value" in pt && (pt as { value?: number }).value != null).length;
};
console.log("sr segments", {
  linesSup: s.linesSup.length,
  linesRes: s.linesRes.length,
  flatSupports: s.flatSupports.length,
  supportLinePts: s.supportLine.filter((v) => v != null).length,
  plotSr: keys.filter(
    (k) =>
      k === "support" ||
      k === "resistance" ||
      k.includes("sup") ||
      k.includes("res") ||
      k.includes("flatSup")
  ),
  valuedSupport: valued("support"),
  valuedFlat0: valued("flatSup0"),
});
// With enough bars, chart must expose at least one visible S/R series
assert(
  valued("support") > 0 ||
    valued("flatSup0") > 0 ||
    valued("sup0") > 0 ||
    s.flatSupports.length + s.linesSup.length > 0,
  "expected visible S/R data for chart"
);

// Live-ish: try a few symbols if API available
// Synthetic major descending-resistance break (price stays under line, then crosses)
function synthMajBreak(n: number): Candle[] {
  const out: Candle[] = [];
  // Line: (40,120)→(80,112) slope -0.2; keep closes well below until breakout bar
  for (let i = 0; i < n; i++) {
    let high = 100;
    let low = 95;
    let open = 97;
    let close = 98;
    let vol = 1000;
    if (i === 40) {
      high = 120;
      low = 100;
      open = 105;
      close = 108;
    } else if (i === 80) {
      high = 112;
      low = 98;
      open = 104;
      close = 106;
    } else if (i >= 100 && i < n - 2) {
      // Under projected line (~96 at i=158); stay ~90
      high = 92;
      low = 88;
      open = 89;
      close = 90;
      if (i === n - 6) {
        // dip anchor near break
        low = 85;
        open = 86;
        close = 87.5;
        high = 88;
        vol = 9000;
      }
    } else if (i === n - 2) {
      // Cross above prior trend (~96.4)
      high = 105;
      low = 91;
      open = 92;
      close = 102;
      vol = 12000;
    } else if (i > 40 && i < 80) {
      high = 108;
      low = 100;
      open = 103;
      close = 104;
    } else if (i > 80 && i < 100) {
      high = 106;
      low = 99;
      open = 102;
      close = 103;
    }
    out.push({
      time: 1_700_000_000 + i * 3600,
      open,
      high,
      low,
      close,
      volume: vol,
    });
  }
  return out;
}

{
  const mb = synthMajBreak(160);
  const r = multiDipBb(mb, { majBreakLookback: 20, breakComboBars: 12 });
  const breaks = r.majResBreak.filter((v) => v === 1).length;
  const combo = r.dipBbBreak.filter((v) => v === 1).length;
  console.log("majBreak synth", {
    breaks,
    combo,
    trendPts: r.majResTrend.filter((v) => v != null).length,
  });
  assert(breaks >= 1, "expected ≥1 maj_res_break on synth");
  // S/R arrays still present (no regress of PR #34 structure)
  assert(Array.isArray(r.linesSup), "maj: linesSup");
  assert(Array.isArray(r.linesRes), "maj: linesRes");
  assert(Array.isArray(r.flatSupports), "maj: flatSupports");
  assert(Array.isArray(r.supportLine), "maj: supportLine");
  assert(Array.isArray(r.resistanceLine), "maj: resistanceLine");
  const inst2: IndicatorInstance = {
    id: "maj-md",
    type: "multiDipBb",
    name: "Çoklu Dip + BB",
    visible: true,
    params: { showSr: 1, showMarkers: 1 },
  };
  const plots2 = computeBuiltin(inst2, mb);
  const srKeys2 = plots2
    .map((p) => p.seriesKey ?? p.id)
    .filter(
      (k) =>
        k === "support" ||
        k === "resistance" ||
        k.includes("sup") ||
        k.includes("res") ||
        k.includes("flatSup")
    );
  assert(srKeys2.length > 0 || r.linesSup.length + r.flatSupports.length === 0, "showSr still plots");
  const cfgMaj: ListScanConfig = {
    matchMode: "any",
    multiDip: {
      enabled: true,
      conds: ["maj_res_break", "dip_bb_break"],
      tf: "1h",
    },
  };
  const majHits = scanSymbol(mb, cfgMaj, 20);
  assert(
    majHits.some((h) => h.cond === "maj_res_break"),
    "scan hits maj_res_break"
  );
  console.log(
    "majHits",
    majHits.map((h) => `${h.cond}@${h.barsAgo}`)
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
      const h = scanSymbol(cs, cfg, 30);
      const md = multiDipBb(cs);
      const liveInst: IndicatorInstance = {
        id: "live-md",
        type: "multiDipBb",
        name: "Çoklu Dip + BB",
        visible: true,
        params: { showSr: 1, showMarkers: 1 },
      };
      const livePlots = computeBuiltin(liveInst, cs);
      const srKeys = livePlots
        .map((p) => p.seriesKey ?? p.id)
        .filter(
          (k) =>
            k.includes("sup") ||
            k.includes("res") ||
            k.includes("flatSup")
        );
      console.log(
        sym,
        "hits",
        h.map((x) => `${x.cond}@${x.barsAgo}`),
        "srPlots",
        srKeys.length,
        "linesSup",
        md.linesSup.length,
        "flat",
        md.flatSupports.length
      );
      assert(srKeys.length > 0 || md.linesSup.length + md.flatSupports.length === 0, "live S/R plots");
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
