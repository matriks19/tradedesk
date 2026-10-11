/**
 * ELIZI-LDR4 Ladder — Liste Tarama / grafik bağdaştırıcısı.
 * Matematik: ./eliziLdr4Core (kullanıcının "Elizi Ladder v4" Pine v6 stratejisinin gösterge çekirdeği; QUANTEX T28 ile aynı modül).
 * Sinyaller yalnız KAPANMIŞ mumlarda: son mum hâlâ açıksa (zaman + mum süresi > şimdi) hesaba katılmaz.
 * barsAgo, verilen mum dizisinin son elemanına göre ölçülür (diğer liste türleriyle ve trend filtresiyle aynı indeks);
 * açık mum varsa son kapanmış mumdaki sinyal barsAgo = 1 olur.
 */
import type { Candle } from "@/lib/types";
import { eld4Calc, eld4Need, eld4Opts, ELD4_DEFAULTS, ELD4_ST_MODES, type Eld4Opts, type Eld4Result } from "./eliziLdr4Core";

export { ELD4_DEFAULTS, ELD4_ST_MODES, eld4Calc, eld4Opts, type Eld4Opts, type Eld4Result };

export type EliziLdr4Cond = "eld_ana_al" | "eld_ana_sat" | "eld_erken_al" | "eld_erken_sat";
export const ALL_ELIZI_LDR4_CONDS: EliziLdr4Cond[] = ["eld_ana_al", "eld_ana_sat", "eld_erken_al", "eld_erken_sat"];
export const DEFAULT_ELIZI_LDR4_CONDS: EliziLdr4Cond[] = [...ALL_ELIZI_LDR4_CONDS];
export const ELIZI_LDR4_BEAR_CONDS = new Set<EliziLdr4Cond>(["eld_ana_sat", "eld_erken_sat"]);
export const ELIZI_LDR4_COND_LABEL: Record<EliziLdr4Cond, string> = {
  eld_ana_al: "Ana AL",
  eld_ana_sat: "Ana SAT",
  eld_erken_al: "Erken AL",
  eld_erken_sat: "Erken SAT",
};
const EV_KEY: Record<EliziLdr4Cond, keyof Eld4Result["ev"]> = {
  eld_ana_al: "anaAl",
  eld_ana_sat: "anaSat",
  eld_erken_al: "erkenAl",
  eld_erken_sat: "erkenSat",
};
/** Liste taramasında ayarlanabilen gösterge girdileri (Pine adlarıyla) */
export type EliziLdr4Params = Partial<Omit<Eld4Opts, "mintick">>;
export const ELIZI_LDR4_DEFAULTS = {
  uniSmooth: ELD4_DEFAULTS.uniSmooth,
  sigLen: ELD4_DEFAULTS.sigLen,
  slowLen: ELD4_DEFAULTS.slowLen,
  L: ELD4_DEFAULTS.L,
  stMode: ELD4_DEFAULTS.stMode,
  earlySrc: ELD4_DEFAULTS.earlySrc,
  useGate: ELD4_DEFAULTS.useGate,
};
/** Gerekli kapalı mum (ısınma) */
export const ELIZI_LDR4_MIN_BARS = eld4Need(ELD4_DEFAULTS);
export const ELIZI_LDR4_FETCH_LIMIT = 500;
export function eliziLdr4MinBars(p?: EliziLdr4Params | null): number {
  return eld4Need(eld4Opts(p ?? {}));
}
export function eliziLdr4FetchLimit(p?: EliziLdr4Params | null): number {
  return Math.min(1000, Math.max(ELIZI_LDR4_FETCH_LIMIT, eliziLdr4MinBars(p) + 120));
}

/** BIST (fiyat adımı 0.01) için mintick; kripto için borsa tick'i bilinmiyorsa 1e-8 */
export function eliziLdr4Mintick(exchange?: string | null): number {
  const ex = String(exchange || "").toLowerCase();
  return ex === "bist" || ex === "yahoo" || ex === "is" ? 0.01 : 1e-8;
}

/** Son kapanmış mumun indeksi (son mum açıksa n-2) */
export function lastClosedIndex(candles: Candle[], nowMs = Date.now()): number {
  const n = candles.length;
  if (n < 2) return n - 1;
  const dur = candles[n - 1]!.time - candles[n - 2]!.time;
  if (dur > 0 && (candles[n - 1]!.time + dur) * 1000 > nowMs) return n - 2;
  return n - 1;
}

export function computeEliziLdr4(candles: Candle[], p?: EliziLdr4Params | null, mintick = 1e-8): Eld4Result {
  return eld4Calc(
    {
      o: candles.map((c) => c.open),
      h: candles.map((c) => c.high),
      l: candles.map((c) => c.low),
      c: candles.map((c) => c.close),
      v: candles.map((c) => (Number.isFinite(c.volume) ? c.volume : 0)),
    },
    { ...(p ?? {}), mintick }
  );
}

export type EliziLdr4Hit = { cond: EliziLdr4Cond; barsAgo: number; note: string };

export function eliziLdr4Scan(
  candles: Candle[],
  conds: EliziLdr4Cond[],
  maxBarsAgo: number,
  p?: EliziLdr4Params | null,
  opts: { mintick?: number; nowMs?: number } = {}
): EliziLdr4Hit[] {
  if (!conds.length) return [];
  const lc = lastClosedIndex(candles, opts.nowMs);
  const closed = candles.slice(0, lc + 1);
  const R = computeEliziLdr4(closed, p, opts.mintick ?? 1e-8);
  if (closed.length < R.need) return [];
  const last = candles.length - 1;
  const out: EliziLdr4Hit[] = [];
  for (const cond of conds) {
    const ev = R.ev[EV_KEY[cond]];
    for (let i = lc; i >= 0 && last - i <= maxBarsAgo; i--) {
      if (!ev[i]) continue;
      const ago = last - i;
      out.push({
        cond,
        barsAgo: ago,
        note: `LDR4 ${ELIZI_LDR4_COND_LABEL[cond]} · hızlı ${R.uniSig[i]!.toFixed(1)} / yavaş ${R.slowSig[i]!.toFixed(1)} (−${ago})`,
      });
      break;
    }
  }
  return out;
}
