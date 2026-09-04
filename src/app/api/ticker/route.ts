import { NextRequest, NextResponse } from "next/server";
import { BinanceProvider } from "@/lib/data/binance";
import { BistProvider } from "@/lib/data/bist";
import type { Exchange } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const exchange = (sp.get("exchange") ?? "binance") as Exchange;
  const symbols = sp.get("symbols");

  try {
    if (exchange === "bist") {
      const list = symbols
        ? symbols.split(",").map((s) => s.trim()).filter(Boolean)
        : BistProvider.listSymbols()
            .slice(0, 40)
            .map((s) => s.symbol);
      const quotes = await BistProvider.getQuotes(list);
      return NextResponse.json({ quotes, delayed: true });
    }
    if (symbols) {
      const parts = symbols.split(",").map((s) => s.trim()).filter(Boolean);
      const quotes = (
        await Promise.all(
          parts.map(async (sym) => {
            try {
              const q = await BinanceProvider.getTicker24h(sym);
              return q[0];
            } catch {
              return null;
            }
          })
        )
      ).filter(Boolean);
      return NextResponse.json({ quotes, delayed: false });
    }
    const quotes = await BinanceProvider.getTicker24h();
    return NextResponse.json({ quotes, delayed: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
