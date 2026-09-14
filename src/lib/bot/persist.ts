import type { FuturesBotKeys, FuturesBotState } from "./types";
import {
  DEFAULT_FUTURES_BOT_PREFS,
  FUTURES_BOT_STORE,
  FUTURES_KEYS_STORE,
} from "./types";

export function loadFuturesKeys(): FuturesBotKeys {
  if (typeof window === "undefined") return { apiKey: "", apiSecret: "" };
  try {
    const raw = localStorage.getItem(FUTURES_KEYS_STORE);
    if (!raw) return { apiKey: "", apiSecret: "" };
    const j = JSON.parse(raw) as FuturesBotKeys;
    return {
      apiKey: typeof j.apiKey === "string" ? j.apiKey : "",
      apiSecret: typeof j.apiSecret === "string" ? j.apiSecret : "",
    };
  } catch {
    return { apiKey: "", apiSecret: "" };
  }
}

export function saveFuturesKeys(keys: FuturesBotKeys) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    FUTURES_KEYS_STORE,
    JSON.stringify({
      apiKey: keys.apiKey.trim(),
      apiSecret: keys.apiSecret.trim(),
    })
  );
}

export function clearFuturesKeys() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(FUTURES_KEYS_STORE);
}

export function loadFuturesBotState(): FuturesBotState {
  if (typeof window === "undefined") {
    return { prefs: { ...DEFAULT_FUTURES_BOT_PREFS }, paperPositions: [] };
  }
  try {
    const raw = localStorage.getItem(FUTURES_BOT_STORE);
    if (!raw) {
      return { prefs: { ...DEFAULT_FUTURES_BOT_PREFS }, paperPositions: [] };
    }
    const j = JSON.parse(raw) as FuturesBotState;
    return {
      prefs: { ...DEFAULT_FUTURES_BOT_PREFS, ...(j.prefs ?? {}) },
      paperPositions: Array.isArray(j.paperPositions) ? j.paperPositions : [],
    };
  } catch {
    return { prefs: { ...DEFAULT_FUTURES_BOT_PREFS }, paperPositions: [] };
  }
}

export function saveFuturesBotState(state: FuturesBotState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FUTURES_BOT_STORE, JSON.stringify(state));
}
