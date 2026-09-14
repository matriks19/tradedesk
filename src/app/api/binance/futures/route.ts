import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

export const dynamic = "force-dynamic";

function baseUrl(testnet?: boolean) {
  return testnet
    ? "https://testnet.binancefuture.com"
    : "https://fapi.binance.com";
}

function toQuery(params: Record<string, string | number | boolean>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
    )
    .join("&");
}

/**
 * Thin signed Futures proxy. Keys arrive per-request and are never persisted.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const apiSecret =
      typeof body.apiSecret === "string" ? body.apiSecret.trim() : "";
    const method = (body.method || "GET") as "GET" | "POST" | "DELETE";
    const path = typeof body.path === "string" ? body.path : "";
    const testnet = !!body.testnet;
    const params =
      body.params && typeof body.params === "object"
        ? (body.params as Record<string, string | number | boolean>)
        : {};

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "apiKey / apiSecret gerekli" }, { status: 400 });
    }
    if (!path.startsWith("/fapi/")) {
      return NextResponse.json({ error: "geçersiz path" }, { status: 400 });
    }

    const timestamp = Date.now();
    const qs = toQuery({ ...params, timestamp });
    const signature = createHmac("sha256", apiSecret).update(qs).digest("hex");
    const url = `${baseUrl(testnet)}${path}?${qs}&signature=${signature}`;

    const res = await fetch(url, {
      method,
      headers: {
        "X-MBX-APIKEY": apiKey,
        ...(method !== "GET"
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      const msg =
        data &&
        typeof data === "object" &&
        data !== null &&
        "msg" in data
          ? String((data as { msg: string }).msg)
          : `binance ${res.status}`;
      return NextResponse.json({ error: msg, data }, { status: 400 });
    }
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "futures proxy hata" },
      { status: 500 }
    );
  }
}
