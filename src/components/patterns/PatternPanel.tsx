"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDeskStore } from "@/store/desk";
import type { PatternHit } from "@/lib/patterns/types";
import type { Candle } from "@/lib/types";
import { FormationScanPanel } from "@/components/formations/FormationScanPanel";
import { MacdScanPanel } from "@/components/formations/MacdScanPanel";
import { RsiScanPanel } from "@/components/formations/RsiScanPanel";
import { EliziScanPanel } from "@/components/formations/EliziScanPanel";
import { MacdEliziScanPanel } from "@/components/formations/MacdEliziScanPanel";
import { SectorScanPanel } from "@/components/formations/SectorScanPanel";
import { detectPatterns } from "@/lib/patterns/detect";
import { detectAdvancedAsPatternHits } from "@/lib/patterns/advanced";
import {
  isShtFlagTriangleType,
  passesShtFilter,
} from "@/lib/patterns/shtFlagTriangle";
import {
  isThreeDrivesType,
  passesThreeDrivesFilter,
} from "@/lib/patterns/threeDrives";
import {
  isBreakoutFvgRetestType,
  passesBreakoutFvgRetestFilter,
} from "@/lib/patterns/breakoutFvgRetest";
import {
  isInversionFvgType,
  passesInversionFvgFilter,
} from "@/lib/patterns/inversionFvg";
import { passesSmcFilter } from "@/lib/patterns/smcModels";
import { passesQuasimodoFilter } from "@/lib/patterns/quasimodo";
import { passesMavkFilter } from "@/lib/patterns/mavkCluster";
import { passesBistCycleFilter } from "@/lib/patterns/bistCycle";
import { passesCloudTouchFilter } from "@/lib/patterns/cloudTouch";
import clsx from "clsx";
import { swingAnchorsFromPattern } from "@/lib/patterns/autoFib";

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
  const [mode, setMode] = useState<"chart" | "scan" | "osc" | "sector">("scan");
  const [oscSub, setOscSub] = useState<"macd" | "rsi" | "elizi" | "mxe">("macd");
  const [shtFocus, setShtFocus] = useState(false);
  const [tdFocus, setTdFocus] = useState(false);
  const [bfrFocus, setBfrFocus] = useState(false);
  const [ifvgFocus, setIfvgFocus] = useState(false);
  const [smcFocus, setSmcFocus] = useState(false);
  const [qmFocus, setQmFocus] = useState(false);
  const [mavkFocus, setMavkFocus] = useState(false);
  const [bistFocus, setBistFocus] = useState(false);
  const [cloudFocus, setCloudFocus] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
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

  const openHit = (h: PatternHit) => {
    if (pane) setActivePane(pane.id);
    // Switch TF first when pattern was detected on another period, then overlay.
    if (h.timeframe && pane && String(pane.timeframe) !== String(h.timeframe)) {
      updatePane(pane.id, { timeframe: h.timeframe });
    }
    setOverlayPattern(h);
    setPatternFocus(h.id);
    const paneId = pane?.id ?? useDeskStore.getState().activePaneId;
    const anchors = swingAnchorsFromPattern(h);
    if (anchors && paneId) {
      useDeskStore.getState().placeAutoFib(paneId, anchors, `Auto Fib · ${h.label}`);
    } else if (paneId) {
      useDeskStore.getState().clearAutoFibs(paneId);
    }
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
    const tf = String(pane.timeframe);
    setProgress({ done: 0, total: 1, label: tf });

    const all: PatternHit[] = [];
    try {
      if (signal.aborted) {
        setStatus("Tarama iptal edildi");
        return;
      }
      try {
        const res = await fetch(
          `/api/klines?symbol=${encodeURIComponent(pane.symbol)}&exchange=${pane.exchange}&timeframe=${encodeURIComponent(tf)}&limit=260`,
          { signal }
        );
        const json = await res.json();
        const bars = (json.candles ?? []) as Candle[];
        if (bars.length < 40) {
          setProgress({ done: 1, total: 1, label: `${tf} (yetersiz veri)` });
        } else {
          const base = detectPatterns(bars, {
            swingStrength: patternSettings.swingStrength,
            twinTol: patternSettings.twinTol,
            boxLookback: patternSettings.boxLookback,
          }).map((h) => ({
            ...h,
            id: `${tf}_${h.id}`,
            timeframe: tf,
            label: h.label.includes("·") ? h.label : `${h.label} · ${tf}`,
          }));
          const adv = detectAdvancedAsPatternHits(bars, {
            swingStrength: patternSettings.swingStrength,
          }).map((h) => ({
            ...h,
            id: `${tf}_${h.id}`,
            timeframe: tf,
            label: h.label.includes("·") ? h.label : `${h.label} · ${tf}`,
          }));
          all.push(...adv, ...base);
        }
      } catch (e) {
        if (signal.aborted) {
          setStatus("Tarama iptal edildi");
          return;
        }
      }
      setProgress({ done: 1, total: 1, label: tf });
      if (signal.aborted) {
        setStatus("Tarama iptal edildi");
        return;
      }
      all.sort((a, b) => b.confidence - a.confidence);
      let filtered = all;
      const focusOn =
        shtFocus ||
        tdFocus ||
        bfrFocus ||
        ifvgFocus ||
        smcFocus ||
        qmFocus ||
        mavkFocus ||
        bistFocus ||
        cloudFocus;
      if (focusOn) {
        filtered = all.filter((h) => {
          const okSht = shtFocus && passesShtFilter(h, 60);
          const okTd = tdFocus && passesThreeDrivesFilter(h, 60);
          const okBfr = bfrFocus && passesBreakoutFvgRetestFilter(h, 60);
          const okIfvg = ifvgFocus && passesInversionFvgFilter(h, 55);
          const okSmc = smcFocus && passesSmcFilter(h, 55);
          const okQm = qmFocus && passesQuasimodoFilter(h, 55);
          const okMavk = mavkFocus && passesMavkFilter(h, 55);
          const okBist = bistFocus && passesBistCycleFilter(h, 50);
          const okCloud = cloudFocus && passesCloudTouchFilter(h, 55);
          return (
            okSht ||
            okTd ||
            okBfr ||
            okIfvg ||
            okSmc ||
            okQm ||
            okMavk ||
            okBist ||
            okCloud
          );
        });
      }
      const sliced = filtered.slice(0, 40);
      setPatterns(sliced);
      setStatus(
        sliced.length
          ? `${sliced.length} formasyon · ${pane.symbol} · ${tf}`
          : `Formasyon bulunamadı · ${pane.symbol}`
      );
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setScanning(false);
      setProgress({ done: 0, total: 0, label: "" });
    }
  }, [
    pane,
    patternSettings.swingStrength,
    patternSettings.twinTol,
    patternSettings.boxLookback,
    shtFocus,
    tdFocus,
    bfrFocus,
    ifvgFocus,
    smcFocus,
    qmFocus,
    mavkFocus,
    bistFocus,
    cloudFocus,
  ]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <p className="text-2xs text-desk-muted px-2 pt-2 pb-0">
        Formasyon modelleri burada ve Formasyon Tara’da; MACD/RSI/Elizi Osilatör’de;
        sektör taraması Sektör sekmesinde.
      </p>
      <div className="flex gap-1 p-2 pb-0">
        <button
          type="button"
          className={clsx("btn text-2xs flex-1", mode === "scan" && "btn-accent")}
          onClick={() => setMode("scan")}
        >
          Formasyon
        </button>
        <button
          type="button"
          className={clsx("btn text-2xs flex-1", mode === "osc" && "btn-accent")}
          onClick={() => setMode("osc")}
          title="MACD / RSI / Elizi / M×E osilatör taramaları"
        >
          Osilatör
        </button>
        <button
          type="button"
          className={clsx("btn text-2xs flex-1", mode === "sector" && "btn-accent")}
          onClick={() => setMode("sector")}
          title="Sektör momentum + sektör hisse taraması"
        >
          Sektör
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
      ) : mode === "osc" ? (
        <div className="flex flex-col h-full min-h-0">
          <div className="flex gap-1 px-2 pt-2">
            <button
              type="button"
              className={clsx("btn text-2xs flex-1", oscSub === "macd" && "btn-accent")}
              onClick={() => setOscSub("macd")}
            >
              MACD
            </button>
            <button
              type="button"
              className={clsx("btn text-2xs flex-1", oscSub === "rsi" && "btn-accent")}
              onClick={() => setOscSub("rsi")}
            >
              RSI
            </button>
            <button
              type="button"
              className={clsx("btn text-2xs flex-1", oscSub === "elizi" && "btn-accent")}
              onClick={() => setOscSub("elizi")}
              title="Elizi Edge ±E kesişim / faz→ateş"
            >
              Elizi
            </button>
            <button
              type="button"
              className={clsx("btn text-2xs flex-1", oscSub === "mxe" && "btn-accent")}
              onClick={() => setOscSub("mxe")}
              title="MACD %60 × Elizi %40 hibrit"
            >
              M×E
            </button>
          </div>
          {oscSub === "macd" ? (
            <MacdScanPanel />
          ) : oscSub === "rsi" ? (
            <RsiScanPanel />
          ) : oscSub === "elizi" ? (
            <EliziScanPanel />
          ) : (
            <MacdEliziScanPanel />
          )}
        </div>
      ) : mode === "sector" ? (
        <SectorScanPanel />
      ) : (
        <div className="flex flex-col h-full min-h-0 p-2 gap-2">
          <div className="text-xs font-medium">Formasyonlar — {pane?.symbol}</div>
          <p className="text-2xs text-desk-muted">
            Seçili grafik TF üzerinde tarar. Tara ile tarayın; tıklayınca çizilir.
            Hard refresh overlay&apos;i temizler (pane/layout localStorage&apos;da
            kalır); izleme listesi ve scriptler /api/store üzerinden yeniden
            yüklenir — sıfırlanma değil.
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

          <div className="flex flex-wrap gap-1 items-center">
            <button
              type="button"
              className={clsx("btn text-2xs", shtFocus && "btn-accent")}
              onClick={() => setShtFocus((v) => !v)}
              title="Yalnız flama/bayrak/üçgen · filtre UYGUN veya skor≥60"
            >
              SHT Flama/Üçgen
            </button>
            <button
              type="button"
              className={clsx("btn text-2xs", tdFocus && "btn-accent")}
              onClick={() => setTdFocus((v) => !v)}
              title="Üç İtiş / Three Drives · filtre UYGUN veya skor≥60"
            >
              Three Drives / Üç İtiş
            </button>
            <button
              type="button"
              className={clsx("btn text-2xs", bfrFocus && "btn-accent")}
              onClick={() => setBfrFocus((v) => !v)}
              title="Breakout · FVG · Retest · onay · skor≥60"
            >
              Breakout·FVG·Retest
            </button>
            <button
              type="button"
              className={clsx("btn text-2xs", ifvgFocus && "btn-accent")}
              onClick={() => setIfvgFocus((v) => !v)}
              title="Inversion FVG · süpürme · CHoCH · retest · skor≥55"
            >
              Inversion FVG (IFVG)
            </button>
            <button
              type="button"
              className={clsx(
                "btn text-2xs",
                (smcFocus || qmFocus || mavkFocus || bistFocus || cloudFocus) &&
                  "btn-accent"
              )}
              onClick={() => setModelsOpen((v) => !v)}
              title="SMC / QM / MAVK / BIST / Cloud"
            >
              Modeller {modelsOpen ? "▴" : "▾"}
            </button>
          </div>
          {modelsOpen && (
            <div className="flex flex-wrap gap-1 border border-desk-border/50 rounded p-1.5">
              <button
                type="button"
                className={clsx("btn text-2xs", smcFocus && "btn-accent")}
                onClick={() => setSmcFocus((v) => !v)}
                title="SMC"
              >
                SMC
              </button>
              <button
                type="button"
                className={clsx("btn text-2xs", qmFocus && "btn-accent")}
                onClick={() => setQmFocus((v) => !v)}
                title="Quasimodo"
              >
                QM
              </button>
              <button
                type="button"
                className={clsx("btn text-2xs", mavkFocus && "btn-accent")}
                onClick={() => setMavkFocus((v) => !v)}
                title="MAVK"
              >
                MAVK
              </button>
              <button
                type="button"
                className={clsx("btn text-2xs", bistFocus && "btn-accent")}
                onClick={() => setBistFocus((v) => !v)}
                title="BIST döngü"
              >
                BIST Döngü
              </button>
              <button
                type="button"
                className={clsx("btn text-2xs", cloudFocus && "btn-accent")}
                onClick={() => setCloudFocus((v) => !v)}
                title="Cloud Touch"
              >
                Cloud Touch
              </button>
            </div>
          )}

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
            {patterns.map((h) => (
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
                    {h.meta?.score != null
                      ? `Skor ${h.meta.score}`
                      : `${(h.confidence * 100).toFixed(0)}%`}
                  </span>
                </div>
                {h.timeframe && (
                  <div className="flex gap-2 mt-0.5 text-2xs text-desk-muted">
                    <span className="uppercase tracking-wide">{h.timeframe}</span>
                  </div>
                )}
                <div className="text-2xs text-desk-muted mt-0.5">{h.detail}</div>
                {h.meta && isShtFlagTriangleType(h.type) && (
                  <div className="mt-1.5 grid grid-cols-4 gap-x-1 gap-y-0.5 text-2xs font-mono border-t border-desk-border/40 pt-1">
                    <span className="text-desk-muted">Durum</span>
                    <span className={h.meta.status === "kirilim" ? "text-desk-up" : ""}>
                      {h.meta.status === "kirilim" ? "KIRILIM" : "Oluşum"}
                    </span>
                    <span className="text-desk-muted">Skor</span>
                    <span>{h.meta.score}</span>
                    <span className="text-desk-muted">Daralma%</span>
                    <span>
                      {h.meta.contractionPct != null
                        ? h.meta.contractionPct.toFixed(1)
                        : "—"}
                    </span>
                    <span className="text-desk-muted">Kırılım</span>
                    <span>
                      {h.meta.breakoutPrice != null
                        ? fmtMetaPx(h.meta.breakoutPrice)
                        : "—"}
                    </span>
                    <span className="text-desk-muted">Hedef</span>
                    <span>
                      {h.meta.targetPrice != null
                        ? fmtMetaPx(h.meta.targetPrice)
                        : "—"}
                    </span>
                    <span className="text-desk-muted">RSI/ADX</span>
                    <span>
                      {h.meta.rsi != null ? h.meta.rsi.toFixed(0) : "—"}/
                      {h.meta.adx != null ? h.meta.adx.toFixed(0) : "—"}
                    </span>
                    <span className="text-desk-muted">Filtre</span>
                    <span
                      className={
                        h.meta.filterOk ? "text-desk-up" : "text-desk-down"
                      }
                    >
                      {h.meta.filterOk ? "UYGUN" : "DEĞİL"}
                    </span>
                  </div>
                )}
                {h.meta && isThreeDrivesType(h.type) && (
                  <div className="mt-1.5 grid grid-cols-4 gap-x-1 gap-y-0.5 text-2xs font-mono border-t border-desk-border/40 pt-1">
                    <span className="text-desk-muted">Durum</span>
                    <span className={h.meta.status === "kirilim" ? "text-desk-up" : ""}>
                      {h.meta.status === "kirilim" ? "KIRILIM" : "Oluşum"}
                    </span>
                    <span className="text-desk-muted">Skor</span>
                    <span>{h.meta.score}</span>
                    <span className="text-desk-muted">Fib A/C</span>
                    <span>
                      {h.meta.fibRetraceA != null
                        ? h.meta.fibRetraceA.toFixed(3)
                        : "—"}
                      /
                      {h.meta.fibRetraceC != null
                        ? h.meta.fibRetraceC.toFixed(3)
                        : "—"}
                    </span>
                    <span className="text-desk-muted">Ext D2/D3</span>
                    <span>
                      {h.meta.fibExtD2 != null
                        ? h.meta.fibExtD2.toFixed(3)
                        : "—"}
                      /
                      {h.meta.fibExtD3 != null
                        ? h.meta.fibExtD3.toFixed(3)
                        : "—"}
                    </span>
                    <span className="text-desk-muted">Fiyat sim</span>
                    <span>
                      {h.meta.priceSymRatio != null
                        ? h.meta.priceSymRatio.toFixed(2)
                        : "—"}
                    </span>
                    <span className="text-desk-muted">Zaman sim</span>
                    <span>
                      {h.meta.timeSymRatio != null
                        ? h.meta.timeSymRatio.toFixed(2)
                        : "—"}
                    </span>
                    <span className="text-desk-muted">PRZ</span>
                    <span>
                      {h.meta.przLow != null && h.meta.przHigh != null
                        ? `${fmtMetaPx(h.meta.przLow)}-${fmtMetaPx(h.meta.przHigh)}`
                        : "—"}
                    </span>
                    <span className="text-desk-muted">Hedef</span>
                    <span>
                      {h.meta.targetPrice != null
                        ? fmtMetaPx(h.meta.targetPrice)
                        : "—"}
                    </span>
                    <span className="text-desk-muted">Filtre</span>
                    <span
                      className={
                        h.meta.filterOk ? "text-desk-up" : "text-desk-down"
                      }
                    >
                      {h.meta.filterOk ? "UYGUN" : "DEĞİL"}
                    </span>
                  </div>
                )}
                {h.meta && isBreakoutFvgRetestType(h.type) && (
                  <div className="mt-1.5 grid grid-cols-4 gap-x-1 gap-y-0.5 text-2xs font-mono border-t border-desk-border/40 pt-1">
                    <span className="text-desk-muted">Durum</span>
                    <span
                      className={
                        h.meta.status === "al_tetiklendi" ||
                        h.meta.status === "confirmation"
                          ? "text-desk-up"
                          : ""
                      }
                    >
                      {(
                        {
                          konsolidasyon: "Konsolidasyon",
                          breakout: "Breakout",
                          fvg: "FVG",
                          retest: "Retest",
                          confirmation: "Onay",
                          al_tetiklendi:
                            h.bias === "bull" ? "AL tetiklendi" : "SAT tetiklendi",
                          olusum: "Oluşum",
                          kirilim: "KIRILIM",
                        } as Record<string, string>
                      )[h.meta.status] ?? h.meta.status}
                    </span>
                    <span className="text-desk-muted">Skor</span>
                    <span>{h.meta.score}</span>
                    <span className="text-desk-muted">RH/RL</span>
                    <span>
                      {h.meta.rangeHigh != null
                        ? fmtMetaPx(h.meta.rangeHigh)
                        : "—"}
                      /
                      {h.meta.rangeLow != null
                        ? fmtMetaPx(h.meta.rangeLow)
                        : "—"}
                    </span>
                    <span className="text-desk-muted">FVG</span>
                    <span>
                      {h.meta.fvgBot != null && h.meta.fvgTop != null
                        ? `${fmtMetaPx(h.meta.fvgBot)}-${fmtMetaPx(h.meta.fvgTop)}`
                        : "—"}
                    </span>
                    <span className="text-desk-muted">Retest</span>
                    <span>
                      {h.meta.retestPrice != null
                        ? fmtMetaPx(h.meta.retestPrice)
                        : "—"}
                    </span>
                    <span className="text-desk-muted">Entry/SL</span>
                    <span>
                      {h.meta.entry != null ? fmtMetaPx(h.meta.entry) : "—"}/
                      {h.meta.stop != null ? fmtMetaPx(h.meta.stop) : "—"}
                    </span>
                    <span className="text-desk-muted">TP1/2/3</span>
                    <span>
                      {h.meta.tp1 != null ? fmtMetaPx(h.meta.tp1) : "—"}/
                      {h.meta.tp2 != null ? fmtMetaPx(h.meta.tp2) : "—"}/
                      {h.meta.tp3 != null ? fmtMetaPx(h.meta.tp3) : "—"}
                    </span>
                    <span className="text-desk-muted">Mum önce</span>
                    <span>
                      {h.meta.barsAgo != null ? h.meta.barsAgo : "—"}{" "}
                      {h.bias === "bull" ? "AL" : h.bias === "bear" ? "SAT" : ""}
                    </span>
                    <span className="text-desk-muted">Hacim/RSI</span>
                    <span>
                      {h.meta.volOk ? "OK" : "—"}/
                      {h.meta.rsi != null ? h.meta.rsi.toFixed(0) : "—"}
                    </span>
                    <span className="text-desk-muted">Filtre</span>
                    <span
                      className={
                        h.meta.filterOk ? "text-desk-up" : "text-desk-down"
                      }
                    >
                      {h.meta.filterOk ? "UYGUN" : "DEĞİL"}
                    </span>
                  </div>
                )}

                {h.meta && isInversionFvgType(h.type) && (
                  <div className="mt-1.5 grid grid-cols-4 gap-x-1 gap-y-0.5 text-2xs font-mono border-t border-desk-border/40 pt-1">
                    <span className="text-desk-muted">Durum</span>
                    <span
                      className={
                        h.meta.status === "al_tetiklendi" ||
                        h.meta.status === "sat_tetiklendi"
                          ? "text-desk-up"
                          : ""
                      }
                    >
                      {(
                        {
                          fvg: "FVG",
                          inversion: "İnversion",
                          choch: "CHoCH",
                          retest: "Retest",
                          al_tetiklendi: "AL tetiklendi",
                          sat_tetiklendi: "SAT tetiklendi",
                          konsolidasyon: "Konsolidasyon",
                          breakout: "Breakout",
                          confirmation: "Onay",
                          olusum: "Oluşum",
                          kirilim: "KIRILIM",
                        } as Record<string, string>
                      )[h.meta.status] ?? h.meta.status}
                    </span>
                    <span className="text-desk-muted">Skor</span>
                    <span>{h.meta.score}</span>
                    <span className="text-desk-muted">Süpürme</span>
                    <span className={h.meta.sweep ? "text-desk-up" : ""}>
                      {h.meta.sweep ? "VAR" : "YOK"}
                    </span>
                    <span className="text-desk-muted">FVG</span>
                    <span>
                      {h.meta.fvgBot != null && h.meta.fvgTop != null
                        ? `${fmtMetaPx(h.meta.fvgBot)}-${fmtMetaPx(h.meta.fvgTop)}`
                        : "—"}
                    </span>
                    <span className="text-desk-muted">CHoCH</span>
                    <span>
                      {h.meta.chochPrice != null
                        ? fmtMetaPx(h.meta.chochPrice)
                        : "—"}
                    </span>
                    <span className="text-desk-muted">Entry/SL</span>
                    <span>
                      {h.meta.entry != null ? fmtMetaPx(h.meta.entry) : "—"}/
                      {h.meta.stop != null ? fmtMetaPx(h.meta.stop) : "—"}
                    </span>
                    <span className="text-desk-muted">TP1/2/3</span>
                    <span>
                      {h.meta.tp1 != null ? fmtMetaPx(h.meta.tp1) : "—"}/
                      {h.meta.tp2 != null ? fmtMetaPx(h.meta.tp2) : "—"}/
                      {h.meta.tp3 != null ? fmtMetaPx(h.meta.tp3) : "—"}
                    </span>
                    <span className="text-desk-muted">Risk R</span>
                    <span>
                      {h.meta.riskR != null ? fmtMetaPx(h.meta.riskR) : "—"}
                    </span>
                    <span className="text-desk-muted">Mum önce</span>
                    <span>
                      {h.meta.barsAgo != null ? h.meta.barsAgo : "—"}{" "}
                      {h.meta.status === "sat_tetiklendi" || h.bias === "bear"
                        ? "SAT"
                        : h.bias === "bull"
                          ? "AL"
                          : ""}
                    </span>
                    <span className="text-desk-muted">Filtre</span>
                    <span
                      className={
                        h.meta.filterOk ? "text-desk-up" : "text-desk-down"
                      }
                    >
                      {h.meta.filterOk ? "UYGUN" : "DEĞİL"}
                    </span>
                  </div>
                )}
                <div className="text-2xs text-desk-muted mt-1">
                  {h.drawings.length} çizim · {h.type}
                </div>
              </button>
            ))}
            {!patterns.length && !scanning && (
              <div className="text-2xs text-desk-muted">
                Tara — canlı tarama yok; yalnızca butonla çalışır.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function fmtMetaPx(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}
