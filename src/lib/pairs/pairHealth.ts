/**
 * Pair Health — statistical arbitrage diagnostics for TradeDesk.
 *
 * Teaching model (encode in UI copy too):
 * - Cointegration ≠ correlation. High corr can still mean a drifting spread.
 * - Pair Health = is the relationship still tradeable TODAY (recent corr,
 *   beta stability, residual mean-reversion / half-life, ADF proxy).
 */

export type ClosePoint = { time: number; close: number };

export type PairSignalSide = "AL" | "SAT" | "EXIT";

export interface PairSignal {
  side: PairSignalSide;
  /** Bars before the last bar (0 = current bar). */
  barsAgo: number;
  z: number;
  time: number;
  priceA: number;
  priceB: number;
  /** Spread value at signal. */
  spread: number;
  /** Stock-side mean-reversion target for A (hedge unwind toward mean). */
  targetA?: number;
}

export interface FibLevel {
  label: string;
  /** Level on spread scale. */
  spread: number;
  /** Mapped approximate price for A holding B fixed at last. */
  priceA?: number;
}

export interface PairHealthResult {
  symbolA: string;
  symbolB: string;
  n: number;
  corr30: number;
  corr60: number;
  corr90: number;
  /** corr60 − corr90 (positive = strengthening). */
  corrDelta: number;
  beta: number;
  betaStab: number;
  halfLife: number;
  adfStat: number;
  /** Rough p-proxy from ADF critical values (with intercept). */
  adfP: number;
  cointLabel: "OK" | "Zayıf" | "Yok";
  healthScore: number;
  zNow: number;
  spreadMean: number;
  spreadStd: number;
  spreadNow: number;
  lastA: number;
  lastB: number;
  signals: PairSignal[];
  lastSignal: PairSignal | null;
  fibLevels: FibLevel[];
  /** Optional note (e.g. synthetic index). */
  note?: string;
}

export interface PairScanRow {
  pair: string;
  symbolA: string;
  symbolB: string;
  healthScore: number;
  corr60: number;
  corrDelta: number;
  beta: number;
  betaStab: number;
  halfLife: number;
  cointLabel: PairHealthResult["cointLabel"];
  zNow: number;
  lastSignal: PairSignal | null;
  targetLabel: string;
  result: PairHealthResult;
}

export interface PairHealthOptions {
  entryZ?: number;
  exitZ?: number;
  zLookback?: number;
  rollingBetaWindow?: number;
  sweetHalfLife?: [number, number];
}

const DEFAULTS: Required<PairHealthOptions> = {
  entryZ: 2,
  exitZ: 0.5,
  zLookback: 60,
  rollingBetaWindow: 60,
  sweetHalfLife: [5, 40],
};

// ─── primitives ──────────────────────────────────────────────────────────────

export function alignCloses(
  a: ClosePoint[],
  b: ClosePoint[]
): { time: number; a: number; b: number }[] {
  const mapB = new Map<number, number>();
  for (const p of b) {
    if (Number.isFinite(p.close) && p.close > 0) mapB.set(p.time, p.close);
  }
  const out: { time: number; a: number; b: number }[] = [];
  for (const p of a) {
    if (!Number.isFinite(p.close) || p.close <= 0) continue;
    const bv = mapB.get(p.time);
    if (bv == null) continue;
    out.push({ time: p.time, a: p.close, b: bv });
  }
  return out;
}

export function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (prev > 0 && cur > 0) out.push(Math.log(cur / prev));
    else out.push(0);
  }
  return out;
}

export function mean(xs: number[]): number {
  if (!xs.length) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function variance(xs: number[], ddof = 0): number {
  if (xs.length <= ddof) return NaN;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) {
    const d = x - m;
    s += d * d;
  }
  return s / (xs.length - ddof);
}

export function std(xs: number[], ddof = 0): number {
  const v = variance(xs, ddof);
  return Number.isFinite(v) ? Math.sqrt(v) : NaN;
}

export function pearsonCorr(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return NaN;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const mA = sumA / n;
  const mB = sumB / n;
  let num = 0;
  let dA = 0;
  let dB = 0;
  for (let i = 0; i < n; i++) {
    const xa = a[i] - mA;
    const xb = b[i] - mB;
    num += xa * xb;
    dA += xa * xa;
    dB += xb * xb;
  }
  const den = Math.sqrt(dA * dB);
  return den > 0 ? num / den : NaN;
}

