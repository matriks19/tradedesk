import { NextRequest, NextResponse } from "next/server";
import { BinanceProvider, isBinancePerp } from "@/lib/data/binance";
import { BistProvider } from "@/lib/data/bist";
import { getLastPerpFeed } from "@/lib/data/perpAlts";
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
    const feed = isBinancePerp(symbol) ? getLastPerpFeed() : "binance";
    return NextResponse.json({
      candles,
      delayed: false,
      feed,
      note: feed !== "binance" ? `perp feed: ${feed}` : undefined,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
