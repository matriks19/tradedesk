/**
 * LS Uyumsuzluk + MACD (Elizi backtest, /workspace/ls-dip referansı ile birebir).
 * 4s: ardışık k fiyat pivot dibi (L2/R2) her biri DAHA DÜŞÜK, aynı pivotlarda Binance top-trader
 * L/S POSITION oranı (/futures/data/topLongShortPositionRatio period=4h) her biri DAHA YÜKSEK.
 * Aralık 3-20 mum, toplam açıklık ≤40 mum; onay = son pivot + 2 mum (kapanmış, repaint yok).
 * Giriş: onaydan sonraki ≤48 saat içinde 1s MACD(50,100,200) çizgisi sinyali yukarı keser → LONG
 * (kesişim mumunun kapanışı). Backtest küçük (üçlü 34 işlem) — ayar yapılmadı.
 */
export type LsBar = { time: number; low: number; close: number }; // time = açılış (sn)
export type LsDivEvent = { k: number; confIdx: number; confOpen: number; pivots: number[] };
export type LsDivMacdCond = "ls3_macd" | "ls2_macd" | "ls3_wait";
export const ALL_LS_DIV_MACD_CONDS: LsDivMacdCond[] = ["ls3_macd", "ls2_macd", "ls3_wait"];
export const DEFAULT_LS_DIV_MACD_CONDS: LsDivMacdCond[] = ["ls3_macd", "ls2_macd", "ls3_wait"];
export const LS_DIV_MACD_COND_LABEL: Record<LsDivMacdCond, string> = {
  ls3_macd: "Üçlü Uyumsuzluk+MACD",
  ls2_macd: "İkili Uyumsuzluk+MACD",
  ls3_wait: "Üçlü bekliyor",
};
export const LS_DIV = { L: 2, R: 2, gmin: 3, gmax: 20, span: 40, windowH: 48, fast: 50, slow: 100, sig: 200 };
const H4 = 4 * 3600, H1 = 3600;

export function pivotsLow(a: number[], L: number, R: number): number[] {
  const out: number[] = [];
  for (let i = L; i < a.length - R; i++) {
    let mn = Infinity, cnt = 0;
    for (let j = i - L; j <= i + R; j++) mn = Math.min(mn, a[j]);
    for (let j = i - L; j <= i + R; j++) if (a[j] === mn) cnt++;
    if (a[i] === mn && cnt === 1) out.push(i);
  }
  return out;
}

/** k ardışık pivot: fiyat dipleri alçalan, oran dipleri yükselen. lows/ratio aynı uzunlukta (4s, kapanmış). */
export function multiDiv(lows: number[], ratio: number[], k: number, o = LS_DIV): { conf: number; P: number[] }[] {
  const piv = pivotsLow(lows, o.L, o.R), out: { conf: number; P: number[] }[] = [];
  for (let m = k - 1; m < piv.length; m++) {
    const P = piv.slice(m - k + 1, m + 1), c = P[P.length - 1] + o.R;
    if (c >= lows.length) continue;
    let ok = P[P.length - 1] - P[0] <= o.span;
    for (let t = 0; ok && t < k - 1; t++) {
      const g = P[t + 1] - P[t];
      if (g < o.gmin || g > o.gmax) ok = false;
      else if (!(lows[P[t + 1]] < lows[P[t]] && ratio[P[t + 1]] > ratio[P[t]])) ok = false;
    }
    if (ok) out.push({ conf: c, P });
  }
  return out;
}

function ema(a: number[], n: number): number[] {
  const k = 2 / (n + 1), o: number[] = new Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = i === 0 ? a[0] : a[i] * k + o[i - 1] * (1 - k);
  return o;
}
export function macdLine(c: number[], f = LS_DIV.fast, s = LS_DIV.slow, sg = LS_DIV.sig) {
  const ef = ema(c, f), es = ema(c, s), m = c.map((_, i) => ef[i] - es[i]);
  return { m, g: ema(m, sg) };
}

export type LsDivMacdResult = {
  k: number; confOpen: number; confClose: number; pivots: number[];
  /** ilk MACD kesişim mumunun açılışı (sn) — yoksa null */
  crossOpen: number | null; crossAgo: number | null; macdAbove: boolean;
  priceLows: number[]; ratioLows: number[];
};

/**
 * b4: kapanmış 4s mumlar (perp), ratio: timestamp(ms)→longShortRatio, b1: kapanmış 1s mumlar.
 * Yalnız son 48 saat içinde onaylanan uyumsuzlukları döndürür (k=3 ve k=2).
 */
export function lsDivMacdEval(b4: LsBar[], ratio: Map<number, number>, b1: LsBar[], ks: number[] = [3, 2]): LsDivMacdResult[] {
  const d4 = b4.filter((b) => ratio.has(b.time * 1000)); // inner join (pandas ile aynı)
  if (d4.length < 20 || b1.length < 50) return [];
  const lows = d4.map((b) => b.low), rr = d4.map((b) => ratio.get(b.time * 1000)!);
  const { m, g } = macdLine(b1.map((b) => b.close));
  const idx1 = new Map(b1.map((b, i) => [b.time, i]));
  const last1 = b1[b1.length - 1].time, out: LsDivMacdResult[] = [];
  for (const k of ks) {
    for (const ev of multiDiv(lows, rr, k)) {
      const T = d4[ev.conf].time + H4 - H1; // 4s onay mumunun son 1s mumu
      const ti = idx1.get(T);
      if (ti === undefined || last1 - T > LS_DIV.windowH * H1) continue;
      let cross: number | null = null;
      for (let i = Math.max(1, ti); i < b1.length && b1[i].time <= T + LS_DIV.windowH * H1; i++)
        if (m[i] > g[i] && m[i - 1] <= g[i - 1]) { cross = i; break; }
      out.push({
        k, confOpen: d4[ev.conf].time, confClose: d4[ev.conf].time + H4, pivots: ev.P.map((p) => d4[p].time),
        crossOpen: cross === null ? null : b1[cross].time, crossAgo: cross === null ? null : b1.length - 1 - cross,
        macdAbove: m[b1.length - 1] > g[b1.length - 1],
        priceLows: ev.P.map((p) => lows[p]), ratioLows: ev.P.map((p) => rr[p]),
      });
    }
  }
  return out;
}

/** Binance top-trader L/S POSITION oranı (4s; uç nokta yalnız son 30 günü verir). */
export async function fetchLsRatio(sym: string, get: (url: string) => Promise<unknown>, hosts: string[], period = "4h"): Promise<Map<number, number> | null> {
  for (const h of hosts) {
    try {
      const j = await get(`${h}/futures/data/topLongShortPositionRatio?symbol=${encodeURIComponent(sym)}&period=${period}&limit=500`);
      if (Array.isArray(j) && j.length) {
        const mp = new Map<number, number>();
        for (const x of j as { timestamp: number; longShortRatio: string }[]) mp.set(+x.timestamp, +x.longShortRatio);
        return mp;
      }
    } catch { /* sonraki host */ }
  }
  return null;
}
