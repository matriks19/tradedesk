import { NextRequest, NextResponse } from "next/server";
import { futKlines, futTicker24, futExchangeInfo } from "@/lib/server/futFeed";

export const dynamic = "force-dynamic";

/** Tarayıcı fapi.binance.com'a ulaşamazsa (451/CORS) bu proxy GERÇEK USDT-M vadeli verisi döndürür:
 *  Binance fapi → Bybit linear → OKX SWAP → Gate.io futures. Spot'a ASLA düşmez.
 *  Kaynak başlıkta: x-qx-src: futures:<borsa>. */
const ALLOW = new Set(["klines", "ticker/24hr", "ticker/price", "exchangeInfo", "ping", "time"]);

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const sub = (params.path || []).join("/");
  if (!ALLOW.has(sub)) return NextResponse.json({ error: "yok" }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const sym = (sp.get("symbol") || "").slice(0, 32).toUpperCase() || undefined;
  const hdr = (src: string) => ({ "cache-control": "no-store", "x-qx-src": "futures:" + src });
  try {
    if (sub === "ping") return NextResponse.json({}, { headers: hdr("proxy") });
    if (sub === "time") return NextResponse.json({ serverTime: Date.now() }, { headers: hdr("proxy") });
    if (sub === "exchangeInfo") {
      const r = await futExchangeInfo();
      return NextResponse.json(r.d, { headers: hdr(r.src) });
    }
    if (sub === "klines") {
      if (!sym) return NextResponse.json({ code: -1102, msg: "symbol gerekli" }, { status: 400 });
      const iv = sp.get("interval") || "1h";
      const lim0 = Number(sp.get("limit") || 500);
      const limit = Math.min(1500, Math.max(1, Number.isFinite(lim0) ? lim0 : 500));
      const et = Number(sp.get("endTime") || 0) || undefined;
      const r = await futKlines(sym, iv, limit, et);
      return NextResponse.json(r.rows, { headers: hdr(r.src) });
    }
    const r = await futTicker24(sym);
    if (sub === "ticker/price") {
      const d = r.d.map((x) => ({ symbol: x.symbol, price: x.lastPrice, time: x.closeTime }));
      return NextResponse.json(sym ? d[0] : d, { headers: hdr(r.src) });
    }
    return NextResponse.json(sym ? r.d[0] : r.d, { headers: hdr(r.src) });
  } catch (e) {
    return NextResponse.json({ code: -1121, error: "futures-unavailable", msg: e instanceof Error ? e.message : "proxy" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
