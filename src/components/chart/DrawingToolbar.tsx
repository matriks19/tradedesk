"use client";

import { useDeskStore } from "@/store/desk";
import type { DrawTool } from "@/lib/types";
import clsx from "clsx";

const TOOLS: { id: DrawTool; label: string; title: string }[] = [
  { id: "cursor", label: "↖", title: "İmleç" },
  { id: "hline", label: "H", title: "Yatay çizgi" },
  { id: "trend", label: "/", title: "Trend" },
  { id: "fib", label: "Fib", title: "Fibonacci" },
  { id: "measure", label: "Δ", title: "Ölçü" },
  { id: "rect", label: "▭", title: "Dikdörtgen" },
];

export function DrawingToolbar({ paneId }: { paneId: string }) {
  const activeDrawTool = useDeskStore((s) => s.activeDrawTool);
  const setActiveDrawTool = useDeskStore((s) => s.setActiveDrawTool);
  const clearPaneDrawings = useDeskStore((s) => s.clearPaneDrawings);

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
          title={t.title}
          onClick={() => setActiveDrawTool(t.id)}
        >
          {t.label}
        </button>
      ))}
      <button
        type="button"
        className="btn px-1.5 text-2xs"
        title="Pane çizimlerini temizle"
        onClick={() => clearPaneDrawings(paneId)}
      >
        ⌫
      </button>
    </div>
  );
}
