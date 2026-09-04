"use client";

import { useEffect } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { ChartGrid } from "@/components/chart/ChartGrid";
import { useDeskStore } from "@/store/desk";

export function TerminalShell() {
  const hydrateFromServer = useDeskStore((s) => s.hydrateFromServer);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/store");
        const db = await res.json();
        hydrateFromServer({
          watchlists: db.watchlists ?? [],
          scripts: db.scripts ?? [],
        });
      } catch {
        /* offline seed via empty */
      }
    })();
  }, [hydrateFromServer]);

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
