"use client";

import { useEffect, useMemo, useState } from "react";
import { useDeskStore } from "@/store/desk";
import type {
  AlertCondition,
  AlertRepeat,
  AlertScanKey,
  Exchange,
  PriceAlert,
} from "@/lib/types";
import { SCAN_OPTIONS } from "@/lib/alerts/scanAlert";
import clsx from "clsx";

const CONDITIONS: { value: AlertCondition; label: string }[] = [
  { value: "above", label: "Üstünde" },
  { value: "below", label: "Altında" },
  { value: "cross_above", label: "Yukarı kes" },
  { value: "cross_below", label: "Aşağı kes" },
];

type FormKind = "price" | AlertScanKey;

const GROUPS = ["Hepsi", "Fiyat", "HAM", "Diag", "Liste"] as const;

function alertGroup(a: PriceAlert): string {
  if (a.group) return a.group;
  if (a.kind === "scan") {
    return SCAN_OPTIONS.find((o) => o.key === a.scanKey)?.group ?? "HAM";
  }
  return "Fiyat";
}

export function AlertsPanel() {
  const {
    panes,
    activePaneId,
    alerts,
    addAlert,
    addAlertsBulk,
    removeAlert,
    removeAlerts,
    setAlertsActive,
    updateAlert,
    botSettings,
    setBotSettings,
    watchlists,
    activeWatchlistId,
    openSymbolInActive,
  } = useDeskStore();
  const pane = panes.find((p) => p.id === activePaneId);
  const list = watchlists.find((w) => w.id === activeWatchlistId);

  const [symbol, setSymbol] = useState(pane?.symbol ?? "BTCUSDT");
  const [exchange, setExchange] = useState<Exchange>(pane?.exchange ?? "binance");
  const [condition, setCondition] = useState<AlertCondition>("cross_above");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [formKind, setFormKind] = useState<FormKind>("price");
  const [repeat, setRepeat] = useState<AlertRepeat>("once");
  const [hours, setHours] = useState(24);
  const [cooldownMin, setCooldownMin] = useState(60);
  const [intervalMin, setIntervalMin] = useState(15);
  const [tf, setTf] = useState(pane?.timeframe ?? "15m");
  const [filter, setFilter] = useState<(typeof GROUPS)[number]>("Hepsi");
  const [testStatus, setTestStatus] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tgToken, setTgToken] = useState("");
  const [tgStatus, setTgStatus] = useState("");

  useEffect(() => {
    if (pane) {
      setSymbol(pane.symbol);
      setExchange(pane.exchange);
      setTf(pane.timeframe);
    }
  }, [pane?.id, pane?.symbol, pane?.exchange, pane?.timeframe]);

  const extras = () => {
    const expiresAt = hours > 0 ? Date.now() + hours * 3600_000 : undefined;
    if (formKind === "price") {
      return {
        kind: "price" as const,
        group: "Fiyat",
        repeat,
        cooldownMin: repeat === "repeat" ? cooldownMin : undefined,
        expiresAt,
      };
    }
    const meta = SCAN_OPTIONS.find((o) => o.key === formKind)!;
    return {
      kind: "scan" as const,
      scanKey: formKind as AlertScanKey,
      group: meta.group,
      timeframe: tf,
      intervalMin,
      repeat,
      cooldownMin: repeat === "repeat" ? cooldownMin : undefined,
      expiresAt,
      note: note.trim() || meta.label,
    };
  };

  const submit = () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    const ex: Exchange =
      /\.P$/i.test(sym) || /USDT$/i.test(sym) ? "binance" : exchange;
    if (formKind === "price") {
      const p = Number(price);
      if (!Number.isFinite(p) || p <= 0) return;
      addAlert({
        symbol: sym,
        exchange: ex,
        condition,
        price: p,
        note: note.trim() || undefined,
        ...extras(),
      });
    } else {
      addAlert({
        symbol: sym,
        exchange: ex,
        condition: "cross_above",
        price: 0,
        ...extras(),
      });
    }
    setNote("");
  };

  const bulkList = () => {
    if (!list?.symbols.length) {
      setBulkStatus("Liste boş");
      return;
    }
    const items = list.symbols.map((s) => {
      const ex: Exchange =
        /\.P$/i.test(s.symbol) || /USDT$/i.test(s.symbol)
          ? "binance"
          : s.exchange;
      if (formKind === "price") {
        const p = Number(price);
        return {
          symbol: s.symbol,
          exchange: ex,
          condition,
          price: Number.isFinite(p) && p > 0 ? p : 0,
          note: note.trim() || `liste · ${list.name}`,
          group: "Liste",
          kind: "price" as const,
          repeat,
          cooldownMin: repeat === "repeat" ? cooldownMin : undefined,
          expiresAt: hours > 0 ? Date.now() + hours * 3600_000 : undefined,
        };
      }
      const meta = SCAN_OPTIONS.find((o) => o.key === formKind)!;
      return {
        symbol: s.symbol,
        exchange: ex,
        condition: "cross_above" as const,
        price: 0,
        kind: "scan" as const,
        scanKey: formKind as AlertScanKey,
        group: meta.group,
        timeframe: tf,
        intervalMin,
        repeat,
        cooldownMin: repeat === "repeat" ? cooldownMin : undefined,
        expiresAt: hours > 0 ? Date.now() + hours * 3600_000 : undefined,
        note: `${meta.label} · ${list.name}`,
      };
    });
    const usable =
      formKind === "price"
        ? items.filter((x) => x.price > 0)
        : items;
    if (formKind === "price" && !usable.length) {
      setBulkStatus("Toplu fiyat için hedef gir");
      return;
    }
    const n = addAlertsBulk(usable);
    setBulkStatus(`${n} alarm · ${list.name}`);
  };

  const visible = useMemo(() => {
    return alerts.filter((a) => filter === "Hepsi" || alertGroup(a) === filter);
  }, [alerts, filter]);
  const active = visible.filter((a) => a.active && (a.repeat === "repeat" || !a.triggeredAt));
  const triggered = visible.filter((a) => !active.includes(a));

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
            symbol: pane?.symbol ?? "BTCUSDT",
            exchange: pane?.exchange ?? "binance",
            openUrl:
              typeof window !== "undefined"
                ? `${window.location.origin}/?s=${pane?.symbol ?? "BTCUSDT"}&ex=${pane?.exchange ?? "binance"}`
                : undefined,
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

  const isScan = formKind !== "price";

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2 text-xs overflow-y-auto">
      <div className="font-medium">Alarm</div>
      <p className="text-2xs text-desk-muted">
        Satıra tıkla → grafik. HAM/Diag sürekli taranır; fiyat 8 sn’de bir bakılır.
      </p>

      <label className="text-2xs text-desk-muted">
        Tür
        <select
          className="input mt-0.5"
          value={formKind}
          onChange={(e) => setFormKind(e.target.value as FormKind)}
        >
          <option value="price">Fiyat</option>
          {SCAN_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.group} · {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-1">
        <label className="text-2xs text-desk-muted">
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
        {!isScan && (
          <>
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
          </>
        )}
        {isScan && (
          <label className="text-2xs text-desk-muted">
            TF
            <select
              className="input mt-0.5"
              value={tf}
              onChange={(e) => setTf(e.target.value)}
            >
              {["5m", "15m", "30m", "1h", "4h", "1d"].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-2xs text-desk-muted">
          Tekrar
          <select
            className="input mt-0.5"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as AlertRepeat)}
          >
            <option value="once">Tek sefer</option>
            <option value="repeat">Sürekli</option>
          </select>
        </label>
        <label className="text-2xs text-desk-muted">
          Süre
          <select
            className="input mt-0.5"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          >
            <option value={4}>4 saat</option>
            <option value={8}>8 saat</option>
            <option value={24}>24 saat</option>
            <option value={48}>48 saat</option>
            <option value={0}>Süresiz</option>
          </select>
        </label>
        {repeat === "repeat" && (
          <label className="text-2xs text-desk-muted">
            Cooldown
            <select
              className="input mt-0.5"
              value={cooldownMin}
              onChange={(e) => setCooldownMin(Number(e.target.value))}
            >
              <option value={15}>15 dk</option>
              <option value={30}>30 dk</option>
              <option value={60}>1 saat</option>
              <option value={240}>4 saat</option>
            </select>
          </label>
        )}
        {isScan && (
          <label className="text-2xs text-desk-muted">
            Tara her
            <select
              className="input mt-0.5"
              value={intervalMin}
              onChange={(e) => setIntervalMin(Number(e.target.value))}
            >
              <option value={5}>5 dk</option>
              <option value={15}>15 dk</option>
              <option value={30}>30 dk</option>
              <option value={60}>1 saat</option>
            </select>
          </label>
        )}
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
        <button
          type="button"
          className="btn flex-1"
          title={list ? `${list.name} (${list.symbols.length})` : "Liste yok"}
          onClick={bulkList}
        >
          Listeye toplu
        </button>
      </div>
      {bulkStatus && (
        <div className="text-2xs text-desk-muted">{bulkStatus}</div>
      )}

      <div className="flex flex-wrap gap-1">
        {GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            className={clsx("btn text-2xs px-1.5", filter === g && "btn-accent")}
            onClick={() => {
              setFilter(g);
              setConfirmDelete(false);
            }}
          >
            {g}
          </button>
        ))}
      </div>
      {visible.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className="btn text-2xs"
            onClick={() =>
              setAlertsActive(
                visible.filter((a) => a.active).map((a) => a.id),
                false
              )
            }
          >
            Görünenleri durdur ({visible.filter((a) => a.active).length})
          </button>
          <button
            type="button"
            className="btn text-2xs"
            onClick={() =>
              setAlertsActive(
                visible.filter((a) => !a.active).map((a) => a.id),
                true
              )
            }
          >
            Görünenleri aç ({visible.filter((a) => !a.active).length})
          </button>
          <button
            type="button"
            className={clsx("btn text-2xs", confirmDelete && "btn-accent")}
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              removeAlerts(visible.map((a) => a.id));
              setConfirmDelete(false);
            }}
          >
            {confirmDelete
              ? `Emin misin? ${visible.length} sil`
              : `Görünenleri sil (${visible.length})`}
          </button>
        </div>
      )}

      <div className="border-t border-desk-border pt-2 mt-1">
        <div className="text-2xs text-desk-muted mb-1">
          Aktif ({active.length})
        </div>
        {active.map((a) => (
          <AlertRow
            key={a.id}
            a={a}
            onOpen={() =>
              openSymbolInActive(a.symbol, a.exchange, a.timeframe)
            }
            onToggle={() =>
              updateAlert(a.id, {
                active: !a.active,
                triggeredAt: a.repeat === "repeat" ? a.triggeredAt : undefined,
              })
            }
            onDelete={() => removeAlert(a.id)}
            onReactivate={() =>
              updateAlert(a.id, {
                active: true,
                triggeredAt: undefined,
                lastFiredAt: undefined,
              })
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
                onOpen={() =>
                  openSymbolInActive(a.symbol, a.exchange, a.timeframe)
                }
                onToggle={() =>
                  updateAlert(a.id, { active: true, triggeredAt: undefined })
                }
                onDelete={() => removeAlert(a.id)}
                onReactivate={() =>
                  updateAlert(a.id, {
                    active: true,
                    triggeredAt: undefined,
                    lastFiredAt: undefined,
                  })
                }
              />
            ))}
          </>
        )}
      </div>

      <div className="border-t border-desk-border pt-2 mt-1 space-y-1">
        <div className="font-medium">Telegram bağla</div>
        <p className="text-2xs text-desk-muted leading-relaxed">
          1) Telegram’da @BotFather → /newbot. 2) Token’ı buraya yapıştır (saklanır, git’e gitmez).
          3) Bota bir mesaj at, Chat ID bul. 4) Bağla + Test.
        </p>
        <label className="text-2xs text-desk-muted block">
          Bot token
          <input
            className="input mt-0.5"
            type="password"
            autoComplete="off"
            value={tgToken}
            onChange={(e) => setTgToken(e.target.value.trim())}
            placeholder="123456:AA…"
          />
        </label>
        <label className="text-2xs text-desk-muted block">
          Chat ID
          <input
            className="input mt-0.5"
            value={botSettings.telegramChatId ?? ""}
            onChange={(e) =>
              setBotSettings({ telegramChatId: e.target.value })
            }
            placeholder="123456789 veya -100…"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className="btn text-2xs"
            onClick={async () => {
              const token = tgToken.trim();
              if (!token) {
                setTgStatus("token yaz");
                return;
              }
              setTgStatus("chat aranıyor…");
              try {
                const r = await fetch("/api/telegram/chat", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token }),
                });
                const j = await r.json();
                if (j.chatId) {
                  setBotSettings({ telegramChatId: String(j.chatId) });
                  setTgStatus(`chat ${j.chatId}`);
                } else {
                  setTgStatus(j.error || "bota bir mesaj at, tekrar dene");
                }
              } catch (e) {
                setTgStatus(e instanceof Error ? e.message : "hata");
              }
            }}
          >
            Chat ID bul
          </button>
          <button
            type="button"
            className="btn btn-accent text-2xs"
            onClick={() => {
              const token = tgToken.trim();
              if (!token) {
                setTgStatus("token yaz");
                return;
              }
              const chat = (botSettings.telegramChatId ?? "").trim();
              if (!chat) {
                setTgStatus("chat id yok — önce Chat ID bul");
                return;
              }
              setBotSettings({
                webhookUrl: `https://api.telegram.org/bot${token}/sendMessage`,
                telegramChatId: chat,
                enabled: true,
              });
              setTgStatus("bağlandı — Test’e bas");
            }}
          >
            Bağla
          </button>
        </div>
        {tgStatus && (
          <div className="text-2xs text-desk-muted">{tgStatus}</div>
        )}
        <label className="text-2xs text-desk-muted block">
          Webhook URL
          <input
            className="input mt-0.5"
            value={botSettings.webhookUrl}
            onChange={(e) => setBotSettings({ webhookUrl: e.target.value })}
            placeholder="https://api.telegram.org/bot…/sendMessage"
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
        <label className="flex items-center gap-2 text-2xs">
          <input
            type="checkbox"
            checked={!!botSettings.autoBot}
            onChange={(e) => setBotSettings({ autoBot: e.target.checked })}
          />
          Bot kancası (ileride emir)
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
  onOpen,
  onToggle,
  onDelete,
  onReactivate,
}: {
  a: PriceAlert;
  onOpen: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onReactivate: () => void;
}) {
  const cond =
    a.kind === "scan"
      ? SCAN_OPTIONS.find((o) => o.key === a.scanKey)?.label ?? a.scanKey
      : CONDITIONS.find((c) => c.value === a.condition)?.label ?? a.condition;
  const fired = !!a.triggeredAt && a.repeat !== "repeat";
  const g = alertGroup(a);
  return (
    <div
      className={clsx(
        "flex items-start gap-1 py-1.5 border-b border-desk-border/50",
        fired && "opacity-70"
      )}
    >
      <button
        type="button"
        className="flex-1 min-w-0 text-left hover:text-desk-accent"
        onClick={onOpen}
        title="Grafikte aç"
      >
        <div className="font-medium truncate">
          {a.symbol}{" "}
          <span className="text-desk-muted font-normal text-2xs">
            {a.exchange}
            {a.timeframe ? ` · ${a.timeframe}` : ""}
            {` · ${g}`}
          </span>
        </div>
        <div className="text-2xs text-desk-muted font-mono">
          {cond}
          {a.kind !== "scan"
            ? ` · ${a.price.toLocaleString(undefined, { maximumFractionDigits: 8 })}`
            : ""}
          {a.lastPrice != null
            ? ` · son ${a.lastPrice.toLocaleString(undefined, { maximumFractionDigits: 6 })}`
            : ""}
          {a.repeat === "repeat" ? " · sürekli" : ""}
        </div>
        {a.note && (
          <div className="text-2xs text-desk-muted truncate">{a.note}</div>
        )}
        {a.triggeredAt && (
          <div className="text-2xs text-desk-warn">
            Tetiklendi{" "}
            {new Date(a.triggeredAt).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </button>
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
