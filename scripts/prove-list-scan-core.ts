/**
 * Prove HAM/MACD/Diag list-scan still hit on live ochre klines after chip UX fix.
 * Run: npx --yes tsx scripts/prove-list-scan-core.ts
 */
import type { Candle } from "../src/lib/types";
import {
  scanSymbol,
  type ListScanConfig,
  DEFAULT_HAM_CONDS,
  DEFAULT_MACD_CONDS,
  DEFAULT_DIAG_CONDS,
} from "../src/lib/scanner/listScan";

const BASE =
  "https://tradedesk-ochre.vercel.app/api/klines";

const SYMS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "BNBUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "DOTUSDT",
  "NEARUSDT",
  "ARBUSDT",
  "OPUSDT",
  "SUIUSDT",
  "INJUSDT",
  "TIAUSDT",
  "WIFUSDT",
  "LTCUSDT",
  "UNIUSDT",
  "ATOMUSDT",
  "FILUSDT",
  "APTUSDT",
  "AAVEUSDT",
  "TONUSDT",
];

async function fetchCandles(symbol: string): Promise<Candle[]> {
  const u = `${BASE}?symbol=${symbol}&exchange=binance&timeframe=15m&limit=220`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${symbol} HTTP ${r.status}`);
  const j = (await r.json()) as { candles?: Candle[] };
  return j.candles ?? [];
}

function cfgHam(): ListScanConfig {
  return {
    matchMode: "any",
    ham: { enabled: true, conds: [...DEFAULT_HAM_CONDS] },
  };
}
function cfgMacd(): ListScanConfig {
  return {
    matchMode: "any",
    macd: { enabled: true, conds: [...DEFAULT_MACD_CONDS] },
  };
}
function cfgDiag(): ListScanConfig {
  return {
    matchMode: "any",
    diag: { enabled: true, conds: [...DEFAULT_DIAG_CONDS] },
  };
}
function cfgEmptyHam(): ListScanConfig {
  return { matchMode: "any", ham: { enabled: true, conds: [] } };
}
function cfgMultiAll(): ListScanConfig {
  return {
    matchMode: "all",
    ham: { enabled: true, conds: [...DEFAULT_HAM_CONDS] },
    macd: { enabled: true, conds: [...DEFAULT_MACD_CONDS] },
    diag: { enabled: true, conds: [...DEFAULT_DIAG_CONDS] },
  };
}
function cfgMultiAny(): ListScanConfig {
  return {
    matchMode: "any",
    ham: { enabled: true, conds: [...DEFAULT_HAM_CONDS] },
    macd: { enabled: true, conds: [...DEFAULT_MACD_CONDS] },
    diag: { enabled: true, conds: [...DEFAULT_DIAG_CONDS] },
  };
}

async function main() {
  const maxBars = 2;
  let hamSym = 0,
    macdSym = 0,
    diagSym = 0,
    emptyBeltSym = 0,
    multiAnySym = 0,
    multiAllSym = 0,
    short = 0,
    fail = 0;
  let hamHits = 0,
    macdHits = 0,
    diagHits = 0;

  for (const s of SYMS) {
    let c: Candle[];
    try {
      c = await fetchCandles(s);
    } catch (e) {
      fail++;
      console.warn("fetch fail", s, e);
      continue;
    }
    if (c.length < 80) {
      short++;
      continue;
    }
    try {
      const h = scanSymbol(c, cfgHam(), maxBars);
      const m = scanSymbol(c, cfgMacd(), maxBars);
      const d = scanSymbol(c, cfgDiag(), maxBars);
      const belt = scanSymbol(c, cfgEmptyHam(), maxBars);
      const any = scanSymbol(c, cfgMultiAny(), maxBars);
      const all = scanSymbol(c, cfgMultiAll(), maxBars);
      if (h.length) {
        hamSym++;
        hamHits += h.length;
      }
      if (m.length) {
        macdSym++;
        macdHits += m.length;
      }
      if (d.length) {
        diagSym++;
        diagHits += d.length;
      }
      if (belt.length) emptyBeltSym++;
      if (any.length) multiAnySym++;
      if (all.length) multiAllSym++;
    } catch (e) {
      fail++;
      console.warn("scan throw", s, e);
    }
  }

  const scanned = SYMS.length - short - fail;
  console.log(
    JSON.stringify(
      {
        symbols: SYMS.length,
        scanned,
        short,
        fail,
        maxBars,
        ham: { hitSymbols: hamSym, hitRows: hamHits },
        macd: { hitSymbols: macdSym, hitRows: macdHits },
        diag: { hitSymbols: diagSym, hitRows: diagHits },
        emptyCondsBelt_ham: { hitSymbols: emptyBeltSym },
        multiKind_any: { hitSymbols: multiAnySym },
        multiKind_all_hepsi: { hitSymbols: multiAllSym },
      },
      null,
      2
    )
  );

  if (scanned < 20) throw new Error(`scanned only ${scanned} (<20)`);
  if (hamSym + macdSym + diagSym < 1) {
    throw new Error("ZERO hits across ham/macd/diag — core scan broken");
  }
  // Belt: empty conds while enabled must not be silent []
  if (emptyBeltSym < 1 && hamSym > 0) {
    throw new Error("empty-conds belt failed (ham hits but empty conds silent)");
  }
  console.log("OK prove-list-scan-core");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
