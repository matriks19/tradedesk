/**
 * SANAL KAĞIT İŞLEM DEFTERİ (Umut+PG / Umut) — GERÇEK EMİR YOK, robot pozisyonlarına (state.json) dokunmaz. 02.11.2026.
 * Kural: giriş = sinyalden sonraki 4s açılış; stop = giriş − 2·ATR14 (sinyal mumu); kademeli çıkış 1/3 R1 +%10, 1/3 R2 +%20, 1/3 R3 +%30;
 * kalan kısım stopta (stop R1 sonrası da sabit) veya 100. mum kapanışında çıkar. Aynı mumda stop önceliklidir (stop vurulursa o mumda hedef sayılmaz).
 * Boşluk (gap): açılış stopun altındaysa açılıştan, hedefin üstündeyse açılıştan dolar. Ücret %0.1/taraf her parçaya.
 * Ayrıca "test kuralı" (araştırmadaki tek hedef %10 + 2 ATR + 100 mum) aynı işlem için ayrıca hesaplanır (tp10).
 * Coin başına tek işlem (defter bazında): önceki işlem kapanmadan aynı coinde yeni sinyal deftere girmez.
 */
export const PAPER = { start: 1000, size: 100, fee: 0.001, atrK: 2, tps: [0.1, 0.2, 0.3], bars: 100 };
export interface PBar { t: number; open: number; high: number; low: number; close: number }
export interface PLeg { k: number; px: number; w: number; why: string }
export interface PTrade {
  key: string; sym: string; t: number; tsi: string; atr: number; pg?: number; pgMode?: string; pgC?: Record<string, number>; backfill?: boolean; foundAt: number;
  fillT?: number; entry?: number; stop?: number; r?: [number, number, number];
  status: "bekliyor" | "açık" | "kapandı"; why?: string; exitT?: number; exitPx?: number; bars?: number; last?: number;
  hit?: { r1: number | null; r2: number | null; r3: number | null; stop: number | null };
  legs?: PLeg[]; pct?: number; usd?: number; tp10?: { pct: number; why: string; k: number; done: boolean } | null; mfe?: number; mae?: number;
}
const net = (E: number, x: number) => x / E - 1 - PAPER.fee * (1 + x / E);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Deterministik: mumlardan her seferinde baştan hesaplar. Giriş mumu veri penceresinden çıkmışsa kayıt korunur. */
export function paperTrack(tr: PTrade, b: PBar[]): void {
  if (tr.status === "kapandı" && tr.fillT != null && !b.some((x) => x.t === tr.fillT)) return;
  const i0 = b.findIndex((x) => x.t > tr.t);
  if (i0 < 0) { tr.status = "bekliyor"; return; }
  if (tr.fillT != null && b[i0].t !== tr.fillT) { const j = b.findIndex((x) => x.t === tr.fillT); if (j < 0) return; }
  const E = b[i0].open, S = E - PAPER.atrK * tr.atr, tg = PAPER.tps.map((p) => E * (1 + p));
  tr.fillT = b[i0].t; tr.entry = E; tr.stop = S; tr.r = [tg[0], tg[1], tg[2]];
  const hit = { r1: null as number | null, r2: null as number | null, r3: null as number | null, stop: null as number | null };
  const legs: PLeg[] = []; let w = 1, stage = 0, k = 0, end: string | null = null, last = E, hi = E, lo = E;
  for (let j = i0; j < b.length && k < PAPER.bars; j++) {
    k++; const x = b[j]; last = x.close; hi = Math.max(hi, x.high); lo = Math.min(lo, x.low);
    if (x.low <= S) { const px = x.open <= S && k > 1 ? x.open : S; legs.push({ k, px, w, why: "stop" }); w = 0; hit.stop = k; end = stage ? `R${stage}+stop` : "stop"; break; }
    for (let m = stage; m < 3; m++) if (x.high >= tg[m]) { const px = k > 1 ? Math.max(tg[m], x.open) : tg[m]; legs.push({ k, px, w: 1 / 3, why: "R" + (m + 1) }); w -= 1 / 3; stage = m + 1; (hit as Record<string, number | null>)["r" + (m + 1)] = k; }
    if (stage === 3) { w = 0; end = "R3"; break; }
    if (k >= PAPER.bars) { legs.push({ k, px: x.close, w, why: "süre" }); w = 0; end = stage ? `R${stage}+süre` : "süre"; }
  }
  if (w < 1e-9) w = 0;
  const real = legs.reduce((a, g) => a + g.w * net(E, g.px), 0), mtm = w > 0 ? w * net(E, last) : 0;
  tr.legs = legs.map((g) => ({ ...g, w: r2(g.w) })); tr.hit = hit; tr.bars = k; tr.last = last; tr.mfe = r2((hi / E - 1) * 100); tr.mae = r2((lo / E - 1) * 100);
  tr.pct = r2((real + mtm) * 100); tr.usd = r2(((real + mtm) * PAPER.size));
  if (end) { tr.status = "kapandı"; tr.why = end; const lg = legs[legs.length - 1]; tr.exitT = b[i0 + lg.k - 1].t; tr.exitPx = lg.px; }
  else { tr.status = "açık"; tr.why = stage ? `R${stage} alındı` : "açık"; tr.exitT = undefined; tr.exitPx = undefined; }
  // test kuralı: tek hedef %10
  let t10: PTrade["tp10"] = null; k = 0;
  for (let j = i0; j < b.length && k < PAPER.bars; j++) {
    k++; const x = b[j];
    if (x.low <= S) { const px = x.open <= S && k > 1 ? x.open : S; t10 = { pct: r2(net(E, px) * 100), why: "stop", k, done: true }; break; }
    if (x.high >= tg[0]) { const px = k > 1 ? Math.max(tg[0], x.open) : tg[0]; t10 = { pct: r2(net(E, px) * 100), why: "R1", k, done: true }; break; }
    if (k >= PAPER.bars) { t10 = { pct: r2(net(E, x.close) * 100), why: "süre", k, done: true }; break; }
  }
  tr.tp10 = t10 || { pct: r2(net(E, last) * 100), why: "açık", k, done: false };
}

