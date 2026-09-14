/**
 * Locked TradeDesk Futures risk plan.
 * Do not change defaults without an explicit product decision.
 *
 * E=500, riskPct=1%, reserve=50% → margin 5, maxSlots 50, notional 25 (NOT 250 slots).
 */

export type RiskPlan = {
  equity: number;
  riskPct: number;
  reservePct: number;
  leverage: number;
  takeProfitRoePct: number;
  deployable: number;
  marginPerSlot: number;
  maxSlots: number;
  notionalPerSlot: number;
};

export const DEFAULT_RESERVE_PCT = 0.5;
export const DEFAULT_LEVERAGE = 5;
export const DEFAULT_TP_ROE_PCT = 0.1;
export const ALLOWED_RISK_PCTS = [0.01, 0.02] as const;

export function computeRiskPlan(
  equity: number,
  riskPct: number,
  opts?: {
    reservePct?: number;
    leverage?: number;
    takeProfitRoePct?: number;
  }
): RiskPlan {
  const E = Math.max(0, Number.isFinite(equity) ? equity : 0);
  const rp = ALLOWED_RISK_PCTS.includes(riskPct as 0.01 | 0.02)
    ? riskPct
    : 0.01;
  const reservePct = opts?.reservePct ?? DEFAULT_RESERVE_PCT;
  const leverage = opts?.leverage ?? DEFAULT_LEVERAGE;
  const takeProfitRoePct = opts?.takeProfitRoePct ?? DEFAULT_TP_ROE_PCT;
  const deployable = E * (1 - reservePct);
  const marginPerSlot = E * rp;
  const maxSlots =
    marginPerSlot > 0 ? Math.floor(deployable / marginPerSlot) : 0;
  const notionalPerSlot = marginPerSlot * leverage;
  return {
    equity: E,
    riskPct: rp,
    reservePct,
    leverage,
    takeProfitRoePct,
    deployable,
    marginPerSlot,
    maxSlots,
    notionalPerSlot,
  };
}

/** Qty from notional / price, floored to stepSize. */
export function qtyFromNotional(
  notional: number,
  price: number,
  stepSize: number,
  minQty: number
): number {
  if (!(notional > 0) || !(price > 0) || !(stepSize > 0)) return 0;
  const raw = notional / price;
  const steps = Math.floor(raw / stepSize);
  const q = steps * stepSize;
  if (q < minQty) return 0;
  // avoid float dust
  const decimals = Math.max(0, (String(stepSize).split(".")[1] || "").length);
  return Number(q.toFixed(decimals));
}

export function roePct(unrealizedPnl: number, initialMargin: number): number {
  if (!(initialMargin > 0)) return 0;
  return unrealizedPnl / initialMargin;
}

/** Approx price move % that yields target ROE at given leverage. */
export function priceMoveForRoe(roePct: number, leverage: number): number {
  if (!(leverage > 0)) return 0;
  return roePct / leverage;
}
