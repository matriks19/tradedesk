/**
 * QUANTEX paper bot — headless (GitHub Actions). PAPER ONLY: hiçbir borsa emri gönderilmez, API anahtarı kullanılmaz.
 * Run: npx tsx scripts/paper-bot/run.ts  (STATE_FILE=path/state.json)
 * Kurallar (quantex.html robotundan): global TP/SL (fiyat %), 1m iğne kontrolü (önce SL), slot sınırı, toplam marjin ≤ bakiye,
 * tur başı yeni giriş ≤ maxNew, sembol başı tek pozisyon. Binance: ≤4 istek/sn sıra, 418/429 → Retry-After / ban bekleme.
 */
import fs from "node:fs";
import path from "node:path";
import type { Candle } from "../../src/lib/types";
import { scanSymbol, type ListScanConfig } from "../../src/lib/scanner/listScan";
import { tpcCalc } from "./tpc";
import { lsDivMacdEval, fetchLsRatio, multiDiv, type LsBar } from "../../src/lib/indicators/lsDivMacd";

type Src = { id: string; label: string; type: "list" | "tpc" | "lsdiv"; tf: string; k?: number; on: boolean; ev: boolean;
  scan?: ListScanConfig; sig?: string; tp?: number; exit?: string; maxH?: number };
type Cfg = {
  universeTop: number; extraSymbols: string[]; maxAge: number; allowShort: boolean; equity: number; leverage: number;
  riskPct: number; tp: number; sl: number; maxSlots: number; marginUsd?: number; maxNew: number; maxNewFirst?: number; perSymSig?: number; feePct: number; evGlobal: boolean; sources: Src[];
};
type Pos = { sym: string; side: "LONG" | "SHORT"; entry: number; last: number; src: string; lev: number;
  notional: number; qty: number; t: number; checked: number; pxSrc: string;
  sid?: string; tpPct?: number; exit?: string; maxH?: number; tf?: string; sigT?: number };
type Closed = Pos & { exit2?: string; exitPx: number; why: string; r: number; pnl: number; closedAt: number };
type State = { v: 1; equity: number; pnl: number; open: Pos[]; closed: Closed[]; log: string[];
  lastRun?: number; runs: number; dataSrc?: string; seen?: Record<string, number>; srcOff?: Record<string, string>; stats?: Stats };
type Stats = { since: number; peak: number; peakT: number; trough: number; maxDd: number; maxDdPct: number; maxDdT?: number;
  maxUp: number; maxUpPct: number; maxUpT?: number; low: number };

const DIR = path.dirname(new URL(import.meta.url).pathname);
const cfg: Cfg = JSON.parse(fs.readFileSync(path.join(DIR, "config.json"), "utf8"));
const STATE_FILE = process.env.STATE_FILE || path.join(DIR, "state.json");
const DRY = process.env.PAPER_DRY === "1";
const EV_TD: Record<string, { n: number; ev: number; oos: number }> = JSON.parse(fs.readFileSync(path.join(DIR, "ev_td.json"), "utf8"));
const TF_MS: Record<string, number> = { "15m": 9e5, "30m": 18e5, "1h": 36e5, "2h": 72e5, "4h": 144e5, "1d": 864e5 };

