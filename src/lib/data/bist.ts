import type { Candle, SymbolInfo, TickerQuote } from "@/lib/types";
import { aggregateCandles, yahooParamsForTimeframe } from "@/lib/data/timeframes";
import { BIST_EXTRA } from "@/lib/data/bistUniverse";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

/** Full-ish BIST ticker universe (~650). Yahoo uses .IS suffix. */
export const BIST_TICKERS: { symbol: string; name: string }[] = [
  { symbol: "THYAO", name: "Türk Hava Yolları" },
  { symbol: "GARAN", name: "Garanti BBVA" },
  { symbol: "AKBNK", name: "Akbank" },
  { symbol: "YKBNK", name: "Yapı Kredi" },
  { symbol: "ISCTR", name: "İş Bankası (C)" },
  { symbol: "EREGL", name: "Ereğli Demir Çelik" },
  { symbol: "SISE", name: "Şişecam" },
  { symbol: "KCHOL", name: "Koç Holding" },
  { symbol: "SAHOL", name: "Sabancı Holding" },
  { symbol: "TUPRS", name: "Tüpraş" },
  { symbol: "ASELS", name: "Aselsan" },
  { symbol: "BIMAS", name: "BİM" },
  { symbol: "TOASO", name: "Tofaş" },
  { symbol: "FROTO", name: "Ford Otosan" },
  { symbol: "TCELL", name: "Turkcell" },
  { symbol: "TTKOM", name: "Türk Telekom" },
  { symbol: "PGSUS", name: "Pegasus" },
  { symbol: "KOZAL", name: "Koza Altın" },
  { symbol: "KOZAA", name: "Koza Anadolu" },
  { symbol: "PETKM", name: "Petkim" },
  { symbol: "SASA", name: "Sasa Polyester" },
  { symbol: "HEKTS", name: "Hektaş" },
  { symbol: "ENKAI", name: "Enka İnşaat" },
  { symbol: "TAVHL", name: "TAV Havalimanları" },
  { symbol: "ULKER", name: "Ülker" },
  { symbol: "MGROS", name: "Migros" },
  { symbol: "SOKM", name: "Şok Marketler" },
  { symbol: "ARCLK", name: "Arçelik" },
  { symbol: "VESTL", name: "Vestel" },
  { symbol: "ASTOR", name: "Astor Enerji" },
];


import { BIST30, BIST_LIQUID_EXTRA } from "@/lib/data/bistLists";
export { BIST30, BIST_LIQUID_EXTRA };

const YAHOO_CHART = "https://query2.finance.yahoo.com/v8/finance/chart";
const YAHOO_CHART_ALT = "https://query1.finance.yahoo.com/v8/finance/chart";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const YAHOO_HEADERS: HeadersInit = {
  "User-Agent": BROWSER_UA,
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
};


const CACHE_DIR = join(process.cwd(), "data", "cache", "bist");

