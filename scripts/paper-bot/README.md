# QUANTEX Paper Bot (GitHub Actions)

PAPER ONLY — borsaya emir gitmez, API anahtarı kullanılmaz. `.github/workflows/paper-bot.yml` her 15 dk çalışır.

- Workflow dosyası: `scripts/paper-bot/paper-bot.yml` → GitHub web arayüzünden `.github/workflows/paper-bot.yml` olarak eklenmeli (bot tokenının `workflow` izni yok).
- Ayarlar: `scripts/paper-bot/config.json` (tarama, TP/SL, slot, risk).
- Durum (pozisyonlar, kapanan işlemler, günlük): `paper-bot-state` dalı → `state.json`.
- Her turun özeti: Actions → paper-bot → çalıştırma → Summary.
- Uyarılar (opsiyonel Secrets): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NTFY_URL`.
- Binance vadeli erişilemezse (451/403) `data-api.binance.vision` spot aynasına düşer; 418/429'da Retry-After kadar bekler.
