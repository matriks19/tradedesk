import { NextRequest, NextResponse } from "next/server";
import { BinanceProvider } from "@/lib/data/binance";
import { BistProvider } from "@/lib/data/bist";
import { aiRank } from "@/lib/data/binanceLists";

export const dynamic = "force-dynamic";

function fuzzyMatch(
  q: string,
  symbol: string,
  name?: string,
  base?: string
): boolean {
  if (!q) return true;
  const s = symbol.toUpperCase();
  const n = (name ?? "").toUpperCase();
  const b = (base ?? "").toUpperCase();
  // partial anywhere (aio → *AIO*, btc.p → BTCUSDT.P)
  if (s.includes(q) || n.includes(q) || b.includes(q)) return true;
  // strip .P then USDT for crypto base search
  const bare = s.replace(/\.P$/i, "").replace(/USDT$/, "");
  if (bare.includes(q)) return true;
  // query without .P still matches perps when typing BTCUSDT
  if (q.endsWith(".P") && s === q) return true;
  if (!q.endsWith(".P") && s === `${q}.P`) return true;
  return false;
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").toUpperCase().trim();
  const exchange = req.nextUrl.searchParams.get("exchange");
  const limitParam = req.nextUrl.searchParams.get("limit");
  // Default: full catalog when no query; with query return up to 500 matches
  const limit = limitParam
    ? Math.min(5000, Math.max(1, Number(limitParam) || 500))
    : q
      ? 500
      : 5000;

  try {
    let symbols =
      exchange === "bist"
        ? BistProvider.listSymbols()
        : exchange === "binance"
          ? await BinanceProvider.getAllUsdtSymbols()
          : [
              ...(await BinanceProvider.getAllUsdtSymbols()),
              ...BistProvider.listSymbols(),
            ];

    if (q) {
      symbols = symbols.filter((s) =>
        fuzzyMatch(q, s.symbol, s.name, s.base)
      );
    }
    symbols.sort((a, b) => {
      const as = a.symbol.toUpperCase();
      const bs = b.symbol.toUpperCase();
      if (q) {
        const score = (s: string) => {
          const base = s.replace(/\.P$/i, "").replace(/USDT$/, "");
          if (s === q || s === `${q}.P` || base === q) return 0;
          if (s.startsWith(q) || base.startsWith(q)) return 1;
          if (s.includes(q)) return 2;
          return 3;
        };
        const d = score(as) - score(bs);
        if (d !== 0) return d;
      }
      const ai = aiRank(as) - aiRank(bs);
      if (ai !== 0) return ai;
      const ap = /\.P$/i.test(as) ? 0 : 1;
      const bp = /\.P$/i.test(bs) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return as.localeCompare(bs);
    });

    const sliced = symbols.slice(0, limit);
    return NextResponse.json({
      symbols: sliced,
      total: symbols.length,
      returned: sliced.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
