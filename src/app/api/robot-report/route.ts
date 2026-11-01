import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Robot Paneli: paper-bot-state dalındaki state.json'u okur, yalnız rapor alanlarını döner (salt okunur).
 *  Dahili tekrar-önleme anahtarları (seen, eliziSeen, rmStop, lsbBar, srcOff) gönderilmez; anahtar/ntfy adresi içermez. */
const SRC = [
  "https://raw.githubusercontent.com/matriks19/tradedesk/paper-bot-state/state.json",
  "https://cdn.jsdelivr.net/gh/matriks19/tradedesk@paper-bot-state/state.json",
];

type Pos = Record<string, unknown>;
const KEEP = ["sym", "side", "entry", "last", "qty", "src", "sid", "tf", "lev", "notional", "t", "checked", "tpPct", "mfePct", "maePct", "mfePx", "maePx", "exitPx", "why", "r", "pnl", "closedAt", "adds"];
function slim(p: Pos): Pos {
  const o: Pos = {};
  for (const k of KEEP) if (p[k] !== undefined) o[k] = p[k];
  return o;
}

export async function GET() {
  const errs: string[] = [];
  for (const u of SRC) {
    try {
      const r = await fetch(u + "?t=" + Math.floor(Date.now() / 60000), { cache: "no-store", signal: AbortSignal.timeout(12000) });
      if (!r.ok) { errs.push(`${new URL(u).host} ${r.status}`); continue; }
      const j = await r.json();
      const open = Array.isArray(j?.open) ? (j.open as Pos[]).map(slim) : [];
      const closed = Array.isArray(j?.closed) ? (j.closed as Pos[]).map(slim) : [];
      const stats = j?.stats || {};
      return NextResponse.json({
        equity: j?.equity, pnl: j?.pnl, runs: j?.runs, lastRun: j?.lastRun, dataSrc: j?.dataSrc,
        stats, open, closed, log: Array.isArray(j?.log) ? j.log.slice(-300) : [],
      }, { headers: { "cache-control": "s-maxage=60, stale-while-revalidate=120" } });
    } catch (e) { errs.push((e as Error).message); }
  }
  return NextResponse.json({ error: "robot-report-unavailable", detail: errs }, { status: 503, headers: { "cache-control": "no-store" } });
}