// ---------- Binance: 4 req/s queue + 418/429 back-off + endpoint fallback ----------
let lastReq = 0, banUntil = 0, reqCount = 0;
const GAP = 250;
async function pace() { const w = lastReq + GAP - Date.now(); if (w > 0) await new Promise((r) => setTimeout(r, w)); lastReq = Date.now(); }
class Banned extends Error {}
async function bget(url: string): Promise<{ status: number; json: unknown }> {
  if (Date.now() < banUntil) throw new Banned("binance ban/back-off until " + new Date(banUntil).toISOString());
  await pace(); reqCount++;
  const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ac.signal });
    if (r.status === 418 || r.status === 429) {
      const ra = +(r.headers.get("Retry-After") || 0);
      banUntil = Date.now() + 1000 * Math.max(r.status === 418 ? 120 : 60, ra || 0);
      throw new Banned(`HTTP ${r.status} — back-off ${Math.round((banUntil - Date.now()) / 1000)}s`);
    }
    return { status: r.status, json: await r.json().catch(() => null) };
  } finally { clearTimeout(to); }
}
const FUT_HOSTS = ["https://fapi.binance.com", "https://fapi1.binance.com", "https://fapi2.binance.com"];
const SPOT_FALLBACK = "https://data-api.binance.vision";
let futHost: string | null = null; // null = futures erişilemiyor → spot aynası
const reach: string[] = [];
async function pickHost() {
  for (const h of FUT_HOSTS) {
    try { const r = await bget(h + "/fapi/v1/ping"); reach.push(`${h} → ${r.status}`); if (r.status === 200) { futHost = h; return; } }
    catch (e) { if (e instanceof Banned) throw e; reach.push(`${h} → ${(e as Error).message}`); }
  }
  try { const r = await bget(SPOT_FALLBACK + "/api/v3/ping"); reach.push(`${SPOT_FALLBACK} → ${r.status}`); } catch (e) { reach.push(`${SPOT_FALLBACK} → ${(e as Error).message}`); }
}
const dataSrc = () => (futHost ? "perp" : "spot-mirror");
async function klines(sym: string, interval: string, limit: number, startTime?: number): Promise<number[][] | null> {
  const q = `symbol=${sym}&interval=${interval}&limit=${limit}` + (startTime ? `&startTime=${startTime}` : "");
  const u = futHost ? `${futHost}/fapi/v1/klines?${q}` : `${SPOT_FALLBACK}/api/v3/klines?${q}`;
  const r = await bget(u);
  return r.status === 200 && Array.isArray(r.json) ? (r.json as number[][]) : null;
}
async function universe(): Promise<string[]> {
  const u = futHost ? `${futHost}/fapi/v1/ticker/24hr` : `${SPOT_FALLBACK}/api/v3/ticker/24hr`;
  const r = await bget(u);
  const rows = Array.isArray(r.json) ? (r.json as { symbol: string; quoteVolume: string }[]) : [];
  const top = rows.filter((x) => /^[A-Z0-9]{2,15}USDT$/.test(x.symbol) && !/^(USDC|FDUSD|TUSD|BUSD|USDP|DAI|RLUSD|USD1|USDE|PYUSD)USDT$/.test(x.symbol))
    .sort((a, b) => +b.quoteVolume - +a.quoteVolume).slice(0, cfg.universeTop).map((x) => x.symbol);
  return Array.from(new Set([...cfg.extraSymbols, ...top]));
}

// ---------- state ----------
function loadState(): State {
  try { const j = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); return { v: 1, equity: cfg.equity, pnl: 0, open: [], closed: [], log: [], runs: 0, ...j }; }
  catch { return { v: 1, equity: cfg.equity, pnl: 0, open: [], closed: [], log: [], runs: 0 }; }
}
const st = loadState();
const alerts: string[] = [];
const trT = () => new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
function log(m: string) { const l = trT() + " " + m; st.log.push(l); console.log(l); }
const fmt = (v: number) => (+v).toPrecision(6);
const pr = (p: Pos) => (p.side === "LONG" ? p.last / p.entry - 1 : 1 - p.last / p.entry);
const fee = (p: Pos) => p.notional * (1 + p.last / p.entry) * (cfg.feePct / 100);

function closePos(i: number, why: string, px: number) {
  const p = st.open[i]; p.last = px;
  const r = pr(p), pnl = r * p.notional - fee(p);
  st.pnl += pnl; st.equity = +(st.equity + pnl).toFixed(4);
  st.closed.push({ ...p, exitPx: px, why, r, pnl, closedAt: Date.now() });
  st.open.splice(i, 1);
  const m = `🤖 PAPER ${why} kapattı: ${p.sym} ${p.side} ${(r * 100).toFixed(2)}% (${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDT net) · bakiye ${st.equity.toFixed(2)}`;
  log(m); alerts.push(m);
}

const tpOf = (p: Pos) => (p.tpPct && p.tpPct > 0 ? p.tpPct : cfg.tp) / 100; // kaynak TP'si yoksa global TP

