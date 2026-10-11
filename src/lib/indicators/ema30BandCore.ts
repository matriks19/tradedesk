/**
 * EMA30 Band Kırılım — kullanıcının Pine v6 göstergesinin birebir çekirdeği (bağımlılıksız; QUANTEX T29 ve
 * TradeDesk Liste Tarama / grafik aynı modülü kullanır).
 *   emaH = ema(high, lenBand), emaL = ema(low, lenBand), ema200 = ema(close, len200)  (Pine ta.ema: SMA tohumu)
 *   zone = close > emaH ? 1 : close < emaL ? −1 : 0
 *   var curPeak/prevPeak/curTrough/prevTrough durum makinesi (bant üstü tepe / bant altı dip)
 *   brkUp/brkDown (useClose: kapanış, değilse high/low), trend filtresi (EMA200), var lastDir sıralaması,
 *   revLong/revShort = math.sum(bant dışı kapanış, revBars) == revBars, longSig/shortSig, lastDir (önce long).
 * Pine na semantiği: na ile karşılaştırma false; math.sum ilk revBars−1 mumda na.
 */
export type E30Opts = {
  lenBand: number;
  len200: number;
  useTrend: boolean;
  useClose: boolean;
  useShort: boolean;
  revOn: boolean;
  revBars: number;
  lenEma50: number;
};
export const E30_DEFAULTS: E30Opts = {
  lenBand: 30, len200: 200, useTrend: true, useClose: true, useShort: true, revOn: true, revBars: 2, lenEma50: 50,
};
export type E30Bars = { o?: number[]; h: number[]; l: number[]; c: number[] };
export type E30Events = {
  long: boolean[]; short: boolean[]; brkLong: boolean[]; revLong: boolean[]; brkShort: boolean[]; revShort: boolean[];
};
export type E30Result = {
  n: number; need: number; o: E30Opts;
  emaH: number[]; emaL: number[]; ema200: number[]; ema50: number[];
  zone: number[]; prevPeak: number[]; prevTrough: number[]; lastDir: number[];
  ev: E30Events;
};
const NA = NaN;
const isna = (v: number) => v !== v;
const fin = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function intOpt(v: unknown, d: number, min: number, max: number): number {
  const x = Math.round(Number(v));
  return Number.isFinite(x) ? Math.max(min, Math.min(max, x)) : d;
}
function boolOpt(v: unknown, d: boolean): boolean {
  if (v === undefined || v === null || v === "") return d;
  if (typeof v === "string") return v === "1" || v === "true";
  return !!v;
}
export function e30Opts(p?: Partial<Record<keyof E30Opts, unknown>> | null): E30Opts {
  const q = p ?? {}, D = E30_DEFAULTS;
  return {
    lenBand: intOpt(q.lenBand, D.lenBand, 1, 1000),
    len200: intOpt(q.len200, D.len200, 1, 2000),
    useTrend: boolOpt(q.useTrend, D.useTrend),
    useClose: boolOpt(q.useClose, D.useClose),
    useShort: boolOpt(q.useShort, D.useShort),
    revOn: boolOpt(q.revOn, D.revOn),
    revBars: intOpt(q.revBars, D.revBars, 1, 100),
    lenEma50: intOpt(q.lenEma50, D.lenEma50, 1, 1000),
  };
}
/** Isınma: trend EMA'sı (useTrend) ya da bant EMA'sı + revBars, üzerine 1 mum. Durum makinesi geçmişe bağlıdır (bkz. not). */
export function e30Need(o: E30Opts): number {
  return Math.max(o.lenBand, o.useTrend ? o.len200 : 0, o.revBars) + 1;
}
/** Pine ta.ema: ilk `len` geçerli değerin SMA'sı ile tohumlanır, sonra alpha = 2/(len+1). */
export function e30Ema(x: number[], len: number): number[] {
  const n = x.length, o = new Array<number>(n).fill(NA), a = 2 / (len + 1);
  let cnt = 0, s = 0, e = NA;
  for (let i = 0; i < n; i++) {
    const v = x[i]!;
    if (isna(v)) continue;
    if (isna(e)) { cnt++; s += v; if (cnt === len) { e = s / len; o[i] = e; } continue; }
    e = a * v + (1 - a) * e; o[i] = e;
  }
  return o;
}

