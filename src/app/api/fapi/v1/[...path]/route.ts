import { NextRequest, NextResponse } from "next/server";
import { guardedGet, guardStatus } from "@/lib/server/binanceGuard";

export const dynamic = "force-dynamic";

const ALLOW = new Set(["klines", "ticker/24hr", "ticker/price", "exchangeInfo", "ping", "time"]);

/** Browser cannot reach fapi.binance.com (451, no CORS). Screener calls /api/fapi/v1/* and we fetch the public vision mirror. */
export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const sub = (params.path || []).join("/");
  if (!ALLOW.has(sub)) {
    return NextResponse.json({ error: "yok" }, { status: 404 });
  }
  const src = req.nextUrl.searchParams;
  const q = new URLSearchParams();
  for (const k of ["symbol", "interval", "limit"]) {
    const v = src.get(k);
    if (v) q.set(k, v.slice(0, 32));
  }
  // Spot proxy tek istekte en fazla 1000 mum; 1001–1500 istenirse (T29/T30) eski mumlar ikinci istekle (endTime) eklenir
  let wantKl = 0;
  if (sub === "klines") {
    const n0 = Math.min(1500, Math.max(1, Number(q.get("limit") || 499)));
    wantKl = Number.isFinite(n0) ? n0 : 499;
    q.set("limit", String(Math.min(1000, wantKl)));
  }
  const url =
    "https://data-api.binance.vision/api/v3/" +
    sub +
    (q.toString() ? "?" + q.toString() : "");
  try {
    const e = await guardedGet(url);
    const st = guardStatus();
    const hdr: Record<string, string> = {
      "content-type": e.ct || "application/json",
      "cache-control": "no-store",
      "x-qx-used-weight-1m": String(st.usedWeight1m),
      "x-qx-cache": e.cached ? (e.stale ? "stale" : "hit") : "miss",
    };
    if (e.status === 429) {
      hdr["retry-after"] = String(Math.max(1, Math.ceil((st.banUntil - Date.now()) / 1000)));
      if (st.banUntil) hdr["x-qx-ban-until"] = String(st.banUntil);
    }
    if (sub === "exchangeInfo" && e.status === 200) {
      const data = JSON.parse(e.body);
      const symbols = Array.isArray(data.symbols) ? data.symbols : [];
      data.symbols = symbols.filter(
        (s: { status?: string; quoteAsset?: string } | null) =>
          !!s && s.status === "TRADING" && s.quoteAsset === "USDT"
      );
      return NextResponse.json(data, { headers: hdr });
    }
    if (sub === "klines" && wantKl > 1000 && e.status === 200) {
      try {
        const rows = JSON.parse(e.body) as unknown[][];
        if (Array.isArray(rows) && rows.length >= 1000) {
          const q2 = new URLSearchParams(q);
          q2.set("limit", String(wantKl - rows.length));
          q2.set("endTime", String(Number(rows[0]![0]) - 1));
          const e2 = await guardedGet("https://data-api.binance.vision/api/v3/klines?" + q2.toString());
          if (e2.status === 200) {
            const older = JSON.parse(e2.body) as unknown[][];
            if (Array.isArray(older)) return NextResponse.json([...older, ...rows], { headers: hdr });
          }
        }
      } catch {
        /* ilk 1000 ile devam */
      }
    }
    return new NextResponse(e.body, { status: e.status, headers: hdr });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "proxy" },
      { status: 502 }
    );
  }
}
