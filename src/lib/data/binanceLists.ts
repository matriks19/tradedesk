/**
 * Binance USDT-M lists: AI ranking + full-perp helpers.
 * Live exchangeInfo is preferred; FALLBACK_USDT_PERPS is the offline snapshot.
 */
import { FALLBACK_USDT_PERPS } from "@/lib/data/binancePerpSnapshot";
import {
  TRADFI_USDT_PERPS,
  TRADFI_COMMODITY_BASES,
  TRADFI_ETF_BASES,
} from "@/lib/data/binanceTradfiSnapshot";
import type { Watchlist } from "@/lib/types";

/** AI / agent names first — AIO, AIOT, then other AI tickers. */
export const AI_PERP_PRIORITY = [
  "AIO",
  "AIOT",
  "AIXBT",
  "AIA",
  "AIN",
  "COAI",
  "UAI",
  "XAI",
  "SKYAI",
  "BLUAI",
  "AVAAI",
  "AIGENSYN",
  "FET",
  "TAO",
  "WLD",
  "RENDER",
  "VIRTUAL",
  "IO",
  "ARKM",
  "CGPT",
  "NMR",
  "RLC",
  "GLM",
  "ATH",
  "AKT",
  "KAITO",
  "COOKIE",
  "PROMPT",
  "ARC",
  "SWARMS",
  "ZEREBRO",
  "GRIFFAIN",
  "BIO",
] as const;

const AI_FALSE_POSITIVE = new Set(["TAIKO", "KAIA", "DATAIP"]);

export function perpBase(sym: string): string {
  return sym
    .trim()
    .toUpperCase()
    .replace(/\.P$/i, "")
    .replace(/USDT$/i, "");
}

export function toPerpDisplay(sym: string): string {
  const u = sym.trim().toUpperCase();
  if (/\.P$/i.test(u)) return u;
  if (u.endsWith("USDT")) return `${u}.P`;
  return `${u}USDT.P`;
}

/** Lower is better. < 900 = AI-themed. */
export function aiRank(sym: string): number {
  const b = perpBase(sym);
  const i = (AI_PERP_PRIORITY as readonly string[]).indexOf(b);
  if (i >= 0) return i;
  if (!AI_FALSE_POSITIVE.has(b) && b.includes("AI")) return 80 + b.length;
  return 999;
}

export function isAiPerp(sym: string): boolean {
  return aiRank(sym) < 900;
}

export function sortPerpsAiFirst(syms: string[]): string[] {
  return [...syms].sort((a, b) => {
    const d = aiRank(a) - aiRank(b);
    if (d !== 0) return d;
    const ap = /\.P$/i.test(a) ? 0 : 1;
    const bp = /\.P$/i.test(b) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.localeCompare(b);
  });
}

export function fallbackUsdtPerps(): string[] {
  return FALLBACK_USDT_PERPS.map(toPerpDisplay);
}

export function fallbackAiPerps(): string[] {
  return sortPerpsAiFirst(fallbackUsdtPerps().filter(isAiPerp));
}

export function binancePerpWatchlistMeta(): Array<{
  id: string;
  name: string;
  symbols: string[];
}> {
  const all = sortPerpsAiFirst(fallbackUsdtPerps());
  return [
    { id: "binance-ai-usdt", name: "BN AI · USDT.P", symbols: all.filter(isAiPerp) },
    { id: "binance-perp-usdt", name: "BN Perp · USDT.P", symbols: all },
  ];
}

/**
 * Binance TRADIFI_PERPETUAL (hisse/ETF/emtia/FX) listeleri — yalnızca Liste
 * tarama evren seçicisinde; izleme listelerine otomatik eklenmez.
 */
export function binanceTradfiWatchlistMeta(): Array<{
  id: string;
  name: string;
  symbols: string[];
}> {
  const tf = [...TRADFI_USDT_PERPS].sort((a, b) => a.localeCompare(b));
  const comm = tf.filter((s) => TRADFI_COMMODITY_BASES.has(perpBase(s)));
  const etf = tf.filter((s) => TRADFI_ETF_BASES.has(perpBase(s)));
  const stocks = tf.filter(
    (s) => !TRADFI_COMMODITY_BASES.has(perpBase(s)) && !TRADFI_ETF_BASES.has(perpBase(s))
  );
  const crypto = sortPerpsAiFirst(fallbackUsdtPerps());
  return [
    { id: "binance-tradfi-usdt", name: "BN TradFi · Tümü", symbols: tf },
    { id: "binance-tradfi-stocks", name: "BN TradFi · Hisse/Pre-IPO", symbols: stocks },
    { id: "binance-tradfi-etf", name: "BN TradFi · ETF/Endeks", symbols: etf },
    { id: "binance-tradfi-comm", name: "BN TradFi · Emtia/FX", symbols: comm },
    {
      id: PERP_ALL_ID,
      name: PERP_ALL_NAME,
      symbols: [...crypto, ...tf],
    },
  ];
}

/** Varsayılan kripto evreni: 528 PERPETUAL + 199 TRADIFI_PERPETUAL = 727 */
export const PERP_ALL_ID = "binance-perp-all-usdt";
export const PERP_ALL_NAME = "BN Perp · Tümü (kripto + TradFi)";
export const PERP_CRYPTO_NAME = "BN Perp · yalnız kripto";

const TRADFI_DISPLAY = new Set(TRADFI_USDT_PERPS);
/** TradFi perp mi (snapshot; canlı listede SymbolInfo.name = "TRADFI PERP") */
export function isTradfiPerp(sym: string): boolean {
  return TRADFI_DISPLAY.has(toPerpDisplay(sym));
}

export function mergeBinanceWatchlists(watchlists: Watchlist[]): Watchlist[] {
  const next = [...watchlists];
  for (const m of binancePerpWatchlistMeta()) {
    const mapped = m.symbols.map((symbol) => ({
      symbol,
      exchange: "binance" as const,
    }));
    const i = next.findIndex((w) => w.id === m.id);
    if (i < 0) {
      next.push({ id: m.id, name: m.name, symbols: mapped });
    } else if (next[i].symbols.length < mapped.length) {
      next[i] = { ...next[i], name: m.name, symbols: mapped };
    }
  }
  return next;
}
