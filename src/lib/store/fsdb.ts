import { promises as fs } from "fs";
import path from "path";
import type { CustomScript, StoredLayout, Watchlist } from "@/lib/types";
import { SAMPLE_SCRIPTS } from "@/lib/scripts/sandbox";
import { getPopularSeedScripts } from "@/lib/scripts/catalog";
import type { ScannerFilter } from "@/lib/scanner/engine";
import { mergeBinanceWatchlists } from "@/lib/data/binanceLists";

/** Vercel serverless FS is read-only except /tmp. */
const IS_VERCEL = Boolean(process.env.VERCEL);
const DATA_DIR = IS_VERCEL ? "/tmp" : path.join(process.cwd(), "data");
const STORE_FILE = IS_VERCEL
  ? "/tmp/tradedesk-store.json"
  : path.join(DATA_DIR, "store.json");

export interface SavedScanPreset {
  id: string;
  name: string;
  filters: ScannerFilter[];
  exchange?: string;
  timeframe?: string;
  updatedAt: number;
}

export interface AppDb {
  watchlists: Watchlist[];
  scripts: CustomScript[];
  layout: StoredLayout | null;
  scanPresets?: SavedScanPreset[];
}

const DEFAULT_DB: AppDb = {
  watchlists: [
    {
      id: "crypto-majors",
      name: "Crypto Majors",
      symbols: [
        { symbol: "BTCUSDT", exchange: "binance" },
        { symbol: "ETHUSDT", exchange: "binance" },
        { symbol: "BNBUSDT", exchange: "binance" },
        { symbol: "SOLUSDT", exchange: "binance" },
        { symbol: "XRPUSDT", exchange: "binance" },
        { symbol: "ADAUSDT", exchange: "binance" },
        { symbol: "DOGEUSDT", exchange: "binance" },
        { symbol: "AVAXUSDT", exchange: "binance" },
        { symbol: "DOTUSDT", exchange: "binance" },
        { symbol: "LINKUSDT", exchange: "binance" },
      ],
    },
    {
      id: "bist30",
      name: "BIST30",
      symbols: [
        { symbol: "THYAO", exchange: "bist" },
        { symbol: "GARAN", exchange: "bist" },
        { symbol: "AKBNK", exchange: "bist" },
        { symbol: "YKBNK", exchange: "bist" },
        { symbol: "EREGL", exchange: "bist" },
        { symbol: "SISE", exchange: "bist" },
        { symbol: "KCHOL", exchange: "bist" },
        { symbol: "SAHOL", exchange: "bist" },
        { symbol: "TUPRS", exchange: "bist" },
        { symbol: "ASELS", exchange: "bist" },
        { symbol: "BIMAS", exchange: "bist" },
        { symbol: "TOASO", exchange: "bist" },
        { symbol: "FROTO", exchange: "bist" },
        { symbol: "TCELL", exchange: "bist" },
        { symbol: "PGSUS", exchange: "bist" },
        { symbol: "HEKTS", exchange: "bist" },
        { symbol: "SASA", exchange: "bist" },
        { symbol: "KOZAL", exchange: "bist" },
        { symbol: "PETKM", exchange: "bist" },
        { symbol: "ISCTR", exchange: "bist" },
        { symbol: "HALKB", exchange: "bist" },
        { symbol: "VAKBN", exchange: "bist" },
        { symbol: "ENKAI", exchange: "bist" },
        { symbol: "TAVHL", exchange: "bist" },
        { symbol: "ARCLK", exchange: "bist" },
        { symbol: "EKGYO", exchange: "bist" },
        { symbol: "GUBRF", exchange: "bist" },
        { symbol: "ULKER", exchange: "bist" },
        { symbol: "MGROS", exchange: "bist" },
        { symbol: "TTKOM", exchange: "bist" },
      ],
    },
  ],
  scripts: [
    ...getPopularSeedScripts(),
    ...SAMPLE_SCRIPTS.map((s, i) => ({
      id: `sample-${i + 1}`,
      name: s.name,
      code: s.code,
      language: "td" as const,
      updatedAt: Date.now(),
    })),
  ],
  layout: null,
  scanPresets: [],
};

/** Module-level cache for Vercel /tmp failures or cold paths — never throws. */
let memoryCache: AppDb | null = null;

export function getFallbackDb(): AppDb {
  const base = memoryCache ?? DEFAULT_DB;
  return {
    ...base,
    watchlists: mergeBinanceWatchlists(base.watchlists ?? []),
  };
}

function withMergedWatchlists(db: AppDb): AppDb {
  const watchlists = mergeBinanceWatchlists(db.watchlists ?? []);
  return { ...db, watchlists };
}

async function tryEnsureFile(): Promise<string | null> {
  try {
    if (!IS_VERCEL) {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
    try {
      await fs.access(STORE_FILE);
    } catch {
      const initial = memoryCache ?? withMergedWatchlists(DEFAULT_DB);
      await fs.writeFile(STORE_FILE, JSON.stringify(initial, null, 2), "utf8");
      memoryCache = initial;
    }
    return STORE_FILE;
  } catch {
    return null;
  }
}

async function tryWriteFile(db: AppDb): Promise<boolean> {
  memoryCache = db;
  try {
    const file = await tryEnsureFile();
    if (!file) return false;
    await fs.writeFile(file, JSON.stringify(db, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

export async function readDb(): Promise<AppDb> {
  try {
    const file = await tryEnsureFile();
    if (!file) {
      if (!memoryCache) memoryCache = withMergedWatchlists(DEFAULT_DB);
      return memoryCache;
    }
    const raw = await fs.readFile(file, "utf8");
    const db = JSON.parse(raw) as AppDb;
    const watchlists = mergeBinanceWatchlists(db.watchlists ?? []);
    const next = { ...db, watchlists };

    if (watchlists.length !== (db.watchlists ?? []).length) {
      await tryWriteFile(next);
      return next;
    }
    // also refresh if perp/ai lists are short
    const before = JSON.stringify(
      (db.watchlists ?? []).filter(
        (w) => w.id === "binance-perp-usdt" || w.id === "binance-ai-usdt"
      )
    );
    const after = JSON.stringify(
      watchlists.filter(
        (w) => w.id === "binance-perp-usdt" || w.id === "binance-ai-usdt"
      )
    );
    if (before !== after) {
      await tryWriteFile(next);
      return next;
    }
    memoryCache = next;
    return next;
  } catch {
    if (!memoryCache) memoryCache = withMergedWatchlists(DEFAULT_DB);
    return memoryCache;
  }
}

export async function writeDb(db: AppDb): Promise<void> {
  await tryWriteFile(db);
}

export async function patchDb(patch: Partial<AppDb>): Promise<AppDb> {
  const db = await readDb();
  const next = { ...db, ...patch };
  await writeDb(next);
  return next;
}
