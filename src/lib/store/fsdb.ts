import { promises as fs } from "fs";
import path from "path";
import type { CustomScript, StoredLayout, Watchlist } from "@/lib/types";
import { SAMPLE_SCRIPTS } from "@/lib/scripts/sandbox";

const DATA_DIR = path.join(process.cwd(), "data");

export interface AppDb {
  watchlists: Watchlist[];
  scripts: CustomScript[];
  layout: StoredLayout | null;
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
  scripts: SAMPLE_SCRIPTS.map((s, i) => ({
    id: `sample-${i + 1}`,
    name: s.name,
    code: s.code,
    language: "td" as const,
    updatedAt: Date.now(),
  })),
  layout: null,
};

async function ensure() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, "store.json");
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, JSON.stringify(DEFAULT_DB, null, 2), "utf8");
  }
  return file;
}

export async function readDb(): Promise<AppDb> {
  const file = await ensure();
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as AppDb;
}

export async function writeDb(db: AppDb): Promise<void> {
  const file = await ensure();
  await fs.writeFile(file, JSON.stringify(db, null, 2), "utf8");
}

export async function patchDb(patch: Partial<AppDb>): Promise<AppDb> {
  const db = await readDb();
  const next = { ...db, ...patch };
  await writeDb(next);
  return next;
}
