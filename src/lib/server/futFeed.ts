/**
 * USDT-M PERPETUAL vadeli veri zinciri (sunucu tarafı).
 * Sıra: Binance fapi → Bybit linear → OKX SWAP → Gate.io futures_usdt.
 * Tüm çıktılar Binance fapi biçimine normalize edilir. ASLA spot'a düşmez.
 */
export type FutSrc = "binance" | "bybit" | "okx" | "gate";
type Row = (string | number)[];

const H = { Accept: "application/json", "User-Agent": "Mozilla/5.0 (TradeDesk futures proxy)" };
const IV_MS: Record<string, number> = { "1m": 6e4, "3m": 18e4, "5m": 3e5, "15m": 9e5, "30m": 18e5, "1h": 36e5, "2h": 72e5, "4h": 144e5, "6h": 216e5, "8h": 288e5, "12h": 432e5, "1d": 864e5, "3d": 2592e5, "1w": 6048e5, "1M": 2592e6 };
const BYBIT_IV: Record<string, string> = { "1m": "1", "3m": "3", "5m": "5", "15m": "15", "30m": "30", "1h": "60", "2h": "120", "4h": "240", "6h": "360", "12h": "720", "1d": "D", "1w": "W", "1M": "M" };
const OKX_IV: Record<string, string> = { "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1H", "2h": "2H", "4h": "4H", "6h": "6Hutc", "12h": "12Hutc", "1d": "1Dutc", "1w": "1Wutc", "1M": "1Mutc" };
const GATE_IV: Record<string, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h", "4h": "4h", "8h": "8h", "1d": "1d" };

/** Bir kaynak engelliyse (451/403/ağ) bir süre atla. */
const down: Partial<Record<FutSrc, number>> = {};
function isDown(s: FutSrc) { return (down[s] || 0) > Date.now(); }
function markDown(s: FutSrc, ms = 5 * 60e3) { down[s] = Date.now() + ms; }

class HttpErr extends Error { constructor(public status: number, m: string) { super(m); } }
async function j(url: string, src: FutSrc): Promise<any> {
  let r: Response;
  try {
    r = await fetch(url, { cache: "no-store", headers: H, signal: AbortSignal.timeout(8000) });
  } catch (e) {
    markDown(src, 60e3);
    throw e;
  }
  if (r.status === 451 || r.status === 403) { markDown(src); throw new HttpErr(r.status, src + " " + r.status); }
  if (r.status === 429 || r.status === 418) { markDown(src, 60e3); throw new HttpErr(r.status, src + " " + r.status); }
  if (!r.ok) throw new HttpErr(r.status, src + " HTTP " + r.status);
  return r.json();
}

/** 1000PEPEUSDT → {base:"PEPE", mult:1000}. Bybit aynı adı kullanır; OKX/Gate tekil birim kullanır. */
export function mapSym(sym: string) {
  const s = sym.toUpperCase().replace(/\.P$/, "");
  const m = /^(1000000|10000|1000|1M)(.+)USDT$/.exec(s);
  if (m) return { sym: s, base: m[2]!, mult: m[1] === "1M" ? 1e6 : Number(m[1]) };
  return { sym: s, base: s.replace(/USDT$/, ""), mult: 1 };
}
const n = (x: unknown) => Number(x);
const fx = (x: number) => (Number.isFinite(x) ? String(+x.toPrecision(12)) : "0");

function klRow(t: number, o: number, h: number, l: number, c: number, v: number, qv: number, ivMs: number): Row {
  return [t, fx(o), fx(h), fx(l), fx(c), fx(v), t + ivMs - 1, fx(qv), 0, "0", "0", "0"];
}

