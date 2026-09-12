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

function isCallMeBotUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("callmebot.com") &&
      /whatsapp\.php/i.test(u.pathname)
    );
  } catch {
    return /callmebot\.com.+whatsapp\.php/i.test(url);
  }
}

function isWhatsAppCloudUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.includes("graph.facebook.com") &&
      /\/messages\/?$/i.test(u.pathname)
    );
  } catch {
    return /graph\.facebook\.com.+\/messages/i.test(url);
  }
}

function waToDigits(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 11) d = `90${d.slice(1)}`;
  return d;
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
    const waToken =
      (typeof body?.waToken === "string" && body.waToken.trim()) ||
      (typeof payload.waToken === "string" && String(payload.waToken).trim()) ||
      "";
    const waPhone =
      (typeof body?.waPhone === "string" && body.waPhone.trim()) ||
      (typeof payload.waPhone === "string" && String(payload.waPhone).trim()) ||
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

    const text = humanText(payload);
    if (!payload.text) payload.text = text;
    if (!payload.message) payload.message = text;

    let upstreamBody: string | undefined;
    let method: "GET" | "POST" = "POST";
    let contentType = "application/json";
    let headers: Record<string, string> = {};
    let fetchUrl = url;

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
      const openUrl =
        typeof payload.openUrl === "string" ? payload.openUrl.trim() : "";
      const symbol = payload.symbol != null ? String(payload.symbol) : "";
      let tgText = String(payload.text || text);
      if (openUrl && !tgText.includes(openUrl)) tgText = `${tgText}\n${openUrl}`;
      const tg: Record<string, unknown> = {
        chat_id: chatId,
        text: tgText,
        disable_web_page_preview: true,
      };
      if (openUrl && /^https?:\/\//i.test(openUrl)) {
        tg.reply_markup = {
          inline_keyboard: [
            [{ text: symbol ? `${symbol} grafiği` : "Grafiği aç", url: openUrl }],
          ],
        };
      }
      upstreamBody = JSON.stringify(tg);
      headers["Content-Type"] = contentType;
    } else if (isCallMeBotUrl(url)) {
      const u = new URL(url);
      const openUrl =
        typeof payload.openUrl === "string" ? payload.openUrl.trim() : "";
      let waText = String(payload.text || text);
      if (openUrl && !waText.includes(openUrl)) waText = `${waText}\n${openUrl}`;
      u.searchParams.set("text", waText);
      if (waPhone && !u.searchParams.get("phone")) {
        u.searchParams.set("phone", waToDigits(waPhone));
      }
      fetchUrl = u.toString();
      method = "GET";
    } else if (isWhatsAppCloudUrl(url)) {
      const to = waToDigits(waPhone);
      if (!waToken) {
        return NextResponse.json(
          { error: "waToken required for WhatsApp Cloud" },
          { status: 400 }
        );
      }
      if (!to) {
        return NextResponse.json(
          { error: "waPhone required for WhatsApp Cloud" },
          { status: 400 }
        );
      }
      const openUrl =
        typeof payload.openUrl === "string" ? payload.openUrl.trim() : "";
      let waText = String(payload.text || text);
      if (openUrl && !waText.includes(openUrl)) waText = `${waText}\n${openUrl}`;
      headers["Content-Type"] = contentType;
      headers.Authorization = `Bearer ${waToken}`;
      upstreamBody = JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: waText.slice(0, 4096), preview_url: true },
      });
    } else {
      upstreamBody = JSON.stringify(payload);
      headers["Content-Type"] = contentType;
    }

    const upstream = await fetch(fetchUrl, {
      method,
      headers,
      body: method === "GET" ? undefined : upstreamBody,
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
