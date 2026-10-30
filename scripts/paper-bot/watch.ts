/**
 * QUANTEX İZLEME (watch-only) — Grok Bot rutinlerinden robota taşınan taramalar. 31.10.2026.
 * HİÇBİR İŞLEM AÇMAZ: paper-bot state.json'a (pozisyonlar/bakiye) dokunmaz, borsaya emir yok, API anahtarı yok.
 * Yalnız: tarama → sinyal kaydı (watch.json, paper-bot-state dalı) + ntfy uyarısı (sinyal mumu başına bir kez) + 40 mum sonuç izleme.
 *
 * Taramalar (osc-lab Python sürümleriyle aynı kurallar, aynı zaman dilimleri):
 *  ek-crypto-4h  EK v3 dip uyumsuzluk (EMs) — kripto 4s, top-200 USDT-M perp (spot mumu, yoksa perp)   [new2-20261029/v3mm/scanner.py]
 *  ek-bist-1d    EK v3 dip uyumsuzluk (EMs) — BIST 1g, ≤200 hisse (Yahoo)                         [aynı]
 *  ls-2h         L/S 2s top-trader POZİSYON oranı dip uyumsuzluğu — en hacimli 200 USDT perp      [ls-div-20261029/scan_ls.py]
 *  dual-crypto-4h Dual 100/10 LRB (z 0.1, hedef hızlı üst bant) — kripto 4s                      [dual-band-20261029/scan_dual.py]
 *  dual-bist-1d  Dual 100/10 BB (z 0.5, 2R) — BIST 1g                                            [aynı]
 *  rsi30-bist-1d RSI14 30 yukarı kırılım — BIST 1g                                               [matriks-dt-20261030/scan_rsi30_bist.py]
 *  + L/S günlük veri toplama (top-40, 4 metrik × 1s/2s) → lsdata/YYYY-MM-DD.csv                  [ls-div-20261029/collect.py]
 * ntfy adresi yalnız ortam değişkeninden (WATCH_NTFY_URL → ELIZI_NTFY_URL → NTFY_URL); koda/loga/rapora yazılmaz.
 */
import fs from "node:fs";
import path from "node:path";
import { ekDivergenceV3, emilimV3, type DivParams } from "../../src/lib/watch/ekV3";
import { BIST30, BIST_LIQUID_EXTRA } from "../../src/lib/data/bistLists";
import { BIST_EXTRA } from "../../src/lib/data/bistUniverse";
import { atr14Ewm, atr14Rma, dualBandBuy, rsi30Buy, lsDivergences, type WBar } from "../../src/lib/watch/watchInd";

export const WATCH_CRYPTO = ["BTC","ETH","BNB","SOL","XRP","DOGE","ADA","TRX","AVAX","LINK","DOT","LTC","BCH","NEAR","UNI","ATOM","ETC","XLM","FIL","APT",
  "ARB","OP","INJ","SUI","AAVE","HBAR","ALGO","ICP","SEI","TIA","RUNE","LDO","CRV","SAND","GALA","PEPE","SHIB","WLD","FET","ENA"].map((s) => s + "USDT");
/** BIST evreni (≤200): Grok Bot rutinlerinin BIST100 listesi (health-score lab, 99 hisse) + BIST30 + likit ekler, kalanı tüm BIST evreninden. Yahoo'da verisi olmayan/kısa geçmişli olanlar taramada zararsızca atlanır. */
const BIST_BOX100 = "AEFES AGHOL AKBNK AKSA AKSEN ALARK ARCLK ASELS ASTOR BIMAS BRSAN BRYAT CCOLA CIMSA DOAS DOHOL EGEEN EKGYO ENJSA ENKAI EREGL FROTO GARAN GUBRF HALKB HEKTS ISCTR ISMEN KCHOL KONTR KOZAA TRALT KRDMD MGROS ODAS OTKAR OYAKC PETKM PGSUS SAHOL SASA SISE SKBNK SOKM TAVHL TCELL THYAO TKFEN TOASO TSKB TTKOM TUPRS ULKER VAKBN VESTL YKBNK ZOREN ALBRK ANSGR BAGFS BERA BUCIM CANTE CEMTS DEVA ECILC GESAN GOZDE IPEKE ISGYO KARSN KARTN KORDS LOGO MAVI NETAS NTHOL PRKME QUAGR SELEC SNGYO TATGD TMSN TRGYO TURSG VESBE YATAS ZRGYO ALKIM AYGAZ BRISA CLEBI GOODY KLMSN PARSN TTRAK ADEL AKCNS AKGRS".split(" ");
export const WATCH_BIST = Array.from(new Set([...BIST_BOX100, ...BIST30, ...BIST_LIQUID_EXTRA, ...BIST_EXTRA.map((x) => x.symbol)].map((x) => x.trim().toUpperCase()).filter((x) => /^[A-Z0-9]{3,6}$/.test(x)))).slice(0, 200).map((x) => x + ".IS");
const EMS_PICK: Partial<DivParams> = { osc: "EMs", Lb: 3, R: 5, G1: 5, G2: 60, delta: 0, zone: "lowZ", Z: 50, dz: 0.5, combo: "alone", N: 0, cool: 10 };
/** exit_config.json (IS seçimi): kripto 4s SAR (stop = pivot dip), BIST 1g ATR (stop pivot − 1.5 ATR, hedef giriş + 4 ATR) */
const EK_EXIT: Record<string, { exit: "sar" | "atr"; k: number; tp: number }> = { "4h": { exit: "sar", k: 1.5, tp: 4 }, "1d": { exit: "atr", k: 1.5, tp: 4 } };
const TF_MS: Record<string, number> = { "1h": 36e5, "2h": 72e5, "4h": 144e5, "1d": 864e5 };
/** Zaman bütçesi: Actions işi 12 dk ile sınırlı → süreç bu saniyeyi geçince yeni sembol/tarama başlatılmaz (kapı ilerlemez, sonraki turda tamamlanır) */
const BUDGET_S = Number(process.env.WATCH_BUDGET_S || 510);
const over = () => process.uptime() > BUDGET_S;
const MAX_AGE = 2, TRACK_BARS = 40, KEEP_SIG = 150, KEEP_NOTIFIED_MS = 60 * 864e5;

