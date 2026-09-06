import type { Candle } from "@/lib/types";
import type { TechnicalFieldId } from "./fields";
import {
  adx,
  aroon,
  atr,
  awesomeOsc,
  bbPercentB,
  bbWidth,
  bollinger,
  cci,
  closes,
  donchian,
  ema,
  hull,
  ichimoku,
  keltner,
  macd,
  mfi,
  natr,
  obv,
  psar,
  roc,
  rsi,
  sma,
  stochastic,
  stochRsi,
  supertrend,
  ultimateOsc,
  vwap,
  vwma,
  williamsR,
} from "@/lib/indicators/math";
import { jurikKaseStoch, jurikStoch } from "@/lib/indicators/jurik";

function fillNull(n: number): (number | null)[] {
  return new Array(n).fill(null);
}

function constSeries(n: number, v: number): (number | null)[] {
  return new Array(n).fill(v);
}

function lastCandlePatterns(candles: Candle[]): {
  doji: (number | null)[];
  hammer: (number | null)[];
  shooting: (number | null)[];
  engulfBull: (number | null)[];
  engulfBear: (number | null)[];
} {
  const n = candles.length;
  const doji = fillNull(n);
  const hammer = fillNull(n);
  const shooting = fillNull(n);
  const engulfBull = fillNull(n);
  const engulfBear = fillNull(n);
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const range = Math.max(1e-12, c.high - c.low);
    const body = Math.abs(c.close - c.open);
    const upper = c.high - Math.max(c.open, c.close);
    const lower = Math.min(c.open, c.close) - c.low;
    doji[i] = body / range <= 0.1 ? 1 : 0;
    hammer[i] =
      lower >= body * 2 && upper <= body * 0.5 && body / range < 0.4 ? 1 : 0;
    shooting[i] =
      upper >= body * 2 && lower <= body * 0.5 && body / range < 0.4 ? 1 : 0;
    if (i > 0) {
      const p = candles[i - 1];
      const pBody = Math.abs(p.close - p.open);
      const bull = c.close > c.open;
      const bear = c.close < c.open;
      const pBull = p.close > p.open;
      const pBear = p.close < p.open;
      engulfBull[i] =
        pBear &&
        bull &&
        c.open <= p.close &&
        c.close >= p.open &&
        body > pBody
          ? 1
          : 0;
      engulfBear[i] =
        pBull &&
        bear &&
        c.open >= p.close &&
        c.close <= p.open &&
        body > pBody
          ? 1
          : 0;
    } else {
      engulfBull[i] = 0;
      engulfBear[i] = 0;
    }
  }
  return { doji, hammer, shooting, engulfBull, engulfBear };
}

/** Elder Bull Bear Power ≈ (High − EMA13) + (Low − EMA13) / 2 mid, or High+Low)/2 − EMA */
function bullBearPower(candles: Candle[]): (number | null)[] {
  const e = ema(closes(candles), 13);
  return candles.map((c, i) => {
    if (e[i] == null) return null;
    const bull = c.high - (e[i] as number);
    const bear = c.low - (e[i] as number);
    return (bull + bear) / 2;
  });
}

function adrPct(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1 || candles[i].close <= 0) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].high - candles[j].low;
    }
    out.push((100 * (sum / period)) / candles[i].close);
  }
  return out;
}

function obvSlope(candles: Candle[], period = 5): (number | null)[] {
  const o = obv(candles);
  return o.map((v, i) => {
    if (v == null || i < period || o[i - period] == null) return null;
    return (v as number) - (o[i - period] as number);
  });
}

/**
 * Heuristic MA rating: majority of close above SMA20/50/200 → +1, below → −1, else 0.
 */
function maRating(candles: Candle[]): (number | null)[] {
  const c = closes(candles);
  const s20 = sma(c, 20);
  const s50 = sma(c, 50);
  const s200 = sma(c, 200);
  return c.map((px, i) => {
    let votes = 0;
    let n = 0;
    for (const s of [s20[i], s50[i], s200[i]]) {
      if (s == null) continue;
      n++;
      votes += px > (s as number) ? 1 : px < (s as number) ? -1 : 0;
    }
    if (n < 2) return null;
    if (votes >= 2) return 1;
    if (votes <= -2) return -1;
    return 0;
  });
}

/**
 * Heuristic Osc rating from RSI / Stoch / CCI zone votes.
 */
function oscRating(candles: Candle[]): (number | null)[] {
  const c = closes(candles);
  const r = rsi(c, 14);
  const st = stochastic(candles, 14, 3);
  const cc = cci(candles, 20);
  return c.map((_, i) => {
    let votes = 0;
    let n = 0;
    const rv = r[i];
    if (rv != null) {
      n++;
      if (rv < 30) votes += 1;
      else if (rv > 70) votes -= 1;
    }
    const kv = st.k[i];
    if (kv != null) {
      n++;
      if (kv < 20) votes += 1;
      else if (kv > 80) votes -= 1;
    }
    const cv = cc[i];
    if (cv != null) {
      n++;
      if (cv < -100) votes += 1;
      else if (cv > 100) votes -= 1;
    }
    if (n < 2) return null;
    if (votes >= 2) return 1;
    if (votes <= -2) return -1;
    return 0;
  });
}

const cache = new WeakMap<Candle[], Map<TechnicalFieldId, (number | null)[]>>();