// ---------- klines ----------
async function klBinance(sym: string, iv: string, limit: number, endTime?: number): Promise<Row[]> {
  const out: Row[] = [];
  let end = endTime;
  while (out.length < limit) {
    const q = new URLSearchParams({ symbol: sym, interval: iv, limit: String(Math.min(1500, limit - out.length)) });
    if (end) q.set("endTime", String(end));
    const d = await j("https://fapi.binance.com/fapi/v1/klines?" + q, "binance");
    if (!Array.isArray(d) || !d.length) break;
    out.unshift(...d);
    if (d.length < Math.min(1500, limit)) break;
    end = Number(d[0][0]) - 1;
  }
  return out;
}
async function klBybit(sym: string, iv: string, limit: number, endTime?: number): Promise<Row[]> {
  const bi = BYBIT_IV[iv]; if (!bi) throw new Error("bybit iv");
  const ivMs = IV_MS[iv]!; const out: Row[] = []; let end = endTime;
  for (let p = 0; p < 20 && out.length < limit; p++) {
    const q = new URLSearchParams({ category: "linear", symbol: sym, interval: bi, limit: String(Math.min(1000, limit - out.length)) });
    if (end) q.set("end", String(end));
    const d = await j("https://api.bybit.com/v5/market/kline?" + q, "bybit");
    if (d?.retCode !== 0) throw new Error("bybit " + d?.retMsg);
    const list: string[][] = d.result?.list || [];
    if (!list.length) break;
    const rows = list.map((r) => klRow(n(r[0]), n(r[1]), n(r[2]), n(r[3]), n(r[4]), n(r[5]), n(r[6]), ivMs)).reverse();
    out.unshift(...rows);
    if (list.length < Math.min(1000, limit)) break;
    end = Number(rows[0]![0]) - 1;
  }
  return out;
}
async function klOkx(sym: string, iv: string, limit: number, endTime?: number): Promise<Row[]> {
  const bi = OKX_IV[iv]; if (!bi) throw new Error("okx iv");
  const { base, mult } = mapSym(sym); const inst = base + "-USDT-SWAP";
  const ivMs = IV_MS[iv]!; const out: Row[] = []; let after = endTime ? endTime + 1 : 0;
  for (let p = 0; p < 16 && out.length < limit; p++) {
    const ps = Math.min(100, limit - out.length);
    const q = new URLSearchParams({ instId: inst, bar: bi, limit: String(ps) });
    if (after) q.set("after", String(after));
    const d = await j("https://www.okx.com/api/v5/market/history-candles?" + q, "okx");
    if (d?.code !== "0") throw new Error("okx " + d?.msg);
    const list: string[][] = d.data || [];
    if (!list.length) break;
    // [ts,o,h,l,c,vol(kontrat),volCcy(baz),volCcyQuote,confirm]
    const rows = list.map((r) => klRow(n(r[0]), n(r[1]) * mult, n(r[2]) * mult, n(r[3]) * mult, n(r[4]) * mult, n(r[6]) / mult, n(r[7]), ivMs)).reverse();
    out.unshift(...rows);
    if (list.length < ps) break;
    after = Number(rows[0]![0]);
  }
  return out;
}
async function klGate(sym: string, iv: string, limit: number, endTime?: number): Promise<Row[]> {
  const gi = GATE_IV[iv]; if (!gi) throw new Error("gate iv");
  const { base, mult } = mapSym(sym); const ivMs = IV_MS[iv]!;
  const c = await j("https://api.gateio.ws/api/v4/futures/usdt/contracts/" + base + "_USDT", "gate").catch(() => null);
  const qm = c ? n(c.quanto_multiplier) || 1 : 1;
  const out: Row[] = []; let to = endTime ? Math.floor(endTime / 1000) : 0;
  for (let p = 0; p < 10 && out.length < limit; p++) {
    const want = Math.min(1999, limit - out.length);
    const q = new URLSearchParams({ contract: base + "_USDT", interval: gi });
    // Gate: from+to ile pencere iste (limit ile to birlikte kullanılamaz)
    const toS = to || Math.floor(Date.now() / 1000);
    q.set("to", String(toS)); q.set("from", String(toS - Math.floor((want * ivMs) / 1000) + 1));
    const d = await j("https://api.gateio.ws/api/v4/futures/usdt/candlesticks?" + q, "gate");
    if (!Array.isArray(d) || !d.length) break;
    const rows = d.map((r: any) => klRow(n(r.t) * 1000, n(r.o) * mult, n(r.h) * mult, n(r.l) * mult, n(r.c) * mult, (n(r.v) * qm) / mult, n(r.sum), ivMs));
    out.unshift(...rows);
    to = Math.floor(Number(rows[0]![0]) / 1000) - 1;
  }
  return out.slice(-limit);
}

/** 3g mumu olmayan kaynaklar (Bybit/OKX/Gate) için: 1g mumlarından UTC 3 günlük kovalar (Binance 3d ile aynı hiza: t % 3g = 0).
 *  Eksik başlayan ilk kova atlanır; son (açık) kova Binance'teki gibi açık mum olarak kalır. */
