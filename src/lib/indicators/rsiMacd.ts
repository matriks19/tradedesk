/**
 * RSI + MACD 1s (rsi-macd-1h) — /workspace/ls-dip/gainers40 %40 pump araştırması (4s RSI uyumsuzluk + 1s MACD kesişimi en ayırt edici ikili).
 * ŞART: 1s MACD(50,100,200) çizgisi sinyali yukarı keser (kapanmış mum).
 * ARTI en az biri: (a) 1s RSI14 30'u yukarı keser — kesişimden önceki ≤12 mum içinde (kesişim mumu dahil)
 *                  (b) boğa RSI uyumsuzluğu (fiyat alçalan dip, RSI yükselen dip; pivot 2/2, ikili) — 1s veya 4s, onayı kesişimden önceki ≤48 saatte.
 * Çıkış (paper bot): TP yok, 1s Parabolic SAR (0.02/0.02/0.2) satışa dönünce "SAR STOP".
 * Yeniden giriş: SAR stop sonrası SAR tekrar alışa döner + MACD hâlâ sinyalin üstünde + son ≤72 mumda geçerli kurulum (MACD↑ + RSI şartı).
 */
import { macdLine, multiDiv, LS_DIV } from "./lsDivMacd";
import { rsi as rsiArr } from "./math";

export type RmBar = { time: number; high: number; low: number; close: number }; // time = açılış (sn), yalnız kapanmış mumlar
export type RsiMacdCond = "rm_x30" | "rm_div1h" | "rm_div4h";
export const ALL_RSI_MACD_CONDS: RsiMacdCond[] = ["rm_x30", "rm_div1h", "rm_div4h"];
export const DEFAULT_RSI_MACD_CONDS: RsiMacdCond[] = ["rm_x30", "rm_div1h", "rm_div4h"];
export const RSI_MACD_COND_LABEL: Record<RsiMacdCond, string> = {
  rm_x30: "MACD↑ + RSI 30↑ (1s)",
  rm_div1h: "MACD↑ + RSI uyumsuzluk 1s",
  rm_div4h: "MACD↑ + RSI uyumsuzluk 4s",
};
export const RSI_MACD = { x30Bars: 12, divH: 48, reentryBars: 72, sar: { start: 0.02, inc: 0.02, max: 0.2 } };
const H1 = 3600, H4 = 4 * 3600;

export type RmDiv = { tf: "1h" | "4h"; confClose: number; pivotTimes: number[]; priceLows: number[]; rsiLows: number[] };
export type RsiMacdSetup = {
  crossIdx: number; crossOpen: number; crossAgo: number;
  /** RSI 30↑ kesişim mumunun açılışı (sn) */ x30: number | null;
  divs: RmDiv[]; conds: RsiMacdCond[];
};

/** Klasik Wilder PSAR (/workspace/ls-dip/sar.py ile aynı): her mum kapanışındaki SAR ve yön (true = alış). */
export function psarState(b: RmBar[], start = RSI_MACD.sar.start, inc = RSI_MACD.sar.inc, mx = RSI_MACD.sar.max) {
  const n = b.length, sar = new Array<number>(n).fill(NaN), bull = new Array<boolean>(n).fill(true);
  if (!n) return { sar, bull };
  let up = true, af = start, ep = b[0].high, s = b[0].low; sar[0] = s;
  for (let i = 1; i < n; i++) {
    s = s + af * (ep - s);
    if (up) {
      s = Math.min(s, b[i - 1].low, i > 1 ? b[i - 2].low : b[i - 1].low);
      if (b[i].low < s) { up = false; s = ep; ep = b[i].low; af = start; }
      else if (b[i].high > ep) { ep = b[i].high; af = Math.min(af + inc, mx); }
    } else {
      s = Math.max(s, b[i - 1].high, i > 1 ? b[i - 2].high : b[i - 1].high);
      if (b[i].high > s) { up = true; s = ep; ep = b[i].high; af = start; }
      else if (b[i].low < ep) { ep = b[i].low; af = Math.min(af + inc, mx); }
    }
    sar[i] = s; bull[i] = up;
  }
  return { sar, bull };
}

