import type { Exchange, TickerQuote } from "@/lib/types";

export type WatchlistSym = { symbol: string; exchange: Exchange };

/** Load ticker quotes for an active watchlist (best-effort). */
export async function fetchWatchlistQuotes(
  symbols: WatchlistSym[]
): Promise<TickerQuote[]> {
  if (!symbols.length) return [];
  const byEx: Record<Exchange, string[]> = { binance: [], bist: [] };
  for (const s of symbols) {
    if (!byEx[s.exchange].includes(s.symbol)) byEx[s.exchange].push(s.symbol);
  }
  const out: TickerQuote[] = [];
  for (const ex of ["binance", "bist"] as Exchange[]) {
    const syms = byEx[ex];
    if (!syms.length) continue;
    for (let i = 0; i < syms.length; i += 80) {
      const chunk = syms.slice(i, i + 80);
      try {
        const res = await fetch(
          `/api/ticker?exchange=${ex}&symbols=${chunk.join(",")}`
        );
        const json = await res.json();
        for (const q of json.quotes ?? []) out.push(q as TickerQuote);
      } catch {
        /* skip chunk */
      }
    }
  }
  for (const s of symbols) {
    if (!out.some((q) => q.symbol === s.symbol && q.exchange === s.exchange)) {
      out.push({
        symbol: s.symbol,
        exchange: s.exchange,
        last: 0,
        changePct: 0,
        volume: 0,
        quoteVolume: 0,
      });
    }
  }
  return out;
}
