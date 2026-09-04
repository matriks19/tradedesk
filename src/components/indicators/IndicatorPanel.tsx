"use client";

import { useDeskStore } from "@/store/desk";
import { BUILTIN_META } from "@/lib/indicators/registry";
import type { BuiltinIndicatorId } from "@/lib/types";

export function IndicatorPanel() {
  const { panes, activePaneId, addIndicator, removeIndicator } = useDeskStore();
  const pane = panes.find((p) => p.id === activePaneId) ?? panes[0];
  const ids = Object.keys(BUILTIN_META) as BuiltinIndicatorId[];

  if (!pane) return null;

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      <div className="text-xs font-medium">Göstergeler — {pane.symbol}</div>
      <div className="grid grid-cols-2 gap-1">
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            className="btn text-2xs justify-start"
            onClick={() => addIndicator(pane.id, id)}
          >
            + {BUILTIN_META[id].label}
          </button>
        ))}
      </div>
      <div className="text-2xs text-desk-muted mt-2">Aktif</div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {pane.indicators.map((ind) => (
          <div
            key={ind.id}
            className="flex items-center justify-between px-2 py-1.5 rounded bg-desk-elevated text-xs"
          >
            <span>
              {ind.name}
              {ind.type === "custom" && (
                <span className="text-desk-muted text-2xs ml-1">özel</span>
              )}
            </span>
            <button
              type="button"
              className="text-desk-muted hover:text-desk-down"
              onClick={() => removeIndicator(pane.id, ind.id)}
            >
              Kaldır
            </button>
          </div>
        ))}
        {!pane.indicators.length && (
          <div className="text-2xs text-desk-muted">Henüz gösterge yok.</div>
        )}
      </div>
    </div>
  );
}
