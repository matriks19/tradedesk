import { NextRequest, NextResponse } from "next/server";
import {
  SCREENER_INTERVALS,
  loadBistCharts,
  mapScreenerInterval,
  normalizeBistSymbol,
  type ScreenerInterval,
} from "@/lib/data/yahooBistProxy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SYMBOLS = 40;

/**
 * Same-origin Yahoo chart proxy for the BIST screener.
 * The browser sends a chunk; this route talks to Yahoo one symbol at a time
 * (plain User-Agent, delay, cache) and returns Binance-shaped klines.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const interval = sp.get("interval") || "1h";
  const mapped = mapScreenerInterval(interval);
  if (!mapped) {
    return NextResponse.json(
      { error: "interval", allowed: SCREENER_INTERVALS },
      { status: 400 }
    );
  }
  const limitRaw = Number(sp.get("limit") || 320);
  const limit = Math.min(500, Math.max(30, Number.isFinite(limitRaw) ? limitRaw : 320));
  const raw = (sp.get("symbols") || "").slice(0, 800);
  const symbols: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const s = normalizeBistSymbol(part);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    symbols.push(s);
    if (symbols.length >= MAX_SYMBOLS) break;
  }
  if (!symbols.length) {
    return NextResponse.json({ error: "symbols" }, { status: 400 });
  }
  try {
    const body = await loadBistCharts({
      symbols,
      interval: interval as ScreenerInterval,
      limit,
    });
    return NextResponse.json(body, {
      headers: { "cache-control": "private, max-age=30" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "yahoo" },
      { status: 502 }
    );
  }
}
