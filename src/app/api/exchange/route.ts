import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

export const dynamic = "force-dynamic";

/**
 * QUANTEX Robot Bağla — imzalı borsa proxy'si.
 * Anahtarlar istek gövdesinde gelir, ASLA saklanmaz / loglanmaz.
 * Opsiyonel: sunucu env (QX_<EX>_KEY / _SECRET / _PASS) — gövdede anahtar yoksa kullanılır.
 * Durum: Binance spot + USDT-M: bakiye + kaldıraç + marjin + market emir (canlı).
 *        Bybit / OKX / Bitget: yalnız bakiye testi; emir "yakında".
 */
type P = Record<string, string | number | boolean>;
type Body = {
  exchange?: string; market?: "spot" | "futures"; testnet?: boolean;
  apiKey?: string; apiSecret?: string; passphrase?: string;
  action?: "balance" | "order" | "leverage" | "marginType" | "price" | "position";
  params?: P;
};

const qs = (p: P) =>
  Object.entries(p).filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
const hmacHex = (s: string, m: string) => createHmac("sha256", s).update(m).digest("hex");
const hmacB64 = (s: string, m: string) => createHmac("sha256", s).update(m).digest("base64");

async function asJson(res: Response) {
  const t = await res.text();
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 300) }; }
}

async function binance(b: Body, key: string, sec: string) {
  const fut = b.market === "futures";
  const base = fut
    ? b.testnet ? "https://testnet.binancefuture.com" : "https://fapi.binance.com"
    : b.testnet ? "https://testnet.binance.vision" : "https://api.binance.com";
  let method = "GET", path = "", params: P = {};
  const p = b.params || {};
  switch (b.action) {
    case "balance": path = fut ? "/fapi/v2/balance" : "/api/v3/account"; params = fut ? {} : { omitZeroBalances: "true" }; break;
    case "price": {
      const r = await fetch(`${base}${fut ? "/fapi/v1/ticker/price" : "/api/v3/ticker/price"}?symbol=${encodeURIComponent(String(p.symbol || ""))}`, { cache: "no-store" });
      return { ok: r.ok, data: await asJson(r) };
    }
    case "position": {
      // Canlı emir öncesi: sembolde mevcut pozisyon var mı? (futures positionRisk / spot baz varlık bakiyesi)
      const sym = String(p.symbol || "");
      const q0 = qs(fut ? { symbol: sym, recvWindow: 5000, timestamp: Date.now() } : { omitZeroBalances: "true", recvWindow: 5000, timestamp: Date.now() });
      const r0 = await fetch(`${base}${fut ? "/fapi/v2/positionRisk" : "/api/v3/account"}?${q0}&signature=${hmacHex(sec, q0)}`, { headers: { "X-MBX-APIKEY": key }, cache: "no-store" });
      const d0 = await asJson(r0);
      if (!r0.ok) return { ok: false, error: d0?.msg || `binance ${r0.status}` };
      if (fut) {
        const pos = (Array.isArray(d0) ? d0 : []).filter((x: { positionAmt?: string }) => Math.abs(Number(x.positionAmt || 0)) > 0);
        return { ok: true, data: { open: pos.length > 0, detail: pos.map((x: { positionAmt?: string; positionSide?: string }) => `${x.positionSide || ""} ${x.positionAmt}`).join(", ") } };
      }
      const baseAsset = sym.replace(/(USDT|USDC|FDUSD|BUSD|TRY)$/, "");
      const b0 = (d0?.balances || []).find((x: { asset: string }) => x.asset === baseAsset);
      const amt = b0 ? Number(b0.free || 0) + Number(b0.locked || 0) : 0;
      const pr = await fetch(`${base}/api/v3/ticker/price?symbol=${encodeURIComponent(sym)}`, { cache: "no-store" }).then((x) => x.json()).catch(() => ({}));
      const val = amt * Number(pr?.price || 0);
      return { ok: true, data: { open: val >= 5, detail: `${baseAsset} ${amt} (~${val.toFixed(2)} USDT)` } };
    }
    case "leverage": if (!fut) throw new Error("spot'ta kaldıraç yok"); method = "POST"; path = "/fapi/v1/leverage"; params = { symbol: p.symbol, leverage: p.leverage }; break;
    case "marginType": if (!fut) throw new Error("spot'ta marjin modu yok"); method = "POST"; path = "/fapi/v1/marginType"; params = { symbol: p.symbol, marginType: p.marginType }; break;
    case "order": {
      method = "POST"; path = fut ? "/fapi/v1/order" : "/api/v3/order";
      const allow = ["symbol", "side", "type", "quantity", "quoteOrderQty", "positionSide", "reduceOnly", "newClientOrderId", "price", "stopPrice", "timeInForce", "closePosition", "workingType"];
      for (const k of allow) if (p[k] !== undefined) params[k] = p[k];
      break;
    }
    default: throw new Error("geçersiz action");
  }
  const q = qs({ ...params, recvWindow: 5000, timestamp: Date.now() });
  const r = await fetch(`${base}${path}?${q}&signature=${hmacHex(sec, q)}`, { method, headers: { "X-MBX-APIKEY": key }, cache: "no-store" });
  const data = await asJson(r);
  return { ok: r.ok, data, error: r.ok ? undefined : (data?.msg || `binance ${r.status}`) };
}

