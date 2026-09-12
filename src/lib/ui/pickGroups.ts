/** Classify scanner/backtest picks so the UI can regroup them. */
export type PickItem = {
  id: string;
  label: string;
  group: string;
  hint?: string;
};

export const SCANNER_GROUP_ORDER = [
  "TV / Dip",
  "Formasyon",
  "Elizi",
  "Osilatör",
  "Trend",
  "Pump",
  "Piyasa",
  "Kombo",
];

export const BACKTEST_GROUP_ORDER = [
  "Elizi",
  "MACD/Hibrit",
  "Short",
  "Erken",
  "ICT/SMC",
  "Formasyon",
  "Jurik/Donch",
  "Osilatör",
  "Trend",
  "Akış/Hacim",
  "Kod",
  "Diğer",
];

function hit(s: string, re: RegExp): boolean {
  return re.test(s);
}

export function classifyScannerId(id: string, label = ""): string {
  const s = `${id} ${label}`.toLowerCase();
  if (id.startsWith("diag_") || /ikili|üçlü|uclu|diag |diyagonal/.test(s))
    return "Formasyon";
  if (id.startsWith("tv_") || /w dip|tobo|düşen|dipten|uzun vade/.test(s))
    return "TV / Dip";
  if (/elizi/.test(s)) return "Elizi";
  if (/pump/.test(s)) return "Pump";
  if (
    /gainer|loser|hod|lod|atr|yeşil|yesil|crypto_|bist_/.test(s)
  )
    return "Piyasa";
  if (
    /rsi|stoch|jurik|macd|asiri|aşırı|oscil|diverj/.test(s)
  )
    return "Osilatör";
  if (
    /adx|aroon|supertrend|sma|di_|st_adx|ema|trend/.test(s)
  )
    return "Trend";
  return "Kombo";
}

export function classifyChipId(id: string, label = ""): string {
  const s = `${id} ${label}`.toLowerCase();
  if (/elizi/.test(s)) return "Elizi";
  if (/ham|rsi|stoch|jkase|jstoch|macd/.test(s)) return "Osilatör";
  if (/adx|di_|aroon|ema|st_|sma/.test(s)) return "Trend";
  if (/bb_|vol|hod|atr/.test(s)) return "Piyasa";
  if (/diag_|ikili|üçlü|uclu|diyagonal|diag /.test(s)) return "Formasyon";
  if (/desc|kırılım|kirilim/.test(s)) return "TV / Dip";
  return "Kombo";
}

export function classifyBacktestId(id: string, label = ""): string {
  const s = `${id} ${label}`.toLowerCase();
  if (id === "codeStrategy" || id === "custom") return "Kod";
  if (/elizi|nexus|pulse|exhaust|firefly/.test(s)) return "Elizi";
  if (
    id.startsWith("short") ||
    /short |fade|dumpstages|pumpfade/.test(s)
  )
    return "Short";
  if (id.startsWith("early") || /early /.test(s)) return "Erken";
  if (/ifvg|smc|ict|bos/.test(s)) return "ICT/SMC";
  if (/twin|triple|diagonal|srcombo|neck/.test(s)) return "Formasyon";
  if (/jurik|donch|turtle|blaster/.test(s)) return "Jurik/Donch";
  if (/macd|hybrid/.test(s)) return "MACD/Hibrit";
  if (
    /rsi|stoch|tsi|coppock|fisher|wave|connors|qqe|schaff|laguerre|squeeze|osc|aoLong|uoLong|dpo|ppo|cmo|rvi|trix|kst/.test(
      s
    )
  )
    return "Osilatör";
  if (
    /ema|supertrend|adx|aroon|qtrend|bayes|kernel|vidya|frama|ssl|halftrend|coral|alligator|zlsma|vortex|elder|gainz/.test(
      s
    )
  )
    return "Trend";
  if (
    /vwap|orb|pli|median|mad|vfi|cmf|force|klinger|bop|mass|delta/.test(s)
  )
    return "Akış/Hacim";
  return "Diğer";
}

export function groupItems(
  items: PickItem[],
  order: string[]
): { group: string; items: PickItem[] }[] {
  const map = new Map<string, PickItem[]>();
  for (const it of items) {
    const g = it.group || "Diğer";
    const arr = map.get(g) ?? [];
    arr.push(it);
    map.set(g, arr);
  }
  const out: { group: string; items: PickItem[] }[] = [];
  for (const g of order) {
    const arr = map.get(g);
    if (arr?.length) out.push({ group: g, items: arr });
    map.delete(g);
  }
  for (const [g, arr] of map) {
    if (arr.length) out.push({ group: g, items: arr });
  }
  return out;
}
