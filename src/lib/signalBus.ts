// [bridge138] Ortak sinyal yolu: TradeDesk Liste Tarama → QUANTEX robotu (aynı origin).
// Sadece kendi anahtarlarını yazar; başka localStorage verisine dokunmaz.
export const BUS_KEY = "qx_signal_bus_v1";
export const LINKS_KEY = "qx_bus_links_v1";
export type BusSignal = {
  id: string; src: string; cond: string; symbol: string; market: "coin" | "bist";
  tf: string; side: "LONG" | "SHORT"; t: number; barsAgo: number; note?: string;
  ph?: string; pchg?: boolean; uev?: { ok: boolean; ev: number; oos: number; n: number } | null; params?: Record<string, unknown>;
};
function readJ<T>(k: string, d: T): T {
  try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v ?? d; } catch { return d; }
}
export function getLinks(): string[] { return readJ<string[]>(LINKS_KEY, []); }
export function setLink(kind: string, on: boolean) {
  const s = new Set(getLinks()); if (on) s.add(kind); else s.delete(kind);
  try { localStorage.setItem(LINKS_KEY, JSON.stringify([...s])); } catch {}
}
export function publish(list: Omit<BusSignal, "id" | "t">[]): number {
  if (!list.length) return 0;
  const bus = readJ<BusSignal[]>(BUS_KEY, []);
  const seen = new Set(bus.map((x) => x.id));
  const now = Date.now(); let n = 0;
  const slot = (tf: string) => { const m: Record<string, number> = { "1m": 6e4, "5m": 3e5, "15m": 9e5, "30m": 18e5, "1h": 36e5, "2h": 72e5, "4h": 144e5, "1d": 864e5 }; return Math.floor(now / (m[tf] || 36e5)); };
  for (const s of list) {
    const id = `${s.src}:${s.cond}|${s.symbol}|${s.tf}|${s.side}|${slot(s.tf)}`;
    if (seen.has(id)) continue; seen.add(id); n++;
    bus.push({ ...s, id, t: now });
  }
  const keep = bus.filter((x) => now - x.t < 2 * 864e5).slice(-500);
  try { localStorage.setItem(BUS_KEY, JSON.stringify(keep)); } catch {}
  try { const bc = new BroadcastChannel("qx_signal_bus"); bc.postMessage({ type: "signals", n }); bc.close(); } catch {}
  return n;
}

// [kombin140] Ayar özeti / hash + kullanıcı testi + kombin ayarları
export const DEFHASH_KEY = "qx_ev_defhash_v1";
export const USER_EV_KEY = "qx_ev_user_v1";
export const KOMBIN_KEY = "qx_kombin_v1";
export const LAB37 = ["1000PEPEUSDT","AAVEUSDT","ADAUSDT","APTUSDT","ARBUSDT","ATOMUSDT","AVAXUSDT","BCHUSDT","BNBUSDT","BTCUSDT","DOGEUSDT","DOTUSDT","DYDXUSDT","ETCUSDT","ETHUSDT","FETUSDT","FILUSDT","GALAUSDT","IMXUSDT","INJUSDT","JUPUSDT","LINKUSDT","LTCUSDT","NEARUSDT","OPUSDT","ORDIUSDT","SANDUSDT","SEIUSDT","SOLUSDT","STXUSDT","SUIUSDT","TIAUSDT","TRXUSDT","UNIUSDT","WIFUSDT","WLDUSDT","XRPUSDT"];
export function paramsOf(c: unknown): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (!c || typeof c !== "object") return o;
  for (const [k, v] of Object.entries(c as Record<string, unknown>).sort()) {
    if (k === "enabled" || k === "conds" || k === "mintick" || /^color/i.test(k) || typeof v === "function") continue;
    o[k] = v;
  }
  return o;
}
export function hashOf(p: unknown): string {
  const s = JSON.stringify(p); let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
export function baseHash(kind: string, h: string): string {
  const m = readJ<Record<string, string>>(DEFHASH_KEY, {});
  if (!m[kind]) { m[kind] = h; try { localStorage.setItem(DEFHASH_KEY, JSON.stringify(m)); } catch {} }
  return m[kind];
}
export type EvRow = { n: number; p: number; b: number; ev: number; oos: number };
export function userEv(): Record<string, EvRow> { return readJ(USER_EV_KEY, {}); }
export function saveUserEv(rows: Record<string, EvRow>) {
  try { localStorage.setItem(USER_EV_KEY, JSON.stringify({ ...userEv(), ...rows })); } catch {}
}
export function evStats(rs: number[], oosFrom: number): EvRow {
  const f = (x: number[]) => { const w = x.filter((r) => r > 0), l = x.filter((r) => r <= 0).map((r) => -r);
    if (!w.length || !l.length) return { n: x.length, p: w.length / Math.max(1, x.length), b: 0, ev: -1 };
    const p = w.length / x.length, b = (w.reduce((a, c) => a + c, 0) / w.length) / (l.reduce((a, c) => a + c, 0) / l.length);
    return { n: x.length, p, b, ev: p * b - (1 - p) }; };
  const a = f(rs), o = f(rs.slice(oosFrom));
  return { n: a.n, p: a.p, b: a.b, ev: a.ev, oos: o.ev };
}
export type Kombin = { on: boolean; tf: string; chips: { k: string; w: number }[]; K: number; minScore: number; M: number; name?: string };
export function getKombin(): Kombin | null { return readJ<Kombin | null>(KOMBIN_KEY, null); }
export function setKombin(k: Kombin) { try { localStorage.setItem(KOMBIN_KEY, JSON.stringify(k)); } catch {} }
