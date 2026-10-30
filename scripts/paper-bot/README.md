# QUANTEX Paper Bot (GitHub Actions)

PAPER ONLY — borsaya emir gitmez, API anahtarı kullanılmaz. `.github/workflows/paper-bot.yml` her 15 dk çalışır.

- Workflow dosyası: `scripts/paper-bot/paper-bot.yml` → GitHub web arayüzünden `.github/workflows/paper-bot.yml` olarak eklenmeli (bot tokenının `workflow` izni yok).
- Ayarlar: `scripts/paper-bot/config.json` (tarama, TP/SL, slot, risk).
- Durum (pozisyonlar, kapanan işlemler, günlük): `paper-bot-state` dalı → `state.json`.
- Her turun özeti: Actions → paper-bot → çalıştırma → Summary.
- Uyarılar (opsiyonel Secrets): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NTFY_URL`.
- Binance vadeli erişilemezse (451/403) `data-api.binance.vision` spot aynasına düşer; 418/429'da Retry-After kadar bekler.

## Kaynaklar (v2)
`config.json → sources`, sırayla değerlendirilir (tur başı yeni giriş ≤ maxNew):
- KOMBİN PLI↑ + Bulut3− 4s (pliLoC3) — TP %25, EV kapalı
- TP RSI TSI 1s (tsiMid) — Fisher üst bant ↓ çıkışı + 48 mum süre, EV kapalı
- TP RSI Bulut 2s (cloudX) — Fisher çıkışı + 48 mum, EV kapalı
- TP RSI TSI 4s (tsiG) — TP %25, EV kapalı
- TP RSI Bulut 15m / 30m (cloudX) — TP %3, EV kapalı
- PLI Yön 1s (pliDir pli_lo_up / pli_hi_up) — global TP, EV açık
- HAM/MACD 15m — global TP, EV açık
SL hepsinde global (%5). EV: `evGlobal` + kaynak `ev`; backtest kapısı `ev_td.json` (QX_EV_TD), canlı EV son 30 işlem ort. < 0 → kaynak oto-kapalı.
`tpc.ts` = quantex.html `tpcCalc` birebir; yalnız kapanmış mumlar.

## İzleme (watch-only) — `watch.ts`
Grok Bot rutinlerinden taşınan taramalar robotun aynı 15 dk döngüsünde çalışır, **işlem/pozisyon açmaz** (state.json'a dokunmaz):
EK v3 DIV (kripto 4s + BIST 1g), L/S 2s top-pozisyon uyumsuzluğu (top-40 perp), Dual 100/10 (kripto 4s LRB, BIST 1g BB), BIST 1g RSI14 30 kırılımı,
ve günlük L/S veri toplama (`lsdata/YYYY-MM-DD.csv`). Sonuçlar `watch.json` (paper-bot-state dalı) → `/api/watch-report` → `/izleme.html`.
ntfy: sinyal mumu başına bir kez, adres yalnız secret'tan (`WATCH_NTFY_URL` → `ELIZI_NTFY_URL` → `NTFY_URL`). İlk tur bildirimsiz tohumlar.
Kapatma: `WATCH_OFF=1`. Yerel deneme: `WATCH_DIR=/tmp/x WATCH_DRY=1 npx tsx scripts/paper-bot/watch.ts`.