/** Rolling Pearson on return series; output length = returns length, nulls as NaN until window fills. */
export function rollingCorr(
  returnsA: number[],
  returnsB: number[],
  window: number
): number[] {
  const n = Math.min(returnsA.length, returnsB.length);
  const out = new Array<number>(n).fill(NaN);
  if (window < 3 || n < window) return out;
  for (let i = window - 1; i < n; i++) {
    const sliceA = returnsA.slice(i - window + 1, i + 1);
    const sliceB = returnsB.slice(i - window + 1, i + 1);
    out[i] = pearsonCorr(sliceA, sliceB);
  }
  return out;
}

/** OLS slope of y ~ α + β x (with intercept). Returns β. */
export function olsBeta(y: number[], x: number[]): number {
  const n = Math.min(y.length, x.length);
  if (n < 3) return NaN;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i];
    sy += y[i];
    sxx += x[i] * x[i];
    sxy += x[i] * y[i];
  }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-18) return NaN;
  return (n * sxy - sx * sy) / den;
}

/** OLS with intercept: returns { alpha, beta }. */
export function olsWithIntercept(
  y: number[],
  x: number[]
): { alpha: number; beta: number } {
  const n = Math.min(y.length, x.length);
  if (n < 3) return { alpha: NaN, beta: NaN };
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i];
    sy += y[i];
    sxx += x[i] * x[i];
    sxy += x[i] * y[i];
  }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-18) return { alpha: NaN, beta: NaN };
  const beta = (n * sxy - sx * sy) / den;
  const alpha = sy / n - beta * (sx / n);
  return { alpha, beta };
}

/**
 * Augmented Dickey–Fuller (lag-1) t-stat on residual series.
 * Model: Δy_t = α + γ y_{t-1} + φ Δy_{t-1} + ε
 * Returns t-stat on γ (more negative → more stationary).
 */
export function adfStat(series: number[]): number {
  const n = series.length;
  if (n < 20) return NaN;
  const dy: number[] = [];
  const yLag: number[] = [];
  const dyLag: number[] = [];
  for (let t = 2; t < n; t++) {
    dy.push(series[t] - series[t - 1]);
    yLag.push(series[t - 1]);
    dyLag.push(series[t - 1] - series[t - 2]);
  }
  const m = dy.length;
  // Regress dy ~ 1 + yLag + dyLag via normal equations (3 params)
  let sY = 0;
  let sL = 0;
  let sD = 0;
  let sYY = 0;
  let sLL = 0;
  let sDD = 0;
  let sYL = 0;
  let sYD = 0;
  let sLD = 0;
  for (let i = 0; i < m; i++) {
    const y = dy[i];
    const l = yLag[i];
    const d = dyLag[i];
    sY += y;
    sL += l;
    sD += d;
    sYY += y * y;
    sLL += l * l;
    sDD += d * d;
    sYL += y * l;
    sYD += y * d;
    sLD += l * d;
  }
  // X'X: [[m, sL, sD], [sL, sLL, sLD], [sD, sLD, sDD]]
  // X'y: [sY, sYL, sYD]
  const xtx = [
    [m, sL, sD],
    [sL, sLL, sLD],
    [sD, sLD, sDD],
  ];
  const xty = [sY, sYL, sYD];
  const solved = solve3(xtx, xty);
  if (!solved) return NaN;
  const [, gamma, phi] = solved;
  // Residuals & se(gamma)
  let sse = 0;
  for (let i = 0; i < m; i++) {
    const pred = solved[0] + gamma * yLag[i] + phi * dyLag[i];
    const e = dy[i] - pred;
    sse += e * e;
  }
  const dof = m - 3;
  if (dof < 1) return NaN;
  const sigma2 = sse / dof;
  // Inverse of X'X [1,1] for var(gamma) — Cramer's / adjugate lite
  const inv11 = cofactor3(xtx, 1, 1) / det3(xtx);
  if (!Number.isFinite(inv11) || inv11 <= 0) return NaN;
  const se = Math.sqrt(sigma2 * inv11);
  if (!(se > 0)) return NaN;
  return gamma / se;
}

