/**
 * PDO — "Pump/Dump Osilatörü" Stoch hibriti (kripto-tarayici / Binance Futures
 * Screener port'u, pro/screener.html PURE bloğu: moveOscSeries + pdoPatternScan +
 * pdoSeparatedBandSignal + pivotLevelTouch). Referansla bar-bar aynı sonuç için
 * yardımcılar (sma/ema/rsi/stoch/boll) referanstaki NaN semantiğiyle birebir
 * kopyalandı (math.ts'teki null tabanlı sürümler EMA tohumlamasında farklı).
 *
 * Formül (varsayılan 'kd' modu):
 *   Stoch %K = SMA(RSV(14), 3), %D = SMA(%K, 3)
 *   yapı     = 50 + (pump − dump)/2   (pump/dump = son 12 mumun hacim oranı,
 *              ATR sıkışması, gövde baskısı, EMA10 eğimi/EMA10−20, RSI+MACD
 *              momentumu ağırlıklı skorları; 0–100)
 *   sapma    = (yapı − 50) · (1 − w),  w = Stoch ağırlığı %70
 *   PDO      = EMA2( clamp(%K + sapma) )   (mavi)
 *   Sinyal   = EMA2( clamp(%D + sapma) )   (turuncu)
 *   'ema' (eski) mod: PDO = EMA2(w·(0.4K+0.6D) + (1−w)·yapı), Sinyal = EMA5(PDO)
 *
 * Sinyaller: AL = PDO sinyali yukarı keser ve son 5 barda PDO ≤ 30 idi;
 * SAT = aşağı keser ve son 5 barda ≥ 70 idi. T10 = AL/SAT kesişimi (≤ 8 mum)
 * + FARKLI bir mumda alt Bollinger(20,2) teması (±20 mum, %2 tolerans).
 * T11 = son 4 mumda UA/US (fiyat/PDO uyumsuzluğu, iki taraflı pivot teyitli
 * veya canlı). Yapılar: 2D/3D AL, 2T/3T SAT; canlı dip/tepe seviye teması.
 */
import type { Candle } from "@/lib/types";

type Arr = number[];
const fin = (v: number | undefined): v is number => Number.isFinite(v);

// ---------- referans yardımcıları (NaN semantiği) ----------
export function refSma(src: Arr, n: number): Arr {
  const L = src.length;
  const out = new Array<number>(L).fill(NaN);
  let sum = 0;
  let started = -1;
  for (let i = 0; i < L; i++) {
    const v = src[i]!;
    if (!fin(v)) continue;
    if (started < 0) started = i;
    sum += v;
    if (i - started + 1 > n) sum -= src[i - n]!;
    if (i - started + 1 >= n) out[i] = sum / n;
  }
  return out;
}

export function refEma(src: Arr, n: number): Arr {
  const L = src.length;
  const out = new Array<number>(L).fill(NaN);
  let f = -1;
  for (let i = 0; i < L; i++) {
    if (fin(src[i])) {
      f = i;
      break;
    }
  }
  if (f < 0 || f + n - 1 >= L) return out;
  const s = f + n - 1;
  let sum = 0;
  for (let j = f; j <= s; j++) sum += src[j]!;
  let prev = sum / n;
  out[s] = prev;
  const k = 2 / (n + 1);
  for (let i2 = s + 1; i2 < L; i2++) {
    prev = src[i2]! * k + prev * (1 - k);
    out[i2] = prev;
  }
  return out;
}

export function refRsi(close: Arr, n: number): Arr {
  const L = close.length;
  const out = new Array<number>(L).fill(NaN);
  let f = -1;
  for (let i = 1; i < L; i++) {
    if (fin(close[i]) && fin(close[i - 1])) {
      f = i;
      break;
    }
  }
  if (f < 0 || f + n >= L) return out;
  let g = 0;
  let l = 0;
  for (let a = f; a < f + n; a++) {
    const d = close[a]! - close[a - 1]!;
    if (d > 0) g += d;
    else l -= d;
  }
  let ag = g / n;
  let al = l / n;
  out[f + n - 1] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let b = f + n; b < L; b++) {
    const d2 = close[b]! - close[b - 1]!;
    ag = (ag * (n - 1) + Math.max(d2, 0)) / n;
    al = (al * (n - 1) + Math.max(-d2, 0)) / n;
    out[b] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}

function refStoch(h: Arr, l: Arr, c: Arr, kN: number, sk: number, dN: number) {
  const L = c.length;
  const rsv = new Array<number>(L).fill(NaN);
  for (let i = kN - 1; i < L; i++) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let j = i - kN + 1; j <= i; j++) {
      if (l[j]! < lo) lo = l[j]!;
      if (h[j]! > hi) hi = h[j]!;
    }
    const rng = hi - lo;
    rsv[i] = rng === 0 ? 50 : ((c[i]! - lo) / rng) * 100;
  }
  const K = refSma(rsv, sk);
  return { K, D: refSma(K, dN) };
}

export function refBoll(c: Arr, len: number, mult: number) {
  const L = c.length;
  const mid = refSma(c, len);
  const up = new Array<number>(L).fill(NaN);
  const lo = new Array<number>(L).fill(NaN);
  for (let i = len - 1; i < L; i++) {
    const m = mid[i]!;
    if (!fin(m)) continue;
    let s2 = 0;
    for (let j = i - len + 1; j <= i; j++) {
      const dv = c[j]! - m;
      s2 += dv * dv;
    }
    const sd = Math.sqrt(s2 / len) * mult;
    up[i] = m + sd;
    lo[i] = m - sd;
  }
  return { mid, up, lo };
}

// ---------- PUMP/DUMP yapı skoru (moveCtx / moveFeature / moveScore) ----------
export type PdoK = { o: Arr; h: Arr; l: Arr; c: Arr; v: Arr };