// ---------- mum önbelleği (yalnız kapanmış mumlar → lookahead/repaint yok) ----------
const KC: Record<string, Candle[] | null> = {};
async function closed(sym: string, tf: string, limit = 1000): Promise<Candle[] | null> {
  const key = sym + "|" + tf; if (key in KC) return KC[key];
  const k = await klines(sym, tf, limit); const ms = TF_MS[tf];
  KC[key] = k ? k.filter((b) => +b[0] + ms <= Date.now()).map((b) => ({ time: Math.floor(+b[0] / 1000), open: +b[1], high: +b[2], low: +b[3], close: +b[4], volume: +b[5] })) : null;
  return KC[key];
}

// ---------- LS Uyumsuzluk + MACD verisi (4s perp mum + top-trader L/S POSITION + 1s perp mum) ----------
// Actions IP'leri fapi'ye 451 alırsa: L/S oranı Vercel fra1 proxy'sinden, mumlar Vercel futures proxy'sinden (spot'a düşmez).
const QX_PROXY = (process.env.QX_PROXY || "https://tradedesk-ochre.vercel.app").replace(/\/$/, "");
const LSC: Record<string, Promise<{ b4: LsBar[]; b1: LsBar[]; ratio: Map<number, number> } | null>> = {};
let lsProxyFail = 0;
async function perpBars(sym: string, tf: string, limit: number): Promise<LsBar[] | null> {
  const q = `symbol=${sym}&interval=${tf}&limit=${limit}`;
  const u = futHost ? `${futHost}/fapi/v1/klines?${q}` : `${QX_PROXY}/api/fapi/v1/klines?${q}`;
  const r = await bget(u);
  if (r.status !== 200 || !Array.isArray(r.json)) return null;
  const ms = TF_MS[tf];
  return (r.json as number[][]).filter((b) => +b[0] + ms <= Date.now()).map((b) => ({ time: Math.floor(+b[0] / 1000), low: +b[3], close: +b[4] }));
}
function lsData(sym: string) {
  return (LSC[sym] ||= (async () => {
    const hosts = futHost ? [futHost] : [];
    let ratio = await fetchLsRatio(sym, async (u) => { const r = await bget(u); return r.status === 200 ? r.json : null; }, hosts);
    if (!ratio && lsProxyFail < 5) {
      try { const r = await bget(`${QX_PROXY}/api/lsratio?symbol=${sym}&period=4h&limit=500`);
        if (r.status === 200 && Array.isArray(r.json) && r.json.length) { ratio = new Map((r.json as { timestamp: number; longShortRatio: string }[]).map((x) => [+x.timestamp, +x.longShortRatio])); lsProxyFail = 0; }
        else if (r.status !== 200 && r.status !== 503) lsProxyFail++; else if (r.status === 503) lsProxyFail++;
      } catch (e) { if (e instanceof Banned) throw e; lsProxyFail++; }
    }
    if (!ratio) return null;
    const b4 = await perpBars(sym, "4h", 300); if (!b4 || b4.length < 60) return null;
    // 1s mumları yalnız son ~52 saatte onaylanmış (ikili/üçlü) uyumsuzluk varsa çek (istek tasarrufu)
    const j4 = b4.filter((b) => ratio!.has(b.time * 1000));
    const recent = multiDiv(j4.map((b) => b.low), j4.map((b) => ratio!.get(b.time * 1000)!), 2).some((e) => Date.now() / 1000 - (j4[e.conf].time + 4 * 3600) <= 52 * 3600);
    if (!recent) return { b4, b1: [] as LsBar[], ratio };
    const b1 = await perpBars(sym, "1h", 1500); if (!b1 || b1.length < 500) return null;
    return { b4, b1, ratio };
  })().catch((e) => { if (e instanceof Banned) throw e; return null; }));
}