const rsiN = (c: number[]) => rsiArr(c, 14).map((v) => (v === null ? NaN : v));
function rsiDivs(b: RmBar[], tf: "1h" | "4h"): RmDiv[] {
  if (b.length < 40) return [];
  const lows = b.map((x) => x.low), r = rsiN(b.map((x) => x.close)), ms = tf === "4h" ? H4 : H1;
  return multiDiv(lows, r, 2, LS_DIV).filter((e) => e.P.every((p) => Number.isFinite(r[p]))).map((e) => ({
    tf, confClose: b[e.conf].time + ms, pivotTimes: e.P.map((p) => b[p].time), priceLows: e.P.map((p) => lows[p]), rsiLows: e.P.map((p) => r[p]),
  }));
}

/**
 * b1: kapanmış 1s mumlar (≥ ~600 önerilir; MACD 200 sinyal ısınması), b4: kapanmış 4s mumlar (boş olabilir → yalnız 1s).
 * maxAgo mum içindeki her MACD↑ kesişimi için RSI şartlarını değerlendirir; şartı sağlayanları YENİ→ESKİ döndürür.
 */
export function rsiMacdSetups(b1: RmBar[], b4: RmBar[], maxAgo: number, conds: RsiMacdCond[] = DEFAULT_RSI_MACD_CONDS): RsiMacdSetup[] {
  const n = b1.length; if (n < 300) return [];
  const { m, g } = macdLine(b1.map((x) => x.close));
  const r1 = rsiN(b1.map((x) => x.close));
  const d1 = conds.includes("rm_div1h") ? rsiDivs(b1, "1h") : [];
  const d4 = conds.includes("rm_div4h") ? rsiDivs(b4, "4h") : [];
  const out: RsiMacdSetup[] = [];
  for (let i = n - 1; i >= Math.max(201, n - 1 - maxAgo); i--) {
    if (!(m[i] > g[i] && m[i - 1] <= g[i - 1])) continue;
    const crossClose = b1[i].time + H1;
    let x30: number | null = null;
    if (conds.includes("rm_x30")) for (let j = i; j >= Math.max(1, i - RSI_MACD.x30Bars); j--) if (r1[j] > 30 && r1[j - 1] <= 30) { x30 = b1[j].time; break; }
    const inWin = (d: RmDiv) => d.confClose <= crossClose && crossClose - d.confClose <= RSI_MACD.divH * H1;
    const divs = [...d1.filter(inWin).slice(-1), ...d4.filter(inWin).slice(-1)];
    const cs: RsiMacdCond[] = [];
    if (x30 !== null) cs.push("rm_x30");
    if (divs.some((d) => d.tf === "1h")) cs.push("rm_div1h");
    if (divs.some((d) => d.tf === "4h")) cs.push("rm_div4h");
    if (cs.length) out.push({ crossIdx: i, crossOpen: b1[i].time, crossAgo: n - 1 - i, x30, divs, conds: cs });
  }
  return out;
}

const tTR = (sec: number) => new Date(sec * 1000).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
/** Hangi RSI şart(lar)ı tetikledi — log/not metni. */
export function rsiMacdTag(s: RsiMacdSetup): string {
  const parts = [`1s MACD(50,100,200)↑ ${tTR(s.crossOpen + H1)}`];
  if (s.x30 !== null) parts.push(`RSI 30↑ ${tTR(s.x30 + H1)}`);
  for (const d of s.divs) parts.push(`RSI uyumsuzluk ${d.tf === "4h" ? "4s" : "1s"} (fiyat ${d.pivotTimes.map((t, k) => `${tTR(t)} ${+d.priceLows[k].toPrecision(6)}`).join(" → ")} alçalan · RSI ${d.rsiLows.map((x) => x.toFixed(1)).join(" → ")} yükselen)`);
  return parts.join(" + ");
}
