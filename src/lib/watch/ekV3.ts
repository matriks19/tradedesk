/* eslint-disable */
/**
 * İzleme (watch-only) — EK v3 Emilim + EK v3 dip uyumsuzluk. osc-lab/new2-20261029/v3/emilimKizismaV3.ts ve
 * v3div/ekDivergenceV3.ts dosyalarının birebir kopyası (Python ek3/ekdiv ile parity testli). Saf ve nedensel: bar i yalnız <= i kullanır.
 */
export interface Candle { open: number; high: number; low: number; close: number; volume: number }
export type Trigger = 'early' | 'vturn' | 'fms' | 'climax'
export type Regime = 'none' | 'sma200' | 'slope' | 'notbear'
export interface EK3Params { L: number; A: number; F: number; S: number; D: number; k: number; qs: number; qf: number; qv: number; dz: number; cr: number; cv: number; N: number; du: number
  thr: number; lo: number; trig: Trigger; fmsconf: boolean; dry: boolean; regime: Regime; htf: boolean; htf_thr: number; m: number; cool: number }
export const EK3_DEF: EK3Params = { L: 50, A: 50, F: 5, S: 20, D: 12, k: 3, qs: 0.01, qf: 0.1, qv: 0.1, dz: 0.4, cr: 1.8, cv: 1.8, N: 10, du: 0.8,
  thr: 60, lo: 30, trig: 'early', fmsconf: false, dry: false, regime: 'none', htf: false, htf_thr: 30, m: 6, cool: 0 }
export const EK3_TUNED: EK3Params = { ...EK3_DEF, dz: 0.5, N: 10, trig: 'vturn', lo: 30, cool: 15 }
export interface EK3Result { emRaw: number[]; ems: number[]; emv: number[]; emf: number[]; fms: number[]; depth: number[]; climax: boolean[]; htf: number[]; al: boolean[] }

const isNum = (x: number) => Number.isFinite(x)
function ema(x: number[], n: number): number[] {
  const a = 2 / (n + 1), out = new Array<number>(x.length).fill(NaN); let prev = NaN
  for (let i = 0; i < x.length; i++) { const v = x[i]; if (!isNum(v)) { out[i] = prev; continue } prev = isNum(prev) ? a * v + (1 - a) * prev : v; out[i] = prev }
  return out
}
function rolling(x: number[], n: number, f: (w: number[]) => number): number[] {
  const out = new Array<number>(x.length).fill(NaN)
  for (let i = n - 1; i < x.length; i++) { const w = x.slice(i - n + 1, i + 1); out[i] = w.some(v => !isNum(v)) ? NaN : f(w) }
  return out
}
const mean = (w: number[]) => w.reduce((s, v) => s + v, 0) / w.length
const clip = (x: number, lo: number, hi: number) => (Number.isNaN(x) ? NaN : Math.min(hi, Math.max(lo, x)))
const sigm = (x: number) => 1 / (1 + Math.exp(-x))

export function kalmanLLT(z: number[], q0: number, qv: number, ar = 0.01, an = 0.1): { level: number[]; vel: number[] } {
  const n = z.length, level = new Array<number>(n).fill(NaN), vel = new Array<number>(n).fill(NaN)
  let x0 = NaN, x1 = 0, p00 = 0, p01 = 0, p11 = 0, R = 25, m = 1, prev = NaN, started = false
  for (let i = 0; i < n; i++) {
    const zi = z[i]; if (!isNum(zi)) continue
    if (!started) { started = true; x0 = zi; x1 = 0; p00 = 100; p01 = 0; p11 = 10; R = 25; prev = zi; level[i] = zi; vel[i] = 0; continue }
    R = (1 - ar) * R + ar * Math.max(0.5 * (zi - prev) ** 2, 1e-6); prev = zi
    const q = q0 * R * Math.min(Math.max(m, 0.5), 4)
    x0 = x0 + x1
    const n00 = p00 + 2 * p01 + p11 + q, n01 = p01 + p11, n11 = p11 + q * qv
    const S = n00 + R, y = zi - x0, k0 = n00 / S, k1 = n01 / S
    x0 += k0 * y; x1 += k1 * y
    p00 = n00 - k0 * n00; p01 = n01 - k0 * n01; p11 = n11 - k1 * n01
    m = (1 - an) * m + an * (y * y / S)
    level[i] = x0; vel[i] = x1
  }
  return { level, vel }
}

