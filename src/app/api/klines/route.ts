import { NextRequest, NextResponse } from "next/server";
import { BinanceProvider } from "@/lib/data/binance";
import { BistProvider } from "@/lib/data/bist";
import type { Exchange } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const symbol = sp.get("symbol") ?? "BTCUSDT";
  const exchange = (sp.get("exchange") ?? "binance") as Exchange;
  const timeframe = sp.get("timeframe") ?? "15m";
  const limit = Number(sp.get("limit") ?? 500);

  try {
    if (exchange === "bist") {
      const result = await BistProvider.getKlines(symbol, timeframe, limit);
      return NextResponse.json({
        candles: result.candles,
        delayed: true,
        note: result.note,
      });
    }
    const candles = await BinanceProvider.getKlines(symbol, timeframe, limit);
    return NextResponse.json({ candles, delayed: false });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
