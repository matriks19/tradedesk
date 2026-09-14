import type { FuturesBotKeys, OrderSide, PositionSide } from "./types";

export type FuturesClientOpts = {
  keys: FuturesBotKeys;
  testnet?: boolean;
};

export function futuresBaseUrl(testnet?: boolean) {
  return testnet
    ? "https://testnet.binancefuture.com"
    : "https://fapi.binance.com";
}

/**
 * Signed Futures request via same-origin proxy (avoids browser CORS on fapi).
 * Secrets travel only in this request body — never stored on the server.
 */
export async function signedFutures(
  opts: FuturesClientOpts,
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Record<string, string | number | boolean> = {}
): Promise<unknown> {
  const res = await fetch("/api/binance/futures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: opts.keys.apiKey,
      apiSecret: opts.keys.apiSecret,
      testnet: !!opts.testnet,
      method,
      path,
      params,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof json?.error === "string"
        ? json.error
        : `futures ${res.status}`
    );
  }
  return json.data;
}

export async function getBalance(opts: FuturesClientOpts) {
  return signedFutures(opts, "GET", "/fapi/v2/balance");
}

export async function getAccount(opts: FuturesClientOpts) {
  return signedFutures(opts, "GET", "/fapi/v2/account");
}

export async function getPositionRisk(
  opts: FuturesClientOpts,
  symbol?: string
) {
  return signedFutures(
    opts,
    "GET",
    "/fapi/v2/positionRisk",
    symbol ? { symbol } : {}
  );
}

export async function setHedgeMode(opts: FuturesClientOpts, on: boolean) {
  return signedFutures(opts, "POST", "/fapi/v1/positionSide/dual", {
    dualSidePosition: on ? "true" : "false",
  });
}

export async function setLeverage(
  opts: FuturesClientOpts,
  symbol: string,
  leverage: number
) {
  return signedFutures(opts, "POST", "/fapi/v1/leverage", {
    symbol,
    leverage,
  });
}

export async function setMarginType(
  opts: FuturesClientOpts,
  symbol: string,
  marginType: "ISOLATED" | "CROSSED"
) {
  return signedFutures(opts, "POST", "/fapi/v1/marginType", {
    symbol,
    marginType,
  });
}

export async function marketOrder(
  opts: FuturesClientOpts,
  args: {
    symbol: string;
    side: OrderSide;
    positionSide: PositionSide;
    quantity: number;
    reduceOnly?: boolean;
  }
) {
  const params: Record<string, string | number | boolean> = {
    symbol: args.symbol,
    side: args.side,
    type: "MARKET",
    quantity: args.quantity,
    positionSide: args.positionSide,
  };
  if (args.reduceOnly) params.reduceOnly = "true";
  return signedFutures(opts, "POST", "/fapi/v1/order", params);
}

/** Public mark price (no auth). */
export async function fetchMarkPrice(
  symbol: string,
  testnet?: boolean
): Promise<number> {
  const base = futuresBaseUrl(testnet);
  const res = await fetch(
    `${base}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`
  );
  if (!res.ok) {
    // fallback via our klines last close
    const kr = await fetch(
      `/api/klines?symbol=${encodeURIComponent(symbol)}&exchange=binance&timeframe=1m&limit=2`
    );
    const kj = await kr.json();
    const c = kj.candles?.[kj.candles.length - 1]?.close;
    if (typeof c === "number") return c;
    throw new Error(`mark price ${res.status}`);
  }
  const j = (await res.json()) as { markPrice?: string };
  return Number(j.markPrice);
}

export async function fetchLotSize(
  symbol: string,
  testnet?: boolean
): Promise<{ stepSize: number; minQty: number }> {
  const base = futuresBaseUrl(testnet);
  const res = await fetch(`${base}/fapi/v1/exchangeInfo`);
  if (!res.ok) return { stepSize: 0.001, minQty: 0.001 };
  const j = (await res.json()) as {
    symbols?: {
      symbol: string;
      filters: { filterType: string; stepSize?: string; minQty?: string }[];
    }[];
  };
  const sym = j.symbols?.find((s) => s.symbol === symbol);
  const lot = sym?.filters?.find((f) => f.filterType === "LOT_SIZE");
  return {
    stepSize: Number(lot?.stepSize ?? 0.001),
    minQty: Number(lot?.minQty ?? 0.001),
  };
}

