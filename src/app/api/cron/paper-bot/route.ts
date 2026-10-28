import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Paper bot dış tetikleyici.
 * GitHub'ın zamanlanmış (schedule) çalıştırmaları ücretsiz hesapta saatlerce gecikebiliyor;
 * bu uç nokta 15 dakikada bir (cron-job.org / Vercel Cron) çağrılır ve paper-bot.yml için
 * workflow_dispatch tetikler. Zaten kuyrukta / çalışan tur varsa yeni tur başlatmaz.
 *
 * Yetki: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron bunu otomatik yollar) ya da `?key=<CRON_SECRET>`.
 * Gizli değerler sadece Vercel ortam değişkenlerinde: CRON_SECRET, GH_DISPATCH_TOKEN. Kodda/GitHub'da yok.
 */
const REPO = process.env.GH_DISPATCH_REPO || "matriks19/tradedesk";
const WORKFLOW = process.env.GH_DISPATCH_WORKFLOW || "395363280"; // .github/workflows/paper-bot.yml
const REF = process.env.GH_DISPATCH_REF || "main";

function safeEq(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const h = req.headers.get("authorization") || "";
  if (h.startsWith("Bearer ") && safeEq(h.slice(7).trim(), secret)) return true;
  const key = new URL(req.url).searchParams.get("key");
  return !!key && safeEq(key, secret);
}

async function gh(path: string, token: string, init?: RequestInit) {
  return fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "quantex-paper-bot-cron",
      ...(init?.headers || {}),
    },
  });
}

async function activeRuns(token: string): Promise<number | null> {
  let n = 0;
  for (const status of ["queued", "in_progress"]) {
    const r = await gh(`/actions/workflows/${WORKFLOW}/runs?status=${status}&per_page=5`, token);
    if (!r.ok) return null;
    const j = (await r.json()) as { total_count?: number };
    n += j.total_count || 0;
  }
  return n;
}

async function handle(req: Request) {
  const noStore = { "cache-control": "no-store" };
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401, headers: noStore });
  }
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "GH_DISPATCH_TOKEN missing" }, { status: 503, headers: noStore });
  }
  const force = new URL(req.url).searchParams.get("force") === "1";
  if (!force) {
    const active = await activeRuns(token);
    if (active && active > 0) {
      return NextResponse.json({ ok: true, dispatched: false, reason: "run already queued/in_progress", active }, { headers: noStore });
    }
  }
  const r = await gh(`/actions/workflows/${WORKFLOW}/dispatches`, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ref: REF }),
  });
  if (r.status !== 204) {
    const text = (await r.text()).slice(0, 300);
    return NextResponse.json({ ok: false, error: `github ${r.status}`, detail: text }, { status: 502, headers: noStore });
  }
  return NextResponse.json({ ok: true, dispatched: true, at: new Date().toISOString() }, { headers: noStore });
}

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}
