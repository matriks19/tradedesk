/**
 * DONCHIAN + RANGE DIP — saf fonksiyonlar (UI yok, ağ yok). GERÇEK İŞLEM YOK: yalnız izleme + sanal kağıt defter. 03.11.2026.
 *
 * 1) Donchian kırılımı (Zarattini–Pagani–Barbon 2025, "Catching Crypto Trends", SSRN 5209907):
 *    üst = en yüksek KAPANIŞ(n), alt = en düşük KAPANIŞ(n), orta = (üst+alt)/2. Kapanış üst banda değince long;
 *    iz süren stop = orta çizgi, yalnız yukarı taşınır (TS[t+1] = max(TS[t], orta[t])); kapanış TS altına/eşitine inince çık.
 *    Ensemble: 5/10/20/30 modellerinin ortalaması (frac 0..1); ağırlık w = min(%25 / σ90, %200) × frac (σ90 = 90 günlük yıllık volatilite).
 * 2) Range Dip (kullanıcının kuralı, ön-kayıtlı test kurallarıyla birebir — /tmp/cct/rd/RULES.md):
 *    alt = en düşük DİP(N) (önceki N mum), üst = en yüksek TEPE(N) (önceki N mum). Likidite avı: mumun fitili alt bandın altına iner, kapanış bandın içinde.
 *    İkili/üçlü dip: önceki [i−N, i−5] aralığında, grab dibine ≤ 1.25·ATR14 yakın, onaylı pivot dipler (3 sol / 3 sağ, ≥5 mum arayla) — en az 1 (ikili), 2+ (üçlü).
 *    Giriş sonraki açılış; stop = grab fitili − 0.1·ATR; hedef = üst bant (sinyal anındaki); en fazla 3N mum; aynı mumda stop önce.
 */
export interface DBar { t: number; open: number; high: number; low: number; close: number }
export const DON = { lbs: [5, 10, 20, 30], scanNs: [20, 55], tv: 0.25, volD: 90, volMin: 60, cap: 2, thr: 0.2, fee: 0.001, start: 1000, top: 10, minBars: 365 };
export const RDIP = { Ns: [20, 55], pivL: 3, pivR: 3, tolAtr: 1.25, minSep: 5, stopBuf: 0.1, holdMul: 3, risk: 0.01, start: 1000, fee: 0.001, top: 50 };

/** Kapanış tabanlı Donchian + orta çizgi iz süren stop. pos[i]=1 pozisyonda (i kapanışı itibarıyla); ts[i] = i+1 mumunda geçerli stop. */
export function donchTrail(c: number[], n: number): { pos: Uint8Array; ts: number[]; up: number[]; mid: number[] } {
  const L = c.length, pos = new Uint8Array(L), ts = new Array(L).fill(NaN), up = new Array(L).fill(NaN), mid = new Array(L).fill(NaN);
  let inp = false, st = NaN;
  for (let i = 0; i < L; i++) {
    if (i >= n - 1) { let hh = -Infinity, ll = Infinity; for (let j = i - n + 1; j <= i; j++) { if (c[j] > hh) hh = c[j]; if (c[j] < ll) ll = c[j]; } up[i] = hh; mid[i] = (hh + ll) / 2; }
    if (!Number.isFinite(up[i]) || !Number.isFinite(c[i])) { inp = false; continue; }
    if (inp) { if (c[i] <= st) inp = false; else st = Math.max(st, mid[i]); }
    if (!inp && c[i] >= up[i]) { inp = true; st = mid[i]; }
    pos[i] = inp ? 1 : 0; ts[i] = inp ? st : NaN;
  }
  return { pos, ts, up, mid };
}
/** Yıllık volatilite (kapanış getirileri, pencere win, en az mn gözlem), günlük mum varsayımı (√365). */
export function volAnn(c: number[], win = DON.volD, mn = DON.volMin): number[] {
  const r = c.map((x, i) => (i ? x / c[i - 1] - 1 : NaN)), o = new Array(c.length).fill(NaN);
  for (let i = 1; i < c.length; i++) {
    const a: number[] = []; for (let j = Math.max(1, i - win + 1); j <= i; j++) if (Number.isFinite(r[j])) a.push(r[j]);
    if (a.length < mn) continue; const m = a.reduce((s, x) => s + x, 0) / a.length;
    o[i] = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)) * Math.sqrt(365);
  }
  return o;
}
/** Ensemble: frac = aktif model oranı (0..1), on = aktif model sayısı, w = vol-hedefli ağırlık (0..cap). */
export function donchEnsemble(c: number[], lbs = DON.lbs): { frac: number[]; on: number[]; w: number[]; ts: number[][] } {
  const T = lbs.map((n) => donchTrail(c, n)), sig = volAnn(c);
  const on = c.map((_, i) => T.reduce((s, x) => s + x.pos[i], 0)), frac = on.map((x) => x / lbs.length);
  const w = frac.map((f, i) => (f > 0 && sig[i] > 0 ? Math.min(DON.tv / sig[i], DON.cap) * f : 0));
  return { frac, on, w, ts: T.map((x) => x.ts) };
}