function ensureCacheDir() {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

function cachePath(symbol: string, timeframe: string): string {
  return join(CACHE_DIR, `${symbol.toUpperCase()}_${timeframe}.json`);
}

function readCandleCache(
  symbol: string,
  timeframe: string,
  allowStale = false
): Candle[] | null {
  try {
    const p = cachePath(symbol, timeframe);
    if (!existsSync(p)) return null;
    const raw = JSON.parse(readFileSync(p, "utf8"));
    if (!Array.isArray(raw?.candles) || !raw.candles.length) return null;
    if (!allowStale) {
      const maxAge = timeframe === "1d" || timeframe === "1w" ? 24 * 3600e3 : 6 * 3600e3;
      if (Date.now() - Number(raw.ts || 0) > maxAge) return null;
    }
    return raw.candles as Candle[];
  } catch {
    return null;
  }
}

function writeCandleCache(symbol: string, timeframe: string, candles: Candle[]) {
  try {
    ensureCacheDir();
    writeFileSync(
      cachePath(symbol, timeframe),
      JSON.stringify({ ts: Date.now(), candles }),
      "utf8"
    );
  } catch {
    /* ignore */
  }
}

function uniqBist(): { symbol: string; name: string }[] {
  const map = new Map<string, string>();
  for (const t of [...BIST_TICKERS, ...BIST_EXTRA]) {
    if (!map.has(t.symbol)) map.set(t.symbol, t.name);
  }
  return [...map.entries()]
    .map(([symbol, name]) => ({ symbol, name }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/** Prefer BIST30 + liquid extras, then fill from full universe up to `limit`. */
export function bistScanUniverse(limit = 180): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of [...BIST30, ...BIST_LIQUID_EXTRA]) {
    const u = s.toUpperCase();
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= limit) return out;
  }
  for (const t of uniqBist()) {
    if (seen.has(t.symbol)) continue;
    seen.add(t.symbol);
    out.push(t.symbol);
    if (out.length >= limit) break;
  }
  return out;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function mapPoolLocal<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

function parseChartCandles(json: unknown): {
  candles: Candle[];
  meta: Record<string, unknown>;
} {
  const result = (json as { chart?: { result?: unknown[] } })?.chart?.result?.[0] as
    | {
        timestamp?: number[];
        meta?: Record<string, unknown>;
        indicators?: { quote?: Array<Record<string, (number | null)[]>> };
      }
    | undefined;
  if (!result) return { candles: [], meta: {} };
  const ts: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    const v = q.volume?.[i];
    if ([o, h, l, c].some((x) => x == null || Number.isNaN(Number(x)))) continue;
    candles.push({
      time: ts[i],
      open: Number(o),
      high: Number(h),
      low: Number(l),
      close: Number(c),
      volume: Number(v ?? 0),
    });
  }
  return { candles, meta: result.meta ?? {} };
}

async function fetchYahooChart(
  ysym: string,
  interval: string,
  range: string,
  retries = 3
): Promise<{ candles: Candle[]; meta: Record<string, unknown> } | null> {
  const hosts = [YAHOO_CHART, YAHOO_CHART_ALT];
  let lastStatus = 0;
  for (let attempt = 0; attempt < retries; attempt++) {
    const base = hosts[attempt % hosts.length];
    const url = `${base}/${encodeURIComponent(ysym)}?interval=${interval}&range=${range}`;
    try {
      const res = await fetch(url, {
        cache: "no-store",
        headers: YAHOO_HEADERS,
        signal: AbortSignal.timeout(4000),
      });
      lastStatus = res.status;
      if (res.status === 429 || res.status === 503) {
        await sleep(120);
        continue;
      }
      if (!res.ok) {
        await sleep(80);
        continue;
      }
      const json = await res.json();
      const parsed = parseChartCandles(json);
      if (parsed.candles.length || Object.keys(parsed.meta).length) return parsed;
    } catch {
      await sleep(80);
    }
  }
  if (lastStatus) {
    /* swallow — caller skips */
  }
  return null;
}

function quoteFromMeta(
  symbol: string,
  meta: Record<string, unknown>,
  candles: Candle[]
): TickerQuote | null {
  const last =
    Number(meta.regularMarketPrice ?? 0) ||
    (candles.length ? candles[candles.length - 1].close : 0);
  if (!last || !Number.isFinite(last)) return null;
  const prev =
    Number(meta.chartPreviousClose ?? meta.previousClose ?? 0) ||
    (candles.length >= 2 ? candles[candles.length - 2].close : 0);
  const changePct = prev ? ((last - prev) / prev) * 100 : 0;
  const high24h =
    Number(meta.regularMarketDayHigh ?? 0) ||
    (candles.length ? Math.max(...candles.slice(-5).map((c) => c.high)) : last);
  const low24h =
    Number(meta.regularMarketDayLow ?? 0) ||
    (candles.length ? Math.min(...candles.slice(-5).map((c) => c.low)) : last);
  const volume =
    Number(meta.regularMarketVolume ?? 0) ||
    (candles.length ? candles[candles.length - 1].volume : 0);
  return {
    symbol: symbol.toUpperCase().replace(/\.IS$/i, ""),
    exchange: "bist",
    last,
    changePct,
    high24h,
    low24h,
    volume,
    delayed: true,
  };
}

export class BistProvider {
  static listSymbols(): SymbolInfo[] {
    return uniqBist().map((t) => ({
      symbol: t.symbol,
      exchange: "bist",
      name: t.name,
      base: t.symbol,
      quote: "TRY",
    }));
  }

  static yahooSymbol(symbol: string): string {
    const s = symbol.toUpperCase().replace(/\.IS$/i, "");
    return `${s}.IS`;
  }

  static async getKlines(
    symbol: string,
    timeframe: string,
    _limit = 500
  ): Promise<{ candles: Candle[]; delayed: true; note: string }> {
    const yp = yahooParamsForTimeframe(timeframe);
    const ysym = this.yahooSymbol(symbol);
    const fresh = readCandleCache(symbol, timeframe, false);
    if (fresh?.length) {
      return { candles: fresh, delayed: true as const, note: "BIST: cache" };
    }
    const fetched = await fetchYahooChart(ysym, yp.interval, yp.range, 2);
    const finalize = (candles: Candle[], note: string) => {
      let out = candles;
      if (yp.aggregateMinutes && yp.aggregateMinutes > 0) {
        const srcMin =
          yp.interval === "60m"
            ? 60
            : yp.interval === "1wk"
              ? 10080
              : yp.interval.endsWith("m")
                ? Number(yp.interval.replace("m", "")) || 1
                : yp.interval === "1d"
                  ? 1440
                  : 1440;
        // Only aggregate when target differs from source bar size
        if (yp.aggregateMinutes !== srcMin) {
          out = aggregateCandles(candles, yp.aggregateMinutes);
        }
      }
      return { candles: out, delayed: true as const, note };
    };
    if (fetched?.candles?.length) {
      const result = finalize(
        fetched.candles,
        "BIST: Yahoo query2 chart (gecikmeli/best-effort)"
      );
      writeCandleCache(symbol, timeframe, result.candles);
      return result;
    }
    const cached = readCandleCache(symbol, timeframe, true);
    if (cached?.length) {
      return {
        candles: cached,
        delayed: true,
        note: "BIST: önbellekten mumlar (canlı kaynak yanıt vermedi)",
      };
    }
    throw new Error(
      `BIST/Yahoo klines başarısız — ${symbol} için mum alınamadı`
    );
  }

  static async getQuotes(symbols: string[]): Promise<TickerQuote[]> {
    const list = [...new Set(symbols.map((s) => s.toUpperCase().replace(/\.IS$/i, "")))];
    const results = await mapPoolLocal(list, 8, async (sym) => {
      const ysym = this.yahooSymbol(sym);
      // Short range is enough for quote meta + change
      const fetched = await fetchYahooChart(ysym, "1d", "5d", 2);
      if (!fetched) return null;
      return quoteFromMeta(sym, fetched.meta, fetched.candles);
    });
    return results.filter((q): q is TickerQuote => q != null && q.last > 0);
  }
}
