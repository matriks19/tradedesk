/**
 * Live smoke: MACD multi-TF cross on a few Binance symbols.
 * Run: npx --yes tsx scripts/smoke-macd-scan.ts
 */
import { detectMacdCross } from "../src/lib/scanner/macdScan";
import type { Candle } from "../src/lib/types";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"];
const TFS = ["15m", "1h", "4h"] as const;

async function fetchCandles(symbol: string, tf: string): Promise<Candle[]> {
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=180`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${symbol} ${tf} HTTP ${res.status}`);
  const raw = (await res.json()) as unknown[][];
  return raw.map((k) => ({
    time: Math.floor(Number(k[0]) / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}

async function main() {
  const hits: {
    symbol: string;
    tf: string;
    bias: string;
    barsAgo: number;
    macd: number;
    signal: number;
    hist: number;
    macdZeroCross?: boolean;
  }[] = [];
  for (const symbol of SYMBOLS) {
    for (const tf of TFS) {
      try {
        const candles = await fetchCandles(symbol, tf);
        const hit = detectMacdCross(candles, { maxBarsAgo: 5 });
        if (hit) {
          hits.push({
            symbol,
            tf,
            bias: hit.bias === "bull" ? "AL" : "SAT",
            barsAgo: hit.barsAgo,
            macd: +hit.macd.toPrecision(5),
            signal: +hit.signal.toPrecision(5),
            hist: +hit.hist.toPrecision(5),
            macdZeroCross: hit.macdZeroCross,
          });
        }
      } catch (e) {
        console.error("skip", symbol, tf, e);
      }
    }
  }
  hits.sort((a, b) => a.barsAgo - b.barsAgo || a.symbol.localeCompare(b.symbol));
  console.log(JSON.stringify({ count: hits.length, hits }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