/** Compute (and cache per candles array) a technical field series. */
export function computeFieldSeries(
  candles: Candle[],
  field: TechnicalFieldId
): (number | null)[] {
  if (!candles.length) return [];
  let map = cache.get(candles);
  if (!map) {
    map = new Map();
    cache.set(candles, map);
  }
  const hit = map.get(field);
  if (hit) return hit;

  const c = closes(candles);
  const n = candles.length;
  let series: (number | null)[];

  switch (field) {
    case "price":
      series = c.map((v) => v);
      break;
    case "change_pct": {
      series = c.map((v, i) =>
        i === 0 || c[i - 1] === 0 ? null : ((v - c[i - 1]) / c[i - 1]) * 100
      );
      break;
    }
    case "rsi":
      series = rsi(c, 14);
      break;
    case "stoch_k":
      series = stochastic(candles, 14, 3).k;
      break;
    case "stoch_d":
      series = stochastic(candles, 14, 3).d;
      break;
    case "stochrsi_k":
      series = stochRsi(c).k;
      break;
    case "stochrsi_d":
      series = stochRsi(c).d;
      break;
    case "macd":
      series = macd(c).macd;
      break;
    case "macd_signal":
      series = macd(c).signal;
      break;
    case "macd_hist":
      series = macd(c).hist;
      break;
    case "cci":
      series = cci(candles, 20);
      break;
    case "roc":
      series = roc(c, 12);
      break;
    case "williams_r":
      series = williamsR(candles, 14);
      break;
    case "ao":
      series = awesomeOsc(candles);
      break;
    case "uo":
      series = ultimateOsc(candles);
      break;
    case "bbp":
      series = bullBearPower(candles);
      break;
    case "sma20":
      series = sma(c, 20);
      break;
    case "sma50":
      series = sma(c, 50);
      break;
    case "sma100":
      series = sma(c, 100);
      break;
    case "sma200":
      series = sma(c, 200);
      break;
    case "ema9":
      series = ema(c, 9);
      break;
    case "ema20":
      series = ema(c, 20);
      break;
    case "ema21":
      series = ema(c, 21);
      break;
    case "ema50":
      series = ema(c, 50);
      break;
    case "hma20":
      series = hull(c, 20);
      break;
    case "vwma20":
      series = vwma(candles, 20);
      break;
    case "bb_upper":
      series = bollinger(c, 20, 2).upper;
      break;
    case "bb_mid":
      series = bollinger(c, 20, 2).mid;
      break;
    case "bb_lower":
      series = bollinger(c, 20, 2).lower;
      break;
    case "bb_pctb":
      series = bbPercentB(c, 20, 2);
      break;
    case "bb_width":
      series = bbWidth(c, 20, 2);
      break;
    case "keltner_upper":
      series = keltner(candles, 20, 1.5).upper;
      break;
    case "keltner_lower":
      series = keltner(candles, 20, 1.5).lower;
      break;
    case "donchian_upper":
      series = donchian(candles, 20).upper;
      break;
    case "donchian_lower":
      series = donchian(candles, 20).lower;
      break;
    case "psar":
      series = psar(candles);
      break;
    case "supertrend_dir":
      series = supertrend(candles, 10, 3).direction;
      break;
    case "atr":
      series = atr(candles, 14);
      break;
    case "atr_pct":
      series = natr(candles, 14);
      break;
    case "adr_pct":
      series = adrPct(candles, 14);
      break;
    case "vwap":
      series = vwap(candles);
      break;
    case "volume":
      series = candles.map((x) => x.volume);
      break;
    case "volume_sma20":
      series = sma(
        candles.map((x) => x.volume),
        20
      );
      break;
    case "volume_spike": {
      const vols = candles.map((x) => x.volume);
      const vs = sma(vols, 20);
      series = vols.map((v, i) =>
        vs[i] == null || (vs[i] as number) === 0
          ? null
          : v / (vs[i] as number)
      );
      break;
    }
    case "mfi":
      series = mfi(candles, 14);
      break;
    case "obv_slope":
      series = obvSlope(candles, 5);
      break;
    case "ichi_tenkan":
      series = ichimoku(candles).tenkan;
      break;
    case "ichi_kijun":
      series = ichimoku(candles).kijun;
      break;
    case "ichi_span_a":
      series = ichimoku(candles).spanA;
      break;
    case "ichi_span_b":
      series = ichimoku(candles).spanB;
      break;
    case "pat_doji":
      series = lastCandlePatterns(candles).doji;
      break;
    case "pat_hammer":
      series = lastCandlePatterns(candles).hammer;
      break;
    case "pat_shooting_star":
      series = lastCandlePatterns(candles).shooting;
      break;
    case "pat_engulf_bull":
      series = lastCandlePatterns(candles).engulfBull;
      break;
    case "pat_engulf_bear":
      series = lastCandlePatterns(candles).engulfBear;
      break;
    case "ma_rating":
      series = maRating(candles);
      break;
    case "osc_rating":
      series = oscRating(candles);
      break;
    case "adx":
      series = adx(candles, 14).adx;
      break;
    case "plus_di":
      series = adx(candles, 14).plusDI;
      break;
    case "minus_di":
      series = adx(candles, 14).minusDI;
      break;
    case "aroon_up":
      series = aroon(candles, 14).up;
      break;
    case "aroon_down":
      series = aroon(candles, 14).down;
      break;
    case "aroon_osc":
      series = aroon(candles, 14).osc;
      break;
    case "jurik_stoch_k":
      series = jurikStoch(candles).k;
      break;
    case "jurik_stoch_d":
      series = jurikStoch(candles).d;
      break;
    case "jurik_kase_k":
      series = jurikKaseStoch(candles).k;
      break;
    case "jurik_kase_d":
      series = jurikKaseStoch(candles).d;
      break;
    default:
      series = fillNull(n);
  }

  map.set(field, series);
  return series;
}

export function priceSeriesFromCandles(candles: Candle[]): (number | null)[] {
  return closes(candles);
}

export function constValueSeries(
  length: number,
  value: number
): (number | null)[] {
  return constSeries(length, value);
}