export function candlesToK(candles: Candle[]): PdoK {
  const n = candles.length;
  const k: PdoK = {
    o: new Array(n),
    h: new Array(n),
    l: new Array(n),
    c: new Array(n),
    v: new Array(n),
  };
  for (let i = 0; i < n; i++) {
    const x = candles[i]!;
    k.o[i] = x.open;
    k.h[i] = x.high;
    k.l[i] = x.low;
    k.c[i] = x.close;
    k.v[i] = x.volume ?? 0;
  }
  return k;
}

function moveAvg(a: Arr, lo: number, hi: number): number {
  let s = 0;
  let n = 0;
  lo = Math.max(0, lo);
  hi = Math.min(a.length - 1, hi);
  for (let i = lo; i <= hi; i++)
    if (fin(a[i])) {
      s += a[i]!;
      n++;
    }
  return n ? s / n : NaN;
}

function moveTr(k: PdoK, i: number): number {
  if (!fin(k.h[i]) || !fin(k.l[i])) return NaN;
  if (i <= 0 || !fin(k.c[i - 1])) return k.h[i]! - k.l[i]!;
  return Math.max(
    k.h[i]! - k.l[i]!,
    Math.abs(k.h[i]! - k.c[i - 1]!),
    Math.abs(k.l[i]! - k.c[i - 1]!)
  );
}

type MoveCtx = { tr: Arr; e10: Arr; e20: Arr; rsi: Arr; hist: Arr };

function moveCtx(k: PdoK): MoveCtx {
  const n = k.c.length;
  const tr = new Array<number>(n);
  for (let i = 0; i < n; i++) tr[i] = moveTr(k, i);
  const e10 = refEma(k.c, 10);
  const e20 = refEma(k.c, 20);
  const rsi = refRsi(k.c, 14);
  const f = refEma(k.c, 12);
  const sl = refEma(k.c, 26);
  const dif = new Array<number>(n);
  for (let i = 0; i < n; i++)
    dif[i] = fin(f[i]) && fin(sl[i]) ? f[i]! - sl[i]! : NaN;
  const sg = refEma(dif, 9);
  const hist = new Array<number>(n);
  for (let i = 0; i < n; i++)
    hist[i] = fin(dif[i]) && fin(sg[i]) ? dif[i]! - sg[i]! : NaN;
  return { tr, e10, e20, rsi, hist };
}

type MoveFeat = {
  valid: boolean;
  compression: number;
  volRatio: number;
  bodyBias: number;
  emaSlope: number;
  trendGap: number;
  rsi: number;
  macdPct: number;
};

function moveFeature(k: PdoK, end: number, pre: number, ctx: MoveCtx): MoveFeat | null {
  const n = k.c.length;
  const e = Math.min(n - 1, end);
  const s = Math.max(0, e - pre + 1);
  if (e < 0 || !fin(k.c[e])) return null;
  const p = k.c[e]!;
  let body = 0;
  let cnt = 0;
  for (let i = s; i <= e; i++) {
    if (!fin(k.c[i]) || !fin(k.o[i]) || !fin(k.h[i]) || !fin(k.l[i])) continue;
    const rg = Math.max(k.h[i]! - k.l[i]!, p * 1e-9);
    body += (k.c[i]! - k.o[i]!) / rg;
    cnt++;
  }
  const a5 = moveAvg(ctx.tr, e - 4, e);
  const a20 = moveAvg(ctx.tr, e - 19, e);
  const v3 = moveAvg(k.v, e - 2, e);
  const vBase = moveAvg(k.v, e - 22, e - 3);
  const e10now = ctx.e10[e]!;
  const e10old = ctx.e10[Math.max(0, e - 5)]!;
  const e20now = ctx.e20[e]!;
  return {
    valid: cnt > 0,
    compression: fin(a5) && a20 > 0 ? a5 / a20 : NaN,
    volRatio: fin(v3) && vBase > 0 ? v3 / vBase : NaN,
    bodyBias: cnt ? body / cnt : NaN,
    emaSlope:
      fin(e10now) && fin(e10old) && e10old !== 0 ? (e10now / e10old - 1) * 100 : NaN,
    trendGap:
      fin(e10now) && fin(e20now) && e20now !== 0 ? (e10now / e20now - 1) * 100 : NaN,
    rsi: ctx.rsi[e]!,
    macdPct: fin(ctx.hist[e]) && p !== 0 ? (ctx.hist[e]! / p) * 100 : NaN,
  };
}

function move01(x: number, a: number, b: number): number {
  return !fin(x) ? NaN : Math.max(0, Math.min(1, (x - a) / (b - a)));
}

/** pump/dump 0–100 (referans moveScore, tüm bileşenler açık). */
function moveScore(f: MoveFeat | null, volMin: number, compress: number) {
  if (!f || !f.valid) return { pump: 0, dump: 0 };
  let pu = 0;
  let du = 0;
  let w = 0;
  const add = (b: number, c: number, ww: number) => {
    if (!fin(b) || !fin(c)) return;
    pu += b * ww;
    du += c * ww;
    w += ww;
  };
  const vr = move01(f.volRatio, 0.8, Math.max(2, volMin + 1));
  add(vr, vr, 20);
  const sq = fin(f.compression)
    ? 1 - move01(f.compression, Math.min(0.5, compress), Math.max(1.5, compress + 0.45))
    : NaN;
  add(sq, sq, 15);
  add(move01(f.bodyBias, -0.35, 0.45), move01(-f.bodyBias, -0.35, 0.45), 25);
  add(move01(f.emaSlope, -0.5, 0.8), move01(-f.emaSlope, -0.5, 0.8), 18);
  add(move01(f.trendGap, -0.6, 1.2), move01(-f.trendGap, -0.6, 1.2), 7);
  const rp = fin(f.rsi) ? 1 - Math.min(1, Math.abs(f.rsi - 57) / 38) : NaN;
  const rd = fin(f.rsi) ? 1 - Math.min(1, Math.abs(f.rsi - 43) / 38) : NaN;
  const mp = fin(f.macdPct) ? move01(f.macdPct, -0.08, 0.12) : NaN;
  const md = fin(f.macdPct) ? move01(-f.macdPct, -0.08, 0.12) : NaN;
  add(fin(rp) && fin(mp) ? (rp + mp) / 2 : rp, fin(rd) && fin(md) ? (rd + md) / 2 : rd, 15);
  const den = w || 1;
  return { pump: Math.round((100 * pu) / den), dump: Math.round((100 * du) / den) };
}

