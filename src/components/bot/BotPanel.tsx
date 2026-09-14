"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  computeRiskPlan,
  priceMoveForRoe,
} from "@/lib/bot/risk";
import type {
  FuturesBotKeys,
  FuturesBotPrefs,
  PaperPosition,
  PositionSide,
} from "@/lib/bot/types";
import { DEFAULT_FUTURES_BOT_PREFS } from "@/lib/bot/types";
import {
  clearFuturesKeys,
  loadFuturesBotState,
  loadFuturesKeys,
  saveFuturesBotState,
  saveFuturesKeys,
} from "@/lib/bot/persist";
import {
  equityFromPrefs,
  fetchUsdtEquity,
  paperUnrealized,
  tryCloseLiveByTp,
  tryClosePaperByTp,
  tryOpen,
} from "@/lib/bot/engine";
import { fetchMarkPrice } from "@/lib/bot/binanceFutures";

export function BotPanel() {
  const [prefs, setPrefs] = useState<FuturesBotPrefs>({
    ...DEFAULT_FUTURES_BOT_PREFS,
  });
  const [keys, setKeys] = useState<FuturesBotKeys>({
    apiKey: "",
    apiSecret: "",
  });
  const [paper, setPaper] = useState<PaperPosition[]>([]);
  const [status, setStatus] = useState("");
  const [manualSym, setManualSym] = useState("BTCUSDT");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const st = loadFuturesBotState();
    setPrefs(st.prefs);
    setPaper(st.paperPositions);
    setKeys(loadFuturesKeys());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveFuturesBotState({ prefs, paperPositions: paper });
  }, [prefs, paper, hydrated]);

  const plan = useMemo(
    () =>
      computeRiskPlan(equityFromPrefs(prefs), prefs.riskPct, {
        reservePct: prefs.reservePct,
        leverage: prefs.leverage,
        takeProfitRoePct: prefs.takeProfitRoePct,
      }),
    [prefs]
  );

  const patchPrefs = (p: Partial<FuturesBotPrefs>) =>
    setPrefs((s) => ({ ...s, ...p }));

  const saveKeys = () => {
    saveFuturesKeys(keys);
    setStatus("API key kaydedildi (sadece bu tarayıcı)");
  };

  const testConn = async () => {
    setStatus("Bağlantı…");
    try {
      const eq = await fetchUsdtEquity(keys, prefs.testnet);
      patchPrefs({ paperEquity: eq > 0 ? eq : prefs.paperEquity });
      setStatus(`USDT bakiye ≈ ${eq.toFixed(2)}`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "bağlantı hatası");
    }
  };

  const openSide = async (positionSide: PositionSide) => {
    setStatus("Emir…");
    const r = await tryOpen(prefs, keys, paper, {
      symbol: manualSym,
      positionSide,
      reason: "manuel",
    });
    if (!r.ok) {
      setStatus(r.error);
      return;
    }
    if (r.paper) setPaper((a) => [...a, r.paper!]);
    setStatus(`Açıldı · ${positionSide} · ${r.planNote}`);
  };

  const tickTp = useCallback(async () => {
    if (!prefs.enabled) return;
    if (prefs.mode === "paper" && paper.length) {
      const marks: Record<string, number> = {};
      for (const p of paper) {
        if (marks[p.symbol] != null) continue;
        try {
          marks[p.symbol] = await fetchMarkPrice(p.symbol, prefs.testnet);
        } catch {
          marks[p.symbol] = p.markPrice ?? p.entryPrice;
        }
      }
      const { closed, kept } = await tryClosePaperByTp(prefs, paper, marks);
      if (closed.length) {
        setPaper(kept);
        setStatus(
          `TP kapandı: ${closed.map((c) => `${c.symbol} ${c.positionSide}`).join(", ")}`
        );
      } else {
        setPaper(kept);
      }
      return;
    }
    if (prefs.mode === "live") {
      const r = await tryCloseLiveByTp(prefs, keys);
      if (r.closed.length) setStatus(`Live TP: ${r.closed.join(", ")}`);
      if (r.errors.length) setStatus(r.errors[0]!);
    }
  }, [prefs, paper, keys]);

  useEffect(() => {
    if (!prefs.enabled) return;
    const id = window.setInterval(() => void tickTp(), 8000);
    return () => clearInterval(id);
  }, [prefs.enabled, tickTp]);

  const pxMove = priceMoveForRoe(prefs.takeProfitRoePct, prefs.leverage);

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2 text-xs overflow-y-auto">
      <div className="font-medium">Futures Bot</div>
      <p className="text-2xs text-desk-muted">
        Binance USDT-M · hedge long+short · 5x · slot margin %1/%2 · rezerv %50 ·
        TP %10 ROE (~fiyat %{(pxMove * 100).toFixed(1)}%) · SL yok. Tab açıkken çalışır
        (AlertWatcher gibi).
      </p>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={prefs.enabled}
          onChange={(e) => patchPrefs({ enabled: e.target.checked })}
        />
        Bot aktif
      </label>

      <div className="flex flex-wrap gap-1">
        {(["paper", "live"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={clsx("btn text-2xs px-1.5", prefs.mode === m && "btn-accent")}
            onClick={() => patchPrefs({ mode: m })}
          >
            {m === "paper" ? "Paper" : "Live"}
          </button>
        ))}
        {([0.01, 0.02] as const).map((r) => (
          <button
            key={r}
            type="button"
            className={clsx(
              "btn text-2xs px-1.5",
              prefs.riskPct === r && "btn-accent"
            )}
            onClick={() => patchPrefs({ riskPct: r })}
          >
            Risk %{(r * 100).toFixed(0)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1 text-2xs border border-desk-border/40 rounded p-2 bg-desk-elevated/30">
        <div>Equity</div>
        <div className="font-mono text-right">{plan.equity.toFixed(2)}</div>
        <div>Rezerv %{ (prefs.reservePct * 100).toFixed(0) }</div>
        <div className="font-mono text-right">{plan.deployable.toFixed(2)}</div>
        <div>Slot margin</div>
        <div className="font-mono text-right">{plan.marginPerSlot.toFixed(2)}</div>
        <div>Notional ({plan.leverage}x)</div>
        <div className="font-mono text-right">{plan.notionalPerSlot.toFixed(2)}</div>
        <div className="font-medium">Max eşzamanlı slot</div>
        <div className="font-mono text-right font-medium">{plan.maxSlots}</div>
        <div>Açık paper</div>
        <div className="font-mono text-right">
          {paper.length} / {plan.maxSlots}
        </div>
      </div>

      <label className="text-2xs text-desk-muted">
        Paper / hesap equity (USDT)
        <input
          className="input mt-0.5"
          type="number"
          value={prefs.paperEquity}
          onChange={(e) =>
            patchPrefs({ paperEquity: Number(e.target.value) || 0 })
          }
        />
      </label>

      <label className="text-2xs text-desk-muted">
        Sinyal kaynağı
        <select
          className="input mt-0.5"
          value={prefs.signalSource}
          onChange={(e) =>
            patchPrefs({
              signalSource: e.target.value as FuturesBotPrefs["signalSource"],
            })
          }
        >
          <option value="manual">Manuel</option>
          <option value="alarm">Alarm (sonra bağlanacak)</option>
          <option value="list_scan">Liste tarama (hook)</option>
          <option value="strategy">Özel strateji (kod sonra)</option>
        </select>
      </label>

      <div className="text-2xs font-medium mt-1">API key (tarayıcıda)</div>
      <input
        className="input text-2xs"
        type="password"
        placeholder="API Key"
        value={keys.apiKey}
        onChange={(e) => setKeys((k) => ({ ...k, apiKey: e.target.value }))}
        autoComplete="off"
      />
      <input
        className="input text-2xs"
        type="password"
        placeholder="API Secret"
        value={keys.apiSecret}
        onChange={(e) => setKeys((k) => ({ ...k, apiSecret: e.target.value }))}
        autoComplete="off"
      />
      <div className="flex flex-wrap gap-1">
        <button type="button" className="btn text-2xs" onClick={saveKeys}>
          Key kaydet
        </button>
        <button
          type="button"
          className="btn text-2xs"
          onClick={() => {
            clearFuturesKeys();
            setKeys({ apiKey: "", apiSecret: "" });
            setStatus("Key silindi");
          }}
        >
          Key sil
        </button>
        <button
          type="button"
          className="btn text-2xs"
          onClick={() => void testConn()}
        >
          Bağlantı test
        </button>
        <label className="flex items-center gap-1 text-2xs ml-1">
          <input
            type="checkbox"
            checked={prefs.testnet}
            onChange={(e) => patchPrefs({ testnet: e.target.checked })}
          />
          Testnet
        </label>
      </div>

      <div className="text-2xs font-medium mt-1">Manuel emir</div>
      <input
        className="input text-2xs"
        value={manualSym}
        onChange={(e) => setManualSym(e.target.value.toUpperCase())}
        placeholder="BTCUSDT"
      />
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="btn-accent text-2xs"
          disabled={!prefs.enabled}
          onClick={() => void openSide("LONG")}
        >
          Long aç
        </button>
        <button
          type="button"
          className="btn text-2xs"
          disabled={!prefs.enabled}
          onClick={() => void openSide("SHORT")}
        >
          Short aç
        </button>
        <button
          type="button"
          className="btn text-2xs"
          onClick={() => void tickTp()}
        >
          TP tara
        </button>
      </div>

      {status && (
        <div className="text-2xs text-desk-muted border border-desk-border/30 rounded px-2 py-1">
          {status}
        </div>
      )}

      {paper.length > 0 && (
        <div className="border border-desk-border/40 rounded overflow-hidden">
          <div className="px-2 py-1 text-2xs bg-desk-elevated/50">
            Paper pozisyonlar
          </div>
          {paper.map((p) => {
            const mark = p.markPrice ?? p.entryPrice;
            const { pnl, roe } = paperUnrealized(p, mark);
            return (
              <div
                key={p.id}
                className="px-2 py-1 text-2xs border-t border-desk-border/30 flex gap-1 justify-between"
              >
                <span>
                  {p.symbol} {p.positionSide}
                </span>
                <span className="font-mono">
                  {pnl >= 0 ? "+" : ""}
                  {pnl.toFixed(2)} ({(roe * 100).toFixed(1)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-2xs text-desk-muted">
        Örnek E=500 · risk %1 → max <b>50</b> slot (250 değil) · her biri 5$
        margin / 25$ notional. Strateji kodunu sonra eklersin; Alarm/Liste hook
        hazır.
      </p>
    </div>
  );
}
