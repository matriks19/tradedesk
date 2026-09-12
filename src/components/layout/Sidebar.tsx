"use client";

import { useDeskStore } from "@/store/desk";
import { WatchlistPanel } from "@/components/watchlist/WatchlistPanel";
import { ScannerPanel } from "@/components/scanner/ScannerPanel";
import { HeatmapPanel } from "@/components/heatmap/HeatmapPanel";
import { PatternPanel } from "@/components/patterns/PatternPanel";
import { RiskPanel } from "@/components/risk/RiskPanel";
import { IndicatorPanel } from "@/components/indicators/IndicatorPanel";
import { ScriptEditor } from "@/components/editor/ScriptEditor";
import { BacktestPanel } from "@/components/backtest/BacktestPanel";
import { StrategiesPanel } from "@/components/strategies/StrategiesPanel";
import { AlertsPanel } from "@/components/alerts/AlertsPanel";
import { ListScanPanel } from "@/components/scanner/ListScanPanel";
import { PairHealthPanel } from "@/components/pairs/PairHealthPanel";
import clsx from "clsx";

const TABS = [
  { id: "strategies", label: "Strateji" },
  { id: "watchlist", label: "İzleme" },
  { id: "list", label: "Liste" },
  { id: "indicators", label: "Göstergeler" },
  { id: "scanner", label: "Tarayıcı" },
  { id: "heatmap", label: "Isı" },
  { id: "patterns", label: "Formasyon" },
  { id: "backtest", label: "Backtest" },
  { id: "risk", label: "Risk" },
  { id: "pairs", label: "Çift" },
  { id: "alerts", label: "Alarm" },
  { id: "scripts", label: "Script" },
] as const;

export function Sidebar() {
  const { sidebarTab, setSidebarTab } = useDeskStore();

  return (
    <aside className="w-[320px] shrink-0 border-r border-desk-border bg-desk-panel flex flex-col min-h-0">
      <div className="flex flex-wrap border-b border-desk-border px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={clsx("tab", sidebarTab === t.id && "tab-active")}
            onClick={() => setSidebarTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {sidebarTab === "strategies" && <StrategiesPanel />}
        {sidebarTab === "watchlist" && <WatchlistPanel />}
        {sidebarTab === "list" && <ListScanPanel />}
        {sidebarTab === "indicators" && <IndicatorPanel />}
        {sidebarTab === "scanner" && <ScannerPanel />}
        {sidebarTab === "heatmap" && <HeatmapPanel />}
        {sidebarTab === "patterns" && <PatternPanel />}
        {sidebarTab === "backtest" && <BacktestPanel />}
        {sidebarTab === "risk" && <RiskPanel />}
        {sidebarTab === "pairs" && <PairHealthPanel />}
        {sidebarTab === "alerts" && <AlertsPanel />}
        {sidebarTab === "scripts" && <ScriptEditor />}
      </div>
    </aside>
  );
}
