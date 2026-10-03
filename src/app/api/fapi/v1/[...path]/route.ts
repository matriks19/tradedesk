import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOW = new Set(["klines", "ticker/24hr", "exchangeInfo", "ping", "time"]);

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
  if (sub === "klines") {
    const n = Math.min(1000, Math.max(1, Number(q.get("limit") || 499)));
    q.set("limit", String(Number.isFinite(n) ? n : 499));
  }
  const url =
    "https://data-api.binance.vision/api/v3/" +
    sub +
    (q.toString() ? "?" + q.toString() : "");
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (sub === "exchangeInfo" && res.ok) {
      const data = await res.json();
      const symbols = Array.isArray(data.symbols) ? data.symbols : [];
      data.symbols = symbols.filter(
        (s: { status?: string; quoteAsset?: string } | null) =>
          !!s && s.status === "TRADING" && s.quoteAsset === "USDT"
      );
      return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
    }
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "proxy" },
      { status: 502 }
    );
  }
}
