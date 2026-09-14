export type FuturesMode = "paper" | "live";
export type SignalSource = "manual" | "alarm" | "list_scan" | "strategy";
export type PositionSide = "LONG" | "SHORT";
export type OrderSide = "BUY" | "SELL";

export type FuturesBotKeys = {
  apiKey: string;
  apiSecret: string;
};

/** Non-secret bot prefs (safe to persist in desk / localStorage). */
export type FuturesBotPrefs = {
  enabled: boolean;
  mode: FuturesMode;
  /** 0.01 or 0.02 of equity as margin per slot */
  riskPct: 0.01 | 0.02;
  reservePct: number;
  leverage: number;
  takeProfitRoePct: number;
  signalSource: SignalSource;
  /** Optional alarm group filter when signalSource=alarm */
  alarmGroup?: string;
  /** Manual equity override for paper / calculator (USDT) */
  paperEquity: number;
  hedgeMode: boolean;
  marginType: "ISOLATED" | "CROSSED";
  testnet: boolean;
};

export type PaperPosition = {
  id: string;
  symbol: string;
  positionSide: PositionSide;
  qty: number;
  entryPrice: number;
  margin: number;
  leverage: number;
  openedAt: number;
  reason?: string;
  markPrice?: number;
};

export type FuturesBotState = {
  prefs: FuturesBotPrefs;
  paperPositions: PaperPosition[];
};

export const DEFAULT_FUTURES_BOT_PREFS: FuturesBotPrefs = {
  enabled: false,
  mode: "paper",
  riskPct: 0.01,
  reservePct: 0.5,
  leverage: 5,
  takeProfitRoePct: 0.1,
  signalSource: "manual",
  paperEquity: 500,
  hedgeMode: true,
  marginType: "ISOLATED",
  testnet: false,
};

export const FUTURES_KEYS_STORE = "tradedesk-futures-keys-v1";
export const FUTURES_BOT_STORE = "tradedesk-futures-bot-v1";
