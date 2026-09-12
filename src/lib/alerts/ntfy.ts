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
