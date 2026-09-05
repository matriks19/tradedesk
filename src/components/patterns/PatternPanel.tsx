"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeskStore } from "@/store/desk";
import type { PatternHit } from "@/lib/patterns/types";
import type { Candle, FormationScaleMode } from "@/lib/types";
import { FormationScanPanel } from "@/components/formations/FormationScanPanel";
import { detectPatterns } from "@/lib/patterns/detect";
import { detectAdvancedAsPatternHits } from "@/lib/patterns/advanced";
import {
  MAJOR_TIMEFRAMES,
  majorSwingStrength,
} from "@/lib/data/timeframes";
import clsx from "clsx";

const SCALE_CHIPS: { id: FormationScaleMode; label: string }[] = [
  { id: "minor", label: "Minör" },
  { id: "major", label: "Majör" },
  { id: "both", label: "İkisi" },
];

export function PatternPanel() {
  const panes = useDeskStore((s) => s.panes);
  const activePaneId = useDeskStore((s) => s.activePaneId);
  const setActivePane = useDeskStore((s) => s.setActivePane);
  const patternSettings = useDeskStore((s) => s.patternSettings);
  const setPatternSettings = useDeskStore((s) => s.setPatternSettings);
  const setPatternFocus = useDeskStore((s) => s.setPatternFocus);
  const setOverlayPattern = useDeskStore((s) => s.setOverlayPattern);
  const updatePane = useDeskStore((s) => s.updatePane);
  const pane = panes.find((p) => p.id === activePaneId) ?? panes[0];
  const [patterns, setPatterns] = useState<PatternHit[]>([]);
  const [mode, setMode] = useState<"chart" | "scan">("scan");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: "" });
  const [status, setStatus] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // Clear results when switching active pane (stale list)
  useEffect(() => {
    setPatterns([]);
    setStatus("");
    abortRef.current?.abort();
    abortRef.current = null;
    setScanning(false);
  }, [activePaneId, pane?.symbol, pane?.exchange, pane?.timeframe]);

  const visible = useMemo(() => {
    const scale = patternSettings.formationScale ?? "both";
    if (scale === "both") return patterns;
    return patterns.filter((p) => (p.scale ?? "minor") === scale);
  }, [patterns, patternSettings.formationScale]);

  const openHit = (h: PatternHit) => {
    if (pane) setActivePane(pane.id);
    // Switch TF first when pattern was detected on another period, then overlay.
    if (h.timeframe && pane && String(pane.timeframe) !== String(h.timeframe)) {
      updatePane(pane.id, { timeframe: h.timeframe });
    }
    setOverlayPattern(h);
    setPatternFocus(h.id);
  };

  const cancelScan = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setScanning(false);
    setStatus("Tarama iptal edildi");
  }, []);

  const runScan = useCallback(async () => {
    if (!pane) {
      setStatus("Aktif grafik yok");
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const { signal } = ac;

    setScanning(true);
    setPatterns([]);
    setStatus("");
    const scale = patternSettings.formationScale ?? "both";
    const jobs: { tf: string; scale: "minor" | "major"; swing: number; boxLb: number }[] =
      [];
    if (scale !== "major") {
      jobs.push({
        tf: String(pane.timeframe),
        scale: "minor",
        swing: patternSettings.swingStrength,
        boxLb: patternSettings.boxLookback,
      });
    }
    if (scale !== "minor") {
      const majSwing = majorSwingStrength(patternSettings.swingStrength);
      for (const tf of MAJOR_TIMEFRAMES) {
        jobs.push({
          tf,
          scale: "major",
          swing: majSwing,
          boxLb: Math.max(patternSettings.boxLookback, 40),
        });
      }
    }
    setProgress({ done: 0, total: jobs.length, label: "" });

    const all: PatternHit[] = [];
    try {
      for (let i = 0; i < jobs.length; i++) {
        if (signal.aborted) break;
        const job = jobs[i]!;
        setProgress({
          done: i,
          total: jobs.length,
          label: `${job.scale === "major" ? "Majör" : "Minör"} ${job.tf}`,
        });
        try {
          const res = await fetch(
            `/api/klines?symbol=${encodeURIComponent(pane.symbol)}&exchange=${pane.exchange}&timeframe=${encodeURIComponent(job.tf)}&limit=260`,
            { signal }
          );
          const json = await res.json();
          const bars = (json.candles ?? []) as Candle[];
          if (bars.length < 40) {
            setProgress({
              done: i + 1,
              total: jobs.length,
              label: `${job.tf} (yetersiz veri)`,
            });
            continue;
          }
          const base = detectPatterns(bars, {
            swingStrength: job.swing,
            twinTol: patternSettings.twinTol,
            boxLookback: job.boxLb,
          }).map((h) => ({
            ...h,
            id:
              job.scale === "major" ? `maj_${job.tf}_${h.id}` : `min_${job.tf}_${h.id}`,
            scale: job.scale,
            timeframe: job.tf,
            label:
              job.scale === "major"
                ? `${h.label} · ${job.tf}`
                : h.label.includes("·")
                  ? h.label
                  : `${h.label} · ${job.tf}`,
            detail:
              job.scale === "major" ? `[Majör ${job.tf}] ${h.detail}` : h.detail,
          }));
          const adv = detectAdvancedAsPatternHits(bars, {
            swingStrength: job.swing,
          }).map((h) => ({
            ...h,
            id:
              job.scale === "major" ? `maj_${job.tf}_${h.id}` : `min_${job.tf}_${h.id}`,
            scale: job.scale,
            timeframe: job.tf,
            label:
              job.scale === "major"
                ? `${h.label.replace(/ · .*$/, "")} · ${job.tf}`
                : h.label.includes("·")
                  ? h.label
                  : `${h.label} · ${job.tf}`,
            detail:
              job.scale === "major" ? `[Majör ${job.tf}] ${h.detail}` : h.detail,
          }));
          all.push(...adv, ...base);
        } catch (e) {
          if (signal.aborted) break;
          /* skip TF */
        }
        setProgress({ done: i + 1, total: jobs.length, label: job.tf });
      }
      if (signal.aborted) {
        setStatus("Tarama iptal edildi");
        return;
      }
      all.sort((a, b) => b.confidence - a.confidence);
      const sliced = all.slice(0, 40);
      setPatterns(sliced);
      setStatus(
        sliced.length
          ? `${sliced.length} formasyon · ${pane.symbol} · ${jobs.map((j) => j.tf).join(",")}`
          : `Formasyon bulunamadı · ${pane.symbol}`
      );
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setScanning(false);
      setProgress({ done: 0, total: 0, label: "" });
    }
  }, [
    pane,
    patternSettings.formationScale,
    patternSettings.swingStrength,
    patternSettings.twinTol,
    patternSettings.boxLookback,
  ]);

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
            Minör: grafik TF. Majör: 1D / 3D / 1W (yüksek swing). Tara ile tarayın;
            tıklayınca çizilir, majörde TF o periyoda geçer. Hard refresh overlay&apos;i
            temizler (pane/layout localStorage&apos;da kalır); izleme listesi ve
            scriptler /api/store üzerinden yeniden yüklenir — sıfırlanma değil.
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

          <div className="flex gap-1">
            <button
              type="button"
              className="btn-accent text-2xs flex-1"
              disabled={scanning || !pane}
              onClick={runScan}
            >
              {scanning
                ? `Taranıyor ${progress.done}/${progress.total}${
                    progress.label ? ` · ${progress.label}` : ""
                  }`
                : "Tara"}
            </button>
            {scanning && (
              <button type="button" className="btn text-2xs" onClick={cancelScan}>
                İptal
              </button>
            )}
            <button
              type="button"
              className="btn text-2xs"
              onClick={() => {
                setPatternFocus(null);
                setOverlayPattern(null);
              }}
            >
              Temizle
            </button>
          </div>

          {scanning && progress.total > 0 && (
            <div className="h-1 bg-desk-border rounded overflow-hidden">
              <div
                className="h-full bg-desk-accent transition-all"
                style={{
                  width: `${(100 * progress.done) / progress.total}%`,
                }}
              />
            </div>
          )}
          {status && <p className="text-2xs text-desk-muted">{status}</p>}

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
            {!visible.length && !scanning && (
              <div className="text-2xs text-desk-muted">
                Ölçek seçip Tara — canlı tarama yok; yalnızca butonla çalışır.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
