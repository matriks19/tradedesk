/**
 * Live smoke: Uyumsuzluk (divScan) with LIST_SCAN_DIV_OPTS research pack.
 * Asserts BTC+ETH 15m yield ≥1 hit at maxBars=50 (after rangeLower fix).
 * Run: npx --yes tsx scripts/smoke-div-scan.ts
 */
import { scanSymbol, type ListScanConfig } from "../src/lib/scanner/listScan";
import {
  computeOscDivergence,
  LIST_SCAN_DIV_OPTS,
} from "../src/lib/indicators/oscDivergence";
import { rsi, closes } from "../src/lib/indicators/math";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function fetchKl(sym: string, tf = "15m", limit = 220) {
  const u = `https://tradedesk-ochre.vercel.app/api/klines?symbol=${encodeURIComponent(sym)}&exchange=binance&timeframe=${tf}&limit=${limit}`;
  const r = await fetch(u);
  const j = await r.json();
  if (!j.candles?.length)
    throw new Error("no candles " + sym + " " + JSON.stringify(j).slice(0, 120));
  return j.candles;
}

async function main() {
  assert(LIST_SCAN_DIV_OPTS.rangeLower === 5, "rangeLower research default 5");
  assert(LIST_SCAN_DIV_OPTS.rangeUpper === 60, "rangeUpper research default 60");
  assert(LIST_SCAN_DIV_OPTS.lbR === 3, "lbR research default 3");
  assert(LIST_SCAN_DIV_OPTS.lbL === 5, "lbL research default 5");

  const cfg: ListScanConfig = {
    matchMode: "any",
    divScan: {
      enabled: true,
      oscillators: ["rsi", "mfi", "cci", "roc"],
      types: ["reg_bull", "reg_bear", "hid_bull", "hid_bear"],
    },
  };

  // Primary assert: BTC + ETH 15m @ maxBars=50 → ≥1 hit
  let pairHits = 0;
  const pairNotes: string[] = [];
  for (const s of ["BTCUSDT", "ETHUSDT"]) {
    const candles = await fetchKl(s);
    const h = scanSymbol(candles, cfg, 50);
    pairHits += h.length;
    if (h.length)
      pairNotes.push(
        s + ":" + h.map((x) => `${x.cond}@${x.barsAgo}`).join(",")
      );
  }
  console.log("BTC+ETH maxBars=50 hits", pairHits);
  if (pairNotes.length) console.log("  ", pairNotes.join(" | "));
  assert(pairHits >= 1, "BTC+ETH 15m maxBars=50 should get ≥1 divScan hit");

  // Broader sample (informational)
  const syms = [
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "XRPUSDT",
    "DOGEUSDT",
    "BNBUSDT",
    "ADAUSDT",
    "AVAXUSDT",
    "LINKUSDT",
    "NEARUSDT",
    "SUIUSDT",
    "APTUSDT",
    "INJUSDT",
    "WIFUSDT",
    "ONDOUSDT",
  ];
  let hits50 = 0;
  for (const s of syms) {
    const h = scanSymbol(await fetchKl(s), cfg, 50);
    hits50 += h.length;
  }
  console.log("15 symbols maxBars=50 hits", hits50);

  const btc = await fetchKl("BTCUSDT");
  const series = rsi(closes(btc), 14);
  const count = (a: (number | null)[]) => a.filter((x) => x != null).length;
  const div = computeOscDivergence(btc, series, LIST_SCAN_DIV_OPTS);
  const markers =
    count(div.bull) +
    count(div.bear) +
    count(div.hiddenBull) +
    count(div.hiddenBear);
  console.log(
    "BTC RSI markers regB/R hidB/R",
    count(div.bull),
    count(div.bear),
    count(div.hiddenBull),
    count(div.hiddenBear)
  );
  assert(markers >= 1, "BTC RSI should have ≥1 divergence marker with research opts");

  console.log("OK smoke-div-scan");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
