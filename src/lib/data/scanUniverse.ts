/** Client helpers to resolve scan symbol universes. */

import type { Exchange, TickerQuote } from "@/lib/types";
import { BIST30, BIST_LIQUID_EXTRA } from "@/lib/data/bistLists";
import { symbolsForSector, allBistSymbols } from "@/lib/data/bistSectors";

export type BistScanSource = "bist30" | "liquid" | "all" | "sector";
export type BinanceMarket = "spot" | "perp";

export function bistSourceLimit(source: BistScanSource): number {
  if (source === "bist30") return 30;
  if (source === "liquid") return 160;
  return 650;
}

/** Local symbol list for a BIST scan source (no network). */
export function bistSymbolsForSource(
  source: BistScanSource,
  sectorCode?: string
): string[] {
  if (source === "bist30") return [...BIST30];
  if (source === "liquid") {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of [...BIST30, ...BIST_LIQUID_EXTRA]) {
      const u = s.toUpperCase();
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    }
    return out;
  }
  if (source === "sector" && sectorCode) {
    return symbolsForSector(sectorCode);
  }
  return allBistSymbols().slice(0, 650);
}

/**
 * Fetch ticker quotes for scan. When `symbols` given (sector/watchlist), uses
 * comma list; otherwise uses limit for BIST universe.
 * Binance: `binanceMarket` spot (default) or perp; `binanceTop` caps by quoteVolume.
 */
export async function fetchScanQuotes(opts: {
  exchange: Exchange;
  source?: BistScanSource;
  sectorCode?: string;
  symbols?: string[];
  binanceTop?: number;
  binanceMarket?: BinanceMarket;
}): Promise<{ quotes: TickerQuote[]; note?: string; requested: number }> {
  const {
    exchange,
    source = "all",
    sectorCode,
    symbols,
    binanceTop = 120,
    binanceMarket = "spot",
  } = opts;

  if (symbols?.length) {
    // chunk to avoid huge URLs / rate limits (esp. large perp sets)
    const chunks: string[][] = [];
    for (let i = 0; i < symbols.length; i += 80) {
      chunks.push(symbols.slice(i, i + 80));
    }
    const quotes: TickerQuote[] = [];
    let note: string | undefined;
    for (const ch of chunks) {
      const res = await fetch(
        `/api/ticker?exchange=${exchange}&symbols=${ch.join(",")}`
      );
      const json = await res.json();
      if (json.note) note = json.note;
      quotes.push(...(json.quotes ?? []));
    }
    return { quotes, note, requested: symbols.length };
  }

  if (exchange === "bist") {
    if (source === "sector" && sectorCode) {
      return fetchScanQuotes({
        exchange,
        symbols: symbolsForSector(sectorCode),
      });
    }
    const limit = bistSourceLimit(source);
    const res = await fetch(
      `/api/ticker?exchange=bist&limit=${limit}`
    );
    const json = await res.json();
    let quotes: TickerQuote[] = json.quotes ?? [];
    if (source === "bist30") {
      const set = new Set(BIST30);
      quotes = quotes.filter((q) => set.has(q.symbol));
    } else if (source === "liquid") {
      const set = new Set([...BIST30, ...BIST_LIQUID_EXTRA].map((s) => s.toUpperCase()));
      quotes = quotes.filter((q) => set.has(q.symbol));
      if (quotes.length < 40) {
        // fall back to whatever ticker returned (liquid-first universe)
        quotes = json.quotes ?? [];
      }
    }
    return {
      quotes,
      note: json.note,
      requested: Number(json.requested ?? limit),
    };
  }

  const market = binanceMarket === "perp" ? "perp" : "spot";
  const res = await fetch(`/api/ticker?exchange=binance&market=${market}`);
  const json = await res.json();
  let quotes: TickerQuote[] = (json.quotes ?? []) as TickerQuote[];
  if (market === "perp") {
    quotes = quotes.filter((q) => /\.P$/i.test(q.symbol));
  } else {
    quotes = quotes.filter(
      (q) => q.symbol.endsWith("USDT") && !/\.P$/i.test(q.symbol)
    );
  }
  quotes = quotes
    .sort(
      (a: TickerQuote, b: TickerQuote) =>
        (b.quoteVolume ?? 0) - (a.quoteVolume ?? 0)
    )
    .slice(0, Math.max(1, binanceTop));
  return { quotes, note: json.note, requested: quotes.length };
}
