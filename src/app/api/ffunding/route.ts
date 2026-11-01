import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// Binance USDT-M funding geçmişi — /api/fklines gibi Edge + Avrupa bölgesi (fapi ABD'den 451 döner).
// Umut+PG (Patlama Gücü FUND bileşeni) için: paper bot (GitHub Actions) ve Panel grafiği. Salt okunur, anahtar yok.
export const runtime = "edge";
export const preferredRegion = ["fra1", "arn1", "cdg1"];

const HOSTS = ["https://fapi.binance.com", "https://fapi1.binance.com", "https://fapi2.binance.com"];

/** GET /api/ffunding?symbol=ETHUSDT&limit=1000 → Binance /fapi/v1/fundingRate biçimi [{symbol,fundingTime,fundingRate,markPrice}] */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("symbol") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
  const lim = Math.min(1000, Math.max(1, Number(sp.get("limit") || 1000) || 1000));
  if (!sym) return NextResponse.json({ error: "symbol" }, { status: 400 });
  const errs: string[] = [];
  for (const h of HOSTS) {
    try {
      const r = await fetch(`${h}/fapi/v1/fundingRate?symbol=${sym}&limit=${lim}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (r.ok) return NextResponse.json(await r.json(), { headers: { "cache-control": "s-maxage=900", "x-qx-src": h } });
      errs.push(`${h} ${r.status}`);
      if (r.status === 400) break;
    } catch (e) { errs.push(`${h} ${(e as Error).message}`); }
  }
  return NextResponse.json({ error: "ffunding-unavailable", detail: errs, region: process.env.VERCEL_REGION || "?" }, { status: 503, headers: { "cache-control": "no-store" } });
}
