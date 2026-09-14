import {
  computeRiskPlan,
  qtyFromNotional,
  roePct,
} from "./risk";
import type {
  FuturesBotKeys,
  FuturesBotPrefs,
  PaperPosition,
  PositionSide,
} from "./types";
import {
  fetchLotSize,
  fetchMarkPrice,
  getBalance,
  marketOrder,
  setHedgeMode,
  setLeverage,
  setMarginType,
} from "./binanceFutures";

export type TryOpenArgs = {
  symbol: string;
  positionSide: PositionSide;
  reason?: string;
  /** Override mark for paper */
  price?: number;
};

export type TryOpenResult =
  | { ok: true; paper?: PaperPosition; live?: unknown; planNote: string }
  | { ok: false; error: string };

function normalizeSymbol(sym: string): string {
  return sym.replace(/\.P$/i, "").toUpperCase();
}

export function equityFromPrefs(
  prefs: FuturesBotPrefs,
  liveEquity?: number
): number {
  if (prefs.mode === "live" && liveEquity != null && liveEquity > 0) {
    return liveEquity;
  }
  return prefs.paperEquity;
}

export async function fetchUsdtEquity(
  keys: FuturesBotKeys,
  testnet?: boolean
): Promise<number> {
  const bal = (await getBalance({ keys, testnet })) as {
    asset?: string;
    balance?: string;
    availableBalance?: string;
  }[];
  const usdt = Array.isArray(bal)
    ? bal.find((b) => b.asset === "USDT")
    : null;
  return Number(usdt?.balance ?? 0);
}

export function canOpenSlot(
  prefs: FuturesBotPrefs,
  openCount: number,
  equity: number
): { ok: true; plan: ReturnType<typeof computeRiskPlan> } | { ok: false; error: string } {
  const plan = computeRiskPlan(equity, prefs.riskPct, {
    reservePct: prefs.reservePct,
    leverage: prefs.leverage,
    takeProfitRoePct: prefs.takeProfitRoePct,
  });
  if (!prefs.enabled) return { ok: false, error: "Bot kapalı" };
  if (plan.maxSlots < 1) return { ok: false, error: "Equity / risk yetersiz" };
  if (openCount >= plan.maxSlots) {
    return {
      ok: false,
      error: `Max slot dolu (${plan.maxSlots})`,
    };
  }
  return { ok: true, plan };
}

export async function tryOpen(
  prefs: FuturesBotPrefs,
  keys: FuturesBotKeys,
  paperPositions: PaperPosition[],
  args: TryOpenArgs
): Promise<TryOpenResult> {
  const symbol = normalizeSymbol(args.symbol);
  const equity = equityFromPrefs(prefs);
  const gate = canOpenSlot(prefs, paperPositions.length, equity);
  if (!gate.ok) return gate;
  const { plan } = gate;

  let price = args.price;
  if (price == null || !(price > 0)) {
    try {
      price = await fetchMarkPrice(symbol, prefs.testnet);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "fiyat alınamadı",
      };
    }
  }

  const lot = await fetchLotSize(symbol, prefs.testnet).catch(() => ({
    stepSize: 0.001,
    minQty: 0.001,
  }));
  const qty = qtyFromNotional(
    plan.notionalPerSlot,
    price,
    lot.stepSize,
    lot.minQty
  );
  if (!(qty > 0)) {
    return { ok: false, error: "qty min lot altında — equity veya sembol step" };
  }

  const planNote = `margin ${plan.marginPerSlot.toFixed(2)} · ${plan.leverage}x · notional ${plan.notionalPerSlot.toFixed(2)} · qty ${qty}`;

  if (prefs.mode === "paper") {
    const pos: PaperPosition = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      symbol,
      positionSide: args.positionSide,
      qty,
      entryPrice: price,
      margin: plan.marginPerSlot,
      leverage: plan.leverage,
      openedAt: Date.now(),
      reason: args.reason,
      markPrice: price,
    };
    return { ok: true, paper: pos, planNote };
  }

  if (!keys.apiKey || !keys.apiSecret) {
    return { ok: false, error: "Live için API key gerekli" };
  }
  const client = { keys, testnet: prefs.testnet };
  try {
    if (prefs.hedgeMode) await setHedgeMode(client, true);
    await setLeverage(client, symbol, prefs.leverage);
    try {
      await setMarginType(client, symbol, prefs.marginType);
    } catch {
      /* already set */
    }
    const side = args.positionSide === "LONG" ? "BUY" : "SELL";
    const live = await marketOrder(client, {
      symbol,
      side,
      positionSide: args.positionSide,
      quantity: qty,
    });
    return { ok: true, live, planNote };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "emir hatası" };
  }
}

export function paperUnrealized(
  pos: PaperPosition,
  mark: number
): { pnl: number; roe: number } {
  const dir = pos.positionSide === "LONG" ? 1 : -1;
  const pnl = (mark - pos.entryPrice) * pos.qty * dir;
  return { pnl, roe: roePct(pnl, pos.margin) };
}

export async function tryClosePaperByTp(
  prefs: FuturesBotPrefs,
  positions: PaperPosition[],
  marks: Record<string, number>
): Promise<{ closed: PaperPosition[]; kept: PaperPosition[] }> {
  const closed: PaperPosition[] = [];
  const kept: PaperPosition[] = [];
  for (const p of positions) {
    const mark = marks[p.symbol] ?? p.markPrice ?? p.entryPrice;
    const { roe } = paperUnrealized(p, mark);
    if (roe >= prefs.takeProfitRoePct) closed.push({ ...p, markPrice: mark });
    else kept.push({ ...p, markPrice: mark });
  }
  return { closed, kept };
}

export async function tryCloseLiveByTp(
  prefs: FuturesBotPrefs,
  keys: FuturesBotKeys
): Promise<{ closed: string[]; errors: string[] }> {
  if (prefs.mode !== "live" || !keys.apiKey) {
    return { closed: [], errors: [] };
  }
  const client = { keys, testnet: prefs.testnet };
  const rows = (await import("./binanceFutures").then((m) =>
    m.getPositionRisk(client)
  )) as {
    symbol: string;
    positionSide: string;
    positionAmt: string;
    entryPrice: string;
    unRealizedProfit: string;
    isolatedMargin?: string;
    initialMargin?: string;
    leverage?: string;
  }[];
  const closed: string[] = [];
  const errors: string[] = [];
  for (const r of rows ?? []) {
    const amt = Math.abs(Number(r.positionAmt));
    if (!(amt > 0)) continue;
    const side = (r.positionSide === "SHORT" ? "SHORT" : "LONG") as PositionSide;
    const margin =
      Number(r.isolatedMargin || r.initialMargin || 0) ||
      (Number(r.entryPrice) * amt) / (Number(r.leverage) || prefs.leverage);
    const pnl = Number(r.unRealizedProfit || 0);
    if (roePct(pnl, margin) < prefs.takeProfitRoePct) continue;
    try {
      const closeSide = side === "LONG" ? "SELL" : "BUY";
      await marketOrder(client, {
        symbol: r.symbol,
        side: closeSide,
        positionSide: side,
        quantity: amt,
        reduceOnly: true,
      });
      closed.push(`${r.symbol} ${side}`);
    } catch (e) {
      errors.push(
        `${r.symbol}: ${e instanceof Error ? e.message : "close fail"}`
      );
    }
  }
  return { closed, errors };
}
