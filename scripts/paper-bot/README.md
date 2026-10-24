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
