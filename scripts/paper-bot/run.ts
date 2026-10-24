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

type Cfg = {
  timeframe: string; universeTop: number; extraSymbols: string[]; maxBarsAgo: number;
  scan: ListScanConfig; allowShort: boolean; equity: number; leverage: number; riskPct: number;
  tp: number; sl: number; maxSlots: number; maxNew: number; feePct: number;
};
type Pos = { sym: string; side: "LONG" | "SHORT"; entry: number; last: number; src: string; lev: number;
  notional: number; qty: number; t: number; checked: number; pxSrc: string };
type Closed = Pos & { exit: number; why: string; r: number; pnl: number; closedAt: number };
type State = { v: 1; equity: number; pnl: number; open: Pos[]; closed: Closed[]; log: string[];
  lastRun?: number; runs: number; dataSrc?: string };

const DIR = path.dirname(new URL(import.meta.url).pathname);
const cfg: Cfg = JSON.parse(fs.readFileSync(path.join(DIR, "config.json"), "utf8"));
const STATE_FILE = process.env.STATE_FILE || path.join(DIR, "state.json");
const DRY = process.env.PAPER_DRY === "1";

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
  const top = rows.filter((x) => /^[A-Z0-9]{2,15}USDT$/.test(x.symbol) && !/^(USDC|FDUSD|TUSD|BUSD|USDP|DAI)USDT$/.test(x.symbol))
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
  st.closed.push({ ...p, exit: px, why, r, pnl, closedAt: Date.now() });
  st.open.splice(i, 1);
  const m = `🤖 PAPER ${why} kapattı: ${p.sym} ${p.side} ${(r * 100).toFixed(2)}% (${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USDT net) · bakiye ${st.equity.toFixed(2)}`;
  log(m); alerts.push(m);
}

// ---------- TP/SL (1m iğne, önce SL) ----------
async function manage() {
  for (let i = st.open.length - 1; i >= 0; i--) {
    const p = st.open[i];
    const since = Math.max(p.t, p.checked || 0);
    const lim = Math.min(1000, Math.ceil((Date.now() - since) / 60000) + 2);
    const k = await klines(p.sym, "1m", lim, since);
    if (!k || !k.length) { log(`⚠ ${p.sym}: fiyat yok — SL bu tur kontrol edilemedi`); continue; }
    const slv = p.side === "LONG" ? p.entry * (1 - cfg.sl / 100) : p.entry * (1 + cfg.sl / 100);
    const tpv = p.side === "LONG" ? p.entry * (1 + cfg.tp / 100) : p.entry * (1 - cfg.tp / 100);
    const closedBars = k.slice(0, -1);
    let hit: [string, number] | null = null;
    for (const b of closedBars) {
      const h = +b[2], l = +b[3];
      if (p.side === "LONG" ? l <= slv : h >= slv) { hit = ["SL", slv]; break; }
      if (p.side === "LONG" ? h >= tpv : l <= tpv) { hit = ["TP", tpv]; break; }
    }
    const last = +k[k.length - 1][4];
    if (closedBars.length) p.checked = +closedBars[closedBars.length - 1][0] + 60000;
    if (hit) { closePos(i, hit[0], hit[1]); continue; }
    if (Math.abs(last / p.entry - 1) > 0.5) { log(`⚠ ${p.sym} şüpheli fiyat ${fmt(last)} atlandı`); continue; }
    p.last = last;
    const r = pr(p);
    if (r >= cfg.tp / 100) closePos(i, "TP", last); else if (r <= -cfg.sl / 100) closePos(i, "SL", last);
  }
}

