import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** QUANTEX İzleme raporu (watch-only): paper-bot-state dalındaki watch.json'u okur, yalnız rapor alanlarını döner.
 *  Salt okunur; anahtar/ntfy adresi içermez (watch.json'a zaten yazılmaz). */
const SRC = [
  "https://raw.githubusercontent.com/matriks19/tradedesk/paper-bot-state/watch.json",
  "https://cdn.jsdelivr.net/gh/matriks19/tradedesk@paper-bot-state/watch.json",
];

export async function GET() {
  const errs: string[] = [];
  for (const u of SRC) {
    try {
      const r = await fetch(u + "?t=" + Math.floor(Date.now() / 60000), { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!r.ok) { errs.push(`${new URL(u).host} ${r.status}`); continue; }
      const j = await r.json();
      // dahili tekrar-önleme anahtarlarını ve kapı sayaçlarını gönderme
      const { notified: _n, gate: _g, ...rest } = j || {};
      void _n; void _g;
      return NextResponse.json(rest, { headers: { "cache-control": "s-maxage=60, stale-while-revalidate=120" } });
    } catch (e) { errs.push((e as Error).message); }
  }
  return NextResponse.json({ error: "watch-report-unavailable", detail: errs }, { status: 503, headers: { "cache-control": "no-store" } });
}
