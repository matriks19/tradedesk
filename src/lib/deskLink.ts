import type { ChartTimeframe, Exchange } from "@/lib/types";

export function buildDeskOpenUrl(opts: {
  origin: string;
  symbol: string;
  exchange: Exchange;
  timeframe?: string;
}): string {
  const base = opts.origin.replace(/\/$/, "") || "https://tradedesk-07f3.onrender.com";
  const u = new URL(base);
  u.searchParams.set("s", opts.symbol);
  u.searchParams.set("ex", opts.exchange);
  if (opts.timeframe) u.searchParams.set("tf", opts.timeframe);
  return u.toString();
}

export function parseDeskOpenSearch(search: string): {
  symbol: string;
  exchange: Exchange;
  timeframe?: ChartTimeframe;
} | null {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const p = new URLSearchParams(raw);
  const symbol = (p.get("s") || p.get("symbol") || "").toUpperCase().trim();
  if (!symbol) return null;
  const ex = (p.get("ex") || p.get("exchange") || "binance").toLowerCase();
  const exchange: Exchange = ex === "bist" ? "bist" : "binance";
  const tf = (p.get("tf") || p.get("timeframe") || "").trim();
  return { symbol, exchange, timeframe: tf || undefined };
}