// ---------- tarama + giriş ----------
async function scanAndOpen() {
  const syms = await universe();
  let nNew = 0, scanned = 0, hits = 0, fail = 0;
  const TF_MS: Record<string, number> = { "15m": 9e5, "30m": 18e5, "1h": 36e5, "4h": 144e5 };
  const tfMs = TF_MS[cfg.timeframe] || 9e5;
  for (const sym of syms) {
    const k = await klines(sym, cfg.timeframe, 300);
    if (!k || k.length < 120) { fail++; continue; }
    // yalnız kapanmış mumlar
    const candles: Candle[] = k.filter((b) => +b[0] + tfMs <= Date.now()).map((b) => ({ time: Math.floor(+b[0] / 1000), open: +b[1], high: +b[2], low: +b[3], close: +b[4], volume: +b[5] }));
    scanned++;
    let res;
    try { res = scanSymbol(candles, cfg.scan, cfg.maxBarsAgo); } catch (e) { fail++; continue; }
    const bull = res.filter((h) => h.bias === "bull"), bear = res.filter((h) => h.bias === "bear");
    const side: "LONG" | "SHORT" | null = bull.length && !bear.length ? "LONG" : bear.length && !bull.length && cfg.allowShort ? "SHORT" : null;
    if (!side) continue;
    hits++;
    const src = (side === "LONG" ? bull : bear).map((h) => `${h.kind}:${h.cond}`).join("+");
    const msg = `📡 Sinyal ${sym} ${side} [${src}] ${cfg.timeframe}`;
    if (st.open.some((p) => p.sym === sym)) { log(msg + " — atlandı: açık pozisyon var"); continue; }
    if (nNew >= cfg.maxNew) { log(msg + ` — atlandı: tur başı yeni giriş sınırı (${cfg.maxNew})`); continue; }
    if (st.open.length >= cfg.maxSlots) { log(msg + ` — atlandı: slot dolu (${st.open.length}/${cfg.maxSlots})`); continue; }
    const margin = st.equity * cfg.riskPct / 100;
    const used = st.open.reduce((a, q) => a + q.notional / q.lev, 0);
    if (!(margin > 0) || used + margin > st.equity + 1e-9) { log(msg + " — atlandı: toplam marjin sınırı"); continue; }
    const price = candles[candles.length - 1].close;
    const notional = margin * cfg.leverage;
    const p: Pos = { sym, side, entry: price, last: price, src, lev: cfg.leverage, notional, qty: notional / price, t: Date.now(), checked: Date.now(), pxSrc: dataSrc() };
    st.open.push(p); nNew++;
    const m = `🤖 PAPER ${side === "LONG" ? "AL" : "SAT"}: ${sym} ${cfg.leverage}x @${fmt(price)} [${src}] marjin ${margin.toFixed(2)} · TP %${cfg.tp} / SL %${cfg.sl}`;
    log(m); alerts.push(m);
  }
  log(`Tarama: ${scanned}/${syms.length} sembol, ${hits} sinyal, ${nNew} yeni giriş, ${fail} veri hatası · kaynak ${dataSrc()}`);
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
  st.log = st.log.slice(-500); st.closed = st.closed.slice(-1000);
  if (!DRY) fs.writeFileSync(STATE_FILE, JSON.stringify(st, null, 1));
  const unreal = st.open.reduce((a, p) => a + pr(p) * p.notional - fee(p), 0);
  const sum = [
    `## QUANTEX Paper Bot — ${trT()} (TSİ)`,
    `Veri: **${dataSrc()}** · Binance istek: ${reqCount} · ${reach.join(" | ")}`,
    `Bakiye: **${st.equity.toFixed(2)} USDT** · gerçekleşen PnL ${st.pnl.toFixed(2)} · açık K/Z ${unreal.toFixed(2)} · açık ${st.open.length}/${cfg.maxSlots}`,
    "", "| Sembol | Yön | Giriş | Son | K/Z % | Kaynak |", "|---|---|---|---|---|---|",
    ...st.open.map((p) => `| ${p.sym} | ${p.side} | ${fmt(p.entry)} | ${fmt(p.last)} | ${(pr(p) * 100).toFixed(2)} | ${p.src} |`),
    "", "### Bu tur", ...(alerts.length ? alerts.map((a) => "- " + a) : ["- işlem yok"]),
  ].join("\n");
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, sum + "\n");
  console.log(sum);
  if (alerts.length) await notify(alerts.join("\n") + `\nBakiye ${st.equity.toFixed(2)} USDT · açık ${st.open.length}`);
}
main();