export interface PStats { n: number; open: number; wait: number; win: number; avg: number | null; total: number; usd: number; balance: number; equity: number; openUsd: number; dd: number; ddPct: number; pf: number | null; tp10: { n: number; avg: number | null; total: number; win: number }; curve: [number, number][] }
export function paperStats(T: PTrade[]): PStats {
  const C = T.filter((x) => x.status === "kapandı" && x.pct != null).sort((a, b) => (a.exitT || 0) - (b.exitT || 0));
  const O = T.filter((x) => x.status === "açık");
  let bal = PAPER.start, peak = bal, dd = 0, ddPct = 0; const curve: [number, number][] = [];
  for (const x of C) { bal += x.usd || 0; curve.push([x.exitT || x.t, r2(bal)]); peak = Math.max(peak, bal); if (peak - bal > dd) { dd = peak - bal; ddPct = (dd / peak) * 100; } }
  const pos = C.filter((x) => (x.pct || 0) > 0), gp = pos.reduce((a, x) => a + (x.pct || 0), 0), gl = -C.filter((x) => (x.pct || 0) < 0).reduce((a, x) => a + (x.pct || 0), 0);
  const openUsd = O.reduce((a, x) => a + (x.usd || 0), 0), t10 = T.filter((x) => x.tp10 && x.tp10.done);
  return { n: C.length, open: O.length, wait: T.filter((x) => x.status === "bekliyor").length, win: C.length ? r2((100 * pos.length) / C.length) : 0,
    avg: C.length ? r2(C.reduce((a, x) => a + (x.pct || 0), 0) / C.length) : null, total: r2(C.reduce((a, x) => a + (x.pct || 0), 0)), usd: r2(bal - PAPER.start),
    balance: r2(bal), equity: r2(bal + openUsd), openUsd: r2(openUsd), dd: r2(dd), ddPct: r2(ddPct), pf: gl > 0 ? r2(gp / gl) : null,
    tp10: { n: t10.length, avg: t10.length ? r2(t10.reduce((a, x) => a + x.tp10!.pct, 0) / t10.length) : null, total: r2(t10.reduce((a, x) => a + x.tp10!.pct, 0)), win: t10.length ? r2((100 * t10.filter((x) => x.tp10!.pct > 0).length) / t10.length) : 0 }, curve };
}