function atr14(b: DBar[]): number[] {
  const n = b.length, o = new Array(n).fill(NaN); if (n < 15) return o;
  const tr = b.map((x, i) => (i ? Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close)) : x.high - x.low));
  let a = 0; for (let i = 0; i < 14; i++) a += tr[i]; a /= 14; o[13] = a;
  for (let i = 14; i < n; i++) { a = (a * 13 + tr[i]) / 14; o[i] = a; }
  return o;
}
export interface RDHit { i: number; N: number; dl: number; du: number; stop: number; atr: number; k: number; bottoms: number[] }
/** Range Dip sinyalleri (kapanmış mumlar). k = grab dışındaki yakın dip sayısı (1 → ikili, 2+ → üçlü). */
export function rangeDipSignals(b: DBar[], N: number): RDHit[] {
  const n = b.length, A = atr14(b), out: RDHit[] = [], P = RDIP.pivL, Q = RDIP.pivR;
  const piv = new Uint8Array(n);
  for (let p = P; p < n - Q; p++) {
    let ok = true; for (let j = p - P; j < p; j++) if (!(b[p].low < b[j].low)) { ok = false; break; }
    if (ok) for (let j = p + 1; j <= p + Q; j++) if (!(b[p].low <= b[j].low)) { ok = false; break; }
    piv[p] = ok ? 1 : 0;
  }
  for (let i = Math.max(N, 20); i < n; i++) {
    const a = A[i]; if (!(a > 0)) continue;
    let dl = Infinity, du = -Infinity; for (let j = i - N; j < i; j++) { if (b[j].low < dl) dl = b[j].low; if (b[j].high > du) du = b[j].high; }
    if (!(b[i].low < dl && b[i].close > dl)) continue; // likidite avı: fitil altta, kapanış içeride
    const bot: number[] = [];
    for (let p = i - 5; p >= i - N; p--) {
      if (p < P || p + Q > i || !piv[p]) continue; // pivot onayı (p+3) sinyal mumuna kadar
      if (Math.abs(b[p].low - b[i].low) > RDIP.tolAtr * a) continue;
      if (bot.every((q) => Math.abs(p - q) >= RDIP.minSep)) bot.push(p);
    }
    if (bot.length < 1) continue; // ikili/üçlü dip teyidi şart
    out.push({ i, N, dl, du, stop: Math.min(b[i].low, dl) - RDIP.stopBuf * a, atr: a, k: bot.length, bottoms: bot });
  }
  return out;
}