function agg3d(rows: Row[], limit: number): Row[] {
  const B = IV_MS["3d"]!; const out: Row[] = []; let cur: number[] | null = null; let b0 = -1; let first = 0;
  const flush = () => { if (cur && first === b0) out.push(klRow(b0, cur[0]!, cur[1]!, cur[2]!, cur[3]!, cur[4]!, cur[5]!, B)); };
  for (const r of rows) {
    const t = Number(r[0]), b = Math.floor(t / B) * B;
    if (b !== b0) { flush(); b0 = b; first = t; cur = [n(r[1]), n(r[2]), n(r[3]), n(r[4]), n(r[5]), n(r[7])]; }
    else if (cur) { cur[1] = Math.max(cur[1]!, n(r[2])); cur[2] = Math.min(cur[2]!, n(r[3])); cur[3] = n(r[4]); cur[4] = cur[4]! + n(r[5]); cur[5] = cur[5]! + n(r[7]); }
  }
  flush();
  return out.slice(-limit);
}

export async function futKlines(sym: string, iv: string, limit: number, endTime?: number): Promise<{ rows: Row[]; src: FutSrc }> {
  const s = mapSym(sym).sym; const errs: string[] = [];
  const chain: [FutSrc, typeof klBinance][] = [["binance", klBinance], ["bybit", klBybit], ["okx", klOkx], ["gate", klGate]];
  for (const [src, f] of chain) {
    if (isDown(src)) continue;
    try {
      const a3 = iv === "3d" && src !== "binance";
      const rows = a3 ? agg3d(await f(s, "1d", Math.min(4500, limit * 3 + 3), endTime), limit) : await f(s, iv, limit, endTime);
      if (rows.length) {
        const last = Number(rows[rows.length - 1]![0]);
        // bayat veri reddi (endTime yoksa)
        if (!endTime && Date.now() - last > Math.max(3 * (IV_MS[iv] || 864e5), 3 * 864e5)) { errs.push(src + ": bayat"); continue; }
        return { rows, src };
      }
      errs.push(src + ": boş");
    } catch (e) { errs.push(src + ": " + (e instanceof Error ? e.message : "hata")); }
  }
  throw new Error("vadeli kaynak yok (" + errs.join("; ") + ")");
}

// ---------- ticker ----------
type Tk = { symbol: string; lastPrice: string; priceChangePercent: string; priceChange: string; openPrice: string; highPrice: string; lowPrice: string; volume: string; quoteVolume: string; closeTime: number };
function tk(symbol: string, last: number, open: number, hi: number, lo: number, vol: number, qv: number): Tk {
  return { symbol, lastPrice: fx(last), openPrice: fx(open), priceChange: fx(last - open), priceChangePercent: open > 0 ? ((last / open - 1) * 100).toFixed(3) : "0", highPrice: fx(hi), lowPrice: fx(lo), volume: fx(vol), quoteVolume: fx(qv), closeTime: Date.now() };
}
let allCache: { at: number; d: Tk[]; src: FutSrc } | null = null;

