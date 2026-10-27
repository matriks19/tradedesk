import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// fapi.binance.com ABD bölgelerinden 451 döner. Node fonksiyonları (Hobby) iad1'de kalıyor →
// Edge runtime + bölge sabitleme (fra1/arn1) ile Avrupa'dan çağır.
export const runtime = "edge";
export const preferredRegion = ["fra1", "arn1", "cdg1"];

/** Binance top-trader L/S POSITION oranı proxy'si (salt okunur, anahtar yok).
 *  GET /api/lsratio?symbol=BTCUSDT&period=4h → Binance /futures/data/topLongShortPositionRatio biçimi. */
const HOSTS = ["https://fapi.binance.com", "https://fapi1.binance.com", "https://fapi2.binance.com"];
const PERIODS = new Set(["5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d"]);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("symbol") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
  const period = sp.get("period") || "4h";
  const lim = Math.min(500, Math.max(1, Number(sp.get("limit") || 500) || 500));
  if (!sym || !PERIODS.has(period)) return NextResponse.json({ error: "symbol/period" }, { status: 400 });
  const errs: string[] = [];
  for (const h of HOSTS) {
    try {
      const r = await fetch(`${h}/futures/data/topLongShortPositionRatio?symbol=${sym}&period=${period}&limit=${lim}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (r.ok) return NextResponse.json(await r.json(), { headers: { "cache-control": "s-maxage=300", "x-qx-src": h } });
      errs.push(`${h} ${r.status}`);
      if (r.status === 451) continue;
      if (r.status === 400) break; // sembol yok
    } catch (e) { errs.push(`${h} ${(e as Error).message}`); }
  }
  return NextResponse.json({ error: "lsratio-unavailable", detail: errs, region: process.env.VERCEL_REGION || "?" }, { status: 503, headers: { "cache-control": "no-store" } });
}