export type ScanId = "ek-crypto-4h" | "ek-bist-1d" | "ls-2h" | "dual-crypto-4h" | "dual-bist-1d" | "rsi30-bist-1d";
export const SCANS: Record<ScanId, { label: string; tf: string; market: "kripto" | "BIST"; note: string }> = {
  "ek-crypto-4h": { label: "EK v3 DIV · kripto 4s", tf: "4h", market: "kripto", note: "EMs dip uyumsuzluk; stop = pivot dip (SAR çıkışı), sabit hedef yok. Backtest IS MAR<0 → yalnız uyarı." },
  "ek-bist-1d": { label: "EK v3 DIV · BIST 1g", tf: "1d", market: "BIST", note: "EMs dip uyumsuzluk; stop = pivot − 1.5 ATR, hedef = giriş + 4 ATR. core=1 BIST testinde güçlü." },
  "ls-2h": { label: "L/S uyumsuzluk · 2s", tf: "2h", market: "kripto", note: "Top-trader L/S POZİSYON oranı boğa uyumsuzluğu (dip bölgesi); stop = pivot dip, hedef = BB(20,2) üst." },
  "dual-crypto-4h": { label: "Dual 100/10 LRB · kripto 4s", tf: "4h", market: "kripto", note: "Hızlı alt banda geri giriş, yavaş %B ≤ 0.1; stop = giriş − 1.5 ATR, hedef = hızlı üst bant (her mum güncellenir)." },
  "dual-bist-1d": { label: "Dual 100/10 BB · BIST 1g", tf: "1d", market: "BIST", note: "Hızlı alt banda geri giriş, yavaş %B ≤ 0.5; stop = giriş − 1.5 ATR, hedef 2R." },
  "rsi30-bist-1d": { label: "RSI14 30 kırılım · BIST 1g", tf: "1d", market: "BIST", note: "RSI14 30'u yukarı keser (10 mum bekleme); stop = giriş − 1.5 ATR, hedef 2R." },
};

/** Seviye hesabı (giriş kesinleşince yeniden hesaplanır) */
type Calc = { kind: "ek"; exit: "sar" | "atr"; pivlow: number; atr: number; k: number; tpm: number } | { kind: "atr"; atr: number; k: number; rr: number | null } | { kind: "fixed" };
export interface WSig {
  key: string; scan: ScanId; symbol: string; tf: string; t: number; tsi: string; age: number; kind: string;
  price: number; entryBasis: string; stop: number; target: number | null; strength?: number | string; info: string;
  calc: Calc; fillT?: number; entry?: number; status: "bekliyor" | "açık" | "hedef" | "stop" | "süre"; exitPx?: number; exitT?: number; R?: number; bars?: number; last?: number;
  alerted: "gönderildi" | "gönderilemedi" | "ilk tur (bildirimsiz)" | "dry-run" | "eski (yaş>2)"; foundAt: number;
}
interface Coverage { total: number; covered: number; thisRun: number; okThisRun: number; slotTsi: string; oldestTsi: string; full: boolean }
interface ScanRep { label: string; tf: string; market: string; note: string; lastRun?: number; lastFull?: number; coverage?: Coverage; errCount?: number; lastRunTsi?: string; nSym?: number; nOk?: number; errors?: string[]; newCount?: number; signals: WSig[] }
export interface WatchDoc {
  v: 1; kind: "quantex-watch"; tradeMode: "KAPALI (yalnız izleme)"; created: number; updated?: number; updatedTsi?: string; runs: number; firstRunDone?: boolean;
  gate: Record<string, number>; symLast?: Record<string, Record<string, number>>; univ?: { day?: string; crypto?: string[] }; notified: Record<string, number>; scans: Record<string, ScanRep>; ls?: { lastDay?: string; files?: string[]; lastRows?: number; lastErr?: string; pend?: { day: string; syms: string[]; done: number; rows: number; errs: number } }; log: string[];
}
export interface WatchCtx { dir: string; dry: boolean; futHost: string | null; proxy: string; log?: (m: string) => void }

