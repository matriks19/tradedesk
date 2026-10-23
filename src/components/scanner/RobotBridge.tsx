"use client";
// [bridge138] Robota bağla düğmeleri + küçük robot durum paneli (QUANTEX ile aynı localStorage'ı okur).
import { useEffect, useState } from "react";
import { getLinks, setLink, BUS_KEY } from "@/lib/signalBus";

type Pos = { sym: string; side: string; entry: number; src?: string; t: number };
function readSt() {
  try {
    const st = JSON.parse(localStorage.getItem("qxbot_state_v1") || "{}") || {};
    const bus = JSON.parse(localStorage.getItem(BUS_KEY) || "[]") || [];
    const hb = +(localStorage.getItem("qx_bus_hb") || 0);
    return { running: !!st.running, open: (st.open || []) as Pos[], log: ((st.log || []) as unknown[]).slice(-4).map(String), bus: bus.length as number, hb };
  } catch { return { running: false, open: [] as Pos[], log: [] as string[], bus: 0, hb: 0 }; }
}

export function RobotBridge({ kinds }: { kinds: string[] }) {
  const [links, setL] = useState<string[]>([]);
  const [s, setS] = useState(readSt);
  useEffect(() => {
    setL(getLinks());
    const t = setInterval(() => setS(readSt()), 5000);
    return () => clearInterval(t);
  }, []);
  const qxOpen = Date.now() - s.hb < 3 * 60000;
  return (
    <div className="border border-desk-border/40 rounded p-1.5 mb-1 text-xs space-y-1">
      <div className="flex flex-wrap gap-1 items-center">
        <span className="font-semibold">🤖 Robota bağla:</span>
        {kinds.length ? kinds.map((k) => {
          const on = links.includes(k);
          return (
            <button key={k} type="button"
              className={on ? "px-1.5 rounded bg-desk-up/30 border border-desk-up" : "px-1.5 rounded border border-desk-border"}
              onClick={() => { setLink(k, !on); setL(getLinks()); }}>
              {on ? "✓ " : ""}{k.toUpperCase()}
            </button>
          );
        }) : <span className="text-desk-muted">önce bir tarama aç</span>}
      </div>
      <div>
        Robot: <b>{s.running ? "🟢 çalışıyor (KÂĞIT)" : "🔴 durdu"}</b> · açık {s.open.length} · sinyal yolu {s.bus}
        {!qxOpen && <span className="text-desk-down"> · QUANTEX sekmesi kapalı — sinyaller orada açılınca işlenir</span>}
        {" "}<a className="underline" href="/quantex.html#robot" target="_blank" rel="noreferrer">Robotu aç</a>
      </div>
      {s.open.slice(0, 5).map((p) => (
        <div key={p.sym + p.t} className="font-mono">{p.sym} {p.side} @{p.entry} · {p.src || ""}</div>
      ))}
      {s.log.map((l, i) => <div key={i} className="text-desk-muted truncate">{l}</div>)}
    </div>
  );
}
