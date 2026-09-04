"use client";

import { useEffect, useRef } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { ChartGrid } from "@/components/chart/ChartGrid";
import { useDeskStore } from "@/store/desk";
import { getPopularSeedScripts } from "@/lib/scripts/catalog";
import type { CustomScript } from "@/lib/types";

export function TerminalShell() {
  const hydrateFromServer = useDeskStore((s) => s.hydrateFromServer);
  const upsertScript = useDeskStore((s) => s.upsertScript);
  const seeded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/store");
        const db = await res.json();
        let scripts: CustomScript[] = db.scripts ?? [];

        // Seed popular community scripts if none installed from library
        const hasLib = scripts.some((x) => x.id.startsWith("lib_"));
        if (!hasLib && !seeded.current) {
          seeded.current = true;
          const seeds = getPopularSeedScripts();
          const byId = new Map(scripts.map((x) => [x.id, x]));
          for (const s of seeds) byId.set(s.id, s);
          scripts = [...byId.values()];
          for (const s of seeds) upsertScript(s);
          try {
            await fetch("/api/store", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scripts }),
            });
          } catch {
            /* local seed only */
          }
        }

        hydrateFromServer({
          watchlists: db.watchlists ?? [],
          scripts,
        });
      } catch {
        if (!seeded.current) {
          seeded.current = true;
          const seeds = getPopularSeedScripts();
          for (const s of seeds) upsertScript(s);
          hydrateFromServer({ watchlists: [], scripts: seeds });
        }
      }
    })();
  }, [hydrateFromServer, upsertScript]);

  return (
    <div className="h-screen w-screen flex flex-col bg-desk-bg">
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