// ---------- TP/SL (1m iğne, önce SL) + kaynak çıkışı / süre limiti ----------
async function manage() {
  for (let i = st.open.length - 1; i >= 0; i--) {
    const p = st.open[i];
    const since = Math.max(p.t, p.checked || 0);
    const lim = Math.min(1000, Math.ceil((Date.now() - since) / 60000) + 2);
    const k = await klines(p.sym, "1m", lim, since);
    if (!k || !k.length) { log(`⚠ ${p.sym}: fiyat yok — SL bu tur kontrol edilemedi`); continue; }
    const slv = p.side === "LONG" ? p.entry * (1 - cfg.sl / 100) : p.entry * (1 + cfg.sl / 100);
    const tpv = p.side === "LONG" ? p.entry * (1 + tpOf(p)) : p.entry * (1 - tpOf(p));
    const closedBars = k.filter((b) => +b[0] + 60000 <= Date.now());
    let hit: [string, number] | null = null;
    for (const b of closedBars) {
      const h = +b[2], l = +b[3];
      if (cfg.sl > 0 && (p.side === "LONG" ? l <= slv : h >= slv)) { hit = ["SL", slv]; break; }
      if (p.side === "LONG" ? h >= tpv : l <= tpv) { hit = ["TP", tpv]; break; }
    }
    const last = +k[k.length - 1][4];
    if (closedBars.length) p.checked = +closedBars[closedBars.length - 1][0] + 60000;
    if (hit) { closePos(i, hit[0], hit[1]); continue; }
    if (Math.abs(last / p.entry - 1) > 0.5) { log(`⚠ ${p.sym} şüpheli fiyat ${fmt(last)} atlandı`); continue; }
    p.last = last;
    const r = pr(p);
    if (r >= tpOf(p)) { closePos(i, "TP", last); continue; }
    if (cfg.sl > 0 && r <= -cfg.sl / 100) { closePos(i, "SL", last); continue; }
    // süre limiti KALDIRILDI (maxH yalnızca bilgi amaçlı)
    const ms = p.tf ? TF_MS[p.tf] : 0;
    void ms; // süre limiti kapatmıyor; sadece raporda kalan süre gösterilir
    // kaynak çıkışı (ör. Fisher üst bant ↓) — son kapanmış mumda, giriş sonrası
    if (p.exit && p.tf) {
      const c = await closed(p.sym, p.tf);
      if (c && c.length >= 520) {
        const R = tpcCalc({ c: c.map((x) => x.close) }) as unknown as Record<string, boolean[]>;
        const j = c.length - 1;
        if (R[p.exit]?.[j] && c[j].time * 1000 + ms > p.t) { log(`Kaynak çıkışı (${p.exit}): ${p.sym} [${p.src}]`); closePos(i, "ÇIKIŞ", last); }
      }
    }
  }
}

// ---------- EV: backtest kapısı (QX_EV_TD) + canlı EV (kaynak başı son 30 işlem) ----------
const evOn = (s: Src) => cfg.evGlobal && s.ev;
function liveBad(s: Src): string {
  const a = st.closed.filter((x) => x.sid === s.id).slice(-30);
  if (a.length < 30) return "";
  const ev = a.reduce((x, y) => x + y.r * 100, 0) / a.length;
  return ev < 0 ? `canlı EV ${ev.toFixed(2)}% (son 30) < 0 — kaynak otomatik kapalı` : "";
}
function btGate(s: Src, hitKeys: string[]): string {
  for (const k of hitKeys) { const e = EV_TD[`${k}|coin|${s.tf}`]; if (e && !(e.n >= 30 && e.ev > 0 && e.oos > 0)) return `backtest EV ${k} ${s.tf}: n ${e.n} EV ${e.ev} OOS ${e.oos}`; }
  return "";
}

