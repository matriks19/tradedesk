"use client";

import { useState } from "react";
import { useDeskStore } from "@/store/desk";
import {
  BUILTIN_META,
  formatIndicatorLabel,
} from "@/lib/indicators/registry";
import { IndicatorMenu } from "@/components/indicators/IndicatorMenu";
import { IndicatorSettings } from "@/components/indicators/IndicatorSettings";
import type { IndicatorInstance } from "@/lib/types";

export function IndicatorPanel() {
  const {
    panes,
    activePaneId,
    removeIndicator,
    toggleIndicatorVisible,
    setIndicatorMenuOpen,
    indicatorMenuOpen,
  } = useDeskStore();
  const pane = panes.find((p) => p.id === activePaneId) ?? panes[0];
  const [settingsInd, setSettingsInd] = useState<IndicatorInstance | null>(null);
  const [onParentId, setOnParentId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  if (!pane) return null;

  const openMenu = (parentId?: string | null) => {
    setOnParentId(parentId ?? null);
    setMenuOpen(true);
    setIndicatorMenuOpen(true);
  };

  const closeMenu = () => {
    setMenuOpen(false);
    setOnParentId(null);
    setIndicatorMenuOpen(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      <div className="flex items-center gap-2">
        <div className="text-xs font-medium">Göstergeler — {pane.symbol}</div>
        <button
          type="button"
          className="btn btn-accent text-2xs ml-auto"
          onClick={() => openMenu(null)}
          title="Gösterge ekle"
        >
          ☰ Göstergeler
        </button>
      </div>

      <div className="text-2xs text-desk-muted">Aktif ({pane.indicators.length})</div>
      <div className="flex-1 overflow-y-auto space-y-1">
        {pane.indicators.map((ind) => {
          const label = formatIndicatorLabel(ind, pane.indicators);
          const acceptsChild =
            ind.type !== "custom" && BUILTIN_META[ind.type]?.primarySeriesKey;
          return (
            <div
              key={ind.id}
              className="flex flex-col gap-1 px-2 py-1.5 rounded bg-desk-elevated text-xs"
            >
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  className={ind.visible ? "" : "opacity-40 line-through"}
                  onClick={() => toggleIndicatorVisible(pane.id, ind.id)}
                  title="Göster/gizle"
                >
                  {label}
                  {ind.type === "custom" && (
                    <span className="text-desk-muted text-2xs ml-1">özel</span>
                  )}
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  {ind.type !== "custom" && (
                    <button
                      type="button"
                      className="text-desk-muted hover:text-desk-accent text-2xs"
                      title="Ayarlar"
                      onClick={() => setSettingsInd(ind)}
                    >
                      ⚙
                    </button>
                  )}
                  {acceptsChild && (
                    <button
                      type="button"
                      className="text-desk-muted hover:text-desk-accent text-2xs"
                      title="Göstergeye gösterge ekle"
                      onClick={() => openMenu(ind.id)}
                    >
                      +↗
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-desk-muted hover:text-desk-down text-2xs"
                    onClick={() => removeIndicator(pane.id, ind.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
              {acceptsChild && (
                <button
                  type="button"
                  className="text-2xs text-left text-desk-muted hover:text-desk-accent"
                  onClick={() => openMenu(ind.id)}
                >
                  Göstergeye gösterge ekle…
                </button>
              )}
            </div>
          );
        })}
        {!pane.indicators.length && (
          <div className="text-2xs text-desk-muted">
            Henüz gösterge yok. ☰ menüden ekleyin.
          </div>
        )}
      </div>

      <IndicatorMenu
        open={menuOpen || indicatorMenuOpen}
        onClose={closeMenu}
        onParentId={onParentId}
        paneId={pane.id}
      />
      {settingsInd && (
        <IndicatorSettings
          paneId={pane.id}
          indicator={settingsInd}
          open={!!settingsInd}
          onClose={() => setSettingsInd(null)}
        />
      )}
    </div>
  );
}
