import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TOKEN_RE = /^\d{6,}:[A-Za-z0-9_-]{20,}$/;

type TgUpdate = {
  message?: { chat?: { id?: number; type?: string; title?: string; username?: string } };
  channel_post?: { chat?: { id?: number; type?: string; title?: string; username?: string } };
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!TOKEN_RE.test(token)) {
      return NextResponse.json({ error: "geçersiz bot token" }, { status: 400 });
    }
    const r = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?limit=50`,
      { cache: "no-store" }
    );
    const data = (await r.json().catch(() => null)) as {
      ok?: boolean;
      description?: string;
      result?: TgUpdate[];
    } | null;
    if (!data?.ok) {
      return NextResponse.json(
        { error: data?.description || `telegram ${r.status}` },
        { status: 400 }
      );
    }
    const chats: { id: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const u of data.result ?? []) {
      const chat = u.message?.chat ?? u.channel_post?.chat;
      if (chat?.id == null) continue;
      const id = String(chat.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const label = [chat.title, chat.username, chat.type, id]
        .filter(Boolean)
        .join(" · ");
      chats.push({ id, label });
    }
    const last = chats[chats.length - 1] ?? null;
    return NextResponse.json({
      ok: true,
      chatId: last?.id ?? null,
      chats,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