// ---------- tarama + giriş ----------
async function scanAndOpen() {
  const syms = await universe();
  st.seen = st.seen || {}; st.srcOff = st.srcOff || {};
  let nNew = 0, lsRan = false;
  const per: string[] = [];
  for (const s of cfg.sources.filter((x) => x.on)) {
    const bad = liveBad(s);
    if (bad && evOn(s)) { if (st.srcOff[s.id] !== bad) { st.srcOff[s.id] = bad; const m = `⛔ ${s.label}: ${bad}`; log(m); alerts.push(m); } per.push(`${s.label}: kapalı (canlı EV)`); continue; }
    delete st.srcOff[s.id];
    let scanned = 0, hits = 0, fail = 0, opened = 0;
    // LS kaynakları saatte bir taranır (1s kesişim; 4s oran 4 saatte bir değişir) → Binance/Vercel istek tasarrufu
    const hourNow = Math.floor(Date.now() / 36e5);
    if (s.type === "lsdiv" && (st as any).lsHour === hourNow) { per.push(`${s.label}: bu saat tarandı`); continue; }
    if (s.type === "lsdiv") lsRan = true;
    for (const sym of syms) {
      if (s.type === "lsdiv") {
        // LS Uyumsuzluk (4s, k=3 üçlü / k=2 ikili) + 1s MACD(50,100,200) yukarı kesişim ≤48s → LONG. Veri yoksa sembol atlanır.
        let d; try { d = await lsData(sym); } catch (e) { if (e instanceof Banned) throw e; d = null; }
        if (!d) { fail++; continue; }
        scanned++;
        const ev = lsDivMacdEval(d.b4, d.ratio, d.b1, [s.k ?? 3]).filter((e) => e.crossOpen !== null && e.crossAgo! <= cfg.maxAge);
        if (!ev.length) continue;
        const e0 = ev[0], sk = `${s.id}|${sym}`, bt = e0.crossOpen!;
        if (st.seen[sk] === bt) continue; // aynı kesişim bir kez
        const tag = `${s.k === 2 ? "ikili" : "üçlü"} div (dipler ${e0.priceLows.map(fmt).join(">")}, L/S ${e0.ratioLows.map((x) => x.toFixed(3)).join("<")}) + MACD↑`;
        hits++;
        const msg = `📡 ${sym} LONG [${s.label}: ${tag}] (yaş ${e0.crossAgo})`;
        const perCap = cfg.perSymSig ?? 1;
        const nSame = st.open.filter((p) => p.sym === sym && p.sid === s.id).length;
        if (nSame >= perCap) { log(msg + ` — atlandı: aynı sembol+sinyal sınırı (${nSame}/${perCap})`); continue; }
        const capNew = (st as any).firstScanDone ? cfg.maxNew : (cfg.maxNewFirst ?? cfg.maxNew);
        if (nNew >= capNew) { log(msg + ` — atlandı: tur başı yeni giriş sınırı (${capNew})`); continue; }
        if (st.open.length >= cfg.maxSlots) { log(msg + ` — atlandı: slot dolu (${st.open.length}/${cfg.maxSlots})`); continue; }
        const margin = cfg.marginUsd && cfg.marginUsd > 0 ? cfg.marginUsd : st.equity * cfg.riskPct / 100;
        const used = st.open.reduce((a, q) => a + q.notional / q.lev, 0);
        if (!(margin > 0) || used + margin > st.equity + 1e-9) { log(msg + " — atlandı: toplam marjin sınırı"); continue; }
        const price = d.b1[d.b1.length - 1].close, notional = margin * cfg.leverage;
        st.open.push({ sym, side: "LONG", entry: price, last: price, src: `${s.label} ${tag}`, lev: cfg.leverage, notional, qty: notional / price,
          t: Date.now(), checked: Date.now(), pxSrc: futHost ? "perp" : "perp-proxy", sid: s.id, tpPct: s.tp, tf: s.tf, sigT: bt * 1000 });
        nNew++; opened++; st.seen[sk] = bt;
        const m = `🤖 PAPER AL: ${sym} ${cfg.leverage}x @${fmt(price)} [${s.label}: ${tag}] marjin ${margin.toFixed(2)} · TP %${s.tp ?? cfg.tp} / SL ${cfg.sl > 0 ? "%" + cfg.sl : "yok"}`;
        log(m); alerts.push(m);
        continue;
      }
      const c = await closed(sym, s.tf);
      if (!c || c.length < (s.type === "tpc" ? 520 : 120)) { fail++; continue; }
      scanned++;
      let side: "LONG" | "SHORT" | null = null, tag = "", keys: string[] = [], age = 0, sk = "", bt = 0;
      if (s.type === "list") {
        let res; try { res = scanSymbol(c, s.scan!, cfg.maxAge); } catch { fail++; continue; }
        const bull = res.filter((h) => h.bias === "bull"), bear = res.filter((h) => h.bias === "bear");
        side = bull.length && !bear.length ? "LONG" : bear.length && !bull.length && cfg.allowShort ? "SHORT" : null;
        if (!side) continue;
        const hs = side === "LONG" ? bull : bear;
        keys = hs.map((h) => `${h.kind}:${h.cond}`); tag = keys.join("+"); age = Math.min(...hs.map((h) => h.barsAgo));
      } else {
        const R = tpcCalc({ c: c.map((x) => x.close) }) as unknown as Record<string, boolean[]>;
        const arr = R[s.sig!]; const n = c.length;
        // kombin girişi: yalnız SON kapanmış mum(lar) — maxAge kadar geriye (Actions gecikmesi için), aynı mum bir kez
        let j = -1; for (let a = 0; a <= cfg.maxAge; a++) if (arr?.[n - 1 - a]) { j = n - 1 - a; break; }
        if (j < 0) continue;
        side = "LONG"; tag = s.sig!; age = n - 1 - j;
        bt = c[j].time; sk = `${s.id}|${sym}`;
        if (st.seen[sk] === bt) continue; // aynı mum sinyali bir kez işlenir
      }
      hits++;
      const msg = `📡 ${sym} ${side} [${s.label}: ${tag}] ${s.tf} (yaş ${age})`;
      if (evOn(s)) { const g = btGate(s, keys); if (g) { log(msg + " — atlandı: " + g); continue; } }
      const perCap = cfg.perSymSig ?? 1;
      const nSame = st.open.filter((p) => p.sym === sym && p.sid === s.id).length;
      if (nSame >= perCap) { log(msg + ` — atlandı: aynı sembol+sinyal sınırı (${nSame}/${perCap})`); continue; }
      const capNew = (st as any).firstScanDone ? cfg.maxNew : (cfg.maxNewFirst ?? cfg.maxNew);
      if (nNew >= capNew) { log(msg + ` — atlandı: tur başı yeni giriş sınırı (${capNew})`); continue; }
      if (st.open.length >= cfg.maxSlots) { log(msg + ` — atlandı: slot dolu (${st.open.length}/${cfg.maxSlots})`); continue; }
      const margin = cfg.marginUsd && cfg.marginUsd > 0 ? cfg.marginUsd : st.equity * cfg.riskPct / 100;
      const used = st.open.reduce((a, q) => a + q.notional / q.lev, 0);
      if (!(margin > 0) || used + margin > st.equity + 1e-9) { log(msg + " — atlandı: toplam marjin sınırı"); continue; }
      const price = c[c.length - 1].close;
      const notional = margin * cfg.leverage;
      const p: Pos = { sym, side, entry: price, last: price, src: `${s.label} ${tag}`, lev: cfg.leverage, notional, qty: notional / price,
        t: Date.now(), checked: Date.now(), pxSrc: dataSrc(), sid: s.id, tpPct: s.tp, exit: s.exit, maxH: s.maxH, tf: s.tf };
      st.open.push(p); nNew++; opened++; if (sk) st.seen[sk] = bt;
      const m = `🤖 PAPER ${side === "LONG" ? "AL" : "SAT"}: ${sym} ${cfg.leverage}x @${fmt(price)} [${s.label}: ${tag} ${s.tf}] marjin ${margin.toFixed(2)} · TP %${s.tp ?? cfg.tp}${s.exit ? " + " + s.exit + " çıkışı" : ""}${s.maxH ? " · süre bilgisi " + s.maxH + " mum (kapatmaz)" : ""} / SL ${cfg.sl > 0 ? "%" + cfg.sl : "yok"}`;
      log(m); alerts.push(m);
    }
    per.push(`${s.label}: ${scanned}/${syms.length} sembol, ${hits} sinyal, ${opened} giriş, ${fail} veri eksik · EV ${evOn(s) ? "açık" : "kapalı"}`);
  }
  if (lsRan) (st as any).lsHour = Math.floor(Date.now() / 36e5);
  log(`Tarama (${dataSrc()}): ` + per.join(" | "));
}

