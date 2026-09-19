"use client";

import { useEffect, useRef } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { ChartGrid } from "@/components/chart/ChartGrid";
import { AlertWatcher } from "@/components/alerts/AlertWatcher";
import { useDeskStore } from "@/store/desk";
import { getPopularSeedScripts } from "@/lib/scripts/catalog";
import type { CustomScript } from "@/lib/types";
import { parseDeskOpenSearch } from "@/lib/deskLink";

export function TerminalShell() {
  const hydrateFromServer = useDeskStore((s) => s.hydrateFromServer);
  const upsertScript = useDeskStore((s) => s.upsertScript);
  const seeded = useRef(false);

  useEffect(() => {
    const applyLink = () => {
      const hit = parseDeskOpenSearch(window.location.search);
      if (!hit) return;
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
          <ChartGrid />
        </main>
      </div>
    </div>
  );
}
