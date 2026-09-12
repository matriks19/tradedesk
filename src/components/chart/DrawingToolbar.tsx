"use client";

import { useDeskStore } from "@/store/desk";
import type { DrawTool } from "@/lib/types";
import clsx from "clsx";
import { ListScanActions } from "@/components/scanner/ListScanActions";

const TOOLS: { id: DrawTool; label: string; title: string }[] = [
  { id: "cursor", label: "↖", title: "İmleç" },
  { id: "hline", label: "H", title: "Yatay çizgi" },
  { id: "trend", label: "/", title: "Trend" },
  { id: "fib", label: "Fib", title: "Fibonacci — 2 tık: swing high → low" },
  { id: "measure", label: "Δ", title: "Ölçü" },
  { id: "rect", label: "▭", title: "Dikdörtgen" },
];

export function DrawingToolbar({ paneId }: { paneId: string }) {
  const activeDrawTool = useDeskStore((s) => s.activeDrawTool);
  const setActiveDrawTool = useDeskStore((s) => s.setActiveDrawTool);
  const clearPaneDrawings = useDeskStore((s) => s.clearPaneDrawings);
  const clearPaneIndicators = useDeskStore((s) => s.clearPaneIndicators);
  const requestPlaceDiag = useDeskStore((s) => s.requestPlaceDiag);
  const addIndicator = useDeskStore((s) => s.addIndicator);
  const panes = useDeskStore((s) => s.panes);

  return (
    <div
      className="flex items-center gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={clsx(
            "btn px-1.5 text-2xs min-w-[1.5rem]",
            activeDrawTool === t.id && "btn-accent"
          )}
          title={
            t.id === "fib" && activeDrawTool === "fib"
              ? "2 tık: swing high → low"
              : t.title
          }
          onClick={() => setActiveDrawTool(t.id)}
        >
          {t.label}
        </button>
      ))}
      <button
        type="button"
        className="btn px-1.5 text-2xs"
        title="Diyagonal S/R — son iki pivot destek/direnç çizgilerini koy"
        onClick={() => {
          const pane = panes.find((x) => x.id === paneId);
          const has = pane?.indicators.some((i) => i.type === "diagonalSr");
          if (!has) addIndicator(paneId, "diagonalSr");
          requestPlaceDiag(paneId);
        }}
      >
        Diag
      </button>
      <button
        type="button"
        className="btn px-1.5 text-2xs"
        title="Pane çizimlerini temizle"
        onClick={() => clearPaneDrawings(paneId)}
      >
        ⌫
      </button>
      <button
        type="button"
        className="btn px-1.5 text-2xs"
        title="Bu panedeki tüm göstergeleri temizle"
        onClick={() => clearPaneIndicators(paneId)}
      >
        Göstergeleri temizle
      </button>
      <ListScanActions compact className="ml-1" />
    </div>
  );
}