interface Raw { em: number[]; depth: number[]; tr: number[]; atr: number[]; clv: number[]; v: number[] }
function emRawOf(cs: Candle[], P: EK3Params): Raw {
  const n = cs.length, o = cs.map(c => c.open), h = cs.map(c => c.high), l = cs.map(c => c.low), c = cs.map(c => c.close)
  const v: number[] = []; let lastV = NaN
  for (const x of cs) { if (x.volume > 0) lastV = x.volume; v.push(isNum(lastV) ? lastV : 1) }
  const pc = c.map((_, i) => (i ? c[i - 1] : o[0]))
  const tr = c.map((_, i) => Math.max(h[i] - l[i], Math.abs(h[i] - pc[i]), Math.abs(l[i] - pc[i])))
  const atr = rolling(tr, P.A, mean), hh = rolling(h, P.L, w => Math.max(...w))
  const clv = c.map((_, i) => (h[i] > l[i] ? (c[i] - l[i]) / (h[i] - l[i]) : 0.5)), dn = c.map((_, i) => (c[i] < o[i] ? 1 : 0))
  const vF = ema(v, P.F), vS = ema(v, P.S)
  const cwF = ema(clv.map((x, i) => x * v[i]), P.F), cwS = ema(clv.map((x, i) => x * v[i]), P.S)
  const dF = ema(dn.map((x, i) => x * v[i]), P.F), dS = ema(dn.map((x, i) => x * v[i]), P.S)
  const em: number[] = [], depth: number[] = []
  for (let i = 0; i < n; i++) {
    const dp = clip((hh[i] - c[i]) / atr[i] / P.D, 0, 1); depth.push(dp)
    if (!isNum(atr[i])) { em.push(NaN); continue }
    const absorb = (cwF[i] / vF[i] - cwS[i] / vS[i]) + (dS[i] / vS[i] - dF[i] / vF[i])
    em.push(100 * Math.sqrt(dp) * sigm(P.k * absorb * 4))
  }
  return { em, depth, tr, atr, clv, v }
}

export function emilimV3(cs: Candle[], p: Partial<EK3Params> = {}): EK3Result {
  const P: EK3Params = { ...EK3_TUNED, ...p }, n = cs.length
  const h = cs.map(c => c.high), l = cs.map(c => c.low), c = cs.map(c => c.close)
  const R = emRawOf(cs, P)
  const S = kalmanLLT(R.em, P.qs, P.qv), F = kalmanLLT(R.em, P.qf, P.qv)
  const ems = S.level.map(x => clip(x, 0, 100)), emf = F.level.map(x => clip(x, 0, 100)), emv = S.vel
  const fms = ems.map((x, i) => emf[i] - x)
  const vma = rolling(R.v, 50, mean)
  const climax = c.map((_, i) => R.depth[i] >= P.dz && R.tr[i] / R.atr[i] >= P.cr && R.v[i] / vma[i] >= P.cv && R.clv[i] <= 0.5)
  const held: boolean[] = []; let last = -1e9, lowc = NaN
  for (let i = 0; i < n; i++) {
    if (climax[i]) { last = i; lowc = l[i] } else if (i - last <= P.N && c[i] < lowc) last = -1e9
    held.push(i - last > 0 && i - last <= P.N)
  }
  const v3 = ema(R.v, 3), v20 = ema(R.v, 20), dryNow = R.v.map((_, i) => v3[i] / v20[i] < P.du)
  const dry = dryNow.map((_, i) => dryNow[i] || (i > 0 && dryNow[i - 1]) || (i > 1 && dryNow[i - 2]))
  const sma = rolling(c, 200, mean)
  const reg = (i: number): boolean => P.regime === 'none' ? true : P.regime === 'sma200' ? c[i] > sma[i]
    : P.regime === 'slope' ? i >= 20 && sma[i] >= sma[i - 20] : c[i] > 0.8 * sma[i]
  // HTF Emilim: positional m-bar groups, bar i sees the previous (completed) group
  const G: Candle[] = []
  for (let i = 0; i < n; i += P.m) {
    const g = cs.slice(i, i + P.m)
    G.push({ open: g[0].open, high: Math.max(...g.map(x => x.high)), low: Math.min(...g.map(x => x.low)), close: g[g.length - 1].close, volume: g.reduce((s, x) => s + x.volume, 0) })
  }
  const hs = kalmanLLT(emRawOf(G, P).em, P.qs, P.qv).level
  const htf = c.map((_, i) => { const gi = Math.floor(i / P.m) - 1; return gi >= 0 ? hs[gi] : NaN })
  const up0 = (x: number[], i: number) => i > 0 && x[i - 1] <= 0 && x[i] > 0
  const al: boolean[] = []; let lastAl = -1e9
  for (let i = 0; i < n; i++) {
    let a = false
    if (P.trig === 'early') a = i > 0 && ems[i - 1] < P.thr && ems[i] >= P.thr
    else if (P.trig === 'vturn') a = R.depth[i] >= P.dz && ems[i] >= P.lo && up0(emv, i)
    else if (P.trig === 'fms') a = R.depth[i] >= P.dz && ems[i] >= P.lo && up0(fms, i)
    else a = held[i] && ems[i] >= P.lo && i > 0 && c[i] > h[i - 1]
    if (P.fmsconf) a = a && fms[i] > 0
    if (P.dry) a = a && dry[i]
    a = a && reg(i)
    if (P.htf) a = a && htf[i] >= P.htf_thr
    if (a && P.cool > 0) { if (i - lastAl <= P.cool) a = false; else lastAl = i }
    al.push(a)
  }
  return { emRaw: R.em, ems, emv, emf, fms, depth: R.depth, climax, htf, al }
}
export type Osc = 'EMs' | 'FMS' | 'RSI'
export type Zone = 'none' | 'lowZ' | 'depth' | 'both'
export type Combo = 'alone' | 'al' | 'fms'
export interface DivParams { osc: Osc; Lb: number; R: number; G1: number; G2: number; delta: number; zone: Zone; Z: number; dz: number; combo: Combo; N: number; cool: number }
export const DIV_DEF: DivParams = { osc: 'EMs', Lb: 5, R: 3, G1: 5, G2: 60, delta: 0, zone: 'lowZ', Z: 50, dz: 0.5, combo: 'alone', N: 10, cool: 10 }
export interface Divergence { p0: number; p: number; confirm: number }
export interface DivResult { osc: number[]; divs: Divergence[]; signal: boolean[]; v3al: boolean[]; fms: number[]; ems: number[] }

