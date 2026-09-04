import { NextRequest, NextResponse } from "next/server";
import { BinanceProvider } from "@/lib/data/binance";
import { BistProvider } from "@/lib/data/bist";

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
  // partial anywhere (aio → *AIO*)
  if (s.includes(q) || n.includes(q) || b.includes(q)) return true;
  // strip USDT for crypto base search
  const bare = s.replace(/USDT$/, "");
  if (bare.includes(q)) return true;
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
          ? await BinanceProvider.getUsdtSymbols()
          : [
              ...(await BinanceProvider.getUsdtSymbols()),
              ...BistProvider.listSymbols(),
            ];

    if (q) {
      symbols = symbols.filter((s) =>
        fuzzyMatch(q, s.symbol, s.name, s.base)
      );
    }

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