async function bybit(b: Body, key: string, sec: string) {
  if (b.action !== "balance") return { ok: false, error: "Bybit emir: yakında" };
  const base = b.testnet ? "https://api-testnet.bybit.com" : "https://api.bybit.com";
  const q = "accountType=UNIFIED", ts = String(Date.now()), rw = "5000";
  const r = await fetch(`${base}/v5/account/wallet-balance?${q}`, { headers: {
    "X-BAPI-API-KEY": key, "X-BAPI-TIMESTAMP": ts, "X-BAPI-RECV-WINDOW": rw,
    "X-BAPI-SIGN": hmacHex(sec, ts + key + rw + q) }, cache: "no-store" });
  const data = await asJson(r);
  const ok = r.ok && data?.retCode === 0;
  return { ok, data, error: ok ? undefined : data?.retMsg || `bybit ${r.status}` };
}

async function okx(b: Body, key: string, sec: string, pass: string) {
  if (b.action !== "balance") return { ok: false, error: "OKX emir: yakında" };
  const path = "/api/v5/account/balance", ts = new Date().toISOString();
  const h: Record<string, string> = { "OK-ACCESS-KEY": key, "OK-ACCESS-PASSPHRASE": pass, "OK-ACCESS-TIMESTAMP": ts,
    "OK-ACCESS-SIGN": hmacB64(sec, ts + "GET" + path) };
  if (b.testnet) h["x-simulated-trading"] = "1";
  const r = await fetch(`https://www.okx.com${path}`, { headers: h, cache: "no-store" });
  const data = await asJson(r);
  const ok = r.ok && data?.code === "0";
  return { ok, data, error: ok ? undefined : data?.msg || `okx ${r.status}` };
}

async function bitget(b: Body, key: string, sec: string, pass: string) {
  if (b.action !== "balance") return { ok: false, error: "Bitget emir: yakında" };
  const fut = b.market === "futures";
  const path = fut ? "/api/v2/mix/account/accounts" : "/api/v2/spot/account/assets";
  const q = fut ? "productType=USDT-FUTURES" : "";
  const ts = String(Date.now());
  const r = await fetch(`https://api.bitget.com${path}${q ? "?" + q : ""}`, { headers: {
    "ACCESS-KEY": key, "ACCESS-PASSPHRASE": pass, "ACCESS-TIMESTAMP": ts, "locale": "en-US",
    "ACCESS-SIGN": hmacB64(sec, ts + "GET" + path + (q ? "?" + q : "")),
    ...(b.testnet ? { paptrading: "1" } : {}) }, cache: "no-store" });
  const data = await asJson(r);
  const ok = r.ok && data?.code === "00000";
  return { ok, data, error: ok ? undefined : data?.msg || `bitget ${r.status}` };
}

export async function POST(req: NextRequest) {
  try {
    const b = (await req.json().catch(() => ({}))) as Body;
    const ex = String(b.exchange || "").toLowerCase();
    const env = (n: string) => process.env[`QX_${ex.toUpperCase()}_${n}`] || "";
    const key = (b.apiKey || "").trim() || env("KEY");
    const sec = (b.apiSecret || "").trim() || env("SECRET");
    const pass = (b.passphrase || "").trim() || env("PASS");
    if (b.action !== "price" && (!key || !sec)) return NextResponse.json({ ok: false, error: "API key / secret gerekli" }, { status: 400 });
    let out: { ok: boolean; data?: unknown; error?: string };
    if (ex === "binance") out = await binance(b, key, sec);
    else if (ex === "bybit") out = await bybit(b, key, sec);
    else if (ex === "okx") out = await okx(b, key, sec, pass);
    else if (ex === "bitget") out = await bitget(b, key, sec, pass);
    else out = { ok: false, error: "borsa desteklenmiyor (yakında)" };
    return NextResponse.json(out, { status: out.ok ? 200 : 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "exchange hata" }, { status: 500 });
  }
}
