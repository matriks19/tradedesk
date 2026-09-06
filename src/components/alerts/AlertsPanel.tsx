"use client";

import { useEffect, useState } from "react";
import { useDeskStore } from "@/store/desk";
import type { AlertCondition, Exchange } from "@/lib/types";
import clsx from "clsx";

const CONDITIONS: { value: AlertCondition; label: string }[] = [
  { value: "above", label: "Üstünde" },
  { value: "below", label: "Altında" },
  { value: "cross_above", label: "Yukarı kes" },
  { value: "cross_below", label: "Aşağı kes" },
];

export function AlertsPanel() {
  const {
    panes,
    activePaneId,
    alerts,
    addAlert,
    removeAlert,
    updateAlert,
    botSettings,
    setBotSettings,
  } = useDeskStore();
  const pane = panes.find((p) => p.id === activePaneId);

  const [symbol, setSymbol] = useState(pane?.symbol ?? "BTCUSDT");
  const [exchange, setExchange] = useState<Exchange>(pane?.exchange ?? "binance");
  const [condition, setCondition] = useState<AlertCondition>("cross_above");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [testStatus, setTestStatus] = useState("");

  useEffect(() => {
    if (pane) {
      setSymbol(pane.symbol);
      setExchange(pane.exchange);
    }
  }, [pane?.id, pane?.symbol, pane?.exchange]);

  const active = alerts.filter((a) => a.active && !a.triggeredAt);
  const triggered = alerts.filter((a) => a.triggeredAt || !a.active);

  const submit = () => {
    const p = Number(price);
    if (!symbol.trim() || !Number.isFinite(p) || p <= 0) return;
    const sym = symbol.trim().toUpperCase();
    // Force Binance for perps / USDT pairs (prevents .P on BIST mismatch)
    const ex: Exchange =
      /\.P$/i.test(sym) || /USDT$/i.test(sym) ? "binance" : exchange;
    if (ex !== exchange) setExchange(ex);
    addAlert({
      symbol: sym,
      exchange: ex,
      condition,
      price: p,
      note: note.trim() || undefined,
    });
    setNote("");
  };

  const quickFromPane = async () => {
    if (!pane) return;
    try {
      const res = await fetch(
        `/api/ticker?exchange=${pane.exchange}&symbols=${pane.symbol}`
      );
      const json = await res.json();
      const q = json.quotes?.[0];
      const last = q?.last;
      if (last == null || !Number.isFinite(last)) return;
      setSymbol(pane.symbol);
      setExchange(pane.exchange);
      setPrice(String(last));
      addAlert({
        symbol: pane.symbol,
        exchange: pane.exchange,
        condition: "cross_above",
        price: last,
        note: "aktif pane",
        lastPrice: last,
      });
    } catch {
      /* */
    }
  };

  const testWebhook = async () => {
    if (!botSettings.webhookUrl.trim()) {
      setTestStatus("URL yok");
      return;
    }
    setTestStatus("Gönderiliyor…");
    try {
      const res = await fetch("/api/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: botSettings.webhookUrl.trim(),
          telegramChatId: botSettings.telegramChatId?.trim() || undefined,
          payload: {
            secret: botSettings.secret || undefined,
            event: "test",
            ts: Date.now(),
            message: "TradeDesk webhook test",
            text: "TradeDesk webhook test",
          },
        }),
      });
      const json = await res.json();
      setTestStatus(
        json.ok
          ? `OK ${json.status}`
          : `Hata ${json.status ?? res.status}: ${json.error ?? json.body ?? ""}`
      );
    } catch (e) {
      setTestStatus(e instanceof Error ? e.message : "hata");
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2 text-xs overflow-y-auto">
      <div className="font-medium">Fiyat Alarmı</div>
      <p className="text-2xs text-desk-muted">
        Aktif pane: {pane?.symbol ?? "—"}. Koşul sağlanınca bildirim + bot.
      </p>

      <div className="grid grid-cols-2 gap-1">
        <label className="text-2xs text-desk-muted col-span-1">
          Sembol
          <input
            className="input mt-0.5"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          />
        </label>
        <label className="text-2xs text-desk-muted">
          Borsa
          <select
            className="input mt-0.5"
            value={exchange}
            onChange={(e) => setExchange(e.target.value as Exchange)}
          >
            <option value="binance">Binance</option>
            <option value="bist">BIST</option>
          </select>
        </label>
        <label className="text-2xs text-desk-muted">
          Koşul
          <select
            className="input mt-0.5"
            value={condition}
            onChange={(e) => setCondition(e.target.value as AlertCondition)}
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-2xs text-desk-muted">
          Fiyat
          <input
            className="input mt-0.5"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
      </div>
      <label className="text-2xs text-desk-muted">
        Not
        <input
          className="input mt-0.5"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="opsiyonel"
        />
      </label>
      <div className="flex gap-1">
        <button type="button" className="btn btn-accent flex-1" onClick={submit}>
          Ekle
        </button>
        <button type="button" className="btn flex-1" onClick={quickFromPane}>
          Aktif pane fiyatına alarm
        </button>
      </div>

      <div className="border-t border-desk-border pt-2 mt-1">
        <div className="text-2xs text-desk-muted mb-1">
          Aktif ({active.length})
        </div>
        {active.map((a) => (
          <AlertRow
            key={a.id}
            a={a}
            onToggle={() =>
              updateAlert(a.id, {
                active: !a.active,
                triggeredAt: undefined,
              })
            }
            onDelete={() => removeAlert(a.id)}
            onReactivate={() =>
              updateAlert(a.id, { active: true, triggeredAt: undefined })
            }
          />
        ))}
        {!active.length && (
          <div className="text-2xs text-desk-muted py-1">Alarm yok</div>
        )}
        {triggered.length > 0 && (
          <>
            <div className="text-2xs text-desk-muted mt-2 mb-1">
              Tetiklenen / kapalı ({triggered.length})
            </div>
            {triggered.map((a) => (
              <AlertRow
                key={a.id}
                a={a}
                onToggle={() =>
                  updateAlert(a.id, {
                    active: true,
                    triggeredAt: undefined,
                  })
                }
                onDelete={() => removeAlert(a.id)}
                onReactivate={() =>
                  updateAlert(a.id, { active: true, triggeredAt: undefined })
                }
              />
            ))}
          </>
        )}
      </div>

      <div className="border-t border-desk-border pt-2 mt-1 space-y-1">
        <div className="font-medium">Bot / Webhook</div>
        <p className="text-2xs text-desk-muted leading-relaxed">
          <strong className="text-desk-text">Telegram:</strong> BotFather ile bot
          oluşturun → URL:{" "}
          <span className="font-mono">
            https://api.telegram.org/bot&lt;TOKEN&gt;/sendMessage
          </span>{" "}
          · Chat ID alanına sohbet/kanal id yazın (ör.{" "}
          <span className="font-mono">123456789</span> veya{" "}
          <span className="font-mono">-100…</span>).
          <br />
          <strong className="text-desk-text">WhatsApp:</strong> Make / n8n
          webhook URL&apos;si kullanın (aynı webhook; metin{" "}
          <span className="font-mono">text</span> /{" "}
          <span className="font-mono">message</span> alanından gelir).
        </p>
        <label className="text-2xs text-desk-muted block">
          Webhook URL
          <input
            className="input mt-0.5"
            value={botSettings.webhookUrl}
            onChange={(e) => setBotSettings({ webhookUrl: e.target.value })}
            placeholder="https://api.telegram.org/bot…/sendMessage"
          />
        </label>
        <label className="text-2xs text-desk-muted block">
          Telegram Chat ID (opsiyonel)
          <input
            className="input mt-0.5"
            value={botSettings.telegramChatId ?? ""}
            onChange={(e) =>
              setBotSettings({ telegramChatId: e.target.value })
            }
            placeholder="123456789 veya -100…"
          />
        </label>
        <label className="text-2xs text-desk-muted block">
          Secret (opsiyonel)
          <input
            className="input mt-0.5"
            value={botSettings.secret ?? ""}
            onChange={(e) => setBotSettings({ secret: e.target.value })}
          />
        </label>
        <label className="flex items-center gap-2 text-2xs">
          <input
            type="checkbox"
            checked={botSettings.enabled}
            onChange={(e) => setBotSettings({ enabled: e.target.checked })}
          />
          Webhook açık
        </label>
        <div className="flex gap-1 items-center">
          <button type="button" className="btn" onClick={testWebhook}>
            Test
          </button>
          {testStatus && (
            <span className="text-2xs text-desk-muted truncate">{testStatus}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertRow({
  a,
  onToggle,
  onDelete,
  onReactivate,
}: {
  a: {
    id: string;
    symbol: string;
    exchange: Exchange;
    condition: AlertCondition;
    price: number;
    active: boolean;
    note?: string;
    triggeredAt?: number;
    lastPrice?: number;
  };
  onToggle: () => void;
  onDelete: () => void;
  onReactivate: () => void;
}) {
  const cond =
    CONDITIONS.find((c) => c.value === a.condition)?.label ?? a.condition;
  const fired = !!a.triggeredAt;
  return (
    <div
      className={clsx(
        "flex items-start gap-1 py-1.5 border-b border-desk-border/50",
        fired && "opacity-70"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {a.symbol}{" "}
          <span className="text-desk-muted font-normal text-2xs">
            {a.exchange}
          </span>
        </div>
        <div className="text-2xs text-desk-muted font-mono">
          {cond} · {a.price.toLocaleString(undefined, { maximumFractionDigits: 8 })}
          {a.lastPrice != null
            ? ` · son ${a.lastPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
            : ""}
        </div>
        {a.note && <div className="text-2xs text-desk-muted truncate">{a.note}</div>}
        {fired && (
          <div className="text-2xs text-desk-warn">
            Tetiklendi{" "}
            {new Date(a.triggeredAt!).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
      <button
        type="button"
        className="btn text-2xs px-1.5"
        title={fired ? "Yeniden aktif" : a.active ? "Durdur" : "Aktifleştir"}
        onClick={fired ? onReactivate : onToggle}
      >
        {fired ? "↻" : a.active ? "⏸" : "▶"}
      </button>
      <button
        type="button"
        className="text-desk-muted hover:text-desk-down text-2xs px-1"
        onClick={onDelete}
      >
        ✕
      </button>
    </div>
  );
}
