// [bridge138] Ortak sinyal yolu: TradeDesk Liste Tarama → QUANTEX robotu (aynı origin).
// Sadece kendi anahtarlarını yazar; başka localStorage verisine dokunmaz.
export const BUS_KEY = "qx_signal_bus_v1";
export const LINKS_KEY = "qx_bus_links_v1";
export type BusSignal = {
  id: string; src: string; cond: string; symbol: string; market: "coin" | "bist";
  tf: string; side: "LONG" | "SHORT"; t: number; barsAgo: number; note?: string;
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