export function e30Calc(k: E30Bars, opts?: Partial<Record<keyof E30Opts, unknown>> | E30Opts | null): E30Result {
  const o = e30Opts(opts as Partial<Record<keyof E30Opts, unknown>>);
  const { h, l, c } = k, n = c.length;
  const emaH = e30Ema(h, o.lenBand), emaL = e30Ema(l, o.lenBand), ema200 = e30Ema(c, o.len200), ema50 = e30Ema(c, o.lenEma50);
  const zone = new Array<number>(n), prevPeakA = new Array<number>(n).fill(NA), prevTroughA = new Array<number>(n).fill(NA), lastDirA = new Array<number>(n);
  const mk = () => new Array<boolean>(n).fill(false);
  const ev: E30Events = { long: mk(), short: mk(), brkLong: mk(), revLong: mk(), brkShort: mk(), revShort: mk() };
  let curPeak = NA, prevPeak = NA, curTrough = NA, prevTrough = NA, lastDir = 0;
  const belowF: number[] = new Array(n), aboveF: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const C = c[i]!, H = h[i]!, Lw = l[i]!, eH = emaH[i]!, eL = emaL[i]!, e2 = ema200[i]!;
    // na karşılaştırması false
    const aboveBand = C > eH, belowBand = C < eL;
    zone[i] = aboveBand ? 1 : belowBand ? -1 : 0;
    if (aboveBand) curPeak = isna(curPeak) ? H : Math.max(curPeak, H);
    else if (!isna(curPeak)) { prevPeak = curPeak; curPeak = NA; }
    if (belowBand) curTrough = isna(curTrough) ? Lw : Math.min(curTrough, Lw);
    else if (!isna(curTrough)) { prevTrough = curTrough; curTrough = NA; }
    const brkUp = o.useClose ? C > prevPeak : H > prevPeak;
    const brkDown = o.useClose ? C < prevTrough : Lw < prevTrough;
    const trendUp = !o.useTrend || C > e2;
    const trendDown = !o.useTrend || C < e2;
    // math.sum(cond ? 1 : 0, revBars): ilk revBars−1 mumda na → == revBars false
    belowF[i] = C < eL ? 1 : 0; aboveF[i] = C > eH ? 1 : 0;
    let belowCnt = NA, aboveCnt = NA;
    if (i >= o.revBars - 1) { belowCnt = 0; aboveCnt = 0; for (let j = i - o.revBars + 1; j <= i; j++) { belowCnt += belowF[j]!; aboveCnt += aboveF[j]!; } }
    const revShort = o.revOn && o.useShort && lastDir === 1 && belowCnt === o.revBars && trendDown;
    const revLong = o.revOn && o.useShort && lastDir === -1 && aboveCnt === o.revBars && trendUp;
    const brkLong = aboveBand && !isna(prevPeak) && brkUp && trendUp && (lastDir <= 0 || !o.useShort);
    const brkShort = o.useShort && belowBand && !isna(prevTrough) && brkDown && trendDown && lastDir >= 0;
    const longSig = brkLong || revLong;
    const shortSig = brkShort || revShort;
    if (longSig) lastDir = 1;
    else if (shortSig) lastDir = -1;
    ev.long[i] = longSig; ev.short[i] = shortSig;
    ev.brkLong[i] = brkLong; ev.revLong[i] = revLong; ev.brkShort[i] = brkShort; ev.revShort[i] = revShort;
    prevPeakA[i] = prevPeak; prevTroughA[i] = prevTrough; lastDirA[i] = lastDir;
  }
  return { n, need: e30Need(o), o, emaH, emaL, ema200, ema50, zone, prevPeak: prevPeakA, prevTrough: prevTroughA, lastDir: lastDirA, ev };
}
export const e30Fin = fin;