// ---------- PDO serisi ----------
export type PdoOpts = {
  stochK?: number;
  stochSk?: number;
  stochD?: number;
  /** Stoch ağırlığı % (50–100), varsayılan 70 → yapı %30 */
  stochWeight?: number;
  /** PDO/sinyal EMA yumuşatma (1 = yok), varsayılan 2 */
  smooth?: number;
  /** yalnız 'ema' modunda: sinyal = EMA(PDO, signal) */
  signal?: number;
  crossMode?: "kd" | "ema";
  movePre?: number;
  volMin?: number;
  compress?: number;
  /** AL/SAT bölge şartı */
  zoneOn?: boolean;
  low?: number;
  high?: number;
  zoneLook?: number;
  /** yapı (pattern) motoru */
  patternBars?: number;
  pivot?: number;
  tol?: number;
  rise?: number;
  divMin?: number;
  live?: boolean;
  touch?: number;
  /** T10 */
  t10SignalBars?: number;
  t10BandWindow?: number;
  t10BandTol?: number;
  bollLen?: number;
  bollMult?: number;
  /** T11 */
  t11RecentBars?: number;
};

export const PDO_DEFAULTS = {
  stochK: 14,
  stochSk: 3,
  stochD: 3,
  stochWeight: 70,
  smooth: 2,
  signal: 5,
  crossMode: "kd" as "kd" | "ema",
  movePre: 12,
  volMin: 1.3,
  compress: 0.85,
  zoneOn: true,
  low: 30,
  high: 70,
  zoneLook: 5,
  patternBars: 20,
  pivot: 2,
  tol: 2,
  rise: 2,
  divMin: 2,
  live: true,
  touch: 0.5,
  t10SignalBars: 8,
  t10BandWindow: 20,
  t10BandTol: 2,
  bollLen: 20,
  bollMult: 2,
  t11RecentBars: 4,
};
export type PdoResolved = typeof PDO_DEFAULTS;

export function resolvePdoOpts(o: PdoOpts = {}): PdoResolved {
  const r = { ...PDO_DEFAULTS };
  for (const key of Object.keys(o) as (keyof PdoOpts)[]) {
    const v = o[key];
    if (v !== undefined && v !== null) (r as Record<string, unknown>)[key] = v;
  }
  return r;
}

/** 14 stoch + 26/9 MACD + 22 hacim tabanı + ısınma → ≥ 80 mum. */
export const PDO_MIN_BARS = 80;
export const PDO_FETCH_LIMIT = 240;

export type PdoSeries = {
  raw: Arr;
  signal: Arr;
  /** yeşil P çizgisi = EMA(pump skoru, smooth) — referans ser.pump */
  pump: Arr;
  /** kırmızı D çizgisi = EMA(dump skoru, smooth) — referans ser.dump */
  dump: Arr;
  stochK: Arr;
  stochD: Arr;
  structure: Arr;
};

export function pdoSeries(k: PdoK, opts: PdoOpts = {}): PdoSeries {
  const P = resolvePdoOpts(opts);
  const n = k.c.length;
  const ctx = moveCtx(k);
  const structure = new Array<number>(n).fill(NaN);
  const pumpBase = new Array<number>(n).fill(NaN);
  const dumpBase = new Array<number>(n).fill(NaN);
  const hybrid = new Array<number>(n).fill(NaN);
  const dLine = new Array<number>(n).fill(NaN);
  const stK = Math.max(2, Math.floor(+P.stochK || 14));
  const stSk = Math.max(1, Math.floor(+P.stochSk || 3));
  const stD = Math.max(1, Math.floor(+P.stochD || 3));
  const stoch = refStoch(k.h, k.l, k.c, stK, stSk, stD);
  const sw = Math.max(0.5, Math.min(1, (+P.stochWeight || 70) / 100));
  const pw = Math.max(1, Math.floor(+P.smooth || 2));
  const sigN = Math.max(1, Math.floor(+P.signal || 5));
  const ema = P.crossMode === "ema";
  const pre = +P.movePre || 0;
  const clamp100 = (v: number) => (v < 0 ? 0 : v > 100 ? 100 : v);
  for (let i = Math.max(pre, 0); i < n; i++) {
    const sc = moveScore(moveFeature(k, i, pre, ctx), P.volMin, P.compress);
    if (fin(sc.pump)) {
      pumpBase[i] = sc.pump;
      dumpBase[i] = sc.dump;
      structure[i] = 50 + (sc.pump - sc.dump) / 2;
    }
    if (fin(stoch.K[i]) && fin(stoch.D[i]) && fin(structure[i])) {
      if (ema) {
        const stBase = stoch.K[i]! * 0.4 + stoch.D[i]! * 0.6;
        hybrid[i] = stBase * sw + structure[i]! * (1 - sw);
      } else {
        const bias = (structure[i]! - 50) * (1 - sw);
        hybrid[i] = clamp100(stoch.K[i]! + bias);
        dLine[i] = clamp100(stoch.D[i]! + bias);
      }
    }
  }
  const sm = (a: Arr) => (pw > 1 ? refEma(a, pw) : a.slice());
  const raw = sm(hybrid);
  const signal = ema ? refEma(raw, sigN) : sm(dLine);
  return {
    raw,
    signal,
    pump: refEma(pumpBase, pw),
    dump: refEma(dumpBase, pw),
    stochK: stoch.K,
    stochD: stoch.D,
    structure,
  };
}

// ---------- kesişim / bölge ----------
type Zone = { low: number; high: number; look: number } | null;

export function pdoZone(P: PdoResolved): Zone {
  return P.zoneOn === false ? null : { low: +P.low || 30, high: +P.high || 70, look: +P.zoneLook || 5 };
}