function det3(a: number[][]): number {
  return (
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])
  );
}

function cofactor3(a: number[][], row: number, col: number): number {
  const m: number[][] = [];
  for (let i = 0; i < 3; i++) {
    if (i === row) continue;
    const r: number[] = [];
    for (let j = 0; j < 3; j++) {
      if (j === col) continue;
      r.push(a[i][j]);
    }
    m.push(r);
  }
  const minor = m[0][0] * m[1][1] - m[0][1] * m[1][0];
  const sign = (row + col) % 2 === 0 ? 1 : -1;
  return sign * minor;
}

function solve3(a: number[][], b: number[]): number[] | null {
  const d = det3(a);
  if (!Number.isFinite(d) || Math.abs(d) < 1e-18) return null;
  const out: number[] = [];
  for (let col = 0; col < 3; col++) {
    const m = a.map((row) => row.slice());
    for (let r = 0; r < 3; r++) m[r][col] = b[r];
    out.push(det3(m) / d);
  }
  return out;
}

/** Map ADF t-stat → approximate p (MacKinnon-ish critical values, intercept). */
export function adfPFromStat(t: number): number {
  if (!Number.isFinite(t)) return 1;
  // Critical: 1% ≈ -3.43, 5% ≈ -2.86, 10% ≈ -2.57
  if (t <= -3.43) return 0.01;
  if (t <= -2.86) return 0.05;
  if (t <= -2.57) return 0.1;
  if (t <= -2.0) return 0.25;
  if (t <= -1.5) return 0.4;
  return 0.7;
}

export function cointLabelFromAdf(t: number): "OK" | "Zayıf" | "Yok" {
  if (!Number.isFinite(t)) return "Yok";
  if (t <= -2.86) return "OK";
  if (t <= -2.2) return "Zayıf";
  return "Yok";
}

/**
 * Half-life of mean reversion from AR(1): Δs_t = λ s_{t-1} (+ const).
 * HL = -ln(2) / λ  when λ < 0.
 */
export function halfLife(spread: number[]): number {
  if (spread.length < 10) return NaN;
  const y: number[] = [];
  const x: number[] = [];
  for (let i = 1; i < spread.length; i++) {
    y.push(spread[i] - spread[i - 1]);
    x.push(spread[i - 1]);
  }
  // With intercept: Δs = α + λ s_{t-1}
  const { beta: lambda } = olsWithIntercept(y, x);
  if (!Number.isFinite(lambda) || lambda >= 0) return Infinity;
  const hl = -Math.LN2 / lambda;
  return hl > 0 && Number.isFinite(hl) ? hl : Infinity;
}

