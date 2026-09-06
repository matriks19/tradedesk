import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isTelegramSendMessageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("api.telegram.org") &&
      /\/sendMessage\/?$/i.test(u.pathname)
    );
  } catch {
    return /api\.telegram\.org.+sendMessage/i.test(url);
  }
}

function humanText(payload: Record<string, unknown> | null | undefined): string {
  if (!payload || typeof payload !== "object") return "TradeDesk alert";
  const t = payload.text ?? payload.message;
  if (typeof t === "string" && t.trim()) return t;
  const event = String(payload.event ?? "alert");
  const symbol = payload.symbol != null ? String(payload.symbol) : "";
  const exchange = payload.exchange != null ? String(payload.exchange) : "";
  const condition = payload.condition != null ? String(payload.condition) : "";
  const price = payload.price != null ? String(payload.price) : "";
  const last = payload.last != null ? String(payload.last) : "";
  const note = payload.note != null ? String(payload.note) : "";
  const parts = [
    `TradeDesk ${event}`,
    symbol && `${symbol}${exchange ? ` (${exchange})` : ""}`,
    condition && price ? `${condition} ${price}` : condition || price,
    last && `son ${last}`,
    note,
  ].filter(Boolean);
  return parts.join(" · ") || "TradeDesk alert";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const payload =
      body?.payload && typeof body.payload === "object"
        ? ({ ...body.payload } as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    const telegramChatId =
      (typeof body?.telegramChatId === "string" && body.telegramChatId.trim()) ||
      (typeof payload.chat_id === "string" && payload.chat_id.trim()) ||
      (typeof payload.telegramChatId === "string" &&
        String(payload.telegramChatId).trim()) ||
      "";

    if (!url) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json({ error: "invalid url" }, { status: 400 });
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json(
        { error: "url must be http(s)" },
        { status: 400 }
      );
    }

    // Always ensure human-readable text/message on generic payloads
    const text = humanText(payload);
    if (!payload.text) payload.text = text;
    if (!payload.message) payload.message = text;

    let upstreamBody: string;
    let contentType = "application/json";

    if (isTelegramSendMessageUrl(url)) {
      const chatId =
        telegramChatId ||
        (payload.chat_id != null ? String(payload.chat_id) : "");
      if (!chatId) {
        return NextResponse.json(
          {
            error:
              "telegramChatId required for Telegram sendMessage webhook (Bot Settings)",
          },
          { status: 400 }
        );
      }
      upstreamBody = JSON.stringify({
        chat_id: chatId,
        text: String(payload.text || text),
        disable_web_page_preview: true,
      });
    } else {
      upstreamBody = JSON.stringify(payload);
    }

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: upstreamBody,
    });

    const respText = await upstream.text().catch(() => "");
    return NextResponse.json({
      ok: upstream.ok,
      status: upstream.status,
      body: respText.slice(0, 2000),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