// ---------- alerts (yalnız Secrets'tan) ----------
async function notify(text: string) {
  const tok = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID, ntfy = process.env.NTFY_URL;
  const out: string[] = [];
  if (tok && chat) {
    try { const r = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: true }) }); out.push("telegram " + r.status); }
    catch { out.push("telegram hata"); }
  } else out.push("telegram: secret yok");
  if (ntfy) {
    try { const r = await fetch(ntfy, { method: "POST", headers: { "Content-Type": "text/plain", Title: "QUANTEX Paper Bot" }, body: text.slice(0, 4000) }); out.push("ntfy " + r.status); }
    catch { out.push("ntfy hata"); }
  } else out.push("ntfy: secret yok");
  console.log("alerts → " + out.join(", "));
}

// ---------- istatistik (state.stats + STATS.md) ----------
const n2 = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(2);
function updateStats(): string {
  const unreal = st.open.reduce((a, p) => a + pr(p) * p.notional - fee(p), 0);
  const eq = st.equity + unreal, now = Date.now();
  const S: Stats = st.stats || { since: now, peak: eq, peakT: now, trough: eq, maxDd: 0, maxDdPct: 0, maxUp: 0, maxUpPct: 0, low: eq };
  if (S.low === undefined) S.low = eq;
  if (eq > S.peak) { S.peak = eq; S.peakT = now; }
  if (eq < S.low) S.low = eq;
  const dd = S.peak - eq, ddPct = S.peak > 0 ? dd / S.peak * 100 : 0;
  if (dd > S.maxDd) { S.maxDd = dd; S.maxDdPct = ddPct; S.maxDdT = now; }
  const up = eq - S.low, upPct = S.low > 0 ? up / S.low * 100 : 0;
  if (up > S.maxUp) { S.maxUp = up; S.maxUpPct = upPct; S.maxUpT = now; }
  S.trough = Math.min(S.trough ?? eq, eq);
  st.stats = S;
  const cl = st.closed, wins = cl.filter((x) => x.pnl > 0), loss = cl.filter((x) => x.pnl <= 0);
  const avg = (a: Closed[]) => (a.length ? a.reduce((x, y) => x + y.pnl, 0) / a.length : 0);
  const best = cl.reduce<Closed | null>((a, x) => (!a || x.pnl > a.pnl ? x : a), null);
  const worst = cl.reduce<Closed | null>((a, x) => (!a || x.pnl < a.pnl ? x : a), null);
  const tr = (x: Closed | null) => (x ? `${x.sym} ${x.side} ${n2(x.pnl)} USDT (${(x.r * 100).toFixed(2)}%) [${x.src}]` : "—");
  const left = (p: Pos) => { const ms = p.tf ? TF_MS[p.tf] : 0; if (!p.maxH || !ms) return "—"; const r = p.t + p.maxH * ms - Date.now(); const a = Math.abs(r), d = Math.floor(a / 864e5), h = Math.floor((a % 864e5) / 36e5); return (r < 0 ? "doldu, +" : "") + `${d}g ${h}s`; };
  const tT = (t?: number) => (t ? new Date(t).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "—");
  const by: Record<string, { n: number; w: number; pnl: number }> = {};
  for (const x of cl) { const k = cfg.sources.find((s) => s.id === x.sid)?.label || x.sid || x.src; const b = (by[k] ||= { n: 0, w: 0, pnl: 0 }); b.n++; if (x.pnl > 0) b.w++; b.pnl += x.pnl; }
  const pct = (a: number, b: number) => (b ? (a / b * 100).toFixed(1) + "%" : "—");
  return [
    `# QUANTEX Paper Bot — İstatistikler`, ``, `Güncelleme: **${trT()} (TSİ)** · tur ${st.runs} · veri ${st.dataSrc || "?"} · izleme başlangıcı ${tT(S.since)}`, ``,
    `## Özet`, `| Metrik | Değer |`, `|---|---|`,
    `| Bakiye (gerçekleşen) | ${st.equity.toFixed(2)} USDT |`, `| Özsermaye (açık K/Z dahil) | ${eq.toFixed(2)} USDT |`,
    `| Başlangıç bakiyesi | ${cfg.equity.toFixed(2)} USDT |`, `| Toplam gerçekleşen PnL | ${n2(st.pnl)} USDT |`, `| Açık K/Z | ${n2(unreal)} USDT |`,
    `| Zirve özsermaye | ${S.peak.toFixed(2)} USDT (${tT(S.peakT)}) |`, `| Şu anki düşüş (zirveden) | ${dd.toFixed(2)} USDT (${ddPct.toFixed(2)}%) |`,
    `| En kötü düşüş (max drawdown) | ${S.maxDd.toFixed(2)} USDT (${S.maxDdPct.toFixed(2)}%) · ${tT(S.maxDdT)} |`,
    `| En yüksek yükseliş (dipten) | ${S.maxUp.toFixed(2)} USDT (${S.maxUpPct.toFixed(2)}%) · ${tT(S.maxUpT)} |`,
    `| İşlem sayısı | ${cl.length} (${wins.length} kazanç / ${loss.length} kayıp) |`, `| Kazanma oranı | ${pct(wins.length, cl.length)} |`,
    `| Ort. kazanç / kayıp | ${n2(avg(wins))} / ${n2(avg(loss))} USDT |`, `| En iyi işlem | ${tr(best)} |`, `| En kötü işlem | ${tr(worst)} |`, ``,
    `## Taramalara göre`, `| Kaynak | İşlem | Kazanma | PnL (USDT) |`, `|---|---|---|---|`,
    ...(Object.keys(by).length ? Object.entries(by).sort((a, b) => b[1].pnl - a[1].pnl).map(([k, b]) => `| ${k} | ${b.n} | ${pct(b.w, b.n)} | ${n2(b.pnl)} |`) : ["| — | 0 | — | 0 |"]), ``,
    `## Açık pozisyonlar (${st.open.length}/${cfg.maxSlots})`, `| Sembol | Yön | Giriş | Son | K/Z % | K/Z USDT | TP % | Kaynak | Açılış | Süreye kalan |`, `|---|---|---|---|---|---|---|---|---|---|`,
    ...st.open.map((p) => `| ${p.sym} | ${p.side} | ${fmt(p.entry)} | ${fmt(p.last)} | ${(pr(p) * 100).toFixed(2)} | ${n2(pr(p) * p.notional - fee(p))} | ${(tpOf(p) * 100).toFixed(0)} | ${p.src} | ${tT(p.t)} | ${left(p)} |`),
    ``, `_Not: Zirve/düşüş/yükseliş tur başı (15 dk) özsermaye ile ölçülür; izleme başlangıcından itibaren geçerlidir. İşlem istatistikleri state'teki son 1000 kapanan işlemden hesaplanır._`, ``,
  ].join("\n");
}

