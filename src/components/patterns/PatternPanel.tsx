"use client";

import { useEffect, useMemo, useState } from "react";
import { useDeskStore } from "@/store/desk";
import type { PatternHit } from "@/lib/patterns/types";
import type { FormationScaleMode } from "@/lib/types";
import { FormationScanPanel } from "@/components/formations/FormationScanPanel";
import clsx from "clsx";

const SCALE_CHIPS: { id: FormationScaleMode; label: string }[] = [
  { id: "minor", label: "Minör" },
  { id: "major", label: "Majör" },
  { id: "both", label: "İkisi" },
];

export function PatternPanel() {
  const panes = useDeskStore((s) => s.panes);
  const activePaneId = useDeskStore((s) => s.activePaneId);
  const patternSettings = useDeskStore((s) => s.patternSettings);
  const setPatternSettings = useDeskStore((s) => s.setPatternSettings);
  const setPatternFocus = useDeskStore((s) => s.setPatternFocus);
  const setOverlayPattern = useDeskStore((s) => s.setOverlayPattern);
  const updatePane = useDeskStore((s) => s.updatePane);
  const pane = panes.find((p) => p.id === activePaneId) ?? panes[0];
  const [patterns, setPatterns] = useState<PatternHit[]>([]);
  const [mode, setMode] = useState<"chart" | "scan">("scan");

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

  const visible = useMemo(() => {
    const scale = patternSettings.formationScale ?? "both";
    if (scale === "both") return patterns;
    return patterns.filter((p) => (p.scale ?? "minor") === scale);
  }, [patterns, patternSettings.formationScale]);

  const openHit = (h: PatternHit) => {
    setOverlayPattern(h);
    setPatternFocus(h.id);
    if (h.scale === "major" && h.timeframe && pane) {
      updatePane(pane.id, { timeframe: h.timeframe });
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex gap-1 p-2 pb-0">
        <button
          type="button"
          className={clsx("btn text-2xs flex-1", mode === "scan" && "btn-accent")}
          onClick={() => setMode("scan")}
        >
          Formasyon Tara
        </button>
        <button
          type="button"
          className={clsx("btn text-2xs flex-1", mode === "chart" && "btn-accent")}
          onClick={() => setMode("chart")}
        >
          Aktif grafik
        </button>
      </div>
      {mode === "scan" ? (
        <FormationScanPanel />
      ) : (
        <div className="flex flex-col h-full min-h-0 p-2 gap-2">
          <div className="text-xs font-medium">Formasyonlar — {pane?.symbol}</div>
          <p className="text-2xs text-desk-muted">
            Minör: grafik TF. Majör: 1D / 3D / 1W (yüksek swing). Tıklayınca çizilir;
            majörde TF o periyoda geçer.
          </p>

          <div className="flex gap-1 flex-wrap">
            {SCALE_CHIPS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={clsx(
                  "btn text-2xs",
                  (patternSettings.formationScale ?? "both") === c.id && "btn-accent"
                )}
                onClick={() => setPatternSettings({ formationScale: c.id })}
              >
                {c.label}
              </button>
            ))}
          </div>

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
            onClick={() => {
              setPatternFocus(null);
              setOverlayPattern(null);
            }}
          >
            Vurgulamayı temizle
          </button>

          <div className="flex-1 overflow-y-auto space-y-2">
            {visible.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => openHit(h)}
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
                <div className="flex gap-2 mt-0.5 text-2xs text-desk-muted">
                  <span
                    className={clsx(
                      "uppercase tracking-wide",
                      h.scale === "major" ? "text-desk-accent" : ""
                    )}
                  >
                    {h.scale === "major" ? "Majör" : "Minör"}
                    {h.timeframe ? ` · ${h.timeframe}` : ""}
                  </span>
                </div>
                <div className="text-2xs text-desk-muted mt-0.5">{h.detail}</div>
                <div className="text-2xs text-desk-muted mt-1">
                  {h.drawings.length} çizim · {h.type}
                </div>
              </button>
            ))}
            {!visible.length && (
              <div className="text-2xs text-desk-muted">
                Aktif grafikte formasyon aranıyor… Veri yüklenince burada listelenir.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
