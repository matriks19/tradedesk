/**
 * Binance REST koruyucu (sunucu tarafı, tüm istekler aynı egress IP'yi paylaşır).
 * - X-MBX-USED-WEIGHT-1M okunur; limitin %60'ı aşılırsa dakika dolana kadar bekletilir.
 * - 418/429 → Retry-After / "banned until <ms>" süresince Binance'e HİÇ istek atılmaz; cache'ten dönülür ya da 429 + Retry-After.
 * - Kısa süreli cache (klines 60 sn, ticker 30 sn, exchangeInfo 1 sa) + aynı isteği birleştirme + eşzamanlılık 4.
 */
type Entry = { exp: number; status: number; body: string; ct: string };
type G = {
  banUntil: number; weight: number; weightMin: number; host: string;
  cache: Map<string, Entry>; inflight: Map<string, Promise<Entry>>; active: number; waiters: (() => void)[];
  log: { t: number; w: number; host: string }[];
};
const g = globalThis as unknown as { __qxBinGuard?: G };
const S: G = (g.__qxBinGuard ??= { banUntil: 0, weight: 0, weightMin: 0, host: "", cache: new Map(), inflight: new Map(), active: 0, waiters: [], log: [] });

const MAX_CONC = 4;
const limitFor = (url: string) => (/fapi|binance\.com\/fapi/.test(url) ? 2400 : 6000);
const minuteOf = (t: number) => Math.floor(t / 60000);

export function guardStatus() {
  const now = Date.now();
  return {
    banUntil: S.banUntil > now ? S.banUntil : 0,
    usedWeight1m: minuteOf(now) === S.weightMin ? S.weight : 0,
    host: S.host,
    cacheSize: S.cache.size,
    recent: S.log.slice(-20),
  };
}
export function banActive() { return S.banUntil > Date.now(); }

async function acquire() {
  if (S.active < MAX_CONC) { S.active++; return; }
  await new Promise<void>((r) => S.waiters.push(r));
  S.active++;
}
function release() { S.active--; const w = S.waiters.shift(); if (w) w(); }

function ttlFor(url: string) {
  if (/exchangeInfo/.test(url)) return 3600_000;
  if (/ticker/.test(url)) return 30_000;
  if (/klines/.test(url)) return 60_000;
  return 15_000;
}

function banResponse(): Entry {
  const sec = Math.max(1, Math.ceil((S.banUntil - Date.now()) / 1000));
  return { exp: 0, status: 429, ct: "application/json", body: JSON.stringify({ code: -1003, error: "binance-ban", msg: "Binance geçici engel", banUntil: S.banUntil, retryAfter: sec }) };
}

async function doFetch(url: string): Promise<Entry> {
  // %60 eşiği: dakika dolana kadar bekle
  const lim = limitFor(url);
  if (minuteOf(Date.now()) === S.weightMin && S.weight >= lim * 0.6) {
    const wait = 60000 - (Date.now() % 60000) + 250;
    await new Promise((r) => setTimeout(r, wait));
  }
  if (banActive()) return banResponse();
  await acquire();
  try {
    if (banActive()) return banResponse();
    const res = await fetch(url, { cache: "no-store" });
    const w = Number(res.headers.get("x-mbx-used-weight-1m") || res.headers.get("x-mbx-used-weight") || NaN);
    if (Number.isFinite(w)) {
      S.weight = w; S.weightMin = minuteOf(Date.now()); S.host = new URL(url).host;
      S.log.push({ t: Date.now(), w, host: S.host }); if (S.log.length > 200) S.log.splice(0, S.log.length - 200);
    }
    const body = await res.text();
    if (res.status === 418 || res.status === 429) {
      let until = 0;
      const m = body.match(/banned until (\d{12,})/);
      if (m) until = Number(m[1]);
      const ra = Number(res.headers.get("retry-after") || 0);
      if (!until) until = Date.now() + Math.max(res.status === 418 ? 120 : 60, ra || 0) * 1000;
      S.banUntil = Math.max(S.banUntil, until);
      console.warn(`[binanceGuard] ${res.status} → istek yok ${new Date(S.banUntil).toISOString()}'a kadar`);
      return banResponse();
    }
    return { exp: res.ok ? Date.now() + ttlFor(url) : 0, status: res.status, body, ct: res.headers.get("content-type") || "application/json" };
  } finally { release(); }
}

/** Korunan GET. Ban sırasında: bayat cache varsa onu, yoksa 429 + Retry-After. */
export async function guardedGet(url: string): Promise<Entry & { cached?: boolean; stale?: boolean }> {
  const now = Date.now();
  const c = S.cache.get(url);
  if (c && c.exp > now) return { ...c, cached: true };
  if (banActive()) return c ? { ...c, cached: true, stale: true } : banResponse();
  let p = S.inflight.get(url);
  if (!p) {
    p = doFetch(url).finally(() => S.inflight.delete(url));
    S.inflight.set(url, p);
  }
  const e = await p;
  if (e.status === 200 && e.exp) {
    S.cache.set(url, e);
    if (S.cache.size > 3000) { for (const [k, v] of S.cache) { if (v.exp < now) S.cache.delete(k); } if (S.cache.size > 3000) S.cache.clear(); }
  } else if (e.status === 429 && c) return { ...c, cached: true, stale: true };
  return e;
}
