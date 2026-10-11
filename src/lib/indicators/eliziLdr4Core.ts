/**
 * ELIZI-LDR4 — "Elizi Ladder v4 — Erken + Ana Hızlı/Yavaş Sinyal (Long)" (Pine v6) gösterge çekirdeği.
 * Kullanıcının strateji betiğinin gösterge matematiği birebir: CTH + Stabilis (25 çekirdek, stMode) + Hız-Entropi,
 * tanh polyfill, ağırlıklı birleşik skor, uniFast/stFast/uniSig/slowSig/eSrc, oy kapısı (useGate).
 * Saf dizi tabanlı (bağımlılık yok): QUANTEX İzleme (coin + BIST) ekranlarına derlenip gömülür, Liste Tarama aynı modülü kullanır.
 * Pine na anlamı: NaN. Karşılaştırma na → false (ternary yanlış dala gider), math.max/min/abs/sign(na) → na, nz(na) → 0.
 * Sinyaller yalnız verilen (kapanmış) mumlarda: anaAl = crossover(uniSig, slowSig), anaSat = crossunder(uniSig, slowSig),
 * erkenAl = crossover(eSrc, slowSig) and not slowUp, erkenSat = crossunder(eSrc, uniSig) and slowUp (betiğin warnUp/warnDn'i).
 */
export type Eld4Opts = {
  minVote: number; wC: number; wS: number; wV: number;
  uniSmooth: number; sigLen: number; slowLen: number; useGate: boolean;
  earlySrc: "Birleşik skor" | "Stabilis skor";
  pLen: number; pFast: number; pSlow: number; zLen: number; need: number; cSmooth: number;
  L: number; dead: number; smoothN: number; effGate: number; stMode: string;
  lenVel: number; lenEnt: number; entThresh: number; thrustLen: number; coreThr: number; vShort: boolean;
  /** syminfo.mintick (BIST 0.01; coin: borsa tick ya da 1e-8) */
  mintick: number;
};
export const ELD4_DEFAULTS: Eld4Opts = {
  minVote: 2, wC: 1, wS: 1, wV: 1, uniSmooth: 5, sigLen: 13, slowLen: 21, useGate: false, earlySrc: "Birleşik skor",
  pLen: 20, pFast: 10, pSlow: 40, zLen: 40, need: 2, cSmooth: 2,
  L: 20, dead: 0.12, smoothN: 3, effGate: 0.2, stMode: "Stabilis",
  lenVel: 14, lenEnt: 20, entThresh: 0.65, thrustLen: 8, coreThr: 0.4, vShort: true, mintick: 1e-8,
};
export const ELD4_ST_MODES = ["Stabilis", "V2 Dual", "DD Shield", "Seed", "Tail", "Fractal", "Agree", "Band MR", "Recover", "ExtClock", "A1 Thrust", "A2 CompRelease", "A3 Fractal", "A4 PhaseLead", "A5 EntSlope", "A6 VolTgtMom", "A7 SessionMem", "A8 Skew", "A9 KurtDamp", "A10 Agree", "A11 Recover", "A12 LiqVac", "A13 RegimeVel", "A14 SpecTilt", "A15 PathEff", "A16 RevPress", "A17 Jerk", "A18 Band", "A19 Impulse", "A20 ScaleDiv", "A21 Tail", "A22 Persist", "A23 ChopGate", "A24 ExtClock", "A25 Seed"];
export type Eld4Bars = { o: number[]; h: number[]; l: number[]; c: number[]; v: number[] };
export type Eld4Result = {
  n: number; need: number; o: Eld4Opts;
  cthScore: number[]; stScore: number[]; vetScore: number[]; uniAvg: number[]; uniBase: number[];
  uniFast: number[]; stFast: number[]; uniSig: number[]; slowSig: number[]; eSrc: number[];
  cDir: number[]; sDir: number[]; vDir: number[]; slowUp: boolean[];
  ev: { anaAl: boolean[]; anaSat: boolean[]; erkenAl: boolean[]; erkenSat: boolean[] };
};

