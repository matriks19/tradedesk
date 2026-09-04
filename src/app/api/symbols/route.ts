import { NextRequest, NextResponse } from "next/server";
import { BinanceProvider } from "@/lib/data/binance";
import { BistProvider } from "@/lib/data/bist";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").toUpperCase();
  const exchange = req.nextUrl.searchParams.get("exchange");

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
      symbols = symbols.filter(
        (s) =>
          s.symbol.includes(q) ||
          (s.name && s.name.toUpperCase().includes(q)) ||
          (s.base && s.base.includes(q))
      );
    }
    return NextResponse.json({ symbols: symbols.slice(0, 200) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