// ---------- Range Dip sanal kağıt defteri ----------
export interface RDTrade {
  key: string; sym: string; N: number; t: number; tsi: string; stop: number; tp: number; dl: number; atr: number; k: number; backfill?: boolean; foundAt: number;
  fillT?: number; entry?: number; notional?: number; status: "bekliyor" | "açık" | "kapandı" | "iptal"; why?: string; exitT?: number; exitPx?: number; bars?: number; last?: number; R?: number; usd?: number; exitNote?: string;
}
const r2 = (v: number) => Math.round(v * 100) / 100;
/** Deterministik: mumlardan baştan hesaplar. Risk = başlangıç × %1 (10$), nominal ≤ başlangıç; ücret %0.1/taraf. */
export function rdTrack(tr: RDTrade, b: DBar[]): void {
  if ((tr.status === "kapandı" || tr.status === "iptal") && tr.fillT != null && !b.some((x) => x.t === tr.fillT)) return;
  const i0 = b.findIndex((x) => x.t > tr.t); if (i0 < 0) { tr.status = "bekliyor"; return; }
  const E = b[i0].open, S = tr.stop, TP = tr.tp; tr.fillT = b[i0].t; tr.entry = E;
  if (!(TP > E && E > S)) { tr.status = "iptal"; tr.why = "giriş stop/hedef dışında açıldı"; tr.usd = 0; tr.R = 0; return; }
  const riskUsd = RDIP.start * RDIP.risk, notional = Math.min(riskUsd * E / (E - S), RDIP.start); tr.notional = r2(notional);
  const maxK = RDIP.holdMul * tr.N; let px: number | null = null, why = "", k = 0, last = E;
  for (let j = i0; j < b.length; j++) {
    k++; const x = b[j]; last = x.close;
    if (k > 1 && x.open <= S) { px = x.open; why = "stop"; }
    else if (x.low <= S) { px = S; why = "stop"; }
    else if (x.high >= TP) { px = k > 1 ? Math.max(TP, x.open) : TP; why = "hedef"; }
    else if (k >= maxK) { px = x.close; why = "süre"; }
    if (px != null) { tr.exitT = x.t; break; }
  }
  const X = px ?? last, usd = notional * (X / E - 1) - notional * RDIP.fee * (1 + X / E);
  tr.bars = k; tr.last = last; tr.usd = r2(usd); tr.R = r2(usd / riskUsd);
  if (px != null) { tr.status = "kapandı"; tr.why = why; tr.exitPx = px; } else { tr.status = "açık"; tr.why = "açık"; tr.exitPx = undefined; tr.exitT = undefined; }
}
export interface RDStats { n: number; open: number; win: number; avgR: number | null; pf: number | null; usd: number; balance: number; equity: number; openUsd: number; dd: number; ddPct: number; curve: [number, number][]; byN: Record<string, { n: number; win: number; avgR: number | null }> }
export function rdStats(T: RDTrade[]): RDStats {
  const C = T.filter((x) => x.status === "kapandı").sort((a, b) => (a.exitT || 0) - (b.exitT || 0)), O = T.filter((x) => x.status === "açık");
  let bal = RDIP.start, peak = bal, dd = 0, ddPct = 0; const curve: [number, number][] = [];
  for (const x of C) { bal += x.usd || 0; curve.push([x.exitT || x.t, r2(bal)]); peak = Math.max(peak, bal); if (peak - bal > dd) { dd = peak - bal; ddPct = (dd / peak) * 100; } }
  const gp = C.filter((x) => (x.R || 0) > 0).reduce((a, x) => a + (x.R || 0), 0), gl = -C.filter((x) => (x.R || 0) < 0).reduce((a, x) => a + (x.R || 0), 0);
  const openUsd = O.reduce((a, x) => a + (x.usd || 0), 0), byN: RDStats["byN"] = {};
  for (const N of RDIP.Ns) { const c = C.filter((x) => x.N === N); byN[N] = { n: c.length, win: c.length ? r2((100 * c.filter((x) => (x.R || 0) > 0).length) / c.length) : 0, avgR: c.length ? r2(c.reduce((a, x) => a + (x.R || 0), 0) / c.length) : null }; }
  return { n: C.length, open: O.length, win: C.length ? r2((100 * C.filter((x) => (x.R || 0) > 0).length) / C.length) : 0, avgR: C.length ? r2(C.reduce((a, x) => a + (x.R || 0), 0) / C.length) : null,
    pf: gl > 0 ? r2(gp / gl) : null, usd: r2(bal - RDIP.start), balance: r2(bal), equity: r2(bal + openUsd), openUsd: r2(openUsd), dd: r2(dd), ddPct: r2(ddPct), curve, byN };
}

