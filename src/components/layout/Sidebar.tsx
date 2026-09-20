"use client";

import dynamic from "next/dynamic";
import { useDeskStore } from "@/store/desk";
import { WatchlistPanel } from "@/components/watchlist/WatchlistPanel";
import clsx from "clsx";

const StrategiesPanel = dynamic(
  () =>
    import("@/components/strategies/StrategiesPanel").then((m) => m.StrategiesPanel),
  { ssr: false }
);
const ListScanPanel = dynamic(
  () =>
    import("@/components/scanner/ListScanPanel").then((m) => m.ListScanPanel),
  { ssr: false }
);
const IndicatorPanel = dynamic(
  () =>
    import("@/components/indicators/IndicatorPanel").then((m) => m.IndicatorPanel),
  { ssr: false }
);
const ScannerPanel = dynamic(
  () =>
    import("@/components/scanner/ScannerPanel").then((m) => m.ScannerPanel),
  { ssr: false }
);
const HeatmapPanel = dynamic(
  () =>
    import("@/components/heatmap/HeatmapPanel").then((m) => m.HeatmapPanel),
  { ssr: false }
);
const PatternPanel = dynamic(
  () =>
    import("@/components/patterns/PatternPanel").then((m) => m.PatternPanel),
  { ssr: false }
);
const BacktestPanel = dynamic(
  () =>
    import("@/components/backtest/BacktestPanel").then((m) => m.BacktestPanel),
  { ssr: false }
);
const RiskPanel = dynamic(
  () => import("@/components/risk/RiskPanel").then((m) => m.RiskPanel),
  { ssr: false }
);
const PairHealthPanel = dynamic(
  () =>
    import("@/components/pairs/PairHealthPanel").then((m) => m.PairHealthPanel),
  { ssr: false }
);
const AlertsPanel = dynamic(
  () =>
    import("@/components/alerts/AlertsPanel").then((m) => m.AlertsPanel),
  { ssr: false }
);
const BotPanel = dynamic(
  () => import("@/components/bot/BotPanel").then((m) => m.BotPanel),
  { ssr: false }
);
const ScriptEditor = dynamic(
  () =>
    import("@/components/editor/ScriptEditor").then((m) => m.ScriptEditor),
  { ssr: false }
);

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
  { id: "bot", label: "Bot" },
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
        {sidebarTab === "bot" && <BotPanel />}
        {sidebarTab === "scripts" && <ScriptEditor />}
      </div>
    </aside>
  );
}