export function rsi(c: number[], n = 14): number[] {
  const out = new Array<number>(c.length).fill(NaN), a = 1 / n; let g = NaN, l = NaN
  for (let i = 1; i < c.length; i++) {
    const d = c[i] - c[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0)
    g = Number.isNaN(g) ? up : a * up + (1 - a) * g; l = Number.isNaN(l) ? dn : a * dn + (1 - a) * l
    out[i] = 100 - 100 / (1 + g / l)
  }
  return out
}
export function pivotsLow(low: number[], Lb: number, R: number): number[] {
  const out: number[] = []
  for (let p = Lb; p < low.length - R; p++) {
    let ok = true
    for (let j = p - Lb; j <= p + R && ok; j++) { if (low[j] < low[p]) ok = false; if (j > p && low[j] <= low[p]) ok = false }
    if (ok) out.push(p)
  }
  return out
}
export function divergences(low: number[], osc: number[], depth: number[], P: DivParams): Divergence[] {
  const piv = pivotsLow(low, P.Lb, P.R), out: Divergence[] = []
  const rmin = low.map((_, i) => Math.min(...low.slice(Math.max(0, i - P.Z + 1), i + 1)))
  for (let j = 1; j < piv.length; j++) {
    const p = piv[j], p0 = piv[j - 1]
    if (p - p0 < P.G1 || p - p0 > P.G2) continue
    if (!(low[p] < low[p0] && Number.isFinite(osc[p]) && Number.isFinite(osc[p0]) && osc[p] > osc[p0] + P.delta)) continue
    const zl = low[p] <= rmin[p], zd = depth[p] >= P.dz
    if (P.zone === 'lowZ' && !zl) continue
    if (P.zone === 'depth' && !zd) continue
    if (P.zone === 'both' && !(zl && zd)) continue
    out.push({ p0, p, confirm: p + P.R })
  }
  return out
}
export function ekDivergenceV3(cs: Candle[], p: Partial<DivParams> = {}, v3: Partial<EK3Params> = {}): DivResult {
  const P: DivParams = { ...DIV_DEF, ...p }, n = cs.length
  const r = emilimV3(cs, v3), low = cs.map(c => c.low)
  const osc = P.osc === 'EMs' ? r.ems : P.osc === 'FMS' ? r.fms : rsi(cs.map(c => c.close))
  const divs = divergences(low, osc, r.depth, P)
  const dv = new Array<boolean>(n).fill(false); for (const d of divs) dv[d.confirm] = true
  const signal: boolean[] = []; let ld = -1e9, la = -1e9, last = -1e9
  for (let i = 0; i < n; i++) {
    if (dv[i]) ld = i
    if (r.al[i]) la = i
    let s = P.combo === 'alone' ? dv[i] : P.combo === 'fms' ? dv[i] && r.fms[i] > 0 : (dv[i] && i - la <= P.N) || (r.al[i] && i - ld <= P.N)
    if (s && P.cool > 0) { if (i - last <= P.cool) s = false; else last = i }
    signal.push(s)
  }
  return { osc, divs, signal, v3al: r.al, fms: r.fms, ems: r.ems }
}