export function pdoZoneOK(a: Arr, i: number, dir: "up" | "down", zone: Zone): boolean {
  if (!zone) return true;
  const look = Math.max(1, Math.floor(+zone.look || 5));
  const lo = fin(+zone.low) ? +zone.low : 30;
  const hi = fin(+zone.high) ? +zone.high : 70;
  for (let j = Math.max(0, i - look + 1); j <= i; j++) {
    if (!fin(a[j])) continue;
    if (dir === "up" ? a[j]! <= lo : a[j]! >= hi) return true;
  }
  return false;
}

function crossAt(a: Arr, b: Arr, i: number): "up" | "down" | "" {
  if (i <= 0 || !fin(a[i]) || !fin(b[i]) || !fin(a[i - 1]) || !fin(b[i - 1])) return "";
  if (a[i - 1]! <= b[i - 1]! && a[i]! > b[i]!) return "up";
  if (a[i - 1]! >= b[i - 1]! && a[i]! < b[i]!) return "down";
  return "";
}

/**
 * Referans pdoSeparatedBandSignal — ilk `n` mum (öneki) üzerinde. `lo` = alt
 * Bollinger serisi (nedensel; tüm seri bir kez hesaplanır).
 */
export function pdoSeparatedBandAt(
  k: PdoK,
  a: Arr,
  b: Arr,
  lo: Arr,
  n: number,
  mode: "up" | "down" | "both",
  crossBars: number,
  bandWindow: number,
  tolPct: number,
  zone: Zone
): { age: number; index: number; bandIndex: number; direction: "up" | "down" } | null {
  const lim = Math.min(Math.max(0, +crossBars || 0), n - 2);
  const win = Math.max(1, +bandWindow || 1);
  const tol = Math.max(0, +tolPct || 0) / 100;
  const bandAt = (j: number) =>
    j >= 0 && j < n && fin(lo[j]) && (k.l[j]! <= lo[j]! * (1 + tol) || k.c[j]! <= lo[j]! * (1 + tol));
  for (let age = 0; age <= lim; age++) {
    const i = n - 1 - age;
    if (i <= 0 || !fin(a[i]) || !fin(b[i]) || !fin(a[i - 1]) || !fin(b[i - 1])) continue;
    const up = a[i - 1]! <= b[i - 1]! && a[i]! > b[i]! && pdoZoneOK(a, i, "up", zone);
    const down = a[i - 1]! >= b[i - 1]! && a[i]! < b[i]! && pdoZoneOK(a, i, "down", zone);
    if (!((mode === "up" && up) || (mode === "down" && down) || (mode === "both" && (up || down))))
      continue;
    let band = -1;
    for (let d = 1; d <= win && band < 0; d++) {
      if (bandAt(i - d)) band = i - d;
      if (band < 0 && bandAt(i + d)) band = i + d;
    }
    if (band >= 0) return { age, index: i, bandIndex: band, direction: up ? "up" : "down" };
  }
  return null;
}

// ---------- pivot / yapı motoru (pdoPatternScan) ----------
export function pdoPivotIndices(k: PdoK, side: "low" | "high", w: number, n = k.c.length): number[] {
  const out: number[] = [];
  const ww = Math.max(1, Math.floor(+w || 2));
  const src = side === "low" ? k.l : k.h;
  for (let i = ww; i < n - ww; i++) {
    const v = src[i]!;
    if (!fin(v)) continue;
    let ok = true;
    let strict = false;
    for (let j = i - ww; j <= i + ww; j++) {
      if (j === i) continue;
      const q = src[j]!;
      if (!fin(q)) {
        ok = false;
        break;
      }
      if (side === "low" && q < v) {
        ok = false;
        break;
      }
      if (side === "high" && q > v) {
        ok = false;
        break;
      }
      if (q !== v) strict = true;
    }
    if (ok && strict) out.push(i);
  }
  return out;
}

function betweenExtreme(k: PdoK, side: "low" | "high", a: number, b: number): number {
  if (b <= a + 1) return NaN;
  let v = side === "low" ? -Infinity : Infinity;
  for (let i = a + 1; i < b; i++) {
    const q = side === "low" ? k.h[i]! : k.l[i]!;
    if (!fin(q)) return NaN;
    if (side === "low" && q > v) v = q;
    if (side === "high" && q < v) v = q;
  }
  return v === -Infinity || v === Infinity ? NaN : v;
}

export type PdoPatternKind =
  | "tripleBottom"
  | "tripleTop"
  | "doubleBottom"
  | "doubleTop"
  | "bullishDivergence"
  | "bearishDivergence";

export type PdoPatternEvent = {
  kind: PdoPatternKind;
  label: string;
  side: "buy" | "sell";
  points: number[];
  from: number;
  to: number;
  priceFrom: number;
  priceTo: number;
  oscFrom: number;
  oscTo: number;
  live?: boolean;
};

export type PdoTouch = {
  label: string;
  side: "buy" | "sell";
  level: number;
  index: number;
  age: number;
};

export type PdoPatternResult = {
  ua: PdoPatternEvent[];
  us: PdoPatternEvent[];
  uaLive: PdoPatternEvent[];
  usLive: PdoPatternEvent[];
  doubleBottom: PdoPatternEvent[];
  tripleBottom: PdoPatternEvent[];
  doubleTop: PdoPatternEvent[];
  tripleTop: PdoPatternEvent[];
  touchBottom: PdoTouch | null;
  touchTop: PdoTouch | null;
  lowPivots: number[];
  highPivots: number[];
};

type PatternArgs = {
  bars: number;
  pivot: number;
  tol: number;
  rise: number;
  divMin: number;
  live: boolean;
  touch: number;
  /** önek uzunluğu (varsayılan tüm seri) */
  n?: number;
  /** tarama başlangıcı (varsayılan referans: n−1−bars; 0 = tüm geçmiş) */
  from?: number;
  lowP?: number[];
  highP?: number[];
};

