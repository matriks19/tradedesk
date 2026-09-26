/**
 * CMO — Chande Momentum Oscillator (TradingView ta.cmo):
 *   mom = close − close[1]
 *   sm1 = Σ_len max(mom, 0), sm2 = Σ_len max(−mom, 0)
 *   CMO = 100 · (sm1 − sm2) / (sm1 + sm2)
 * Paydanın sıfır olduğu (tamamen yatay) pencerede TV `na` üretir; burada 0
 * (TA-Lib gibi) — aralık [−100, 100]. İlk değer `length` indeksinde.
 */
import type { Candle } from "@/lib/types";

export type CmoCond = "cmo_up_lo" | "cmo_dn_hi" | "cmo_zero_up" | "cmo_zero_dn";

export const ALL_CMO_CONDS: CmoCond[] = ["cmo_up_lo", "cmo_dn_hi", "cmo_zero_up", "cmo_zero_dn"];
export const DEFAULT_CMO_CONDS: CmoCond[] = ["cmo_up_lo", "cmo_dn_hi"];
export const CMO_BEAR_CONDS = new Set<CmoCond>(["cmo_dn_hi", "cmo_zero_dn"]);

export const CMO_DEFAULTS = { length: 9, lower: -50, upper: 75 };
export const CMO_MIN_BARS = 30;
export const CMO_FETCH_LIMIT = 150;

export function cmoCondLabel(cond: CmoCond, lower = CMO_DEFAULTS.lower, upper = CMO_DEFAULTS.upper): string {
  if (cond === "cmo_up_lo") return `CMO ${fmtLvl(lower)}↑`;
  if (cond === "cmo_dn_hi") return `CMO ${fmtLvl(upper)}↓`;
  if (cond === "cmo_zero_up") return "CMO 0↑";
  return "CMO 0↓";
}
const fmtLvl = (v: number) => (v < 0 ? `−${Math.abs(v)}` : String(v));

/** Pencere toplamları her mumda doğrudan (O(n·len), len küçük) — kayan-toplam hatası yok. */
export function computeCmo(close: number[], length = CMO_DEFAULTS.length): (number | null)[] {
  const n = close.length;
  const L = Math.max(1, Math.floor(length));
  const out: (number | null)[] = new Array(n).fill(null);
  for (let i = L; i < n; i++) {
    let up = 0;
    let dn = 0;
    for (let j = i - L + 1; j <= i; j++) {
      const m = close[j]! - close[j - 1]!;
      if (m >= 0) up += m;
      else dn -= m;
    }
    const den = up + dn;
    out[i] = den > 0 ? (100 * (up - dn)) / den : 0;
  }
  return out;
}

export type CmoOpts = { length?: number; lower?: number; upper?: number };

/** Kesişim: önceki ≤ seviye < şimdiki (yukarı) / önceki ≥ seviye > şimdiki (aşağı). */
export function cmoCrossAt(v: (number | null)[], i: number, level: number, dir: "up" | "down"): boolean {
  if (i < 1) return false;
  const a = v[i - 1];
  const b = v[i];
  if (a == null || b == null) return false;
  return dir === "up" ? a <= level && b > level : a >= level && b < level;
}

export type CmoHit = { cond: CmoCond; barsAgo: number; note: string; value: number };

export function cmoScan(candles: Candle[], conds: CmoCond[], maxBarsAgo: number, opts: CmoOpts = {}): CmoHit[] {
  const length = opts.length ?? CMO_DEFAULTS.length;
  const lower = opts.lower ?? CMO_DEFAULTS.lower;
  const upper = opts.upper ?? CMO_DEFAULTS.upper;
  if (candles.length < Math.max(length + 2, 12) || !conds.length) return [];
  const v = computeCmo(candles.map((c) => c.close), length);
  const last = candles.length - 1;
  const spec: Record<CmoCond, [number, "up" | "down"]> = {
    cmo_up_lo: [lower, "up"],
    cmo_dn_hi: [upper, "down"],
    cmo_zero_up: [0, "up"],
    cmo_zero_dn: [0, "down"],
  };
  const out: CmoHit[] = [];
  for (const cond of conds) {
    const [lvl, dir] = spec[cond];
    for (let ago = 0; ago <= maxBarsAgo; ago++) {
      const i = last - ago;
      if (i < 1) break;
      if (!cmoCrossAt(v, i, lvl, dir)) continue;
      const val = v[i]!;
      out.push({
        cond,
        barsAgo: ago,
        value: val,
        note: `${cmoCondLabel(cond, lower, upper)} (${Math.round(val)}, len ${length}) (−${ago})`,
      });
      break;
    }
  }
  return out;
}