const NA = NaN;
const fin = (x: number) => x === x && x !== Infinity && x !== -Infinity;
const isna = (x: number) => x !== x;
const nz = (x: number) => (x !== x ? 0 : x);
const tr = (x: number) => Math.trunc(x);
function tanh(x: number): number {
  const ax = Math.min(Math.abs(x), 20.0), t = Math.exp(-2.0 * ax), y = (1.0 - t) / (1.0 + t);
  return Math.sign(x) * y;
}
function arr(n: number, v = NA): number[] { return new Array<number>(n).fill(v); }
function map(x: number[], f: (v: number, i: number) => number): number[] { const n = x.length, o = new Array<number>(n); for (let i = 0; i < n; i++) o[i] = f(x[i]!, i); return o; }
function lag(x: number[], i: number, k: number): number { return i - k >= 0 && k >= 0 ? x[i - k]! : NA; }
/** Pine ta.sma / math.sum: pencerede na varsa na */
function sum(x: number[], len: number): number[] {
  const n = x.length, o = arr(n); let s = 0, bad = 0;
  for (let i = 0; i < n; i++) {
    const v = x[i]!; if (isna(v)) bad++; else s += v;
    if (i >= len) { const w = x[i - len]!; if (isna(w)) bad--; else s -= w; }
    if (i >= len - 1 && !bad) { let t = 0; if ((i % 64) === 0) { for (let j = i - len + 1; j <= i; j++) t += x[j]!; s = t; } o[i] = s; }
  }
  return o;
}
function sma(x: number[], len: number): number[] { return map(sum(x, len), (v) => v / len); }
/** Pine ta.stdev (popülasyon, biased) */
function stdev(x: number[], len: number): number[] {
  const n = x.length, o = arr(n); let bad = 0;
  for (let i = 0; i < n; i++) {
    if (isna(x[i]!)) bad++; if (i >= len && isna(x[i - len]!)) bad--;
    if (i < len - 1 || bad) continue;
    let s = 0; for (let j = i - len + 1; j <= i; j++) s += x[j]!;
    const m = s / len; let q = 0; for (let j = i - len + 1; j <= i; j++) { const d = x[j]! - m; q += d * d; }
    o[i] = Math.sqrt(q / len);
  }
  return o;
}
/** Pine ta.ema / ta.rma: ilk len geçerli değerin SMA'sı ile tohum; na girdide durum korunur, çıktı na */
function ema(x: number[], len: number, rma = false): number[] {
  const n = x.length, o = arr(n), a = rma ? 1 / len : 2 / (len + 1); let cnt = 0, s = 0, e = NA;
  for (let i = 0; i < n; i++) {
    const v = x[i]!; if (isna(v)) continue;
    if (isna(e)) { cnt++; s += v; if (cnt === len) { e = s / len; o[i] = e; } continue; }
    e = a * v + (1 - a) * e; o[i] = e;
  }
  return o;
}
function change(x: number[], k = 1): number[] { return map(x, (v, i) => v - lag(x, i, k)); }
/** Pine ta.median (çift uzunlukta iki orta değerin ortalaması); pencerede na → na */
function median(x: number[], len: number): number[] {
  const n = x.length, o = arr(n), w = new Array<number>(len);
  for (let i = len - 1; i < n; i++) {
    let bad = false; for (let j = 0; j < len; j++) { const v = x[i - len + 1 + j]!; if (isna(v)) { bad = true; break; } w[j] = v; }
    if (bad) continue; const s = w.slice().sort((a, b) => a - b), m = len >> 1;
    o[i] = len % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  }
  return o;
}
/** Pine ta.correlation (Pearson, popülasyon) */
function correlation(x: number[], y: number[], len: number): number[] {
  const n = x.length, o = arr(n);
  for (let i = len - 1; i < n; i++) {
    let sx = 0, sy = 0, bad = false;
    for (let j = i - len + 1; j <= i; j++) { if (isna(x[j]!) || isna(y[j]!)) { bad = true; break; } sx += x[j]!; sy += y[j]!; }
    if (bad) continue; const mx = sx / len, my = sy / len; let cxy = 0, vx = 0, vy = 0;
    for (let j = i - len + 1; j <= i; j++) { const dx = x[j]! - mx, dy = y[j]! - my; cxy += dx * dy; vx += dx * dx; vy += dy * dy; }
    o[i] = (cxy / len) / (Math.sqrt(vx / len) * Math.sqrt(vy / len));
  }
  return o;
}
function highest(x: number[], len: number): number[] { const n = x.length, o = arr(n); for (let i = len - 1; i < n; i++) { let m = -Infinity, bad = false; for (let j = i - len + 1; j <= i; j++) { if (isna(x[j]!)) { bad = true; break; } if (x[j]! > m) m = x[j]!; } if (!bad) o[i] = m; } return o; }
function lowest(x: number[], len: number): number[] { const n = x.length, o = arr(n); for (let i = len - 1; i < n; i++) { let m = Infinity, bad = false; for (let j = i - len + 1; j <= i; j++) { if (isna(x[j]!)) { bad = true; break; } if (x[j]! < m) m = x[j]!; } if (!bad) o[i] = m; } return o; }
function barssince(c: boolean[]): number[] { const n = c.length, o = arr(n); let last = -1; for (let i = 0; i < n; i++) { if (c[i]) last = i; o[i] = last < 0 ? NA : i - last; } return o; }
function roc(x: number[], k: number): number[] { return map(x, (v, i) => { const p = lag(x, i, k); return 100 * (v - p) / p; }); }
function atr(h: number[], l: number[], c: number[], len: number): number[] {
  const t = map(c, (_, i) => (i === 0 ? h[i]! - l[i]! : Math.max(h[i]! - l[i]!, Math.abs(h[i]! - c[i - 1]!), Math.abs(l[i]! - c[i - 1]!))));
  return ema(t, len, true);
}
function clampNum(v: unknown, d: number, lo?: number, hi?: number, int = false): number {
  let x = typeof v === "number" ? v : v == null || v === "" ? NaN : Number(v);
  if (!fin(x)) x = d; if (int) x = Math.round(x);
  if (lo != null && x < lo) x = lo; if (hi != null && x > hi) x = hi; return x;
}
/** Ayar nesnesinden (eksik/bozuk değerlere varsayılan) Pine minval/maxval sınırlarıyla */
export function eld4Opts(p?: Partial<Record<keyof Eld4Opts, unknown>> | null): Eld4Opts {
  const q = (p || {}) as Record<string, unknown>, D = ELD4_DEFAULTS;
  const b = (k: string, d: boolean) => (q[k] === undefined || q[k] === null ? d : q[k] === true || q[k] === 1 || q[k] === "1" || q[k] === "true");
  const st = String(q.stMode ?? D.stMode);
  return {
    minVote: clampNum(q.minVote, D.minVote, 1, 3, true), wC: clampNum(q.wC, D.wC, 0), wS: clampNum(q.wS, D.wS, 0), wV: clampNum(q.wV, D.wV, 0),
    uniSmooth: clampNum(q.uniSmooth, D.uniSmooth, 1, 10, true), sigLen: clampNum(q.sigLen, D.sigLen, 2, undefined, true), slowLen: clampNum(q.slowLen, D.slowLen, 5, undefined, true),
    useGate: b("useGate", D.useGate), earlySrc: q.earlySrc === "Stabilis skor" ? "Stabilis skor" : "Birleşik skor",
    pLen: clampNum(q.pLen, D.pLen, 5, undefined, true), pFast: clampNum(q.pFast, D.pFast, 3, undefined, true), pSlow: clampNum(q.pSlow, D.pSlow, 10, undefined, true),
    zLen: clampNum(q.zLen, D.zLen, 10, undefined, true), need: clampNum(q.need, D.need, 2, 3, true), cSmooth: clampNum(q.cSmooth, D.cSmooth, 1, 5, true),
    L: clampNum(q.L, D.L, 8, 80, true), dead: clampNum(q.dead, D.dead, 0, 0.6), smoothN: clampNum(q.smoothN, D.smoothN, 1, 7, true), effGate: clampNum(q.effGate, D.effGate, 0.05, 0.6),
    stMode: ELD4_ST_MODES.indexOf(st) >= 0 ? st : D.stMode,
    lenVel: clampNum(q.lenVel, D.lenVel, 2, undefined, true), lenEnt: clampNum(q.lenEnt, D.lenEnt, 5, undefined, true), entThresh: clampNum(q.entThresh, D.entThresh, 0.3, 0.9),
    thrustLen: clampNum(q.thrustLen, D.thrustLen, 2, undefined, true), coreThr: clampNum(q.coreThr, D.coreThr, 0.05), vShort: b("vShort", D.vShort),
    mintick: clampNum(q.mintick, D.mintick, 1e-12),
  };
}
/** Kararlı sinyal için gereken kapalı mum (ısınma): L*3 SMA, L*2 stdev, pSlow/zLen zinciri + EMA yakınsaması */
export function eld4Need(o: Eld4Opts): number {
  return Math.max(o.L * 3 + 2, o.L * 4 + 2, o.pLen + o.zLen, o.pSlow, o.lenVel * 3, o.lenEnt + 1) + o.slowLen * 4 + o.sigLen * 2 + 60;
}