export function pdoPatternScan(k: PdoK, raw: Arr, A: PatternArgs): PdoPatternResult {
  const n = A.n ?? k.c.length;
  const bars = Math.max(5, Math.floor(+A.bars || 20));
  const w = Math.max(1, Math.floor(+A.pivot || 2));
  const tol = Math.max(0, +A.tol || 2) / 100;
  const rise = Math.max(0, +A.rise || 2) / 100;
  const from = A.from ?? Math.max(0, n - 1 - bars);
  const lowP = A.lowP ? A.lowP.filter((i) => i < n - w) : pdoPivotIndices(k, "low", w, n);
  const highP = A.highP ? A.highP.filter((i) => i < n - w) : pdoPivotIndices(k, "high", w, n);
  const ua: PdoPatternEvent[] = [];
  const us: PdoPatternEvent[] = [];
  const doubleBottom: PdoPatternEvent[] = [];
  const tripleBottom: PdoPatternEvent[] = [];
  const doubleTop: PdoPatternEvent[] = [];
  const tripleTop: PdoPatternEvent[] = [];
  const tripleLowTo = new Set<number>();
  const tripleHighTo = new Set<number>();
  const inScan = (i: number) => i >= from && i < n;
  const oscOK = (pts: number[]) => pts.every((i) => fin(raw[i]));
  const levelsOK = (pts: number[], side: "low" | "high") => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const i of pts) {
      const v = side === "low" ? k.l[i]! : k.h[i]!;
      if (!fin(v)) return false;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return lo > 0 && (hi - lo) / lo <= tol;
  };
  const ev = (
    kind: PdoPatternKind,
    label: string,
    side: "buy" | "sell",
    points: number[]
  ): PdoPatternEvent => {
    const a = points[0]!;
    const b = points[points.length - 1]!;
    return {
      kind,
      label,
      side,
      points: points.slice(),
      from: a,
      to: b,
      priceFrom: side === "buy" ? k.l[a]! : k.h[a]!,
      priceTo: side === "buy" ? k.l[b]! : k.h[b]!,
      oscFrom: raw[a]!,
      oscTo: raw[b]!,
    };
  };
  for (let t = 2; t < lowP.length; t++) {
    const l0 = lowP[t - 2]!;
    const l1 = lowP[t - 1]!;
    const l2 = lowP[t]!;
    if (l2 - l0 <= bars && inScan(l2) && oscOK([l0, l1, l2]) && levelsOK([l0, l1, l2], "low")) {
      const r01 = betweenExtreme(k, "low", l0, l1);
      const r12 = betweenExtreme(k, "low", l1, l2);
      const base = Math.max(k.l[l0]!, k.l[l1]!, k.l[l2]!);
      if (fin(r01) && fin(r12) && r01 >= base * (1 + rise) && r12 >= base * (1 + rise)) {
        tripleBottom.push(ev("tripleBottom", "3D AL", "buy", [l0, l1, l2]));
        tripleLowTo.add(l2);
      }
    }
  }
  for (let t = 2; t < highP.length; t++) {
    const h0 = highP[t - 2]!;
    const h1 = highP[t - 1]!;
    const h2 = highP[t]!;
    if (h2 - h0 <= bars && inScan(h2) && oscOK([h0, h1, h2]) && levelsOK([h0, h1, h2], "high")) {
      const r01 = betweenExtreme(k, "high", h0, h1);
      const r12 = betweenExtreme(k, "high", h1, h2);
      const top = Math.min(k.h[h0]!, k.h[h1]!, k.h[h2]!);
      if (fin(r01) && fin(r12) && r01 <= top * (1 - rise) && r12 <= top * (1 - rise)) {
        tripleTop.push(ev("tripleTop", "3T SAT", "sell", [h0, h1, h2]));
        tripleHighTo.add(h2);
      }
    }
  }
  for (let q = 1; q < lowP.length; q++) {
    const a = lowP[q - 1]!;
    const b = lowP[q]!;
    if (b - a > bars || !inScan(b) || !oscOK([a, b])) continue;
    const rebound = betweenExtreme(k, "low", a, b);
    if (
      fin(rebound) &&
      levelsOK([a, b], "low") &&
      rebound >= Math.max(k.l[a]!, k.l[b]!) * (1 + rise) &&
      !tripleLowTo.has(b)
    )
      doubleBottom.push(ev("doubleBottom", "2D AL", "buy", [a, b]));
  }
  for (let q = 1; q < highP.length; q++) {
    const c = highP[q - 1]!;
    const d = highP[q]!;
    if (d - c > bars || !inScan(d) || !oscOK([c, d])) continue;
    const pull = betweenExtreme(k, "high", c, d);
    if (
      fin(pull) &&
      levelsOK([c, d], "high") &&
      pull <= Math.min(k.h[c]!, k.h[d]!) * (1 - rise) &&
      !tripleHighTo.has(d)
    )
      doubleTop.push(ev("doubleTop", "2T SAT", "sell", [c, d]));
  }
  const divMin = fin(+A.divMin) ? Math.max(0, +A.divMin) : 2;
  const divPair = (list: number[], q: number, side: "low" | "high"): number => {
    const pb = list[q]!;
    for (let back = 1; back <= 2 && q - back >= 0; back++) {
      const pa = list[q - back]!;
      if (pb - pa > bars) break;
      if (back === 2) {
        const mid = list[q - 1]!;
        if (
          side === "low"
            ? !(k.l[mid]! > k.l[pa]! && k.l[mid]! > k.l[pb]!)
            : !(k.h[mid]! < k.h[pa]! && k.h[mid]! < k.h[pb]!)
        )
          break;
      }
      if (!oscOK([pa, pb])) continue;
      if (
        side === "low"
          ? k.l[pb]! < k.l[pa]! && raw[pb]! > raw[pa]! + divMin
          : k.h[pb]! > k.h[pa]! && raw[pb]! < raw[pa]! - divMin
      )
        return pa;
    }
    return -1;
  };
  for (let q = 1; q < lowP.length; q++) {
    const pb = lowP[q]!;
    if (!inScan(pb)) continue;
    const pa = divPair(lowP, q, "low");
    if (pa >= 0) ua.push(ev("bullishDivergence", "UA", "buy", [pa, pb]));
  }
  for (let q = 1; q < highP.length; q++) {
    const hb = highP[q]!;
    if (!inScan(hb)) continue;
    const ha = divPair(highP, q, "high");
    if (ha >= 0) us.push(ev("bearishDivergence", "US", "sell", [ha, hb]));
  }
  const uaLive: PdoPatternEvent[] = [];
  const usLive: PdoPatternEvent[] = [];
  const liveDiv = (side: "low" | "high"): PdoPatternEvent | null => {
    const list = side === "low" ? lowP : highP;
    if (!list.length) return null;
    const last = list[list.length - 1]!;
    let m = -1;
    for (let j = Math.max(last + 1, n - w); j < n; j++) {
      const v = side === "low" ? k.l[j]! : k.h[j]!;
      if (fin(v) && (m < 0 || (side === "low" ? v < k.l[m]! : v > k.h[m]!))) m = j;
    }
    if (m < 0 || !fin(raw[m]) || m - last > bars) return null;
    for (let j = last + 1; j < m; j++)
      if (side === "low" ? k.l[j]! < k.l[m]! : k.h[j]! > k.h[m]!) return null;
    const tmp = list.concat([m]);
    const pa = divPair(tmp, tmp.length - 1, side);
    if (pa < 0) return null;
    const e = ev(
      side === "low" ? "bullishDivergence" : "bearishDivergence",
      side === "low" ? "UA" : "US",
      side === "low" ? "buy" : "sell",
      [pa, m]
    );
    e.live = true;
    return e;
  };
  let touchBottom: PdoTouch | null = null;
  let touchTop: PdoTouch | null = null;
  if (A.live !== false) {
    const lu = liveDiv("low");
    if (lu) uaLive.push(lu);
    const ls = liveDiv("high");
    if (ls) usLive.push(ls);
    // referans: pivotLevelTouch({tol: tol*100, rise: rise*100}) → /100 (aynı kayan nokta yolu)
    const tolT = Math.max(0, tol * 100) / 100;
    const riseT = Math.max(0, rise * 100) / 100;
    const t = pivotLevelTouch(k, n, lowP, highP, w, bars, tolT, riseT, Math.max(0, fin(+A.touch) ? +A.touch : 0.5) / 100, 1);
    touchBottom = t.bottom;
    touchTop = t.top;
  }
  return {
    ua,
    us,
    uaLive,
    usLive,
    doubleBottom,
    tripleBottom,
    doubleTop,
    tripleTop,
    touchBottom,
    touchTop,
    lowPivots: lowP,
    highPivots: highP,
  };
}