// ---------- Donchian ensemble sanal robot (top-10, vol-hedefli) ----------
export interface DSleeve { eq: number; held: number; frac: number; on: number; last?: number; entryT?: number; entryPx?: number; entryEq?: number; ts?: number }
export interface DEvent { t: number; tsi: string; sym: string; type: "GİRİŞ" | "ÇIKIŞ"; why: string; px: number; on: number; w: number; pnl?: number; pct?: number; alerted?: string }
export interface DTradeRec { sym: string; inT: number; outT: number; inPx: number; outPx: number; pnl: number; pct: number }
export interface DRobot { v: 1; rule: string; start: number; since?: number; lastT?: number; month?: string; members: string[]; cash: number; sl: Record<string, DSleeve>; ev: DEvent[]; trades: DTradeRec[]; curve: [number, number][]; equity?: number; updated?: number; updatedTsi?: string; err?: string }
export interface DDay { c: number; r: number; frac: number; on: number; w: number; ts: number }
/** Bir günlük kapanışı işler: (1) dünkü ağırlıkla getiri, (2) ay başında evren yenileme (eşit 1/10 dilim), (3) sinyal değişimi ya da %20 eşik aşımında yeniden boyut (ücret %0.1).
 *  Dönen olaylar: GİRİŞ (frac 0 → >0) / ÇIKIŞ (frac >0 → 0 ya da evrenden çıkış). */
export function donchStep(R: DRobot, t: number, tsi: string, day: Record<string, DDay | undefined>, members: string[] | null): DEvent[] {
  const ev: DEvent[] = [], fee = DON.fee;
  for (const s of R.members) { const x = R.sl[s], d = day[s]; if (!x || !d) continue; const g = 1 + x.held * d.r; x.eq *= g; x.held = g > 0 ? (x.held * (1 + d.r)) / g : 0; x.last = d.c; }
  const exit = (s: string, x: DSleeve, px: number, why: string) => {
    const pnl = x.entryEq != null ? x.eq - x.entryEq : 0, pct = x.entryEq ? (x.eq / x.entryEq - 1) * 100 : 0;
    ev.push({ t, tsi, sym: s, type: "ÇIKIŞ", why, px, on: 0, w: 0, pnl: r2(pnl), pct: r2(pct) });
    if (x.entryT != null && x.entryPx != null) R.trades.unshift({ sym: s, inT: x.entryT, outT: t, inPx: x.entryPx, outPx: px, pnl: r2(pnl), pct: r2(pct) });
    x.entryT = x.entryPx = x.entryEq = x.ts = undefined;
  };
  if (members) {
    const total = R.cash + R.members.reduce((a, s) => a + (R.sl[s]?.eq || 0), 0), share = total / DON.top, nsl: Record<string, DSleeve> = {};
    for (const s of R.members) { const x = R.sl[s]; if (!x || members.includes(s)) continue; if (x.held > 0 || x.frac > 0) { x.eq -= x.held * x.eq * fee; exit(s, x, x.last ?? 0, "evrenden çıktı (aylık yenileme)"); } }
    for (const s of members) {
      const o = R.sl[s]; const x: DSleeve = o ? { ...o } : { eq: share, held: 0, frac: 0, on: 0 };
      if (o) { const cost = Math.abs(share * o.held - o.eq * o.held) * fee; x.eq = share - cost; } else x.eq = share;
      nsl[s] = x;
    }
    R.cash = total - members.length * share; R.sl = nsl; R.members = members.slice();
  }
  for (const s of R.members) {
    const x = R.sl[s], d = day[s]; if (!x || !d) continue;
    const tw = d.w, prev = x.frac, chg = d.frac !== prev;
    if (chg || (tw === 0 && x.held !== 0) || (tw > 0 && Math.abs(x.held - tw) > DON.thr * tw)) { x.eq -= Math.abs(tw - x.held) * x.eq * fee; x.held = tw; }
    if (prev === 0 && d.frac > 0) { x.entryT = t; x.entryPx = d.c; x.entryEq = x.eq; ev.push({ t, tsi, sym: s, type: "GİRİŞ", why: `${d.on}/${DON.lbs.length} model kırılımda`, px: d.c, on: d.on, w: r2(tw * 100) }); }
    else if (prev > 0 && d.frac === 0) exit(s, x, d.c, "iz süren stop (orta çizgi) kırıldı");
    x.frac = d.frac; x.on = d.on; x.last = d.c; x.ts = d.frac > 0 && Number.isFinite(d.ts) ? d.ts : undefined;
  }
  R.equity = r2(R.cash + R.members.reduce((a, s) => a + (R.sl[s]?.eq || 0), 0));
  R.curve.push([t, R.equity]); R.curve = R.curve.slice(-1500);
  R.ev = [...ev, ...R.ev].slice(0, 400); R.trades = R.trades.slice(0, 400); R.lastT = t;
  return ev;
}