const trT = (t = Date.now()) => new Date(t).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
const fmtP = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : (+v).toPrecision(6).replace(/\.?0+$/, ""));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------- HTTP (salt okunur, herkese açık veri) ----------
const lastReq: Record<string, number> = {}; // host başına hız sınırı (bloklar paralel çalışır)
async function getJson(url: string, gap = 250, tries = 3, headers?: Record<string, string>): Promise<unknown> {
  let err: unknown = null; const host = new URL(url).host;
  for (let k = 0; k < tries; k++) {
    const w = (lastReq[host] || 0) + gap - Date.now(); if (w > 0) await sleep(w); lastReq[host] = Math.max(Date.now(), (lastReq[host] || 0) + gap);
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", ...(headers || {}) }, signal: AbortSignal.timeout(15000) });
      if (r.ok) return await r.json();
      err = new Error("HTTP " + r.status);
      if (r.status === 400 || r.status === 404) break;
      if (r.status === 418 || r.status === 429) await sleep(5000 * (k + 1));
    } catch (e) { err = e; }
    await sleep(800 * 2 ** k);
  }
  throw err instanceof Error ? err : new Error("fetch failed");
}
const KC: Record<string, Promise<WBar[] | null>> = {};
/** Binance SPOT mumları (data-api.binance.vision) — Python taramalarıyla aynı kaynak; yalnız kapanmış mumlar */
function spotBars(sym: string, tf: string): Promise<WBar[] | null> {
  return (KC["s|" + sym + "|" + tf] ||= (async () => {
    const rows = (await getJson(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${tf}&limit=1000`, 120, 2)) as (string | number)[][];
    const now = Date.now();
    return rows.filter((r) => Number(r[6]) < now).map((r) => ({ t: Number(r[0]), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] }));
  })().catch(() => null));
}
interface YChart { chart: { result: { timestamp: number[]; indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[] } }[] } }
/** Yahoo günlük (3y); bugün 18:30 TSİ'den önce oluşan günlük mum atılır */
function yahooBars(sym: string): Promise<WBar[] | null> {
  return (KC["y|" + sym] ||= (async () => {
    let j: YChart | null = null;
    for (const h of ["query1", "query2"]) { try { j = (await getJson(`https://${h}.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=3y`, 400, 2)) as YChart; break; } catch { /* sonraki */ } }
    if (!j) return null;
    const r = j.chart.result[0], q = r.indicators.quote[0]; let out: WBar[] = [];
    r.timestamp.forEach((t, i) => { const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i], v = q.volume[i];
      if (o != null && h != null && l != null && c != null && v != null) out.push({ t: t * 1000, open: o, high: h, low: l, close: c, volume: v }); });
    if (out.filter((b) => b.volume > 0).length > 0.5 * out.length) out = out.filter((b) => b.volume > 0);
    const f = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
    const nowS = f(new Date()), lastS = f(new Date(out[out.length - 1].t)), hm = Number(nowS.slice(12, 14)) * 60 + Number(nowS.slice(15, 17));
    if (lastS.slice(0, 10) === nowS.slice(0, 10) && hm < 18 * 60 + 30) out.pop();
    const seen = new Set<number>(); return out.filter((b) => (seen.has(b.t) ? false : (seen.add(b.t), true)));
  })().catch(() => null));
}

// ---------- ntfy (yalnız ortam değişkeni; adres hiçbir yere yazılmaz) ----------
const ntfyUrl = () => process.env.WATCH_NTFY_URL || process.env.ELIZI_NTFY_URL || process.env.NTFY_URL || "";
const b64Title = (s: string) => "=?UTF-8?B?" + Buffer.from(s, "utf8").toString("base64") + "?=";
async function ntfySend(title: string, body: string): Promise<number> {
  const u = ntfyUrl(); if (!u) throw new Error("ntfy adresi tanımlı değil");
  const r = await fetch(u, { method: "POST", headers: { "Content-Type": "text/plain; charset=utf-8", Title: b64Title(title), Tags: "mag", Priority: "default" }, body, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("ntfy HTTP " + r.status);
  return r.status;
}

// ---------- doc ----------
function loadDoc(file: string): WatchDoc {
  try { const j = JSON.parse(fs.readFileSync(file, "utf8")); if (j && j.kind === "quantex-watch") return j as WatchDoc; } catch { /* yeni */ }
  return { v: 1, kind: "quantex-watch", tradeMode: "KAPALI (yalnız izleme)", created: Date.now(), runs: 0, gate: {}, notified: {}, scans: {}, log: [] };
}

// ---------- sonuç izleme (işlem değil: sinyalin sonraki mumlarda stop/hedefe değip değmediği) ----------
function levelsFor(s: WSig, entry: number): { stop: number; target: number | null } {
  const c = s.calc;
  if (c.kind === "ek") {
    if (c.exit === "sar") { let st = c.pivlow; if (st >= entry) st = entry - c.atr; return { stop: st, target: null }; }
    let st = c.pivlow - c.k * c.atr; if (st >= entry) st = entry - c.k * c.atr; return { stop: st, target: entry + c.tpm * c.atr };
  }
  if (c.kind === "atr") { const st = entry - c.k * c.atr; return { stop: st, target: c.rr == null ? null : entry + c.rr * (entry - st) }; }
  return { stop: s.stop, target: s.target };
}
/** dyn: hızlı üst bant gibi her mum değişen hedef (önceki kapanışın seviyesi) */
function track(s: WSig, bars: WBar[], dyn?: number[]) {
  if (s.status === "hedef" || s.status === "stop" || s.status === "süre") return;
  const i0 = bars.findIndex((b) => b.t > s.t); if (i0 < 0) return;
  if (s.fillT === undefined) { s.fillT = bars[i0].t; s.entry = bars[i0].open; const lv = levelsFor(s, s.entry); s.stop = lv.stop; if (!dyn) s.target = lv.target; }
  const i1 = bars.findIndex((b) => b.t === s.fillT); if (i1 < 0) return;
  const e = s.entry!, risk = e - s.stop; s.status = "açık";
  for (let j = i1, k = 1; j < bars.length; j++, k++) {
    const b = bars[j], tg = dyn ? (j > 0 && Number.isFinite(dyn[j - 1]) ? dyn[j - 1] : null) : s.target;
    let px: number | null = null, why: WSig["status"] | null = null;
    if (b.open <= s.stop) { px = b.open; why = "stop"; }
    else if (b.low <= s.stop) { px = s.stop; why = "stop"; }
    else if (tg != null && b.high >= tg) { px = Math.max(tg, b.open); why = "hedef"; }
    else if (k >= TRACK_BARS) { px = b.close; why = "süre"; }
    s.bars = k; s.last = b.close;
    if (dyn && Number.isFinite(dyn[j])) s.target = dyn[j];
    if (px != null && why) { s.status = why; s.exitPx = px; s.exitT = b.t; s.R = risk > 0 ? +((px - e) / risk).toFixed(2) : undefined; return; }
  }
}

// ---------- taramalar ----------
type Found = Omit<WSig, "alerted" | "foundAt" | "status"> & { title: string; body: string };
const tsiBar = (t: number, tf: string) => (tf === "1d" ? new Date(t).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }) : trT(t).slice(0, -3));
function ekScan(scan: ScanId, sym: string, tf: string, bars: WBar[], maxAge = MAX_AGE): Found[] {
  const m = tf === "4h" ? 6 : 5, X = EK_EXIT[tf];
  const r = ekDivergenceV3(bars, EMS_PICK, { m }), v = emilimV3(bars, { m }), A = atr14Ewm(bars), n = bars.length;
  const cx = v.fms.map(() => false); let last = -1e9;
  for (let i = 1; i < n; i++) {
    const a = Number.isFinite(v.fms[i - 1]) && v.fms[i - 1] <= 0 && v.fms[i] > 0 && v.depth[i] >= 0.5 && v.ems[i] >= 30;
    if (a) { if (i - last <= 15) continue; cx[i] = true; last = i; }
  }
  const byC = new Map(r.divs.map((d) => [d.confirm, d]));
  const evs: { c: number; d: { p0: number; p: number }; core: boolean; kind: string; dc: number }[] = [];
  r.signal.forEach((s, c) => {
    if (!s) return; const d = byC.get(c); if (!d) return;
    let core = false; for (let j = Math.max(0, c - 10); j <= c; j++) if (cx[j]) core = true;
    evs.push({ c, d, core, kind: "DIV", dc: c });
    for (let j = c + 1; j <= Math.min(n - 1, c + 10); j++) if (cx[j]) { evs.push({ c: j, d, core: true, kind: "CORE+DIV", dc: c }); break; }
  });
  const out: Found[] = [];
  for (const e of evs) {
    const age = n - 1 - e.c; if (age > maxAge) continue;
    const c0 = e.dc, d = e.d;
    const ds = Math.min(1, Math.max(0, (r.osc[d.p] - r.osc[d.p0]) / 20)), deep = v.depth[d.p] >= 0.5 ? 1 : 0, fm = v.fms[c0] > 0 ? 1 : 0;
    let al = 0; for (let j = Math.max(0, c0 - 10); j <= c0; j++) if (v.al[j]) al = 1;
    const strength = Math.round(((ds + deep + fm + al) / 4) * 100) / 100;
    const entry = age >= 1 ? bars[e.c + 1].open : bars[n - 1].close;
    const calc: Calc = { kind: "ek", exit: X.exit, pivlow: bars[d.p].low, atr: A[c0], k: X.k, tpm: X.tp };
    const s0 = { calc } as WSig; const lv = levelsFor(s0, entry);
    const info = `${e.kind !== "DIV" ? e.kind + " · " : ""}güç ${strength.toFixed(2)} (div ${ds.toFixed(2)} deep ${deep} fms ${fm} al ${al} core ${e.core ? 1 : 0})${e.core && tf === "1d" ? " · core: BIST testinde güçlü" : ""}`;
    const t = bars[e.c].t, lbl = SCANS[scan].label;
    out.push({ key: `${scan}|${sym}|${t}|${e.kind}`, scan, symbol: sym, tf, t, tsi: tsiBar(t, tf), age, kind: e.kind, price: entry, entryBasis: age >= 1 ? "sonraki açılış" : "son kapanış (sonraki açılış henüz yok)",
      stop: lv.stop, target: lv.target, strength, info, calc,
      title: `İZLEME | ${lbl} | ${sym} AL${e.kind !== "DIV" ? " (" + e.kind + ")" : ""}`,
      body: `${lbl} — ${sym} ${tf}\nSinyal mumu: ${tsiBar(t, tf)} (TSİ, yaş ${age} mum)\n${info}\nGiriş ref: ${fmtP(entry)} (${age >= 1 ? "sonraki açılış" : "son kapanış"})\nStop: ${fmtP(lv.stop)}${X.exit === "sar" ? " (pivot dip, SAR iz sürer)" : ""}\nHedef: ${lv.target == null ? "yok (SAR çıkışı)" : fmtP(lv.target)}\nDurum: SADECE İZLEME — işlem açılmadı` });
  }
  return out;
}
function dualScan(scan: ScanId, sym: string, tf: string, bars: WBar[], typ: "BB" | "LRB", z: number, mode: "A" | "B", maxAge = MAX_AGE): { found: Found[]; dyn: number[] } {
  const D = dualBandBuy(bars, 100, 10, typ, z), A = atr14Rma(bars), n = bars.length, out: Found[] = [], lbl = SCANS[scan].label;
  for (let i = Math.max(1, n - 1 - maxAge); i < n; i++) {
    if (!D.buy[i] || !Number.isFinite(A[i])) continue;
    const c = bars[i].close, stop = c - 1.5 * A[i], tgt = mode === "A" ? c + 3 * A[i] : D.fastUp[i], t = bars[i].t, age = n - 1 - i;
    const info = `kapanış ${fmtP(c)} · hızlı alt bant ${fmtP(D.fastLow[i])} · yavaş %B(önceki) ${D.pbPrev[i].toFixed(2)}`;
    out.push({ key: `${scan}|${sym}|${t}`, scan, symbol: sym, tf, t, tsi: tsiBar(t, tf), age, kind: "AL", price: c, entryBasis: "sonraki açılış (ref kapanış)", stop, target: tgt, info,
      calc: { kind: "atr", atr: A[i], k: 1.5, rr: mode === "A" ? 2 : null },
      title: `İZLEME | ${lbl} | ${sym} AL`,
      body: `${lbl} — ${sym} ${tf}\nSinyal mumu: ${tsiBar(t, tf)} (TSİ, yaş ${age} mum)\n${info}\nGiriş: sonraki mum açılışı (ref ${fmtP(c)})\nStop: ≈${fmtP(stop)} (giriş − 1.5 ATR)\nHedef: ${mode === "A" ? "≈" + fmtP(tgt) + " (2R)" : "hızlı üst bant, şu an " + fmtP(tgt)}\nZaman: 40 mum\nDurum: SADECE İZLEME — işlem açılmadı` });
  }
  return { found: out, dyn: D.fastUp };
}
function rsi30Scan(sym: string, bars: WBar[], maxAge = MAX_AGE): Found[] {
  const scan: ScanId = "rsi30-bist-1d", R = rsi30Buy(bars), A = atr14Rma(bars), n = bars.length, out: Found[] = [], lbl = SCANS[scan].label;
  for (let i = Math.max(1, n - 1 - maxAge); i < n; i++) {
    if (!R.buy[i] || !Number.isFinite(A[i])) continue;
    const c = bars[i].close, stop = c - 1.5 * A[i], tgt = c + 3 * A[i], t = bars[i].t, age = n - 1 - i;
    const info = `RSI14 ${R.rsi[i - 1].toFixed(1)} → ${R.rsi[i].toFixed(1)} · kapanış ${fmtP(c)}`;
    out.push({ key: `${scan}|${sym}|${t}`, scan, symbol: sym, tf: "1d", t, tsi: tsiBar(t, "1d"), age, kind: "AL", price: c, entryBasis: "sonraki açılış (ref kapanış)", stop, target: tgt, info,
      calc: { kind: "atr", atr: A[i], k: 1.5, rr: 2 },
      title: `İZLEME | ${lbl} | ${sym} AL`,
      body: `${lbl} — ${sym} 1d\nSinyal mumu: ${tsiBar(t, "1d")} (yaş ${age} mum)\n${info}\nGiriş: sonraki mum açılışı (ref ${fmtP(c)})\nStop: ≈${fmtP(stop)} (giriş − 1.5 ATR)\nHedef: ≈${fmtP(tgt)} (2R)\nZaman: 40 mum\nDurum: SADECE İZLEME — işlem açılmadı` });
  }
  return out;
}

// ---------- L/S (perp) veri ----------
async function futGet(ctx: WatchCtx, pathQ: string, proxyPath: string): Promise<unknown> {
  if (ctx.futHost) { try { return await getJson(ctx.futHost + pathQ, 250, 2); } catch { /* proxy */ } }
  return await getJson(ctx.proxy + proxyPath, 150, 3);
}
async function lsUniverse(ctx: WatchCtx, top = 200): Promise<string[]> {
  const tk = (await futGet(ctx, "/fapi/v1/ticker/24hr", "/api/fapi/v1/ticker/24hr")) as { symbol: string; quoteVolume: string }[];
  let perps: Set<string> | null = null;
  try {
    const info = (await futGet(ctx, "/fapi/v1/exchangeInfo", "/api/fapi/v1/exchangeInfo")) as { symbols?: { symbol: string; contractType?: string; quoteAsset?: string; status?: string }[] };
    const ok = (info.symbols || []).filter((x) => x.contractType === "PERPETUAL" && x.quoteAsset === "USDT" && x.status === "TRADING").map((x) => x.symbol);
    if (ok.length > 50) perps = new Set(ok);
  } catch { /* yalnız ticker */ }
  return tk.filter((t) => /USDT$/.test(t.symbol) && (!perps || perps.has(t.symbol)) && !/^(USDC|FDUSD|TUSD|BUSD|USDP|DAI|USDE|USD1)USDT$/.test(t.symbol))
    .sort((a, b) => +b.quoteVolume - +a.quoteVolume).slice(0, top).map((t) => t.symbol);
}
const LS_METRIC: Record<string, string> = { topPos: "topLongShortPositionRatio", topAcc: "topLongShortAccountRatio", globAcc: "globalLongShortAccountRatio", taker: "takerlongshortRatio" };
async function lsSeries(ctx: WatchCtx, sym: string, metric: string, period: string, limit: number): Promise<Record<string, string | number>[]> {
  const ep = LS_METRIC[metric];
  const j = await futGet(ctx, `/futures/data/${ep}?symbol=${sym}&period=${period}&limit=${limit}`, `/api/lsratio?symbol=${sym}&period=${period}&limit=${limit}&metric=${metric}`);
  return Array.isArray(j) ? (j as Record<string, string | number>[]) : [];
}
async function perp2h(ctx: WatchCtx, sym: string): Promise<{ bars: WBar[]; px: number } | null> {
  const j = (await futGet(ctx, `/fapi/v1/klines?symbol=${sym}&interval=2h&limit=500`, `/api/fklines?symbol=${sym}&interval=2h&limit=500`)) as (string | number)[][];
  if (!Array.isArray(j) || j.length < 120) return null;
  const all = j.map((r) => ({ t: Number(r[0]), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] }));
  const px = all[all.length - 1].close, now = Date.now();
  return { bars: all.filter((b) => b.t + TF_MS["2h"] <= now), px };
}