export function eld4Calc(k: Eld4Bars, opts?: Partial<Record<keyof Eld4Opts, unknown>> | Eld4Opts | null): Eld4Result {
  const o = eld4Opts(opts as Partial<Record<keyof Eld4Opts, unknown>>);
  const { c, h, l } = k, op = k.o, vol = k.v && k.v.length === c.length ? k.v.map((x) => (fin(+x) ? +x : 0)) : c.map(() => 0);
  const n = c.length, L = o.L, mt = o.mintick;
  const atrV = atr(h, l, c, L);
  const chg = change(c);
  // ---- MODÜL 1 — CTH
  const cHH = map(h, (v, i) => (v > lag(h, i, 1) ? 1 : 0)), cHL = map(l, (v, i) => (v > lag(l, i, 1) ? 1 : 0));
  const cLH = map(h, (v, i) => (v < lag(h, i, 1) ? 1 : 0)), cLL = map(l, (v, i) => (v < lag(l, i, 1) ? 1 : 0));
  const sHH = sma(cHH, o.pLen), sHL = sma(cHL, o.pLen), sLH = sma(cLH, o.pLen), sLL = sma(cLL, o.pLen);
  const structRaw = map(sHH, (v, i) => v + sHL[i]! - sLH[i]! - sLL[i]!);
  const erDen = sum(map(chg, Math.abs), o.pLen);
  const er = map(c, (v, i) => (erDen[i]! > 0 ? Math.abs(v - lag(c, i, o.pLen)) / erDen[i]! : 0));
  const smF = sma(c, o.pFast), smL = sma(c, o.pLen), smS = sma(c, o.pSlow);
  const msRaw = map(c, (v, i) => (Math.sign(v - smF[i]!) + Math.sign(v - smL[i]!) + Math.sign(v - smS[i]!)) / 3.0 * er[i]!);
  const signedVol = map(chg, (v, i) => v * vol[i]!);
  const csv = sum(signedVol, o.pLen), csvMean = sma(csv, o.zLen), csvSd = stdev(csv, o.zLen);
  const csvZ = map(csv, (v, i) => (csvSd[i]! > 0 ? (v - csvMean[i]!) / csvSd[i]! : 0));
  const cDir = new Array<number>(n), cStr = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const s = structRaw[i]!, m = msRaw[i]!, z = csvZ[i]!;
    const vote = (s > 0 ? 1 : s < 0 ? -1 : 0) + (m > 0 ? 1 : m < 0 ? -1 : 0) + (z > 0.25 ? 1 : z < -0.25 ? -1 : 0);
    cDir[i] = vote >= o.need ? 1 : vote <= -o.need ? -1 : 0;
    cStr[i] = (s / 2.0 + m + Math.max(-1.0, Math.min(1.0, z / 2.0))) / 3.0;
  }
  const cthScore = ema(map(cDir, (d, i) => d * Math.abs(cStr[i]!) * 100.0), o.cSmooth);
  // ---- MODÜL 2 — STABİLİS
  const ret = map(chg, (v, i) => v / lag(c, i, 1));
  const rng = map(c, (v, i) => (h[i]! - l[i]!) / v);
  const upLeg = map(chg, (v) => Math.max(v, 0.0)), dnLeg = map(chg, (v) => Math.max(-v, 0.0));
  const eUp = ema(upLeg, L), eDn = ema(dnLeg, L);
  const a1 = map(eUp, (v, i) => tanh((v - eDn[i]!) / Math.max(atrV[i]!, mt)));
  const rS = sma(rng, L), rS3 = sma(rng, L * 3);
  const comp = map(rS, (v, i) => v / Math.max(rS3[i]!, 1e-8));
  const compGate = map(comp, (v) => Math.max(0.25, 0.5 + 0.5 * Math.max(-1.0, Math.min(1.0, 1.0 - v))));
  const smCL = sma(c, L);
  const a2 = map(c, (v, i) => tanh(compGate[i]! * 1.5 * Math.sign(v - smCL[i]!)));
  const fr = map(h, (v, i) => (v > lag(h, i, 1) ? 1 : 0) - (l[i]! < lag(l, i, 1) ? 1 : 0));
  const a3 = map(ema(fr, L), (v) => tanh(v * 2.0));
  const phLag = Math.max(2, tr(L / 5));
  const det = map(c, (v, i) => v - smCL[i]!);
  const a4 = map(det, (v, i) => { const pf = v - lag(det, i, phLag), ps = lag(det, i, phLag); return tanh((pf * Math.sign(ps)) / Math.max(atrV[i]!, mt)); });
  const pUp = map(sma(map(ret, (v) => (v > 0 ? 1 : 0)), L), (v) => Math.max(0.02, Math.min(0.98, v)));
  const sEnt = map(pUp, (p) => -(p * Math.log(p) + (1.0 - p) * Math.log(1.0 - p)));
  const smRet = sma(ret, L), sdRet = stdev(ret, L);
  const lag4 = Math.max(3, tr(L / 4));
  const a5 = map(sEnt, (v, i) => tanh(-(v - lag(sEnt, i, lag4)) * 4.0 * Math.sign(smRet[i]!)));
  const pers = sma(map(ret, (v) => Math.sign(nz(v))), L);
  const a6 = map(smRet, (v, i) => tanh((v / Math.max(sdRet[i]!, 1e-8)) * Math.abs(pers[i]!)));
  const intra = map(c, (v, i) => (v - op[i]!) / v), resid = map(op, (v, i) => (v - lag(c, i, 1)) / lag(c, i, 1));
  const eIn = ema(intra, L), eRe = ema(resid, L);
  const a7 = map(eIn, (v, i) => tanh(v * 8.0 - eRe[i]! * 4.0));
  const sm1 = smRet;
  const sm3 = sma(map(ret, (v, i) => Math.pow(nz(v) - sm1[i]!, 3)), L);
  const sd = map(sdRet, (v) => Math.max(v, 1e-8));
  const a8 = map(sm3, (v, i) => tanh(v / Math.pow(sd[i]!, 3) / 1.5));
  const sm4 = sma(map(ret, (v, i) => Math.pow(nz(v) - sm1[i]!, 4)), L);
  const a9 = map(sm4, (v, i) => { const kurt = v / Math.pow(sd[i]!, 4) - 3.0, damp = 1.0 / (1.0 + Math.max(kurt, 0.0) / 6.0); return tanh((sm1[i]! / sd[i]!) * damp); });
  const a10 = map(c, (v, i) => (Math.sign(v / lag(c, i, lag4) - 1) + Math.sign(v / lag(c, i, L) - 1) + Math.sign(v / lag(c, i, L * 2) - 1)) / 3.0);
  const peak = new Array<number>(n); for (let i = 0; i < n; i++) peak[i] = Math.max(i ? peak[i - 1]! : c[i]!, c[i]!);
  const ddv = map(c, (v, i) => v / Math.max(peak[i]!, mt) - 1.0);
  const a11 = map(ddv, (v, i) => tanh((v - lag(ddv, i, L)) * 8.0));
  const vS = sma(vol, L), vSd = stdev(vol, L), rSd = stdev(rng, L);
  const a12 = map(c, (v, i) => {
    const vz = (vol[i]! - vS[i]!) / Math.max(vSd[i]!, 1.0), rz = (rng[i]! - rS[i]!) / Math.max(rSd[i]!, 1e-8);
    return tanh(rz * (-Math.min(vz, 2.0)) * Math.sign(v - op[i]!) / 2.0);
  });
  const path = sum(map(ret, (v) => Math.abs(nz(v))), L);
  const eff = map(c, (v, i) => (v / lag(c, i, L) - 1.0) / Math.max(path[i]!, 1e-8));
  const a15 = map(eff, (v) => tanh(v * 2.0));
  const lag3 = Math.max(3, tr(L / 3));
  const a13 = map(eff, (v, i) => tanh((v - lag(eff, i, lag3)) * 3.0));
  const sdH = stdev(ret, Math.max(5, tr(L / 2))), sd2 = stdev(ret, L * 2);
  const a14 = map(sdH, (v, i) => tanh(Math.max(1.2 - v / Math.max(sd2[i]!, 1e-8), 0.1) * Math.sign(sm1[i]!) * 2.0));
  const medC = median(c, L);
  const a16 = map(c, (v, i) => tanh(-((v - medC[i]!) / Math.max(atrV[i]!, mt)) / 2.0));
  const emaL = ema(c, L), jerk = change(change(change(emaL)));
  const a17 = map(jerk, (v, i) => tanh(v / Math.max(atrV[i]!, mt) * L));
  const bMid = emaL;
  const a18 = map(c, (v, i) => { const bPos = (v - (bMid[i]! - 1.6 * atrV[i]!)) / Math.max(3.2 * atrV[i]!, mt); return tanh((bPos - 0.5) * 3.0); });
  const a19 = new Array<number>(n); { let run = 0; for (let i = 0; i < n; i++) { const sg = Math.sign(nz(ret[i]!)); run = sg === Math.sign(nz(lag(ret, i, 1))) ? run + 1 : 1; a19[i] = tanh(sg * Math.log(1.0 + run) / Math.log(1.0 + L)); } }
  const scF = map(c, (v, i) => (v - lag(c, i, lag4)) / v), scS = map(c, (v, i) => (v - lag(c, i, L * 2)) / v);
  const scFm = sma(scF, L), scFs = stdev(scF, L), scSm = sma(scS, L * 2), scSs = stdev(scS, L * 2);
  const a20 = map(scF, (v, i) => tanh(((v - scFm[i]!) / Math.max(scFs[i]!, 1e-8) - (scS[i]! - scSm[i]!) / Math.max(scSs[i]!, 1e-8)) / 2.0));
  const upSd = map(sma(map(ret, (v) => Math.pow(Math.max(nz(v), 0.0), 2)), L), Math.sqrt);
  const dnSd = map(sma(map(ret, (v) => Math.pow(Math.min(nz(v), 0.0), 2)), L), Math.sqrt);
  const a21 = map(upSd, (u, i) => tanh((u - dnSd[i]!) / Math.max(u + dnSd[i]!, 1e-8) * 2.0));
  const ac = correlation(ret, map(ret, (_, i) => lag(ret, i, 1)), L);
  const a22 = map(ac, (v, i) => tanh(v * Math.sign(sm1[i]!) * 2.0));
  const a23 = map(a1, (v, i) => tanh(v * (Math.abs(Math.max(-1.0, Math.min(1.0, eff[i]!))) + 0.15) * 1.4));
  const hh = highest(h, L), ll = lowest(l, L);
  const sinceHi = barssince(map(h, (v, i) => (v === hh[i]! ? 1 : 0)).map(Boolean)), sinceLo = barssince(map(l, (v, i) => (v === ll[i]! ? 1 : 0)).map(Boolean));
  const a24 = map(sinceHi, (v, i) => tanh(((nz(v) - nz(sinceLo[i]!)) / L) * -1.2));
  const a25 = map(eff, (v, i) => tanh(v * compGate[i]! * 2.0 + a1[i]! * 0.5));
  const mN = Math.max(o.smoothN, 1);
  const effS = sma(eff, 5);
  const seedS = median(a25, mN), tailS = median(a21, mN), frS = median(a3, mN), bandS = median(a18, mN);
  const stRaw = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const trendOn = Math.abs(effS[i]!) > o.effGate;
    let v: number;
    switch (o.stMode) {
      case "V2 Dual": v = tanh(0.62 * seedS[i]! + 0.38 * tailS[i]!); break;
      case "DD Shield": v = tanh(0.35 * a25[i]! + 0.25 * a21[i]! + 0.20 * a9[i]! + 0.20 * Math.max(-1.0, Math.min(a11[i]!, 0.3))); break;
      case "Seed": case "A25 Seed": v = a25[i]!; break;
      case "Tail": case "A21 Tail": v = a21[i]!; break;
      case "Fractal": case "A3 Fractal": v = a3[i]!; break;
      case "Agree": case "A10 Agree": v = a10[i]!; break;
      case "Band MR": v = -a18[i]!; break;
      case "Recover": case "A11 Recover": v = a11[i]!; break;
      case "ExtClock": case "A24 ExtClock": v = a24[i]!; break;
      case "A1 Thrust": v = a1[i]!; break; case "A2 CompRelease": v = a2[i]!; break; case "A4 PhaseLead": v = a4[i]!; break;
      case "A5 EntSlope": v = a5[i]!; break; case "A6 VolTgtMom": v = a6[i]!; break; case "A7 SessionMem": v = a7[i]!; break;
      case "A8 Skew": v = a8[i]!; break; case "A9 KurtDamp": v = a9[i]!; break; case "A12 LiqVac": v = a12[i]!; break;
      case "A13 RegimeVel": v = a13[i]!; break; case "A14 SpecTilt": v = a14[i]!; break; case "A15 PathEff": v = a15[i]!; break;
      case "A16 RevPress": v = a16[i]!; break; case "A17 Jerk": v = a17[i]!; break; case "A18 Band": v = a18[i]!; break;
      case "A19 Impulse": v = a19[i]!; break; case "A20 ScaleDiv": v = a20[i]!; break; case "A22 Persist": v = a22[i]!; break;
      case "A23 ChopGate": v = a23[i]!; break;
      default: v = tanh(0.34 * seedS[i]! + 0.24 * tailS[i]! + 0.16 * frS[i]! + 0.12 * a10[i]! + (trendOn ? 0.0 : 0.14 * (-bandS[i]!)));
    }
    stRaw[i] = v;
  }
  const stScore = map(stRaw, (v) => v * 100.0);
  const sDir = map(stScore, (v) => (v > o.dead * 100.0 ? 1 : v < -o.dead * 100.0 ? -1 : 0));
  // ---- MODÜL 3 — VELOCITY-ENTROPY THRUST
  const vRoc = roc(c, o.lenVel), vRocSd = stdev(vRoc, o.lenVel * 2);
  const vel = map(vRoc, (v, i) => (vRocSd[i]! > 0 ? v / vRocSd[i]! : 0));
  const vAbs = map(chg, Math.abs), vAbsAvg = sma(vAbs, o.lenEnt);
  // Pine: vEnt = vAbsAvg > 0 ? ta.stdev(vAbs, lenEnt) / vAbsAvg : 0.0 — ta.stdev üçlü dalda: yalnız çağrıldığı (vAbsAvg > 0)
  // mumlarda kendi geçmişini biriktirir; ilk lenEnt−1 çağrıda na → entNorm na (Pine birebir)
  const entNorm = new Array<number>(n); {
    const w: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = vAbsAvg[i]!; let vEnt = 0;
      if (a > 0) {
        w.push(vAbs[i]!); if (w.length > o.lenEnt) w.shift();
        let sdv = NA; if (w.length === o.lenEnt && !w.some(isna)) { let s = 0; for (const x of w) s += x; const m = s / o.lenEnt; let q = 0; for (const x of w) q += (x - m) * (x - m); sdv = Math.sqrt(q / o.lenEnt); }
        vEnt = sdv / a;
      }
      entNorm[i] = Math.min(1.0, vEnt / 2.0);
    }
  }
  const loN = lowest(l, o.thrustLen), hiN = highest(h, o.thrustLen), roc5 = roc(c, 5);
  const vDir = new Array<number>(n), vetScore = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const vHL = loN[i]! > lag(loN, i, 1), vLH = hiN[i]! < lag(hiN, i, 1);
    const thrustL = vHL ? roc5[i]! : 0, thrustS = vLH ? roc5[i]! : 0;
    const thrustOk = vel[i]! >= 0 ? thrustL > 0 : thrustS < 0;
    const vCore = vel[i]! * (1.0 - entNorm[i]!) * (thrustOk ? 1.2 : 0.6);
    vDir[i] = entNorm[i]! < o.entThresh ? (vCore > o.coreThr ? 1 : o.vShort && vCore < -o.coreThr ? -1 : 0) : 0;
    vetScore[i] = tanh(vCore / 1.5) * 100.0;
  }
  // ---- BİRLEŞİK SKOR + HIZLI / YAVAŞ / STABLE
  const wSum = Math.max(o.wC + o.wS + o.wV, 1e-8);
  const uniAvg = map(cthScore, (v, i) => (v * o.wC + stScore[i]! * o.wS + vetScore[i]! * o.wV) / wSum);
  const uniBase = map(uniAvg, (u, i) => {
    if (!o.useGate) return u;
    const votes = cDir[i]! + sDir[i]! + vDir[i]!, uDir = votes >= o.minVote ? 1 : votes <= -o.minVote ? -1 : 0;
    return uDir === 0 ? 0.0 : Math.sign(u) === uDir ? u : 0.0;
  });
  const uniFast = ema(uniBase, o.uniSmooth), stFast = ema(stScore, o.uniSmooth);
  const uniSig = ema(uniFast, o.sigLen), slowSig = ema(uniBase, o.slowLen);
  const eSrc = o.earlySrc === "Stabilis skor" ? stFast : uniFast;
  const slowUp = map(uniSig, (v, i) => (v > slowSig[i]! ? 1 : 0)).map(Boolean);
  const xo = (a: number[], b: number[], i: number) => i > 0 && a[i]! > b[i]! && a[i - 1]! <= b[i - 1]!;
  const xu = (a: number[], b: number[], i: number) => i > 0 && a[i]! < b[i]! && a[i - 1]! >= b[i - 1]!;
  const ev = { anaAl: new Array<boolean>(n), anaSat: new Array<boolean>(n), erkenAl: new Array<boolean>(n), erkenSat: new Array<boolean>(n) };
  for (let i = 0; i < n; i++) {
    ev.anaAl[i] = xo(uniSig, slowSig, i); ev.anaSat[i] = xu(uniSig, slowSig, i);
    ev.erkenAl[i] = xo(eSrc, slowSig, i) && !slowUp[i]; ev.erkenSat[i] = xu(eSrc, uniSig, i) && slowUp[i]!;
  }
  return { n, need: eld4Need(o), o, cthScore, stScore, vetScore, uniAvg, uniBase, uniFast, stFast, uniSig, slowSig, eSrc, cDir, sDir, vDir, slowUp, ev };
}
