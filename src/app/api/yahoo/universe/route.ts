import { NextResponse } from "next/server";
import { BistProvider } from "@/lib/data/bist";

export const dynamic = "force-dynamic";

/** Full BIST equity list already used by TradeDesk (BistProvider.listSymbols). */
export async function GET() {
  const symbols = BistProvider.listSymbols().map((s) => ({
    symbol: s.symbol,
    name: s.name ?? s.symbol,
  }));
  return NextResponse.json(
    {
      source: "BistProvider.listSymbols",
      count: symbols.length,
      symbols,
    },
    { headers: { "cache-control": "public, max-age=3600" } }
  );
}