/** Kripto 4s mumları: önce Binance spot (Python taramalarıyla aynı), spotta olmayan futures-only semboller için perp (fapi/proxy) */
async function coinBars(ctx: WatchCtx, sym: string): Promise<{ bars: WBar[] | null; src: string }> {
  const sp = await spotBars(sym, "4h"); if (sp && sp.length >= 300) return { bars: sp, src: "spot" };
  try {
    const j = (await futGet(ctx, `/fapi/v1/klines?symbol=${sym}&interval=4h&limit=1000`, `/api/fklines?symbol=${sym}&interval=4h&limit=1000`)) as (string | number)[][];
    if (Array.isArray(j) && j.length) { const now = Date.now(); return { bars: j.map((r) => ({ t: Number(r[0]), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] })).filter((b) => b.t + TF_MS["4h"] <= now), src: "perp" }; }
  } catch { /* yok */ }
  return { bars: sp, src: "spot" };
}

// ---------- ana tur ----------
export async function runWatch(ctx: WatchCtx): Promise<{ newSignals: number; sent: number; ran: string[]; summary: string }> {
  const file = path.join(ctx.dir, ctx.dry ? "watch.dry.json" : "watch.json");
  const doc = loadDoc(ctx.dry && !fs.existsSync(file) ? path.join(ctx.dir, "watch.json") : file);
  const lg = (m: string) => { const l = trT() + " İZLEME " + m; doc.log.push(l); (ctx.log || console.log)(l); };
  const now = Date.now(); doc.runs++;
  const first = !doc.firstRunDone;
  const ran: string[] = []; const found: { f: Found; bars: WBar[]; dyn?: number[] }[] = [];
  const touched: { scan: ScanId; sym: string; bars: WBar[]; dyn?: number[] }[] = [];
  const rep = (id: ScanId) => (doc.scans[id] ||= { ...SCANS[id], signals: [] });
  for (const id of Object.keys(SCANS) as ScanId[]) Object.assign(rep(id), { label: SCANS[id].label, note: SCANS[id].note, tf: SCANS[id].tf, market: SCANS[id].market });
  const mark = (ids: ScanId[], extra: Partial<ScanRep>) => { for (const id of ids) Object.assign(rep(id), { lastRun: now, lastRunTsi: trT(now) }, extra); };
  const symLast = (doc.symLast ||= {});
  /** Evrene yeni giren (hiç taranmamış) sembolün ilk taraması bildirimsiz tohumlanır → evren büyütmede toplu ntfy patlaması olmaz */
  const seedSyms = new Set<string>();

  /** Dönen parti (rotating batch): her blokta semboller "en eski taranan önce" sırayla işlenir, kalıcı imleç = sembol başı son tarama zamanı.
   *  Bu mum aralığında (slot) taranmış sembol tekrar taranmaz; bütçe biterse kalanlar sonraki turda devam eder → uzun vadede hiçbir sembol atlanmaz.
   *  Pencere (yaş): sembolün son taramasından beri kapanan mumlar da rapora girer; ntfy yalnız yaş ≤ 2. */
  async function runBlock(blk: string, ids: ScanId[], tf: string, slotMs: number, syms: string[], conc: number, one: (sym: string, maxAge: number) => Promise<string | null>) {
    const L = (symLast[blk] ||= {}), slotStart = Math.floor(now / slotMs) * slotMs;
    for (const k of Object.keys(L)) if (!syms.includes(k) && now - L[k] > 7 * 864e5) delete L[k];
    const pend = syms.filter((x) => !(L[x] >= slotStart)).sort((x, y) => (L[x] || 0) - (L[y] || 0));
    const errs: string[] = []; let done = 0, ok = 0, i = 0;
    const worker = async () => {
      while (i < pend.length && !over()) {
        const sym = pend[i++]; const last = L[sym];
        if (!last) for (const id of ids) seedSyms.add(id + "|" + sym);
        const maxAge = last ? Math.min(30, Math.max(MAX_AGE, Math.ceil((now - last) / TF_MS[tf]) + 1)) : MAX_AGE;
        let e: string | null = null;
        try { e = await one(sym, maxAge); } catch (x) { e = (x as Error).message; }
        L[sym] = now; done++; if (e) errs.push(`${sym}: ${e}`); else ok++;
      }
    };
    if (pend.length) await Promise.all(Array.from({ length: conc }, worker));
    const covered = syms.filter((x) => L[x] >= slotStart).length;
    const oldest = syms.reduce((m, x) => Math.min(m, L[x] || 0), Infinity);
    const cov = { total: syms.length, covered, thisRun: done, okThisRun: ok, slotTsi: trT(slotStart), oldestTsi: oldest && oldest !== Infinity ? trT(oldest) : "hiç", full: covered >= syms.length };
    if (pend.length) {
      mark(ids, { nSym: syms.length, nOk: covered, coverage: cov, ...(errs.length || done ? { errors: errs.slice(0, 15), errCount: errs.length } : {}) });
      ran.push(...ids);
      lg(`${blk}: bu tur ${done} sembol (hatasız ${ok}) · kapsam ${covered}/${syms.length}${covered < syms.length ? " — kalan sonraki turda" : " ✓"}${errs.length ? " · hata " + errs.length : ""}`);
    } else for (const id of ids) Object.assign(rep(id), { nSym: syms.length, nOk: covered, coverage: cov });
  }

  // evrenler: kripto = USDT-M perp hacim sıralı ilk 200 (günde bir yenilenir), BIST = 200'e kadar
  const today = new Date(now).toISOString().slice(0, 10);
  const U = (doc.univ ||= {});
  if (U.day !== today || !U.crypto?.length) {
    try { const u = await lsUniverse(ctx, 200); if (u.length >= 50) { U.crypto = u; U.day = today; lg(`kripto evreni yenilendi: ${u.length} sembol (hacim sıralı)`); } }
    catch (e) { lg("kripto evreni alınamadı (önceki liste kullanılıyor): " + (e as Error).message); }
  }
  const CRYPTO = U.crypto?.length ? U.crypto : WATCH_CRYPTO;

  const blkCrypto = () => runBlock("kripto 4s", ["ek-crypto-4h", "dual-crypto-4h"], "4h", TF_MS["4h"], CRYPTO, 2, async (sym, maxAge) => {
    const { bars: b } = await coinBars(ctx, sym);
    if (!b || b.length < 300) return b ? `${b.length} mum (<300, atlandı)` : "veri yok";
    for (const f of ekScan("ek-crypto-4h", sym, "4h", b, maxAge)) found.push({ f, bars: b });
    touched.push({ scan: "ek-crypto-4h", sym, bars: b });
    const d = dualScan("dual-crypto-4h", sym, "4h", b, "LRB", 0.1, "B", maxAge); for (const f of d.found) found.push({ f, bars: b, dyn: d.dyn });
    touched.push({ scan: "dual-crypto-4h", sym, bars: b, dyn: d.dyn });
    return null;
  });
  const blkBist = () => runBlock("BIST 1g", ["ek-bist-1d", "dual-bist-1d", "rsi30-bist-1d"], "1d", TF_MS["2h"], WATCH_BIST, 2, async (sym, maxAge) => {
    const b = await yahooBars(sym);
    if (!b || b.length < 100) return b ? `${b.length} mum (<100, atlandı)` : "veri yok";
    if (b.length >= 100) { for (const f of rsi30Scan(sym, b, maxAge)) found.push({ f, bars: b }); touched.push({ scan: "rsi30-bist-1d", sym, bars: b }); }
    if (b.length < 300) return `${b.length} mum (EK/Dual için <300, yalnız RSI30)`;
    for (const f of ekScan("ek-bist-1d", sym, "1d", b, maxAge)) found.push({ f, bars: b });
    touched.push({ scan: "ek-bist-1d", sym, bars: b });
    const d = dualScan("dual-bist-1d", sym, "1d", b, "BB", 0.5, "A", maxAge); for (const f of d.found) found.push({ f, bars: b });
    touched.push({ scan: "dual-bist-1d", sym, bars: b });
    return null;
  });
  const blkLs = () => runBlock("L/S 2s", ["ls-2h"], "2h", TF_MS["2h"], CRYPTO, 3, async (sym, maxAge) => {
    const k = await perp2h(ctx, sym); if (!k) return "mum yok";
    const rs = await lsSeries(ctx, sym, "topPos", "2h", 500); if (!rs.length) return "oran yok";
    const mp = new Map<number, number>(rs.map((x) => [Number(x.timestamp), Number(x.longShortRatio)]));
    const ratio = k.bars.map((b) => (mp.has(b.t) ? mp.get(b.t)! : null));
    for (const d of lsDivergences(k.bars, ratio, maxAge)) {
      const t = k.bars[d.p].t, tc = k.bars[d.c].t;
      const info = `güç ${d.strength} · oran ${d.prev.toFixed(3)} → ${d.ratio.toFixed(3)} (+${d.rr.toFixed(1)}%) · BB alt bant ${d.bb ? "EVET" : "hayır"} · pivot ${tsiBar(t, "2h")}`;
      found.push({ bars: k.bars, f: { key: `ls-2h|${sym}|${t}`, scan: "ls-2h", symbol: sym, tf: "2h", t: tc, tsi: tsiBar(tc, "2h"), age: d.age, kind: "AL", price: k.px, entryBasis: "anlık fiyat",
        stop: d.stop, target: d.target, strength: d.strength, info, calc: { kind: "fixed" },
        title: `İZLEME | L/S DIP UYUMSUZLUK 2s | ${sym} [${d.strength}]`,
        body: `${sym} 2s top-trader L/S POZİSYON oranı boğa uyumsuzluğu (dip bölgesi)\nGüç: ${d.strength} (oran ${d.prev.toFixed(3)} → ${d.ratio.toFixed(3)}, +${d.rr.toFixed(1)}%)\nBB alt bant: ${d.bb ? "EVET" : "hayır"}\nPivot dip: ${tsiBar(t, "2h")} TSİ, onay ${d.age} mum önce\nGiriş (anlık): ${fmtP(k.px)}\nStop (dip): ${fmtP(d.stop)}\nHedef (BB üst): ${fmtP(d.target)}\nDurum: SADECE İZLEME — işlem açılmadı` } });
    }
    touched.push({ scan: "ls-2h", sym, bars: k.bars });
    return null;
  });
  // üç blok paralel (farklı veri kaynakları: Binance spot / Yahoo / proxy), her biri kendi dönen partisiyle
  await Promise.all([blkCrypto(), blkBist(), blkLs()]);

  // 4) yeni sinyaller → rapor + ntfy (sinyal mumu başına bir kez; ilk turda bildirimsiz tohumlama)
  let sent = 0, nNew = 0;
  for (const { f, bars, dyn } of found) {
    const r = rep(f.scan); if (r.signals.some((s) => s.key === f.key)) continue;
    nNew++;
    const { title, body, ...rest } = f;
    const s: WSig = { ...rest, status: "bekliyor", alerted: "dry-run", foundAt: now };
    if (doc.notified[f.key]) s.alerted = "gönderildi";
    else if (f.age > MAX_AGE) s.alerted = "eski (yaş>2)";
    else if (first || seedSyms.has(f.scan + "|" + f.symbol)) { s.alerted = "ilk tur (bildirimsiz)"; doc.notified[f.key] = now; }
    else if (ctx.dry) { s.alerted = "dry-run"; console.log(`--- ntfy (dry-run, gönderilmedi) ---\n${title}\n${body}`); }
    else {
      try { await ntfySend(title, body); s.alerted = "gönderildi"; doc.notified[f.key] = now; sent++; }
      catch (e) { s.alerted = "gönderilemedi"; lg(`ntfy hata ${f.scan} ${f.symbol}: ${(e as Error).message.replace(/https?:\/\/\S+/g, "<url>")}`); }
    }
    track(s, bars, dyn);
    r.signals.unshift(s); r.newCount = (r.newCount || 0) + 1;
    lg(`SİNYAL ${SCANS[f.scan].label} ${f.symbol} ${f.tsi} @${fmtP(f.price)} stop ${fmtP(f.stop)} hedef ${fmtP(f.target)} · ntfy ${s.alerted}`);
  }
  // 5) eski sinyallerin sonuç takibi (yalnız bu turda verisi olan semboller)
  for (const tc of touched) for (const s of rep(tc.scan).signals) if (s.symbol === tc.sym) track(s, tc.bars, tc.dyn);
  // retry: bildirimi başarısız kalan güncel sinyaller
  if (!ctx.dry) for (const r of Object.values(doc.scans)) for (const s of r.signals) {
    if (s.alerted !== "gönderilemedi" || now - s.foundAt > 6 * 36e5) continue;
    try { await ntfySend(`İZLEME | ${r.label} | ${s.symbol} AL`, `${r.label} — ${s.symbol} ${s.tf}\nSinyal mumu: ${s.tsi}\n${s.info}\nGiriş ref: ${fmtP(s.price)}\nStop: ${fmtP(s.stop)}\nHedef: ${fmtP(s.target)}\nDurum: SADECE İZLEME — işlem açılmadı`); s.alerted = "gönderildi"; doc.notified[s.key] = now; sent++; } catch { /* sonraki tur */ }
  }
  for (const r of Object.values(doc.scans)) r.signals = r.signals.slice(0, KEEP_SIG);
  for (const [k, t] of Object.entries(doc.notified)) if (now - t > KEEP_NOTIFIED_MS) delete doc.notified[k];

  // 6) L/S günlük veri toplama (dün UTC günü tamamlanınca bir kez)
  if (!ctx.dry) { try { await lsCollect(ctx, doc, lg); } catch (e) { doc.ls = { ...(doc.ls || {}), lastErr: (e as Error).message }; lg("L/S veri toplama hata: " + (e as Error).message); } }

  doc.firstRunDone = true; doc.updated = Date.now(); doc.updatedTsi = trT(); doc.log = doc.log.slice(-200);
  fs.writeFileSync(file, JSON.stringify(doc, null, 1));
  const summary = `İzleme: ${ran.length ? ran.join(", ") : over() ? "zaman bütçesi doldu (sonraki turda)" : "bu tur taranacak yeni mum yok"} · yeni sinyal ${nNew} · ntfy ${sent}${ctx.dry ? " (dry-run)" : ""}${first ? " · ilk tur: bildirimsiz tohumlama" : ""}`;
  lg(summary);
  return { newSignals: nNew, sent, ran, summary };
}

