"use client";

import { useCallback, useMemo, useState } from "react";
import { useDeskStore } from "@/store/desk";
import type { Candle, Exchange, Timeframe, AlertScanKey } from "@/lib/types";
import {
  mapPool,
  matchFilters,
  type ScannerFilter,
} from "@/lib/scanner/engine";
import { fetchWatchlistQuotes } from "@/lib/scanner/watchlistQuotes";
import {
  scanSymbol,
  indicatorParamsFromConfig,
  KIND_TO_INDICATOR,
  type HamCond,
  type MacdCond,
  type StochCond,
  type DiagCond,
  type ListScanConfig,
  type ListScanHit,
  type ListScanKind,
} from "@/lib/scanner/listScan";
import clsx from "clsx";

const TFS: Timeframe[] = ["5m", "15m", "30m", "1h", "4h", "1d"];

const HAM_CHIPS: { id: HamCond; label: string }[] = [
  { id: "raw_up", label: "Raw↑" },
  { id: "raw_dn", label: "Raw↓" },
  { id: "hist_zero_up", label: "Hist0↑" },
  { id: "hist_zero_dn", label: "Hist0↓" },
  { id: "hist_pos", label: "Hist+" },
  { id: "hist_neg", label: "Hist−" },
  { id: "hist_turn", label: "Hist→" },
  { id: "raw_x_hist_up", label: "Raw×H↑" },
  { id: "raw_x_hist_dn", label: "Raw×H↓" },
  { id: "setup", label: "Setup" },
  { id: "confirm", label: "Onay" },
  { id: "al", label: "AL" },
];

const DIAG_CHIPS: { id: DiagCond; label: string }[] = [
  { id: "bounce", label: "Temas" },
  { id: "break", label: "Kırılım" },
  { id: "twin_bull", label: "İkili↑" },
  { id: "twin_bear", label: "İkili↓" },
  { id: "triple_bull", label: "Üçlü↑" },
  { id: "triple_bear", label: "Üçlü↓" },
];

const MACD_CHIPS: { id: MacdCond; label: string }[] = [
  { id: "cross_up", label: "×Sig↑" },
  { id: "cross_dn", label: "×Sig↓" },
  { id: "hist_zero_up", label: "Hist0↑" },
  { id: "hist_zero_dn", label: "Hist0↓" },
  { id: "hist_pos", label: "Hist+" },
  { id: "hist_neg", label: "Hist−" },
];

const STOCH_CHIPS: { id: StochCond; label: string }[] = [
  { id: "os", label: "OS" },
  { id: "ob", label: "OB" },
  { id: "kx_up", label: "K×D↑" },
  { id: "kx_dn", label: "K×D↓" },
  { id: "kx_up_os", label: "↑15–25" },
  { id: "kx_dn_ob", label: "↓75–85" },
];

const EXTRA_CHIPS: { id: string; label: string; filter: ScannerFilter }[] = [
  { id: "rsi30", label: "RSI<30", filter: { type: "rsi", op: "lt", value: 30 } },
  { id: "rsi70", label: "RSI>70", filter: { type: "rsi", op: "gt", value: 70 } },
  { id: "vol2", label: "Vol×2", filter: { type: "volumeSpike", mult: 2 } },
  { id: "ema_b", label: "EMA↑", filter: { type: "emaCross", direction: "bull" } },
];

type ResultRow = ListScanHit & {
  symbol: string;
  exchange: Exchange;
};

