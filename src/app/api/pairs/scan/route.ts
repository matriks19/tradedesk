import { NextRequest, NextResponse } from "next/server";
import { BistProvider, BIST30 } from "@/lib/data/bist";
import {
  computePairHealth,
  syntheticIndexFromCloses,
  toScanRow,
  pairCombinations,
  type ClosePoint,
  type PairScanRow,
} from "@/lib/pairs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  mode?: "vs_index" | "pairs";
  index?: string;
  symbols?: string[];
  timeframe?: string;
  limit?: number;
  maxPairs?: number;
};

async function mapPoolLocal<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

async function fetchCloses(
  symbol: string,
  timeframe: string,
  limit: number
): Promise<ClosePoint[]> {
  try {
    const { candles } = await BistProvider.getKlines(symbol, timeframe, limit);
    return (candles ?? [])
      .filter((c) => c.close > 0)
      .map((c) => ({ time: c.time, close: c.close }));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const mode = body.mode ?? "vs_index";
  const timeframe = body.timeframe ?? "1d";
  const limit = Math.min(400, Math.max(80, body.limit ?? 250));
  const maxPairs = Math.min(80, Math.max(5, body.maxPairs ?? 40));
  const symbols = (body.symbols?.length ? body.symbols : BIST30).map((s) =>
    s.toUpperCase()
  );
  const indexSym = (body.index ?? "XU100").toUpperCase();

  const notes: string[] = [];

  const stockSeries = await mapPoolLocal(symbols, 3, async (sym) => {
    const closes = await fetchCloses(sym, timeframe, limit);
    return { sym, closes };
  });
  const bySym = new Map<string, ClosePoint[]>();
  for (const s of stockSeries) {
    if (s.closes.length >= 40) bySym.set(s.sym, s.closes);
  }

  if (bySym.size < 2) {
    return NextResponse.json(
      {
        error: "Yetersiz BIST kline verisi",
        notes: ["Yahoo gecikmeli / rate-limit olabilir"],
        rows: [],
      },
      { status: 502 }
    );
  }

  let indexCloses: ClosePoint[] = [];
  let indexLabel = indexSym;

  if (mode === "vs_index") {
    indexCloses = await fetchCloses(indexSym, timeframe, limit);
    if (indexCloses.length < 40 && indexSym !== "XU030") {
      const alt = await fetchCloses("XU030", timeframe, limit);
      if (alt.length >= 40) {
        indexCloses = alt;
        indexLabel = "XU030";
        notes.push("XU100 başarısız → XU030 kullanıldı");
      }
    }
    if (indexCloses.length < 40) {
      indexCloses = syntheticIndexFromCloses([...bySym.values()]);
      indexLabel = "SYN_BIST30";
      notes.push(
        `${indexSym} yok → BIST30 eşit ağırlıklı sentetik endeks (SYN_BIST30)`
      );
    }
  }

  const rows: PairScanRow[] = [];

  if (mode === "vs_index") {
    const note = notes[0];
    for (const [sym, closes] of bySym) {
      const r = computePairHealth(sym, indexLabel, closes, indexCloses, {}, note);
      if (r) rows.push(toScanRow(r));
    }
  } else {
    const syms = [...bySym.keys()];
    const scored: { row: PairScanRow; absCorr: number }[] = [];
    for (const [a, b] of pairCombinations(syms)) {
      const r = computePairHealth(a, b, bySym.get(a)!, bySym.get(b)!);
      if (!r) continue;
      scored.push({ row: toScanRow(r), absCorr: Math.abs(r.corr60) || 0 });
    }
    scored.sort((x, y) => y.absCorr - x.absCorr);
    const top = scored
      .slice(0, Math.max(maxPairs * 2, maxPairs))
      .sort((x, y) => y.row.healthScore - x.row.healthScore)
      .slice(0, maxPairs);
    for (const t of top) rows.push(t.row);
  }

  rows.sort((a, b) => b.healthScore - a.healthScore);

  return NextResponse.json({
    mode,
    index: mode === "vs_index" ? indexLabel : undefined,
    timeframe,
    limit,
    notes,
    fetched: bySym.size,
    rows,
  });
}