async function tkBinance(sym?: string): Promise<Tk[]> {
  const d = await j("https://fapi.binance.com/fapi/v1/ticker/24hr" + (sym ? "?symbol=" + sym : ""), "binance");
  return Array.isArray(d) ? d : [d];
}
async function tkBybit(sym?: string): Promise<Tk[]> {
  const d = await j("https://api.bybit.com/v5/market/tickers?category=linear" + (sym ? "&symbol=" + sym : ""), "bybit");
  if (d?.retCode !== 0) throw new Error("bybit " + d?.retMsg);
  return (d.result?.list || []).filter((r: any) => /USDT$/.test(r.symbol)).map((r: any) => tk(r.symbol, n(r.lastPrice), n(r.prevPrice24h), n(r.highPrice24h), n(r.lowPrice24h), n(r.volume24h), n(r.turnover24h)));
}
async function tkOkx(sym?: string): Promise<Tk[]> {
  const ms = sym ? mapSym(sym) : null;
  const d = await j("https://www.okx.com/api/v5/market/" + (ms ? "ticker?instId=" + ms.base + "-USDT-SWAP" : "tickers?instType=SWAP"), "okx");
  if (d?.code !== "0") throw new Error("okx " + d?.msg);
  return (d.data || []).filter((r: any) => /-USDT-SWAP$/.test(r.instId)).map((r: any) => {
    const m = ms ? ms.mult : 1, s = ms ? ms.sym : r.instId.replace("-USDT-SWAP", "") + "USDT";
    return tk(s, n(r.last) * m, n(r.open24h) * m, n(r.high24h) * m, n(r.low24h) * m, n(r.volCcy24h) / m, n(r.volCcy24h) * n(r.last));
  });
}
async function tkGate(sym?: string): Promise<Tk[]> {
  const ms = sym ? mapSym(sym) : null;
  const d = await j("https://api.gateio.ws/api/v4/futures/usdt/tickers" + (ms ? "?contract=" + ms.base + "_USDT" : ""), "gate");
  return (Array.isArray(d) ? d : []).map((r: any) => {
    const m = ms ? ms.mult : 1, s = ms ? ms.sym : String(r.contract).replace("_USDT", "") + "USDT";
    const last = n(r.last), pct = n(r.change_percentage);
    return tk(s, last * m, (last / (1 + pct / 100)) * m, n(r.high_24h) * m, n(r.low_24h) * m, n(r.volume_24h_base) / m, n(r.volume_24h_quote));
  });
}

export async function futTicker24(sym?: string): Promise<{ d: Tk[]; src: FutSrc }> {
  const s = sym ? mapSym(sym).sym : undefined;
  if (!s && allCache && Date.now() - allCache.at < 5000) return { d: allCache.d, src: allCache.src };
  const errs: string[] = [];
  const chain: [FutSrc, (x?: string) => Promise<Tk[]>][] = [["binance", tkBinance], ["bybit", tkBybit], ["okx", tkOkx], ["gate", tkGate]];
  for (const [src, f] of chain) {
    if (isDown(src)) continue;
    try {
      const d = (await f(s)).filter((x) => n(x.lastPrice) > 0);
      if (d.length) { if (!s) allCache = { at: Date.now(), d, src }; return { d, src }; }
      errs.push(src + ": boş");
    } catch (e) { errs.push(src + ": " + (e instanceof Error ? e.message : "hata")); }
  }
  throw new Error("vadeli ticker yok (" + errs.join("; ") + ")");
}

// ---------- exchangeInfo ----------
let exCache: { at: number; d: any; src: FutSrc } | null = null;
export async function futExchangeInfo(): Promise<{ at?: number; d: any; src: FutSrc }> {
  if (exCache && Date.now() - exCache.at < 10 * 60e3) return exCache;
  const mk = (syms: string[]) => ({ timezone: "UTC", serverTime: Date.now(), symbols: syms.map((s) => ({ symbol: s, pair: s, status: "TRADING", contractType: "PERPETUAL", baseAsset: s.replace(/USDT$/, ""), quoteAsset: "USDT", marginAsset: "USDT" })) });
  const errs: string[] = [];
  if (!isDown("binance")) {
    try {
      const d = await j("https://fapi.binance.com/fapi/v1/exchangeInfo", "binance");
      d.symbols = (d.symbols || []).filter((s: any) => s.status === "TRADING" && s.quoteAsset === "USDT" && s.contractType === "PERPETUAL");
      return (exCache = { at: Date.now(), d, src: "binance" });
    } catch (e) { errs.push(String(e)); }
  }
  if (!isDown("bybit")) {
    try {
      const d = await j("https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000", "bybit");
      const syms = (d.result?.list || []).filter((s: any) => s.status === "Trading" && s.quoteCoin === "USDT" && s.contractType === "LinearPerpetual").map((s: any) => s.symbol);
      if (syms.length) return (exCache = { at: Date.now(), d: mk(syms), src: "bybit" });
    } catch (e) { errs.push(String(e)); }
  }
  for (const src of ["okx", "gate"] as FutSrc[]) {
    if (isDown(src)) continue;
    try {
      const t = src === "okx" ? await tkOkx() : await tkGate();
      if (t.length) return (exCache = { at: Date.now(), d: mk(t.map((x) => x.symbol)), src });
    } catch (e) { errs.push(String(e)); }
  }
  throw new Error("vadeli exchangeInfo yok (" + errs.join("; ") + ")");
}