/** collect.py karşılığı: kripto evreni (top-200 perp), 4 metrik × (1s, 2s), dünün (UTC) satırları → lsdata/YYYY-MM-DD.csv (gün başına bir dosya, bir kez yazılır) */
async function lsCollect(ctx: WatchCtx, doc: WatchDoc, lg: (m: string) => void) {
  const now = Date.now(), dayStart = Math.floor(now / 864e5) * 864e5, day = new Date(dayStart - 864e5).toISOString().slice(0, 10);
  if (now - dayStart < 30 * 6e4) return; // 00:30 UTC sonrası (son 2s oranı yayımlansın)
  const L = (doc.ls ||= {});
  if (over()) return;
  if (L.pend && L.pend.day !== day && L.pend.done < L.pend.syms.length) { /* önceki günü bitir */ }
  else { if (L.lastDay === day) return; if (!L.pend || L.pend.day !== day) L.pend = { day, syms: (doc.univ?.crypto?.length ? doc.univ.crypto : await lsUniverse(ctx, 200)), done: 0, rows: 0, errs: 0 }; }
  const P = L.pend; if (!P.syms.length) throw new Error("evren boş");
  const pd0 = Date.parse(P.day + "T00:00:00Z"), pd1 = pd0 + 864e5, pday = P.day;
  const dir = path.join(ctx.dir, "lsdata"), file = path.join(dir, pday + ".csv"); fs.mkdirSync(dir, { recursive: true });
  if (P.done === 0) fs.writeFileSync(file, "symbol,metric,period,ts,ratio,long_v,short_v\n");
  while (P.done < P.syms.length && !over()) {
    const sym = P.syms[P.done], rows: string[] = [];
    for (const metric of Object.keys(LS_METRIC)) for (const period of ["1h", "2h"]) {
      try {
        const d = await lsSeries(ctx, sym, metric, period, period === "1h" ? 60 : 36);
        for (const x of d) {
          const ts = Number(x.timestamp); if (ts < pd0 || ts >= pd1) continue;
          if (metric === "taker") rows.push(`${sym},${metric},${period},${ts},${x.buySellRatio},${x.buyVol},${x.sellVol}`);
          else rows.push(`${sym},${metric},${period},${ts},${x.longShortRatio},${x.longAccount},${x.shortAccount}`);
        }
      } catch { P.errs++; }
    }
    if (rows.length) fs.appendFileSync(file, rows.join("\n") + "\n");
    P.rows += rows.length; P.done++;
  }
  if (P.done < P.syms.length) { lg(`L/S veri toplama ${pday}: ${P.done}/${P.syms.length} sembol (sonraki turda devam)`); return; }
  L.lastDay = pday; L.files = [...(L.files || []).filter((f) => f !== pday + ".csv"), pday + ".csv"].slice(-60); L.lastRows = P.rows; L.lastErr = P.errs ? `${P.errs} istek hatası` : undefined; delete L.pend;
  lg(`L/S veri toplama ${pday}: ${P.rows} satır, ${P.syms.length} sembol${P.errs ? ", hata " + P.errs : ""}`);
}

// Tek başına çalıştırma (yerel deneme): WATCH_DIR=/tmp/x WATCH_DRY=1 npx tsx scripts/paper-bot/watch.ts
if (process.argv[1] && /watch\.ts$/.test(process.argv[1])) {
  const dir = process.env.WATCH_DIR || process.cwd();
  runWatch({ dir, dry: process.env.WATCH_DRY === "1", futHost: process.env.WATCH_FUT_HOST || null, proxy: (process.env.QX_PROXY || "https://tradedesk-ochre.vercel.app").replace(/\/$/, "") })
    .then((r) => console.log(r.summary)).catch((e) => { console.error(e); process.exit(1); });
}
