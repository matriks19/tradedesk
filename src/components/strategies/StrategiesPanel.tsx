"use client";

import { useMemo, useState } from "react";
import { useDeskStore } from "@/store/desk";
import {
  CATEGORY_LABELS,
  KILLZONES_TR,
  STRATEGY_CATEGORY_ORDER,
  STRATEGY_PACKS,
  type StrategyCategory,
  type StrategyPack,
} from "@/lib/strategies";
import clsx from "clsx";

function nowInKillzone(): string | null {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00";
  const cur = `${hh}:${mm}`;
  const toMin = (s: string) => {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  };
  const c = toMin(cur);
  for (const z of KILLZONES_TR) {
    const a = toMin(z.start);
    const b = toMin(z.end);
    if (c >= a && c <= b) return z.label;
  }
  return null;
}

function packSortKey(s: StrategyPack): number {
  const catRank = STRATEGY_CATEGORY_ORDER.indexOf(s.category);
  const cat = catRank < 0 ? 99 : catRank;
  const edge = s.edgeScore ?? (s.category === "high_edge" ? 50 : 0);
  return cat * 1000 - edge;
}

export function StrategiesPanel() {
  const { activeStrategyId, applyStrategyPack, setSidebarTab } = useDeskStore();
  const [cat, setCat] = useState<StrategyCategory | "all">("all");
  const [tfFilter, setTfFilter] = useState<"all" | "5m" | "10m" | "15m" | "30m" | "1h" | "2h">("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(activeStrategyId);
  const [toast, setToast] = useState<string | null>(null);
  const kz = nowInKillzone();

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const filtered = STRATEGY_PACKS.filter((s) => {
      if (cat !== "all" && s.category !== cat) return false;
      if (
        tfFilter !== "all" &&
        s.timeframe !== tfFilter &&
        !s.tags.includes(tfFilter)
      )
        return false;
      if (!qq) return true;
      return (
        s.name.toLowerCase().includes(qq) ||
        s.summary.toLowerCase().includes(qq) ||
        s.tags.some((t) => t.toLowerCase().includes(qq)) ||
        s.inspiredBy.toLowerCase().includes(qq) ||
        (s.researchNote?.toLowerCase().includes(qq) ?? false)
      );
    });
    return filtered.sort((a, b) => {
      const d = packSortKey(a) - packSortKey(b);
      if (d !== 0) return d;
      return a.name.localeCompare(b.name, "tr");
    });
  }, [cat, tfFilter, q]);

  const apply = (s: StrategyPack) => {
    applyStrategyPack(s.id);
    setOpenId(s.id);
    setToast(`Uygulandı: ${s.name} · TF ${s.timeframe}`);
    window.setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="flex flex-col h-full min-h-0 text-xs">
      <div className="p-2 border-b border-desk-border space-y-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">Strateji paketleri</div>
          {kz ? (
            <span className="text-2xs text-desk-up">KZ: {kz}</span>
          ) : (
            <span className="text-2xs text-desk-muted">KZ dışı</span>
          )}
        </div>
        <p className="text-2xs text-desk-muted leading-snug">
          YouTube / retail playbook'lardan derlendi. Tek tık: grafik
          göstergeleri + TF + risk + backtest/tarayıcı. ★ Yüksek başarı =
          literatür iddiası — ölçülmüş win-rate değil.
        </p>
        <input
          className="input w-full text-2xs"
          placeholder="Ara: Elizi, ORB, RSI2, Turtle, ICT, Jurik…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          {(["all", "5m", "10m", "15m", "30m", "1h", "2h"] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              className={clsx("btn text-2xs", tfFilter === tf && "btn-accent")}
              onClick={() => setTfFilter(tf)}
            >
              {tf === "all" ? "Tüm TF" : tf}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            className={clsx("btn text-2xs", cat === "all" && "btn-accent")}
            onClick={() => setCat("all")}
          >
            Tümü
          </button>
          {STRATEGY_CATEGORY_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              className={clsx(
                "btn text-2xs",
                cat === c && "btn-accent",
                c === "high_edge" &&
                  cat !== c &&
                  "border border-amber-500/40 text-amber-400/90",
                c === "elizi" &&
                  cat !== c &&
                  "border border-fuchsia-500/40 text-fuchsia-300/90"
              )}
              onClick={() => setCat(c)}
            >
              {c === "high_edge"
                ? `★ ${CATEGORY_LABELS[c]}`
                : c === "elizi"
                  ? `◈ ${CATEGORY_LABELS[c]}`
                  : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        {toast && <div className="text-2xs text-desk-up">{toast}</div>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {list.map((s) => {
          const open = openId === s.id;
          const active = activeStrategyId === s.id;
          const lit = s.literatureEstimate;
          return (
            <div
              key={s.id}
              className={clsx(
                "border rounded border-desk-border/60 p-2 space-y-1.5",
                active && "border-desk-accent/60 bg-desk-elevated/40",
                s.category === "high_edge" && !active && "border-amber-500/25",
                s.category === "elizi" && !active && "border-fuchsia-500/30"
              )}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => setOpenId(open ? null : s.id)}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium">{s.name}</span>
                    {s.category === "high_edge" && (
                      <span
                        className="text-2xs px-1 rounded border border-amber-500/40 text-amber-400/90"
                        title="Literatür / topluluk kaynaklı — garanti değil"
                      >
                        ★ araştırılmış
                      </span>
                    )}
                    {s.category === "elizi" && (
                      <span
                        className="text-2xs px-1 rounded border border-fuchsia-500/45 text-fuchsia-300/95"
                        title="Elizi Lab proprietary composite — not measured WR; validate in backtest"
                      >
                        ◈ Elizi
                      </span>
                    )}
                    {active && (
                      <span className="text-2xs text-desk-accent">aktif</span>
                    )}
                  </div>
                  <div className="text-2xs text-desk-muted line-clamp-2">
                    {s.summary}
                  </div>
                </button>
                <button
                  type="button"
                  className="btn-accent text-2xs shrink-0"
                  onClick={() => apply(s)}
                >
                  Uygula
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                <span
                  className={clsx(
                    "text-2xs px-1 rounded bg-desk-elevated",
                    s.category === "high_edge"
                      ? "text-amber-400/90"
                      : s.category === "elizi"
                        ? "text-fuchsia-300/90"
                        : "text-desk-muted"
                  )}
                >
                  {CATEGORY_LABELS[s.category]}
                </span>
                <span className="text-2xs px-1 rounded bg-desk-elevated text-desk-muted">
                  {s.timeframe}
                </span>
                {s.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="text-2xs px-1 rounded bg-desk-elevated text-desk-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>
              {lit && (lit.winRateHint || lit.expectancyHint) && (
                <div className="text-2xs text-amber-400/75 leading-snug">
                  {lit.winRateHint && <span>Lit. WR: {lit.winRateHint}</span>}
                  {lit.winRateHint && lit.expectancyHint && " · "}
                  {lit.expectancyHint && (
                    <span>Expectancy: {lit.expectancyHint}</span>
                  )}
                  <span className="block text-desk-muted/90 mt-0.5">
                    {lit.disclaimer ??
                      "Literatür/topluluk iddiası — ölçülmüş TradeDesk WR değil"}
                  </span>
                </div>
              )}
              {open && (
                <div className="space-y-1.5 pt-1 border-t border-desk-border/40">
                  <p className="text-2xs text-desk-muted italic">
                    Kaynak ilham: {s.inspiredBy}
                  </p>
                  {s.researchNote && (
                    <p className="text-2xs text-amber-400/80 leading-snug rounded bg-amber-500/5 px-1.5 py-1 border border-amber-500/20">
                      Araştırma notu: {s.researchNote}
                    </p>
                  )}
                  <ol className="list-decimal pl-4 text-2xs space-y-0.5 text-desk-muted">
                    {s.howTo.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ol>
                  <p className="text-2xs">
                    <span className="text-desk-muted">Risk: </span>
                    {s.risk.tip} (hedef ~{s.risk.rMultiple}R)
                  </p>
                  <div className="text-2xs text-desk-muted">
                    Göstergeler:{" "}
                    {s.indicators
                      .map((i) =>
                        i.params?.period
                          ? `${i.type}(${i.params.period})`
                          : i.type
                      )
                      .join(", ")}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {s.backtestPreset && (
                      <button
                        type="button"
                        className="btn text-2xs"
                        onClick={() => {
                          apply(s);
                          setSidebarTab("backtest");
                        }}
                      >
                        Backtest'e git
                      </button>
                    )}
                    {(s.scannerPresets?.length || s.scannerChips?.length) && (
                      <button
                        type="button"
                        className="btn text-2xs"
                        onClick={() => {
                          apply(s);
                          setSidebarTab("scanner");
                        }}
                      >
                        Tarayıcıya git
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn text-2xs"
                      onClick={() => {
                        apply(s);
                        setSidebarTab("risk");
                      }}
                    >
                      Risk paneli
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {!list.length && (
          <div className="rounded border border-desk-border/50 p-3 space-y-1">
            <p className="text-2xs text-desk-muted">Eşleşen strateji yok.</p>
            <p className="text-2xs text-desk-muted/80">
              TF veya kategori filtresini gevşet; ★ Yüksek başarı tüm TF'lerde
              (1d RSI2, 4h kanal…) listelenir — 5m filtresi onları gizler.
            </p>
            <button
              type="button"
              className="btn text-2xs"
              onClick={() => {
                setCat("high_edge");
                setTfFilter("all");
                setQ("");
              }}
            >
              ★ Yüksek başarı'yı göster
            </button>
          </div>
        )}

        <section className="pt-2 border-t border-desk-border/40 space-y-1">
          <div className="text-2xs font-medium text-desk-muted">
            Killzone (TR / UTC+3)
          </div>
          {KILLZONES_TR.map((z) => (
            <div
              key={z.id}
              className="flex justify-between text-2xs font-mono text-desk-muted"
            >
              <span>{z.label}</span>
              <span>
                {z.start}–{z.end}
              </span>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
