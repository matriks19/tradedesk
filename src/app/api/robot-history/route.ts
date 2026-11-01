import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Robot Paneli · Geçmiş: paper-bot-state dalının commit geçmişi (her commit = bir robot turu) +
 *  her turun STATS.md özet satırları (bakiye, özsermaye, açık K/Z, işlem sayısı...). Salt okunur. */
const REPO = "matriks19/tradedesk";
const BR = "paper-bot-state";

type Run = { sha: string; t: number; tur?: number; bakiye?: number; ozsermaye?: number; baslangic?: number; acikKz?: number; realize?: number; islem?: number; kazanc?: number; kayip?: number; kazanmaPct?: number; ddPct?: number; maxDdPct?: number; ok: boolean };

let memo: { at: number; body: unknown } | null = null;

async function listCommits(): Promise<{ sha: string; t: number }[]> {
  const h: Record<string, string> = { accept: "application/vnd.github+json", "user-agent": "tradedesk-panel" };
  const tok = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (tok) h.authorization = `Bearer ${tok}`;
  const out: { sha: string; t: number }[] = [];
  try {
    for (let page = 1; page <= 3; page++) {
      const r = await fetch(`https://api.github.com/repos/${REPO}/commits?sha=${BR}&per_page=100&page=${page}`, { headers: h, cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!r.ok) throw new Error("api " + r.status);
      const a = (await r.json()) as { sha: string; commit: { committer: { date: string } } }[];
      for (const c of a) out.push({ sha: c.sha, t: Date.parse(c.commit.committer.date) });
      if (a.length < 100) break;
    }
    if (out.length) return out;
  } catch { /* atom yedeği */ }
  const r = await fetch(`https://github.com/${REPO}/commits/${BR}.atom`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  const x = await r.text();
  const re = /<entry>[\s\S]*?<id>[^<]*Commit\/([0-9a-f]{40})<\/id>[\s\S]*?<updated>([^<]+)<\/updated>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(x))) out.push({ sha: m[1], t: Date.parse(m[2]) });
  return out;
}

const num = (s?: string) => { if (!s) return undefined; const v = parseFloat(s.replace(/[^0-9.+-]/g, "")); return isFinite(v) ? v : undefined; };
function row(md: string, label: string): string | undefined {
  const i = md.indexOf("| " + label);
  if (i < 0) return undefined;
  const e = md.indexOf("\n", i);
  const line = e < 0 ? md.slice(i) : md.slice(i, e);
  return line.split("|")[2]?.trim();
}
function parse(md: string, c: { sha: string; t: number }): Run {
  const r: Run = { sha: c.sha, t: c.t, ok: true };
  r.tur = num(md.match(/tur (\d+)/)?.[1]);
  r.bakiye = num(row(md, "Bakiye (gerçekleşen)"));
  r.ozsermaye = num(row(md, "Özsermaye"));
  r.baslangic = num(row(md, "Başlangıç bakiyesi"));
  r.realize = num(row(md, "Toplam gerçekleşen PnL"));
  r.acikKz = num(row(md, "Açık K/Z"));
  const isl = row(md, "İşlem sayısı");
  const im = isl?.match(/(\d+)\s*\((\d+)[^/]*\/\s*(\d+)/);
  if (im) { r.islem = +im[1]; r.kazanc = +im[2]; r.kayip = +im[3]; }
  r.kazanmaPct = num(row(md, "Kazanma oranı"));
  r.ddPct = num(row(md, "Şu anki düşüş")?.match(/\(([-0-9.]+)%\)/)?.[1]);
  r.maxDdPct = num(row(md, "En kötü düşüş")?.match(/\(([-0-9.]+)%\)/)?.[1]);
  if (r.ozsermaye == null) r.ok = false;
  return r;
}

export async function GET() {
  if (memo && Date.now() - memo.at < 5 * 60000) return NextResponse.json(memo.body, { headers: { "cache-control": "s-maxage=300, stale-while-revalidate=600" } });
  try {
    const cs = (await listCommits()).slice(0, 200);
    const runs: Run[] = [];
    const B = 16;
    for (let i = 0; i < cs.length; i += B) {
      const part = await Promise.all(cs.slice(i, i + B).map(async (c) => {
        try {
          const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${c.sha}/STATS.md`, { cache: "force-cache", signal: AbortSignal.timeout(8000) });
          if (!r.ok) return { sha: c.sha, t: c.t, ok: false } as Run;
          return parse(await r.text(), c);
        } catch { return { sha: c.sha, t: c.t, ok: false } as Run; }
      }));
      runs.push(...part);
    }
    runs.sort((a, b) => a.t - b.t);
    const body = { branch: BR, count: runs.length, runs };
    memo = { at: Date.now(), body };
    return NextResponse.json(body, { headers: { "cache-control": "s-maxage=300, stale-while-revalidate=600" } });
  } catch (e) {
    return NextResponse.json({ error: "robot-history-unavailable", detail: (e as Error).message }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