/** Referans pivotLevelTouch (canlı ikili/üçlü dip-tepe teması), önek `n`. */
function pivotLevelTouch(
  k: PdoK,
  n: number,
  lowP: number[],
  highP: number[],
  w: number,
  bars: number,
  tol: number,
  rise: number,
  tt: number,
  recent: number
): { bottom: PdoTouch | null; top: PdoTouch | null } {
  const L = n - 1;
  const one = (side: "low" | "high"): PdoTouch | null => {
    const low = side === "low";
    const list = low ? lowP : highP;
    if (!list.length) return null;
    const p1 = list[list.length - 1]!;
    if (L - p1 > bars) return null;
    const lv = low ? k.l[p1]! : k.h[p1]!;
    if (!(lv > 0)) return null;
    let label = low ? "2D" : "2T";
    if (list.length >= 2) {
      const p0 = list[list.length - 2]!;
      const lv0 = low ? k.l[p0]! : k.h[p0]!;
      if (p1 - p0 <= bars && lv0 > 0 && Math.abs(lv0 - lv) <= Math.min(lv0, lv) * tol) {
        const e01 = betweenExtreme(k, side, p0, p1);
        if (fin(e01) && (low ? e01 >= Math.max(lv0, lv) * (1 + rise) : e01 <= Math.min(lv0, lv) * (1 - rise)))
          label = low ? "3D" : "3T";
      }
    }
    const ok = (j: number) => {
      const ext = betweenExtreme(k, side, p1, j);
      if (!fin(ext) || (low ? ext < lv * (1 + rise) : ext > lv * (1 - rise))) return false;
      for (let q = p1 + 1; q < j; q++) {
        const y = low ? k.l[q]! : k.h[q]!;
        if (low ? y < lv * (1 - tol) : y > lv * (1 + tol)) return false;
      }
      return true;
    };
    for (let j = L; j >= Math.max(p1 + w + 1, L - recent); j--) {
      const x = low ? k.l[j]! : k.h[j]!;
      if (!fin(x)) continue;
      if (!(low ? x <= lv * (1 + tt) && x >= lv * (1 - tol) : x >= lv * (1 - tt) && x <= lv * (1 + tol)))
        continue;
      if (!ok(j)) continue;
      return { label, side: low ? "buy" : "sell", level: lv, index: j, age: L - j };
    }
    return null;
  };
  return { bottom: one("low"), top: one("high") };
}

// ---------- T11 (son N mum UA/US) ----------
function latestRecent(
  list: PdoPatternEvent[],
  live: PdoPatternEvent[],
  lastI: number,
  recent: number
): PdoPatternEvent | null {
  let e = list.length ? list[list.length - 1]! : null;
  const lv = live.length ? live[live.length - 1]! : null;
  if (lv && (!e || lv.to >= e.to)) e = lv;
  return e && lastI - e.to <= recent ? e : null;
}

// ---------- Liste koşulları ----------
export type PdoCond =
  | "trend_up"
  | "trend_dn"
  | "old_up"
  | "old_dn"
  | "al"
  | "sat"
  | "x_up"
  | "x_dn"
  | "t10_al"
  | "t10_sat"
  | "ua"
  | "us"
  | "d2"
  | "d3"
  | "t2"
  | "t3"
  | "touch_dip"
  | "touch_top"
  | "exit30"
  | "exit70"
  | "zone_low"
  | "zone_high";