async function main() {
  st.runs++; st.lastRun = Date.now();
  try {
    await pickHost();
    console.log("Binance erişim: " + reach.join(" | "));
    st.dataSrc = dataSrc();
    if (st.open.length) await manage();
    await scanAndOpen();
  } catch (e) {
    log(`⚠ Tur yarıda kaldı: ${(e as Error).message}`);
  }
  const statsMd = updateStats();
  st.log = st.log.slice(-500); st.closed = st.closed.slice(-1000);
  (st as any).firstScanDone = true;
  if (!DRY) { fs.writeFileSync(STATE_FILE, JSON.stringify(st, null, 1)); fs.writeFileSync(path.join(path.dirname(STATE_FILE), "STATS.md"), statsMd); }
  const unreal = st.open.reduce((a, p) => a + pr(p) * p.notional - fee(p), 0);
  const sum = [
    `## QUANTEX Paper Bot — ${trT()} (TSİ)`,
    `Veri: **${dataSrc()}** · Binance istek: ${reqCount} · ${reach.join(" | ")}`,
    `Bakiye: **${st.equity.toFixed(2)} USDT** · gerçekleşen PnL ${st.pnl.toFixed(2)} · açık K/Z ${unreal.toFixed(2)} · açık ${st.open.length}/${cfg.maxSlots}`,
    "", "| Sembol | Yön | Giriş | Son | K/Z % | TP % | Kaynak |", "|---|---|---|---|---|---|---|",
    ...st.open.map((p) => `| ${p.sym} | ${p.side} | ${fmt(p.entry)} | ${fmt(p.last)} | ${(pr(p) * 100).toFixed(2)} | ${(tpOf(p) * 100).toFixed(0)} | ${p.src} |`),
    "", "### Bu tur", ...(alerts.length ? alerts.map((a) => "- " + a) : ["- işlem yok"]),
  ].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, sum + "\n\n" + statsMd + "\n");
  console.log(sum);
  if (alerts.length) await notify(alerts.join("\n") + `\nBakiye ${st.equity.toFixed(2)} USDT · açık ${st.open.length}`);
}
main();
