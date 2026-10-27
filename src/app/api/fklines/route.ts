import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
// Binance USDT-M perp mumları — /api/lsratio gibi Edge + Avrupa bölgesi (fapi ABD'den 451 döner).
// Paper bot (GitHub Actions, ABD IP) LS kaynakları için perp mumlarını buradan alır (OKX/Gate yedeği olmayan semboller dahil).
export const runtime = "edge";
export const preferredRegion = ["fra1", "arn1", "cdg1"];

const HOSTS = ["https://fapi.binance.com", "https://fapi1.binance.com", "https://fapi2.binance.com"];
const TFS = new Set(["1m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d"]);

/** GET /api/fklines?symbol=ETHUSDT&interval=4h&limit=500 → Binance /fapi/v1/klines biçimi (salt okunur, anahtar yok). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("symbol") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
  const tf = sp.get("interval") || "4h";
  const lim = Math.min(1500, Math.max(1, Number(sp.get("limit") || 500) || 500));
  if (!sym || !TFS.has(tf)) return NextResponse.json({ error: "symbol/interval" }, { status: 400 });
  const errs: string[] = [];
  for (const h of HOSTS) {
    try {
      const r = await fetch(`${h}/fapi/v1/klines?symbol=${sym}&interval=${tf}&limit=${lim}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (r.ok) return NextResponse.json(await r.json(), { headers: { "cache-control": "s-maxage=60", "x-qx-src": h } });
      errs.push(`${h} ${r.status}`);
      if (r.status === 400) break; // sembol yok
    } catch (e) { errs.push(`${h} ${(e as Error).message}`); }
  }
  return NextResponse.json({ error: "fklines-unavailable", detail: errs, region: process.env.VERCEL_REGION || "?" }, { status: 503, headers: { "cache-control": "no-store" } });
}
