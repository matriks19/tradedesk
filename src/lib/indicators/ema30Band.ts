/**
 * EMA30 Band Kırılım — Liste Tarama / grafik bağdaştırıcısı.
 * Matematik: ./ema30BandCore (kullanıcının Pine v6 göstergesi birebir; QUANTEX T29 ile aynı modül).
 * Sinyaller yalnız KAPANMIŞ mumlarda (son mum hâlâ açıksa dışarıda bırakılır). barsAgo, verilen dizinin son
 * elemanına göre ölçülür (diğer liste türleri / trend filtresiyle aynı indeks).
 * Not: lastDir / prevPeak / prevTrough durumu geçmişin başlangıcına bağlıdır → 1000 mum çekilir.
 */
import type { Candle } from "@/lib/types";
import { e30Calc, e30Need, e30Opts, E30_DEFAULTS, type E30Opts, type E30Result } from "./ema30BandCore";
import { lastClosedIndex } from "./eliziLdr4";
import { EMA30_BAND_FETCH_LIMIT } from "./ema30BandLimits";

export { E30_DEFAULTS, e30Calc, e30Opts, type E30Opts, type E30Result, EMA30_BAND_FETCH_LIMIT };

export type Ema30BandCond =
  | "e30_long"
  | "e30_short"
  | "e30_brk_long"
  | "e30_brk_short"
  | "e30_rev_long"
  | "e30_rev_short"
  | "e30_zone_up"
  | "e30_zone_mid"
  | "e30_zone_down";
export const ALL_EMA30_BAND_CONDS: Ema30BandCond[] = [
  "e30_long", "e30_short", "e30_brk_long", "e30_brk_short", "e30_rev_long", "e30_rev_short", "e30_zone_up", "e30_zone_mid", "e30_zone_down",
];
export const DEFAULT_EMA30_BAND_CONDS: Ema30BandCond[] = ["e30_long", "e30_short"];
export const EMA30_BAND_BEAR_CONDS = new Set<Ema30BandCond>(["e30_short", "e30_brk_short", "e30_rev_short", "e30_zone_down"]);
export const EMA30_BAND_COND_LABEL: Record<Ema30BandCond, string> = {
  e30_long: "LONG",
  e30_short: "SHORT",
  e30_brk_long: "Kırılım LONG",
  e30_brk_short: "Kırılım SHORT",
  e30_rev_long: "Ters LONG",
  e30_rev_short: "Ters SHORT",
  e30_zone_up: "Bant üstü",
  e30_zone_mid: "Bant içi",
  e30_zone_down: "Bant altı",
};
const EV_KEY: Partial<Record<Ema30BandCond, keyof E30Result["ev"]>> = {
  e30_long: "long", e30_short: "short", e30_brk_long: "brkLong", e30_brk_short: "brkShort", e30_rev_long: "revLong", e30_rev_short: "revShort",
};
const ZONE_OF: Partial<Record<Ema30BandCond, number>> = { e30_zone_up: 1, e30_zone_mid: 0, e30_zone_down: -1 };

export type Ema30BandParams = Partial<E30Opts>;
export function ema30BandMinBars(p?: Ema30BandParams | null): number {
  return e30Need(e30Opts(p ?? {})) + 1;
}

export function computeEma30Band(candles: Candle[], p?: Ema30BandParams | null): E30Result {
  return e30Calc({ h: candles.map((c) => c.high), l: candles.map((c) => c.low), c: candles.map((c) => c.close) }, p ?? {});
}

export type Ema30BandHit = { cond: Ema30BandCond; barsAgo: number; note: string };

export function ema30BandScan(
  candles: Candle[],
  conds: Ema30BandCond[],
  maxBarsAgo: number,
  p?: Ema30BandParams | null,
  opts: { nowMs?: number } = {}
): Ema30BandHit[] {
  if (!conds.length) return [];
  const lc = lastClosedIndex(candles, opts.nowMs);
  const closed = candles.slice(0, lc + 1);
  const R = computeEma30Band(closed, p);
  if (closed.length < R.need) return [];
  const last = candles.length - 1;
  const out: Ema30BandHit[] = [];
  const fmt = (v: number) => (Number.isFinite(v) ? (Math.abs(v) >= 100 ? v.toFixed(2) : v.toPrecision(5)) : "—");
  for (const cond of conds) {
    const z = ZONE_OF[cond];
    if (z !== undefined) {
      // durum çipi: son kapanmış mum seçilen bölgede
      if (R.zone[lc] === z && last - lc <= maxBarsAgo) {
        out.push({ cond, barsAgo: last - lc, note: `E30 ${EMA30_BAND_COND_LABEL[cond]} (emaH ${fmt(R.emaH[lc]!)} / emaL ${fmt(R.emaL[lc]!)})` });
      }
      continue;
    }
    const ev = R.ev[EV_KEY[cond]!];
    for (let i = lc; i >= 0 && last - i <= maxBarsAgo; i--) {
      if (!ev[i]) continue;
      const ago = last - i;
      const lvl = cond.includes("long") ? R.prevPeak[i]! : R.prevTrough[i]!;
      out.push({ cond, barsAgo: ago, note: `E30 ${EMA30_BAND_COND_LABEL[cond]} · önceki ${cond.includes("long") ? "tepe" : "dip"} ${fmt(lvl)} (−${ago})` });
      break;
    }
  }
  return out;
}