/** TradFi (hisse/emtia/endeks/FX/ön-piyasa) USDT-M perp'leri — Binance exchangeInfo underlyingType ≠ COIN (03.11.2026 anlık listesi).
 *  Donchian/Range Dip yalnız kripto coinlerde çalışır; sonradan eklenen TradFi perp'ler kısa geçmişleri nedeniyle robotun ≥365 gün şartına zaten takılır. */
export const TRADFI = new Set("AAOI AAPL ABBV ACN ADBE AGPU AKAM ALAB ALL AMAT AMC AMD AMGN AMZN ANET ANTHROPIC APLD APP ARM ASML ASTS AVGO AXTI BABA BAC BBX BE BITO BMNR BNC BOT BRKB BSP BTCDOM BWET BX BYD BZ CAT CBRS CEG CIEN CL COHR COIN COPPER COST CRCL CRDO CRML CRM CRWD CRWV CSCO CSOPSAMSUNG2L CSOPSKHYNIX2L CVNA CXMT CYPH DDOG DEFI DELL DIS DJT DKNG DRAM EBAY EIDO EQT EWJ EWT EWY EWZS EWZ FLEX FLNC FWDI GDX GEV GIGADEV GLW GME GOOGL GPRO GS GTLB HANMI HD HIMS HK0625 HK0700 HK0992 HK1810 HOOD HPE HUT HYUNDAI IBKR IBM INTC INTW IONQ IREN IWM JPM KLAC KODEX200 KORU KO KSTR KUAISHOU LGELECTRONICS LITE LLY LRCX LYTE MARA MCD MDB MDT MEITUAN MELI META MINIMAX MOONSHOT MP MRK MRNA MRVL MSFT MSTR MSTU MU MUU MVLL NATGAS NAVER NBIS NET NFLX NKE NOK NOW NVDA NVDL NVO OKLO ONDS OPENAI ORCL OURA OXY PANW PATH PAYP PDD PENG PFE PLTR POPMART PREDICT PYPL QCOM QNTX QQQ RAM RDDT RDW RIVN RKLB RUM SAMSUNGEM SAMSUNG SECZ SHAZ SHOP SKDD SKHYNIX SKHY SKUU SMCI SMH SMR SNDK SNOW SNPS SNXX SOFI SONY SOXL SOXS SPCX SPY SQQQ STM STRC STXX TBT TEAM TEM TENCENT TER TMF TQQQ TSLA TSLL TSM TTWO TWST TXN TZA UBER UNH UNITREE URNM USAR USDBRL USDEX UVXY VKTX VRT VST V WDC WEN WMT XAG XAU XBI XLE XOM XPD XPT ZCSH ZHIPU ZHONGJI ZM ZS".split(" "));
export const isCoin = (sym: string) => !TRADFI.has(sym.replace(/USDT$/, ""));
