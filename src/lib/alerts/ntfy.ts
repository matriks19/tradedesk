export function isNtfyWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname === "ntfy.sh" ||
      u.hostname.endsWith(".ntfy.sh") ||
      u.hostname.includes("ntfy")
    );
  } catch {
    return /ntfy\.sh/i.test(url);
  }
}

export async function publishNtfy(opts: {
  url: string;
  text: string;
  title?: string;
  click?: string;
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    Priority: "high",
    Tags: "chart_with_upwards_trend",
  };
  if (opts.title) headers.Title = opts.title;
  if (opts.click && /^https?:\/\//i.test(opts.click)) headers.Click = opts.click;
  try {
    const res = await fetch(opts.url, {
      method: "POST",
      headers,
      body: opts.text.slice(0, 4000),
    });
    const body = await res.text().catch(() => "");
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: body.slice(0, 200) || `ntfy ${res.status}`,
      };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : "ntfy hata",
    };
  }
}

const NTFY_STORE_KEY = "tradedesk-ntfy-v1";

export function topicFromWebhook(url: string): string {
  try {
    const u = new URL(url);
    if (!isNtfyWebhookUrl(url)) return "";
    return decodeURIComponent(u.pathname.replace(/^\//, "").split("/")[0] || "");
  } catch {
    const m = url.match(/ntfy\.sh\/([^/?#]+)/i);
    return m?.[1] ? decodeURIComponent(m[1]) : "";
  }
}

function cookieTopic(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|; )td_ntfy=([^;]+)/);
  return m?.[1] ? decodeURIComponent(m[1]).trim() : "";
}

export function loadSavedNtfy(): { topic: string; url: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(NTFY_STORE_KEY);
    if (raw) {
      const j = JSON.parse(raw) as { topic?: string; url?: string };
      const topic = (j.topic || "").trim();
      const url = (j.url || "").trim();
      if (topic && url) return { topic, url };
    }
  } catch {
    /* ignore */
  }
  const topic = cookieTopic();
  if (topic) return { topic, url: `https://ntfy.sh/${topic}` };
  return null;
}

export function saveNtfyChannel(topic: string, url: string) {
  if (typeof window === "undefined") return;
  const t = topic.trim();
  const u = url.trim();
  if (!t || !u) return;
  localStorage.setItem(NTFY_STORE_KEY, JSON.stringify({ topic: t, url: u }));
  try {
    document.cookie = `td_ntfy=${encodeURIComponent(t)};max-age=31536000;path=/;SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function clearSavedNtfy() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(NTFY_STORE_KEY);
  try {
    document.cookie = "td_ntfy=;max-age=0;path=/";
  } catch {
    /* ignore */
  }
}

export function persistNtfyFromBot(bot: {
  ntfyTopic?: string;
  webhookUrl?: string;
  channel?: string;
}) {
  const topic =
    (bot.ntfyTopic || "").trim() || topicFromWebhook(bot.webhookUrl || "");
  const url = (bot.webhookUrl || "").trim();
  if (topic && (url ? isNtfyWebhookUrl(url) : true)) {
    saveNtfyChannel(topic, url || `https://ntfy.sh/${topic}`);
  }
}
