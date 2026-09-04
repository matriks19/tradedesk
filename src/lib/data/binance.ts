import type { Candle, SymbolInfo, TickerQuote, Timeframe } from "@/lib/types";

const REST = "https://api.binance.com";

const TF_MAP: Record<Timeframe, string> = {
  "1m": "1m",
  "3m": "3m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "2h": "2h",
  "4h": "4h",
  "6h": "6h",
  "12h": "12h",
  "1d": "1d",
  "1w": "1w",
};

export class BinanceProvider {
  static async getUsdtSymbols(): Promise<SymbolInfo[]> {
    const res = await fetch(`${REST}/api/v3/exchangeInfo`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`Binance exchangeInfo ${res.status}`);
    const data = await res.json();
    return (data.symbols as Array<Record<string, unknown>>)
      .filter(
        (s) =>
          s.status === "TRADING" &&
          s.quoteAsset === "USDT" &&
          s.isSpotTradingAllowed !== false
      )
      .map((s) => ({
        symbol: String(s.symbol),
        exchange: "binance" as const,
        base: String(s.baseAsset),
        quote: String(s.quoteAsset),
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  }

  static async getKlines(
    symbol: string,
    timeframe: Timeframe,
    limit = 500
  ): Promise<Candle[]> {
    const interval = TF_MAP[timeframe] ?? "15m";
    const url = `${REST}/api/v3/klines?symbol=${encodeURIComponent(
      symbol.toUpperCase()
    )}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Binance klines ${res.status}`);
    const rows = (await res.json()) as unknown[][];
    return rows.map((r) => ({
      time: Math.floor(Number(r[0]) / 1000),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    }));
  }

  static async getTicker24h(symbol?: string): Promise<TickerQuote[]> {
    const url = symbol
      ? `${REST}/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol.toUpperCase())}`
      : `${REST}/api/v3/ticker/24hr`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Binance ticker ${res.status}`);
    const data = await res.json();
    const arr = Array.isArray(data) ? data : [data];
    return arr
      .filter((t: { symbol: string }) => t.symbol.endsWith("USDT"))
      .map(
        (t: {
          symbol: string;
          lastPrice: string;
          priceChangePercent: string;
          highPrice: string;
          lowPrice: string;
          volume: string;
          quoteVolume: string;
        }) => ({
          symbol: t.symbol,
          exchange: "binance" as const,
          last: Number(t.lastPrice),
          changePct: Number(t.priceChangePercent),
          high24h: Number(t.highPrice),
          low24h: Number(t.lowPrice),
          volume: Number(t.volume),
          quoteVolume: Number(t.quoteVolume),
        })
      );
  }

  static wsKlineUrl(symbol: string, timeframe: Timeframe): string {
    const s = symbol.toLowerCase();
    const i = (TF_MAP[timeframe] ?? "15m").toLowerCase();
    return `wss://stream.binance.com:9443/ws/${s}@kline_${i}`;
  }

  static wsTickerUrl(symbol: string): string {
    return `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`;
  }

  static parseKlineMessage(msg: unknown): Candle | null {
    const m = msg as { k?: Record<string, unknown> };
    if (!m?.k) return null;
    const k = m.k;
    return {
      time: Math.floor(Number(k.t) / 1000),
      open: Number(k.o),
      high: Number(k.h),
      low: Number(k.l),
      close: Number(k.c),
      volume: Number(k.v),
    };
  }
}
