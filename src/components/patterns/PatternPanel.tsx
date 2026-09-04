"use client";

import { useEffect, useState } from "react";
import { useDeskStore } from "@/store/desk";
import type { PatternHit } from "@/lib/patterns/types";
import clsx from "clsx";

export function PatternPanel() {
  const panes = useDeskStore((s) => s.panes);
  const activePaneId = useDeskStore((s) => s.activePaneId);
  const patternSettings = useDeskStore((s) => s.patternSettings);
  const setPatternSettings = useDeskStore((s) => s.setPatternSettings);
  const setPatternFocus = useDeskStore((s) => s.setPatternFocus);
  const pane = panes.find((p) => p.id === activePaneId) ?? panes[0];
  const [patterns, setPatterns] = useState<PatternHit[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        paneId: string;
        patterns: PatternHit[];
      };
      if (detail.paneId === activePaneId) setPatterns(detail.patterns ?? []);
    };
    window.addEventListener("td-patterns", handler);
    return () => window.removeEventListener("td-patterns", handler);
  }, [activePaneId]);

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2">
      <div className="text-xs font-medium">
        Formasyonlar — {pane?.symbol}
      </div>
      <p className="text-2xs text-desk-muted">
        Çift tepe/dip, OBO, üçgen, bayrak/flama, HH/HL, kırılım kutusu. Tıklayınca
        grafikte vurgulanır.
      </p>

      <div className="grid grid-cols-3 gap-1 text-2xs">
        <label className="text-desk-muted">
          Swing
          <input
            className="input mt-0.5"
            type="number"
            min={1}
            max={5}
            value={patternSettings.swingStrength}
            onChange={(e) =>
              setPatternSettings({ swingStrength: Number(e.target.value) })
            }
          />
        </label>
        <label className="text-desk-muted">
          Hassasiyet %
          <input
            className="input mt-0.5"
            type="number"
            min={0.5}
            max={5}
            step={0.1}
            value={Number((patternSettings.twinTol * 100).toFixed(2))}
            onChange={(e) =>
              setPatternSettings({ twinTol: Number(e.target.value) / 100 })
            }
          />
        </label>
        <label className="text-desk-muted">
          Kutu LB
          <input
            className="input mt-0.5"
            type="number"
            min={10}
            max={80}
            value={patternSettings.boxLookback}
            onChange={(e) =>
              setPatternSettings({ boxLookback: Number(e.target.value) })
            }
          />
        </label>
      </div>

      <button
        type="button"
        className="btn text-2xs"
        onClick={() => setPatternFocus(null)}
      >
        Vurgulamayı temizle
      </button>

      <div className="flex-1 overflow-y-auto space-y-2">
        {patterns.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setPatternFocus(h.id)}
            className={clsx(
              "w-full text-left rounded border px-2 py-2 transition-colors",
              patternSettings.focusId === h.id && "ring-1 ring-desk-accent",
              h.bias === "bull" && "border-desk-up/40 bg-desk-up/10",
              h.bias === "bear" && "border-desk-down/40 bg-desk-down/10",
              h.bias === "neutral" && "border-desk-border bg-desk-elevated"
            )}
          >
            <div className="flex justify-between gap-2">
              <span className="text-xs font-medium">{h.label}</span>
              <span className="text-2xs font-mono text-desk-muted">
                {(h.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-2xs text-desk-muted mt-0.5">{h.detail}</div>
            <div className="text-2xs text-desk-muted mt-1">
              {h.drawings.length} çizim · {h.type}
            </div>
          </button>
        ))}
        {!patterns.length && (
          <div className="text-2xs text-desk-muted">
            Aktif grafikte formasyon aranıyor… Veri yüklenince burada listelenir.
          </div>
        )}
      </div>
    </div>
  );
}