/** Rolling OLS beta of log(y) on log(x); returns std/|mean| of rolling betas. */
export function betaStability(
  logY: number[],
  logX: number[],
  window: number
): number {
  const n = Math.min(logY.length, logX.length);
  if (n < window + 5 || window < 10) return NaN;
  const betas: number[] = [];
  for (let i = window - 1; i < n; i++) {
    const y = logY.slice(i - window + 1, i + 1);
    const x = logX.slice(i - window + 1, i + 1);
    const b = olsBeta(y, x);
    if (Number.isFinite(b)) betas.push(b);
  }
  if (betas.length < 5) return NaN;
  const m = mean(betas);
  const s = std(betas);
  const absM = Math.abs(m);
  if (!(absM > 1e-9)) return NaN;
  return s / absM;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function scoreCorr(c60: number): number {
  if (!Number.isFinite(c60)) return 0;
  // Prefer |corr| in 0.55–0.95 (pairs tradeable, not identical)
  const a = Math.abs(c60);
  if (a < 0.3) return 10 * (a / 0.3);
  if (a < 0.55) return 10 + 25 * ((a - 0.3) / 0.25);
  if (a <= 0.95) return 35 + 25 * ((a - 0.55) / 0.4);
  return 50 - 20 * ((a - 0.95) / 0.05); // too identical
}

function scoreCorrStability(roll: number[]): number {
  const vals = roll.filter((x) => Number.isFinite(x));
  if (vals.length < 5) return 10;
  const s = std(vals);
  // low std of rolling corr → stable relationship
  if (!Number.isFinite(s)) return 10;
  if (s < 0.05) return 20;
  if (s < 0.1) return 16;
  if (s < 0.15) return 12;
  if (s < 0.25) return 6;
  return 2;
}

function scoreCoint(adf: number, p: number): number {
  if (!Number.isFinite(adf)) return 0;
  if (p <= 0.01) return 25;
  if (p <= 0.05) return 20;
  if (p <= 0.1) return 12;
  if (adf <= -2.0) return 6;
  return 0;
}

function scoreBetaStab(bs: number): number {
  if (!Number.isFinite(bs)) return 5;
  if (bs < 0.1) return 15;
  if (bs < 0.2) return 12;
  if (bs < 0.35) return 8;
  if (bs < 0.5) return 4;
  return 1;
}

function scoreHalfLife(hl: number, sweet: [number, number]): number {
  if (!Number.isFinite(hl) || hl === Infinity) return 0;
  const [lo, hi] = sweet;
  if (hl >= lo && hl <= hi) return 20;
  if (hl < lo) return 8; // too fast / noise
  if (hl <= hi * 1.5) return 10;
  if (hl <= hi * 3) return 4;
  return 0;
}

export function pairHealthScore(parts: {
  corr60: number;
  rollingCorr60: number[];
  adfStat: number;
  adfP: number;
  betaStab: number;
  halfLife: number;
  sweetHalfLife?: [number, number];
}): number {
  const sweet = parts.sweetHalfLife ?? DEFAULTS.sweetHalfLife;
  const total =
    scoreCorr(parts.corr60) +
    scoreCorrStability(parts.rollingCorr60) +
    scoreCoint(parts.adfStat, parts.adfP) +
    scoreBetaStab(parts.betaStab) +
    scoreHalfLife(parts.halfLife, sweet);
  return Math.round(clamp(total, 0, 100));
}

/** Build z-score series with lookback window (or full sample if lookback >= n). */
export function zScores(spread: number[], lookback: number): number[] {
  const n = spread.length;
  const out = new Array<number>(n).fill(NaN);
  const w = Math.max(10, lookback);
  for (let i = 0; i < n; i++) {
    const from = Math.max(0, i - w + 1);
    const slice = spread.slice(from, i + 1);
    if (slice.length < 10) continue;
    const m = mean(slice);
    const s = std(slice);
    if (!(s > 1e-12)) continue;
    out[i] = (spread[i] - m) / s;
  }
  return out;
}

function mapSpreadToPriceA(
  spreadLevel: number,
  beta: number,
  alpha: number,
  lastB: number
): number {
  // spread = log(A) - beta*log(B) - alpha  =>  A = exp(spread + alpha + beta*log(B))
  if (!(lastB > 0) || !Number.isFinite(beta)) return NaN;
  return Math.exp(spreadLevel + alpha + beta * Math.log(lastB));
}

function fibOnSpread(
  spread: number[],
  beta: number,
  alpha: number,
  lastB: number,
  lookback = 60
): FibLevel[] {
  const n = spread.length;
  if (n < 20) return [];
  const slice = spread.slice(Math.max(0, n - lookback));
  const hi = Math.max(...slice);
  const lo = Math.min(...slice);
  const range = hi - lo;
  const m = mean(slice);
  if (!(range > 1e-12)) {
    return [
      {
        label: "mean",
        spread: m,
        priceA: mapSpreadToPriceA(m, beta, alpha, lastB),
      },
    ];
  }
  const ratios: { label: string; r: number }[] = [
    { label: "0", r: 0 },
    { label: "0.382", r: 0.382 },
    { label: "0.5", r: 0.5 },
    { label: "0.618", r: 0.618 },
    { label: "1", r: 1 },
  ];
  const levels: FibLevel[] = [
    {
      label: "mean",
      spread: m,
      priceA: mapSpreadToPriceA(m, beta, alpha, lastB),
    },
  ];
  for (const { label, r } of ratios) {
    const s = lo + range * r;
    levels.push({
      label: `Fib ${label}`,
      spread: s,
      priceA: mapSpreadToPriceA(s, beta, alpha, lastB),
    });
  }
  // Also ±0.382/0.5/0.618 of recent swing around mean
  for (const r of [0.382, 0.5, 0.618]) {
    levels.push({
      label: `mean+${r}`,
      spread: m + range * r,
      priceA: mapSpreadToPriceA(m + range * r, beta, alpha, lastB),
    });
    levels.push({
      label: `mean-${r}`,
      spread: m - range * r,
      priceA: mapSpreadToPriceA(m - range * r, beta, alpha, lastB),
    });
  }
  return levels;
}

function extractSignals(
  aligned: { time: number; a: number; b: number }[],
  spread: number[],
  z: number[],
  beta: number,
  alpha: number,
  entryZ: number,
  exitZ: number
): PairSignal[] {
  const signals: PairSignal[] = [];
  const last = aligned.length - 1;
  let pos: "flat" | "long" | "short" = "flat";
  for (let i = 0; i < aligned.length; i++) {
    const zi = z[i];
    if (!Number.isFinite(zi)) continue;
    const barsAgo = last - i;
    const targetA = mapSpreadToPriceA(
      mean(spread.slice(Math.max(0, i - 59), i + 1)),
      beta,
      alpha,
      aligned[i].b
    );
    if (pos === "flat") {
      if (zi <= -entryZ) {
        pos = "long";
        signals.push({
          side: "AL",
          barsAgo,
          z: zi,
          time: aligned[i].time,
          priceA: aligned[i].a,
          priceB: aligned[i].b,
          spread: spread[i],
          targetA,
        });
      } else if (zi >= entryZ) {
        pos = "short";
        signals.push({
          side: "SAT",
          barsAgo,
          z: zi,
          time: aligned[i].time,
          priceA: aligned[i].a,
          priceB: aligned[i].b,
          spread: spread[i],
          targetA,
        });
      }
    } else if (pos === "long") {
      if (zi >= -exitZ || zi >= entryZ) {
        signals.push({
          side: "EXIT",
          barsAgo,
          z: zi,
          time: aligned[i].time,
          priceA: aligned[i].a,
          priceB: aligned[i].b,
          spread: spread[i],
          targetA,
        });
        pos = "flat";
        if (zi >= entryZ) {
          pos = "short";
          signals.push({
            side: "SAT",
            barsAgo,
            z: zi,
            time: aligned[i].time,
            priceA: aligned[i].a,
            priceB: aligned[i].b,
            spread: spread[i],
            targetA,
          });
        }
      }
    } else if (pos === "short") {
      if (zi <= exitZ || zi <= -entryZ) {
        signals.push({
          side: "EXIT",
          barsAgo,
          z: zi,
          time: aligned[i].time,
          priceA: aligned[i].a,
          priceB: aligned[i].b,
          spread: spread[i],
          targetA,
        });
        pos = "flat";
        if (zi <= -entryZ) {
          pos = "long";
          signals.push({
            side: "AL",
            barsAgo,
            z: zi,
            time: aligned[i].time,
            priceA: aligned[i].a,
            priceB: aligned[i].b,
            spread: spread[i],
            targetA,
          });
        }
      }
    }
  }
  return signals;
}

/**
 * Core Pair Health computation on two aligned close series.
 * y = symbolA (stock), x = symbolB (index or pair leg).
 */
export function computePairHealth(
  symbolA: string,
  symbolB: string,
  seriesA: ClosePoint[],
  seriesB: ClosePoint[],
  opts: PairHealthOptions = {},
  note?: string
): PairHealthResult | null {
  const o = { ...DEFAULTS, ...opts };
  const aligned = alignCloses(seriesA, seriesB);
  if (aligned.length < 40) return null;

  const closesA = aligned.map((p) => p.a);
  const closesB = aligned.map((p) => p.b);
  const retA = logReturns(closesA);
  const retB = logReturns(closesB);

  const corr30 = pearsonCorr(retA.slice(-30), retB.slice(-30));
  const corr60 = pearsonCorr(retA.slice(-60), retB.slice(-60));
  const corr90 = pearsonCorr(retA.slice(-90), retB.slice(-90));
  const corrDelta =
    Number.isFinite(corr60) && Number.isFinite(corr90) ? corr60 - corr90 : NaN;

  const roll60 = rollingCorr(retA, retB, 60);

  const logY = closesA.map((c) => Math.log(c));
  const logX = closesB.map((c) => Math.log(c));
  const { alpha, beta } = olsWithIntercept(logY, logX);
  if (!Number.isFinite(beta)) return null;

  const spread = logY.map((ly, i) => ly - beta * logX[i] - alpha);
  const hl = halfLife(spread);
  const adf = adfStat(spread);
  const adfP = adfPFromStat(adf);
  const cointLabel = cointLabelFromAdf(adf);
  const bStab = betaStability(logY, logX, o.rollingBetaWindow);

  const healthScore = pairHealthScore({
    corr60,
    rollingCorr60: roll60,
    adfStat: adf,
    adfP,
    betaStab: bStab,
    halfLife: hl,
    sweetHalfLife: o.sweetHalfLife,
  });

  const z = zScores(spread, o.zLookback);
  const zNow = z[z.length - 1];
  const lookSlice = spread.slice(-o.zLookback);
  const spreadMean = mean(lookSlice);
  const spreadStd = std(lookSlice);
  const spreadNow = spread[spread.length - 1];

  const signals = extractSignals(
    aligned,
    spread,
    z,
    beta,
    alpha,
    o.entryZ,
    o.exitZ
  );
  const tradeSignals = signals.filter((s) => s.side === "AL" || s.side === "SAT");
  const lastSignal =
    tradeSignals.length > 0 ? tradeSignals[tradeSignals.length - 1] : null;

  const lastA = closesA[closesA.length - 1];
  const lastB = closesB[closesB.length - 1];
  const fibLevels = fibOnSpread(spread, beta, alpha, lastB);

  return {
    symbolA,
    symbolB,
    n: aligned.length,
    corr30,
    corr60,
    corr90,
    corrDelta,
    beta,
    betaStab: bStab,
    halfLife: hl,
    adfStat: adf,
    adfP,
    cointLabel,
    healthScore,
    zNow,
    spreadMean,
    spreadStd,
    spreadNow,
    lastA,
    lastB,
    signals,
    lastSignal,
    fibLevels,
    note,
  };
}

/** Equal-weight synthetic index from multiple aligned close series (by time). */
export function syntheticIndexFromCloses(
  seriesList: ClosePoint[][]
): ClosePoint[] {
  if (!seriesList.length) return [];
  const maps = seriesList.map((s) => {
    const m = new Map<number, number>();
    for (const p of s) {
      if (p.close > 0) m.set(p.time, p.close);
    }
    return m;
  });
  const times = new Set<number>();
  for (const m of maps) {
    for (const t of m.keys()) times.add(t);
  }
  const sorted = [...times].sort((a, b) => a - b);
  // Need first valid for each series to normalize to 100
  const first: (number | null)[] = maps.map(() => null);
  const out: ClosePoint[] = [];
  for (const t of sorted) {
    const vals: number[] = [];
    let ok = true;
    for (let i = 0; i < maps.length; i++) {
      const c = maps[i].get(t);
      if (c == null) {
        ok = false;
        break;
      }
      if (first[i] == null) first[i] = c;
      vals.push((c / (first[i] as number)) * 100);
    }
    if (!ok || vals.length !== maps.length) continue;
    // Only emit once all series have a first close
    if (first.some((f) => f == null)) continue;
    out.push({ time: t, close: mean(vals) });
  }
  return out;
}

export function toScanRow(r: PairHealthResult): PairScanRow {
  const meanFib = r.fibLevels.find((f) => f.label === "mean");
  const targetLabel =
    r.lastSignal?.targetA != null && Number.isFinite(r.lastSignal.targetA)
      ? `A→${fmt(r.lastSignal.targetA)}`
      : meanFib?.priceA != null
        ? `mean ${fmt(meanFib.priceA)}`
        : "—";
  return {
    pair: `${r.symbolA}/${r.symbolB}`,
    symbolA: r.symbolA,
    symbolB: r.symbolB,
    healthScore: r.healthScore,
    corr60: r.corr60,
    corrDelta: r.corrDelta,
    beta: r.beta,
    betaStab: r.betaStab,
    halfLife: r.halfLife,
    cointLabel: r.cointLabel,
    zNow: r.zNow,
    lastSignal: r.lastSignal,
    targetLabel,
    result: r,
  };
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toFixed(1);
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(3);
}

/** Generate unique unordered pairs from symbol list. */
export function pairCombinations(symbols: string[]): [string, string][] {
  const out: [string, string][] = [];
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      out.push([symbols[i], symbols[j]]);
    }
  }
  return out;
}