function toggleIn<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={clsx(
        "px-1.5 py-0.5 rounded text-2xs border",
        active
          ? "border-desk-accent bg-desk-accent/20 text-desk-accent"
          : "border-desk-border/50 text-desk-muted hover:border-desk-border"
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function NumInput({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="text-2xs text-desk-muted flex flex-col gap-0.5 min-w-0">
      <span className="truncate">{label}</span>
      <input
        type="number"
        className="input text-2xs py-0.5"
        value={value}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
      <span>{label}</span>
      <input
        type="color"
        className="h-6 w-full cursor-pointer bg-transparent border border-desk-border/40 rounded"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SectionCard({
  title,
  enabled,
  onToggle,
  open,
  onOpen,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  open: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-desk-border/40 rounded">
      <div className="flex items-center gap-2 px-2 py-1 bg-desk-elevated/50">
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          className="accent-desk-accent"
        />
        <button
          type="button"
          className="flex-1 text-left text-xs font-medium"
          onClick={onOpen}
        >
          {title} {open ? "▾" : "▸"}
        </button>
      </div>
      {open && <div className="p-2 space-y-2">{children}</div>}
    </div>
  );
}

function hamCondToScanKey(cond: string): AlertScanKey | null {
  if (cond === "setup") return "ham_setup";
  if (cond === "confirm") return "ham_confirm";
  if (cond === "al") return "ham_al";
  return null;
}

function diagCondToScanKey(cond: string): AlertScanKey | null {
  if (cond === "bounce") return "diag_bounce";
  if (cond === "break") return "diag_break";
  return null;
}

export function ListScanPanel() {
  const watchlists = useDeskStore((s) => s.watchlists);
  const activeWatchlistId = useDeskStore((s) => s.activeWatchlistId);
  const panes = useDeskStore((s) => s.panes);
  const activePaneId = useDeskStore((s) => s.activePaneId);
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);
  const addIndicator = useDeskStore((s) => s.addIndicator);
  const updateIndicatorParams = useDeskStore((s) => s.updateIndicatorParams);
  const addAlertsBulk = useDeskStore((s) => s.addAlertsBulk);

  const pane = panes.find((p) => p.id === activePaneId) ?? panes[0];
  const list =
    watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0];

  const [tf, setTf] = useState<Timeframe>(
    () => (pane?.timeframe as Timeframe) || "15m"
  );
  const [maxBars, setMaxBars] = useState(2);
  const [matchMode, setMatchMode] = useState<"any" | "all">("any");

  const [hamOn, setHamOn] = useState(true);
  const [diagOn, setDiagOn] = useState(false);
  const [macdOn, setMacdOn] = useState(false);
  const [stochOn, setStochOn] = useState(false);

  const [hamConds, setHamConds] = useState<HamCond[]>(["setup", "al"]);
  const [diagConds, setDiagConds] = useState<DiagCond[]>(["bounce"]);
  const [macdConds, setMacdConds] = useState<MacdCond[]>(["cross_up"]);
  const [stochConds, setStochConds] = useState<StochCond[]>(["kx_up_os"]);

  const [hamLen, setHamLen] = useState(21);
  const [momSpan, setMomSpan] = useState(10);
  const [normLen, setNormLen] = useState(80);
  const [jLen, setJLen] = useState(20);
  const [jPhase, setJPhase] = useState(0);
  const [postSmooth, setPostSmooth] = useState(5);
  const [colorOsc, setColorOsc] = useState("#18d0bd");
  const [colorRaw, setColorRaw] = useState("#8b95a8");
  const [colorHistUp, setColorHistUp] = useState("#00c878");
  const [colorHistDn, setColorHistDn] = useState("#dc283c");

  const [pivotWindow, setPivotWindow] = useState(6);
  const [historyBars, setHistoryBars] = useState(300);
  const [left, setLeft] = useState(30);
  const [right, setRight] = useState(30);
  const [colorSup, setColorSup] = useState("#7BCB8B");
  const [colorRes, setColorRes] = useState("#ff77ad");

  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);
  const [colorMacd, setColorMacd] = useState("#2962ff");
  const [colorSignal, setColorSignal] = useState("#ff6d00");
  const [colorHist, setColorHist] = useState("#26a69a");

  const [kPeriod, setKPeriod] = useState(14);
  const [dPeriod, setDPeriod] = useState(3);
  const [stochOs, setStochOs] = useState(20);
  const [stochOb, setStochOb] = useState(80);
  const [colorK, setColorK] = useState("#2962ff");
  const [colorD, setColorD] = useState("#ff6d00");

  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [openCard, setOpenCard] = useState<string | null>("ham");
  const [extraOpen, setExtraOpen] = useState(false);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [status, setStatus] = useState("");
  const [hits, setHits] = useState<ResultRow[]>([]);

  const buildConfig = useCallback((): ListScanConfig => {
    return {
      matchMode,
      ham: {
        enabled: hamOn,
        conds: hamConds,
        hamLen,
        momSpan,
        normLen,
        jLen,
        jPhase,
        postSmooth,
        colorOsc,
        colorRaw,
        colorHistUp,
        colorHistDn,
      },
      diag: {
        enabled: diagOn,
        conds: diagConds,
        pivotWindow,
        historyBars,
        left,
        right,
        colorSup,
        colorRes,
      },
      macd: {
        enabled: macdOn,
        conds: macdConds,
        fast: macdFast,
        slow: macdSlow,
        signal: macdSignal,
        colorMacd,
        colorSignal,
        colorHist,
      },
      stoch: {
        enabled: stochOn,
        conds: stochConds,
        kPeriod,
        dPeriod,
        os: stochOs,
        ob: stochOb,
        colorK,
        colorD,
      },
      extraFilters: EXTRA_CHIPS.filter((c) => extraIds.includes(c.id)).map(
        (c) => c.filter
      ),
    };
  }, [
    matchMode,
    hamOn,
    hamConds,
    hamLen,
    momSpan,
    normLen,
    jLen,
    jPhase,
    postSmooth,
    colorOsc,
    colorRaw,
    colorHistUp,
    colorHistDn,
    diagOn,
    diagConds,
    pivotWindow,
    historyBars,
    left,
    right,
    colorSup,
    colorRes,
    macdOn,
    macdConds,
    macdFast,
    macdSlow,
    macdSignal,
    colorMacd,
    colorSignal,
    colorHist,
    stochOn,
    stochConds,
    kPeriod,
    dPeriod,
    stochOs,
    stochOb,
    colorK,
    colorD,
    extraIds,
  ]);

  const runScan = useCallback(async () => {
    if (!list?.symbols.length) {
      setStatus("Aktif izleme listesi boş");
      return;
    }
    const cfg = buildConfig();
    if (!cfg.ham?.enabled && !cfg.diag?.enabled && !cfg.macd?.enabled && !cfg.stoch?.enabled) {
      setStatus("En az bir gösterge seçin");
      return;
    }
    setRunning(true);
    setHits([]);
    setStatus("");
    setProgress(`0/${list.symbols.length}`);
    try {
      const quotes = await fetchWatchlistQuotes(list.symbols);
      const out: ResultRow[] = [];
      let done = 0;
      await mapPool(quotes, 8, async (q) => {
        try {
          const kr = await fetch(
            `/api/klines?symbol=${encodeURIComponent(q.symbol)}&exchange=${q.exchange}&timeframe=${tf}&limit=220`
          );
          const kj = await kr.json();
          const candles: Candle[] = kj.candles ?? [];
          if (candles.length < 50) return null;
          let found = scanSymbol(candles, cfg, maxBars);
          if (found.length && cfg.extraFilters?.length) {
            const m = matchFilters(q, candles, cfg.extraFilters);
            if (!m.ok) found = [];
            else {
              found = found.map((h) => ({
                ...h,
                note: m.note ? `${h.note} · ${m.note}` : h.note,
              }));
            }
          }
          for (const h of found) {
            out.push({ ...h, symbol: q.symbol, exchange: q.exchange });
          }
        } catch {
          /* skip */
        } finally {
          done += 1;
          setProgress(`${done}/${quotes.length}`);
        }
        return null;
      });
      out.sort(
        (a, b) =>
          a.barsAgo - b.barsAgo ||
          a.symbol.localeCompare(b.symbol) ||
          a.kind.localeCompare(b.kind)
      );
      setHits(out);
      setStatus(
        `${out.length} hit · ${list.symbols.length} sembol · ${tf} · ≤${maxBars} bar · ${matchMode === "all" ? "Hepsi" : "Herhangi"}`
      );
    } finally {
      setRunning(false);
      setProgress("");
    }
  }, [list, buildConfig, tf, maxBars, matchMode]);

  const upsertIndicators = useCallback(
    (cfg: ListScanConfig) => {
      if (!pane) return;
      const kinds: ListScanKind[] = [];
      if (cfg.ham?.enabled) kinds.push("ham");
      if (cfg.diag?.enabled) kinds.push("diag");
      if (cfg.macd?.enabled) kinds.push("macd");
      if (cfg.stoch?.enabled) kinds.push("stoch");
      for (const kind of kinds) {
        const type = KIND_TO_INDICATOR[kind];
        const params = indicatorParamsFromConfig(kind, cfg);
        const existing = pane.indicators.find((i) => i.type === type);
        if (existing) {
          updateIndicatorParams(pane.id, existing.id, params);
        } else {
          addIndicator(pane.id, type);
          // params applied after add — re-read from store
          const fresh = useDeskStore
            .getState()
            .panes.find((p) => p.id === pane.id);
          const added = fresh?.indicators
            .slice()
            .reverse()
            .find((i) => i.type === type);
          if (added) updateIndicatorParams(pane.id, added.id, params);
        }
      }
    },
    [pane, addIndicator, updateIndicatorParams]
  );

  const onHitClick = useCallback(
    (row: ResultRow) => {
      const cfg = buildConfig();
      openSymbolInActive(row.symbol, row.exchange, tf);
      // slight delay so pane symbol updates first
      setTimeout(() => upsertIndicators(cfg), 0);
    },
    [buildConfig, openSymbolInActive, tf, upsertIndicators]
  );

  const bulkAlerts = useCallback(async () => {
    if (!hits.length) {
      setStatus("Önce Listeyi tara");
      return;
    }
    const cfg = buildConfig();
    const items: Parameters<typeof addAlertsBulk>[0] = [];
    const byEx = new Map<Exchange, string[]>();
    const scanCandidates: ResultRow[] = [];

    for (const h of hits) {
      let scanKey: AlertScanKey | null = null;
      if (h.kind === "ham") scanKey = hamCondToScanKey(h.cond);
      if (h.kind === "diag") scanKey = diagCondToScanKey(h.cond);
      if (scanKey) {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: h.kind === "ham" ? "HAM" : "Diag",
          scanKey,
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
        });
      } else {
        scanCandidates.push(h);
        const arr = byEx.get(h.exchange) ?? [];
        if (!arr.includes(h.symbol)) arr.push(h.symbol);
        byEx.set(h.exchange, arr);
      }
    }

    for (const [ex, syms] of byEx) {
      try {
        const res = await fetch(
          `/api/ticker?exchange=${ex}&symbols=${syms.join(",")}`
        );
        const json = await res.json();
        const by = new Map<string, number>();
        for (const q of json.quotes ?? []) {
          if (q?.symbol && Number.isFinite(q.last))
            by.set(q.symbol, Number(q.last));
        }
        for (const sym of syms) {
          const last = by.get(sym);
          if (last == null) continue;
          const hit = scanCandidates.find((h) => h.symbol === sym);
          items.push({
            symbol: sym,
            exchange: ex,
            condition: "cross_above",
            price: Number((last * 1.03).toFixed(4)),
            note: hit?.note ? `${hit.note} +%3` : "liste tarama +%3",
            lastPrice: last,
            kind: "price",
            group: "Liste",
            repeat: "once",
            expiresAt: Date.now() + 24 * 3600_000,
          });
        }
      } catch {
        /* skip */
      }
    }

    // Avoid unused cfg lint — keep for future scan-param alerts
    void cfg;
    const n = addAlertsBulk(items);
    setStatus(`${n} alarm eklendi`);
  }, [hits, buildConfig, addAlertsBulk, tf]);

  const listLabel = useMemo(
    () => `${list?.name ?? "—"} (${list?.symbols.length ?? 0})`,
    [list]
  );

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2 text-xs overflow-y-auto">
      <div className="font-medium">Liste Tarama</div>
      <div className="text-2xs text-desk-muted">{listLabel}</div>

      <div className="flex flex-wrap gap-1 items-end">
        <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
          TF
          <select
            className="input text-2xs py-0.5"
            value={tf}
            onChange={(e) => setTf(e.target.value as Timeframe)}
          >
            {TFS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <NumInput label="Max bar" value={maxBars} onChange={setMaxBars} />
        <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
          Eşleşme
          <select
            className="input text-2xs py-0.5"
            value={matchMode}
            onChange={(e) => setMatchMode(e.target.value as "any" | "all")}
          >
            <option value="any">Herhangi</option>
            <option value="all">Hepsi</option>
          </select>
        </label>
      </div>

      <SectionCard
        title="HAM"
        enabled={hamOn}
        onToggle={() => setHamOn((v) => !v)}
        open={openCard === "ham"}
        onOpen={() => setOpenCard((c) => (c === "ham" ? null : "ham"))}
      >
        <div className="flex flex-wrap gap-1">
          {HAM_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={hamConds.includes(c.id)}
              label={c.label}
              onClick={() => setHamConds((a) => toggleIn(a, c.id))}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          <NumInput label="hamLen" value={hamLen} onChange={setHamLen} />
          <NumInput label="momSpan" value={momSpan} onChange={setMomSpan} />
          <NumInput label="normLen" value={normLen} onChange={setNormLen} />
          <NumInput label="jLen" value={jLen} onChange={setJLen} />
          <NumInput label="jPhase" value={jPhase} onChange={setJPhase} />
          <NumInput label="postSm" value={postSmooth} onChange={setPostSmooth} />
        </div>
        <div className="grid grid-cols-4 gap-1">
          <ColorInput label="Osc" value={colorOsc} onChange={setColorOsc} />
          <ColorInput label="Raw" value={colorRaw} onChange={setColorRaw} />
          <ColorInput label="Hist+" value={colorHistUp} onChange={setColorHistUp} />
          <ColorInput label="Hist−" value={colorHistDn} onChange={setColorHistDn} />
        </div>
      </SectionCard>

      <SectionCard
        title="Diag"
        enabled={diagOn}
        onToggle={() => setDiagOn((v) => !v)}
        open={openCard === "diag"}
        onOpen={() => setOpenCard((c) => (c === "diag" ? null : "diag"))}
      >
        <div className="flex flex-wrap gap-1">
          {DIAG_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={diagConds.includes(c.id)}
              label={c.label}
              onClick={() => setDiagConds((a) => toggleIn(a, c.id))}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          <NumInput label="pivot" value={pivotWindow} onChange={setPivotWindow} />
          <NumInput label="history" value={historyBars} onChange={setHistoryBars} />
          <NumInput label="left" value={left} onChange={setLeft} />
          <NumInput label="right" value={right} onChange={setRight} />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <ColorInput label="Destek" value={colorSup} onChange={setColorSup} />
          <ColorInput label="Direnç" value={colorRes} onChange={setColorRes} />
        </div>
      </SectionCard>

      <SectionCard
        title="MACD"
        enabled={macdOn}
        onToggle={() => setMacdOn((v) => !v)}
        open={openCard === "macd"}
        onOpen={() => setOpenCard((c) => (c === "macd" ? null : "macd"))}
      >
        <div className="flex flex-wrap gap-1">
          {MACD_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={macdConds.includes(c.id)}
              label={c.label}
              onClick={() => setMacdConds((a) => toggleIn(a, c.id))}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          <NumInput label="fast" value={macdFast} onChange={setMacdFast} />
          <NumInput label="slow" value={macdSlow} onChange={setMacdSlow} />
          <NumInput label="signal" value={macdSignal} onChange={setMacdSignal} />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <ColorInput label="MACD" value={colorMacd} onChange={setColorMacd} />
          <ColorInput label="Signal" value={colorSignal} onChange={setColorSignal} />
          <ColorInput label="Hist" value={colorHist} onChange={setColorHist} />
        </div>
      </SectionCard>

      <SectionCard
        title="Stoch"
        enabled={stochOn}
        onToggle={() => setStochOn((v) => !v)}
        open={openCard === "stoch"}
        onOpen={() => setOpenCard((c) => (c === "stoch" ? null : "stoch"))}
      >
        <div className="flex flex-wrap gap-1">
          {STOCH_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={stochConds.includes(c.id)}
              label={c.label}
              onClick={() => setStochConds((a) => toggleIn(a, c.id))}
            />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1">
          <NumInput label="%K" value={kPeriod} onChange={setKPeriod} />
          <NumInput label="%D" value={dPeriod} onChange={setDPeriod} />
          <NumInput label="OS" value={stochOs} onChange={setStochOs} />
          <NumInput label="OB" value={stochOb} onChange={setStochOb} />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <ColorInput label="%K" value={colorK} onChange={setColorK} />
          <ColorInput label="%D" value={colorD} onChange={setColorD} />
        </div>
      </SectionCard>

      <div className="border border-desk-border/40 rounded">
        <button
          type="button"
          className="w-full text-left px-2 py-1 text-xs bg-desk-elevated/50"
          onClick={() => setExtraOpen((v) => !v)}
        >
          Özel şart {extraOpen ? "▾" : "▸"}
        </button>
        {extraOpen && (
          <div className="p-2 flex flex-wrap gap-1">
            {EXTRA_CHIPS.map((c) => (
              <Chip
                key={c.id}
                active={extraIds.includes(c.id)}
                label={c.label}
                onClick={() => setExtraIds((a) => toggleIn(a, c.id))}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="btn-accent text-2xs"
          disabled={running}
          onClick={() => void runScan()}
        >
          {running ? "Taranıyor…" : "Listeyi tara"}
        </button>
        <button
          type="button"
          className="btn text-2xs"
          disabled={!hits.length || running}
          onClick={() => void bulkAlerts()}
        >
          Hitlere alarm
        </button>
      </div>

      {(progress || status) && (
        <div className="text-2xs text-desk-muted">
          {progress && <span className="mr-2">{progress}</span>}
          {status}
        </div>
      )}

      {hits.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto border border-desk-border/40 rounded">
          {hits.map((h, i) => (
            <button
              key={`${h.symbol}_${h.kind}_${h.cond}_${h.barsAgo}_${i}`}
              type="button"
              className="w-full text-left px-2 py-1 text-2xs border-b border-desk-border/30 hover:bg-desk-elevated flex gap-1.5 items-center"
              onClick={() => onHitClick(h)}
            >
              <span className="font-medium shrink-0">{h.symbol}</span>
              <span
                className={clsx(
                  "shrink-0",
                  h.bias === "bull"
                    ? "text-desk-up"
                    : h.bias === "bear"
                      ? "text-desk-down"
                      : "text-desk-muted"
                )}
              >
                {h.kind.toUpperCase()}
              </span>
              <span className="text-desk-muted flex-1 truncate">{h.note}</span>
              <span className="font-mono shrink-0">−{h.barsAgo}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