export const ALL_PDO_CONDS: PdoCond[] = [
  "trend_up",
  "trend_dn",
  "al",
  "sat",
  "t10_al",
  "t10_sat",
  "ua",
  "us",
  "d2",
  "d3",
  "t2",
  "t3",
  "touch_dip",
  "touch_top",
  "x_up",
  "x_dn",
  "exit30",
  "exit70",
  "old_up",
  "old_dn",
  "zone_low",
  "zone_high",
];

export const DEFAULT_PDO_CONDS: PdoCond[] = ["trend_up", "trend_dn", "al", "sat"];

export const PDO_COND_LABEL: Record<PdoCond, string> = {
  trend_up: "PDO trend↑ (yeşil)",
  trend_dn: "PDO trend↓ (kırmızı)",
  old_up: "Eski PDO↑",
  old_dn: "Eski PDO↓",
  al: "PDO AL",
  sat: "PDO SAT",
  x_up: "PDO×Sin↑",
  x_dn: "PDO×Sin↓",
  t10_al: "T10 AL",
  t10_sat: "T10 SAT",
  ua: "T11 UA",
  us: "T11 US",
  d2: "2D AL",
  d3: "3D AL",
  t2: "2T SAT",
  t3: "3T SAT",
  touch_dip: "Dip teması",
  touch_top: "Tepe teması",
  exit30: "PDO 30↑",
  exit70: "PDO 70↓",
  zone_low: "PDO ≤30",
  zone_high: "PDO ≥70",
};

export const PDO_BEAR_CONDS = new Set<PdoCond>([
  "trend_dn",
  "old_dn",
  "sat",
  "x_dn",
  "t10_sat",
  "us",
  "t2",
  "t3",
  "touch_top",
  "exit70",
  "zone_high",
]);

export type PdoScanHit = { cond: PdoCond; barsAgo: number; note: string };

/** T10/T11 durum koşulu ne kadar geriye izlenir (kenar yaşı için). */
const STATE_BACK = 40;

/**
 * Liste taraması. Kenar olayları (AL/SAT, ×, 30↑/70↓, 2D/3D/2T/3T teyidi,
 * dip/tepe teması) son `maxBarsAgo` mum içinde aranır. T10/T11 referanstaki
 * geçiş durumunu (T10: kesişim ≤ 8 mum + ayrı mumda alt bant; T11: son 4 mum
 * UA/US) son mumda doğrular; barsAgo = durumun açıldığı mumdan bu yana.
 */
