"use client";

import { useDeskStore } from "@/store/desk";

export function RiskPanel() {
  const { risk, setRisk, showRiskLines, setShowRiskLines, panes, activePaneId } =
    useDeskStore();
  const pane = panes.find((p) => p.id === activePaneId);

  const riskPerUnit =
    risk.entry > 0 && risk.stopLoss > 0
      ? Math.abs(risk.entry - risk.stopLoss)
      : 0;
  const size =
    riskPerUnit > 0 && risk.riskAmount > 0
      ? risk.riskAmount / riskPerUnit
      : 0;
  const reward =
    risk.entry > 0 && risk.takeProfit > 0
      ? Math.abs(risk.takeProfit - risk.entry)
      : 0;
  const rr = riskPerUnit > 0 ? reward / riskPerUnit : 0;

  const fillFromLast = async () => {
    if (!pane) return;
    const res = await fetch(
      `/api/klines?symbol=${pane.symbol}&exchange=${pane.exchange}&timeframe=${pane.timeframe}&limit=2`
    );
    const json = await res.json();
    const last = json.candles?.[json.candles.length - 1];
    if (!last) return;
    const entry = last.close;
    const sl =
      entry *
      (last.close >= last.open ? 0.98 : 1.02);
    const tp = entry + (entry - sl) * risk.rMultiple;
    setRisk({ entry, stopLoss: Number(sl.toPrecision(8)), takeProfit: Number(tp.toPrecision(8)) });
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2 text-xs">
      <div className="font-medium">TP / SL Risk</div>
      <p className="text-2xs text-desk-muted">
        Aktif grafik: {pane?.symbol}. R katları ile pozisyon boyutu.
      </p>
      <button type="button" className="btn" onClick={fillFromLast}>
        Son fiyattan doldur (R={risk.rMultiple})
      </button>
      <label className="text-2xs text-desk-muted">
        Giriş
        <input
          className="input mt-0.5"
          type="number"
          value={risk.entry || ""}
          onChange={(e) => setRisk({ entry: Number(e.target.value) })}
        />
      </label>
      <label className="text-2xs text-desk-muted">
        Stop Loss
        <input
          className="input mt-0.5"
          type="number"
          value={risk.stopLoss || ""}
          onChange={(e) => setRisk({ stopLoss: Number(e.target.value) })}
        />
      </label>
      <label className="text-2xs text-desk-muted">
        Take Profit
        <input
          className="input mt-0.5"
          type="number"
          value={risk.takeProfit || ""}
          onChange={(e) => setRisk({ takeProfit: Number(e.target.value) })}
        />
      </label>
      <label className="text-2xs text-desk-muted">
        Risk tutarı ($)
        <input
          className="input mt-0.5"
          type="number"
          value={risk.riskAmount || ""}
          onChange={(e) => setRisk({ riskAmount: Number(e.target.value) })}
        />
      </label>
      <label className="text-2xs text-desk-muted">
        R katı (otomatik TP için)
        <input
          className="input mt-0.5"
          type="number"
          step="0.5"
          value={risk.rMultiple || ""}
          onChange={(e) => setRisk({ rMultiple: Number(e.target.value) })}
        />
      </label>
      <label className="flex items-center gap-2 text-2xs">
        <input
          type="checkbox"
          checked={showRiskLines}
          onChange={(e) => setShowRiskLines(e.target.checked)}
        />
        Grafikte TP/SL çizgileri
      </label>
      <div className="panel p-2 space-y-1 mt-1">
        <div className="flex justify-between">
          <span className="text-desk-muted">1R mesafe</span>
          <span className="font-mono">{riskPerUnit ? riskPerUnit.toPrecision(6) : "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-desk-muted">Pozisyon boyutu</span>
          <span className="font-mono">{size ? size.toFixed(4) : "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-desk-muted">R:R</span>
          <span className="font-mono text-desk-up">{rr ? rr.toFixed(2) : "—"}</span>
        </div>
      </div>
    </div>
  );
}
