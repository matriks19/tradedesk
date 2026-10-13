import { NextResponse } from "next/server";
import { guardStatus } from "@/lib/server/binanceGuard";

export const dynamic = "force-dynamic";

/** Binance ağırlık / ban durumu (Binance'e istek ATMAZ). */
export async function GET() {
  return NextResponse.json(guardStatus(), { headers: { "cache-control": "no-store" } });
}