export function pdoScan(
  candles: Candle[],
  conds: PdoCond[],
  maxBarsAgo: number,
  opts: PdoOpts = {}
): PdoScanHit[] {
  const n = candles.length;
  if (n < PDO_MIN_BARS || !conds.length) return [];
  const P = resolvePdoOpts(opts);
  const k = candlesToK(candles);
  const s = pdoSeries(k, P);
  const a = s.raw;
  const b = s.signal;
  const zone = pdoZone(P);
  const last = n - 1;
  const want = new Set(conds);
  const out: PdoScanHit[] = [];
  const low = +P.low || 30;
  const high = +P.high || 70;
  const fmt = (v: number) => (fin(v) ? Math.round(v) : "—");

  const edge = (cond: PdoCond, test: (i: number) => boolean, extra?: (i: number) => string) => {
    if (!want.has(cond)) return;
    for (let ago = 0; ago <= maxBarsAgo; ago++) {
      const i = last - ago;
      if (i < 1) break;
      if (!test(i)) continue;
      out.push({
        cond,
        barsAgo: ago,
        note: `${PDO_COND_LABEL[cond].startsWith("PDO") ? "" : "PDO "}${PDO_COND_LABEL[cond]} ${fmt(a[i]!)}/${fmt(b[i]!)}${extra ? extra(i) : ""} (−${ago})`,
      });
      return;
    }
  };

  // Trend kesişimi: yeşil P (pump) çizgisi kırmızı D (dump) çizgisini keser.
  edge("trend_up", (i) => crossAt(s.pump, s.dump, i) === "up", (i) => ` P${fmt(s.pump[i]!)}/D${fmt(s.dump[i]!)}`);
  edge("trend_dn", (i) => crossAt(s.pump, s.dump, i) === "down", (i) => ` P${fmt(s.pump[i]!)}/D${fmt(s.dump[i]!)}`);
  // Eski kesişim: (0,4K+0,6D)·w + yapı → EMA5, sinyal = EMA5(PDO), bölge şartı yok.
  if (want.has("old_up") || want.has("old_dn")) {
    const o = pdoSeries(k, { ...P, crossMode: "ema", smooth: 5, signal: 5 });
    const oldEdge = (cond: PdoCond, dir: "up" | "down") => {
      if (!want.has(cond)) return;
      for (let ago = 0; ago <= maxBarsAgo; ago++) {
        const i = last - ago;
        if (i < 1) break;
        if (crossAt(o.raw, o.signal, i) !== dir) continue;
        out.push({
          cond,
          barsAgo: ago,
          note: `${PDO_COND_LABEL[cond]} ${fmt(o.raw[i]!)}/${fmt(o.signal[i]!)} (−${ago})`,
        });
        return;
      }
    };
    oldEdge("old_up", "up");
    oldEdge("old_dn", "down");
  }
  edge("al", (i) => crossAt(a, b, i) === "up" && pdoZoneOK(a, i, "up", zone));
  edge("sat", (i) => crossAt(a, b, i) === "down" && pdoZoneOK(a, i, "down", zone));
  edge("x_up", (i) => crossAt(a, b, i) === "up");
  edge("x_dn", (i) => crossAt(a, b, i) === "down");
  edge("exit30", (i) => fin(a[i]) && fin(a[i - 1]) && a[i - 1]! <= low && a[i]! > low);
  edge("exit70", (i) => fin(a[i]) && fin(a[i - 1]) && a[i - 1]! >= high && a[i]! < high);

  const w = Math.max(1, Math.floor(+P.pivot || 2));
  const patArgs = {
    bars: P.patternBars,
    pivot: w,
    tol: P.tol,
    rise: P.rise,
    divMin: P.divMin,
    live: P.live,
    touch: P.touch,
  };
  let lowP: number[] | null = null;
  let highP: number[] | null = null;
  const pivots = () => {
    if (!lowP) {
      lowP = pdoPivotIndices(k, "low", w);
      highP = pdoPivotIndices(k, "high", w);
    }
    return { lowP: lowP!, highP: highP! };
  };

  // Yapılar: tam geçmiş taraması, olay = teyit mumu (son pivot + w).
  if (want.has("d2") || want.has("d3") || want.has("t2") || want.has("t3")) {
    const pv = pivots();
    const pat = pdoPatternScan(k, a, { ...patArgs, live: false, from: Math.max(0, last - maxBarsAgo - w - 1), ...pv });
    const map: [PdoCond, PdoPatternEvent[]][] = [
      ["d2", pat.doubleBottom],
      ["d3", pat.tripleBottom],
      ["t2", pat.doubleTop],
      ["t3", pat.tripleTop],
    ];
    for (const [cond, list] of map) {
      if (!want.has(cond)) continue;
      let best: PdoPatternEvent | null = null;
      for (const e of list) {
        const ago = last - (e.to + w);
        if (ago < 0 || ago > maxBarsAgo) continue;
        if (!best || e.to > best.to) best = e;
      }
      if (best) {
        const ago = last - (best.to + w);
        out.push({
          cond,
          barsAgo: ago,
          note: `PDO ${PDO_COND_LABEL[cond]} pivot −${last - best.to} (−${ago})`,
        });
      }
    }
  }

  // Önek taraması (canlı temas + T11): yalnız son birkaç mum.
  const prefixCache = new Map<number, PdoPatternResult>();
  const prefix = (m: number) => {
    let r = prefixCache.get(m);
    if (!r) {
      r = pdoPatternScan(k, a, { ...patArgs, n: m + 1, ...pivots() });
      prefixCache.set(m, r);
    }
    return r;
  };
  const stateEdge = (
    cond: PdoCond,
    state: (m: number) => string | null,
    limit: number,
    requireNow: boolean
  ) => {
    if (!want.has(cond)) return;
    if (requireNow) {
      const now = state(last);
      if (!now) return;
      let ago = 0;
      while (ago < STATE_BACK && last - ago - 1 >= PDO_MIN_BARS && state(last - ago - 1)) ago++;
      out.push({ cond, barsAgo: ago, note: `PDO ${PDO_COND_LABEL[cond]} ${now} (−${ago})` });
      return;
    }
    for (let ago = 0; ago <= limit; ago++) {
      const m = last - ago;
      if (m < PDO_MIN_BARS) break;
      const now = state(m);
      if (now && !state(m - 1)) {
        out.push({ cond, barsAgo: ago, note: `PDO ${PDO_COND_LABEL[cond]} ${now} (−${ago})` });
        return;
      }
    }
  };

  if (want.has("touch_dip") || want.has("touch_top")) {
    const lim = Math.min(maxBarsAgo, STATE_BACK);
    stateEdge("touch_dip", (m) => {
      const t = prefix(m).touchBottom;
      return t ? `${t.label} ${t.level.toPrecision(6)}` : null;
    }, lim, false);
    stateEdge("touch_top", (m) => {
      const t = prefix(m).touchTop;
      return t ? `${t.label} ${t.level.toPrecision(6)}` : null;
    }, lim, false);
  }

  const recent = Math.max(1, Math.floor(+P.t11RecentBars || 4));
  const t11 = (m: number, dir: "ua" | "us") => {
    const r = prefix(m);
    const e = dir === "ua" ? latestRecent(r.ua, r.uaLive, m, recent) : latestRecent(r.us, r.usLive, m, recent);
    return e ? `${e.live ? "canlı " : ""}${m - e.to} mum` : null;
  };
  stateEdge("ua", (m) => t11(m, "ua"), 0, true);
  stateEdge("us", (m) => t11(m, "us"), 0, true);

  if (want.has("t10_al") || want.has("t10_sat")) {
    const bb = refBoll(k.c, +P.bollLen || 20, +P.bollMult || 2);
    const t10 = (m: number, mode: "up" | "down") => {
      const h = pdoSeparatedBandAt(k, a, b, bb.lo, m + 1, mode, P.t10SignalBars, P.t10BandWindow, P.t10BandTol, zone);
      return h ? `kesişim −${h.age} · alt bant −${m - h.bandIndex}` : null;
    };
    stateEdge("t10_al", (m) => t10(m, "up"), 0, true);
    stateEdge("t10_sat", (m) => t10(m, "down"), 0, true);
  }

  if (want.has("zone_low") && fin(a[last]) && a[last]! <= low)
    out.push({ cond: "zone_low", barsAgo: 0, note: `PDO ≤${low} (${fmt(a[last]!)})` });
  if (want.has("zone_high") && fin(a[last]) && a[last]! >= high)
    out.push({ cond: "zone_high", barsAgo: 0, note: `PDO ≥${high} (${fmt(a[last]!)})` });

  return out;
}

/** Grafik için tüm (bölge şartlı) kesişimler — referans pdoCrossEvents. */
export function pdoCrossEvents(a: Arr, b: Arr, zone: Zone, from = 1) {
  const out: { index: number; direction: "up" | "down" }[] = [];
  for (let i = Math.max(1, from); i < a.length; i++) {
    const x = crossAt(a, b, i);
    if (x === "up" && pdoZoneOK(a, i, "up", zone)) out.push({ index: i, direction: "up" });
    else if (x === "down" && pdoZoneOK(a, i, "down", zone)) out.push({ index: i, direction: "down" });
  }
  return out;
}

export const toNullable = (a: Arr): (number | null)[] => a.map((v) => (fin(v) ? v : null));
