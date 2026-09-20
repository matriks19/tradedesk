"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { AlertWatcher } from "@/components/alerts/AlertWatcher";
import { useDeskStore } from "@/store/desk";
import { getPopularSeedScripts } from "@/lib/scripts/catalog";
import type { CustomScript } from "@/lib/types";
import { parseDeskOpenSearch } from "@/lib/deskLink";

/** Heavy: lightweight-charts + indicator registry + ChartPane — load after Liste shell. */
const ChartGrid = dynamic(
  () =>
    import("@/components/chart/ChartGrid").then((m) => m.ChartGrid),
  {
    ssr: false,
    loading: () => <ChartBootPlaceholder label="Grafik yükleniyor…" />,
  }
);

function ChartBootPlaceholder({ label }: { label: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-desk-muted text-xs select-none">
      {label}
    </div>
  );
}

/**
 * Defer ChartGrid (and thus /api/klines) until after first paint + idle so Liste /
 * sidebar stay interactive on boot. Mount immediately when chartEager (symbol open
 * / deep-link) or after a short idle timeout.
 */
function useDeferChartMount(chartEager: boolean): boolean {
  const [idleReady, setIdleReady] = useState(false);

  useEffect(() => {
    if (chartEager) return;
    let cancelled = false;
    const enable = () => {
      if (!cancelled) setIdleReady(true);
    };
    const w = window as Window & {
      requestIdleCallback?: (
        cb: IdleRequestCallback,
        opts?: IdleRequestOptions
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | undefined;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(() => enable(), { timeout: 1500 });
    }
    // Guarantees mount even without ric / if main thread stays busy (scan UI first ~0.6–1.5s).
    const t = window.setTimeout(enable, 750);
    return () => {
      cancelled = true;
      if (idleId != null) w.cancelIdleCallback?.(idleId);
      window.clearTimeout(t);
    };
  }, [chartEager]);

  return chartEager || idleReady;
}

export function TerminalShell() {
  const hydrateFromServer = useDeskStore((s) => s.hydrateFromServer);
  const upsertScript = useDeskStore((s) => s.upsertScript);
  const chartEager = useDeskStore((s) => s.chartEager);
  const seeded = useRef(false);
  const showChart = useDeferChartMount(chartEager);

  useEffect(() => {
    const applyLink = () => {
      const hit = parseDeskOpenSearch(window.location.search);
      if (!hit) return;
      // Deep-link: need chart + klines immediately.
      useDeskStore.getState().requestChartEager();
      useDeskStore
        .getState()
        .openSymbolInActive(hit.symbol, hit.exchange, hit.timeframe);
    };
    applyLink();
    window.addEventListener("popstate", applyLink);
    return () => window.removeEventListener("popstate", applyLink);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/store");
        if (!res.ok) {
          // Keep existing zustand/localStorage watchlists — do not hydrate from error body
          if (!seeded.current) {
            seeded.current = true;
            const seeds = getPopularSeedScripts();
            for (const s of seeds) upsertScript(s);
          }
          return;
        }
        const db = await res.json();
        let scripts: CustomScript[] = Array.isArray(db?.scripts) ? db.scripts : [];

        // Seed popular community scripts if none installed from library
        const hasLib = scripts.some((x: CustomScript) => x.id.startsWith("lib_"));
        if (!hasLib && !seeded.current) {
          seeded.current = true;
          const seeds = getPopularSeedScripts();
          const byId = new Map(scripts.map((x: CustomScript) => [x.id, x]));
          for (const s of seeds) byId.set(s.id, s);
          scripts = [...byId.values()];
          for (const s of seeds) upsertScript(s);
          try {
            const seedRes = await fetch("/api/store", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scripts }),
            });
            if (!seedRes.ok) {
              /* local seed only — keep client scripts */
            }
          } catch {
            /* local seed only */
          }
        }

        hydrateFromServer({
          watchlists: Array.isArray(db?.watchlists)
            ? db.watchlists
            : useDeskStore.getState().watchlists,
          scripts,
        });
      } catch {
        if (!seeded.current) {
          seeded.current = true;
          const seeds = getPopularSeedScripts();
          for (const s of seeds) upsertScript(s);
          // Do NOT pass watchlists: [] in a way that wipes — upsert scripts only
        }
      }
    })();
  }, [hydrateFromServer, upsertScript]);

  return (
    <div className="h-screen w-screen flex flex-col bg-desk-bg">
      <AlertWatcher />
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 min-h-0 bg-desk-bg">
          {showChart ? (
            <ChartGrid />
          ) : (
            <ChartBootPlaceholder label="Tarama hazır — grafik birazdan…" />
          )}
        </main>
      </div>
    </div>
  );
}
