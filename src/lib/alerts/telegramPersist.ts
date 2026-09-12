const TG_STORE_KEY = "tradedesk-tg-v1";

export function tokenFromTelegramWebhook(url: string): string {
  const m = url.match(/api\.telegram\.org\/bot([^/?#]+)\/sendMessage/i);
  return m?.[1] || "";
}

export function isTelegramWebhookUrl(url: string): boolean {
  return /api\.telegram\.org\/bot[^/]+\/sendMessage/i.test(url);
}

export function loadSavedTelegram(): {
  token: string;
  chatId: string;
  url: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TG_STORE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as {
      token?: string;
      chatId?: string;
      url?: string;
    };
    const token = (j.token || "").trim();
    const chatId = (j.chatId || "").trim();
    const url = (j.url || "").trim();
    if (token && chatId && url) return { token, chatId, url };
  } catch {
    /* ignore */
  }
  return null;
}

export function saveTelegramChannel(token: string, chatId: string, url: string) {
  if (typeof window === "undefined") return;
  const t = token.trim();
  const c = chatId.trim();
  const u = url.trim();
  if (!t || !c || !u) return;
  localStorage.setItem(TG_STORE_KEY, JSON.stringify({ token: t, chatId: c, url: u }));
}

export function persistTelegramFromBot(bot: {
  webhookUrl?: string;
  telegramChatId?: string;
  channel?: string;
}) {
  const url = (bot.webhookUrl || "").trim();
  const token = tokenFromTelegramWebhook(url);
  const chatId = (bot.telegramChatId || "").trim();
  if (token && chatId && isTelegramWebhookUrl(url)) {
    saveTelegramChannel(token, chatId, url);
  }
}
