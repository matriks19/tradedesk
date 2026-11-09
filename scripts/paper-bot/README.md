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
EK v3 DIV (kripto 4s + BIST 1g), L/S 2s top-pozisyon uyumsuzluğu; evren: top-200 USDT-M perp (günlük), BIST ≤200, dönen parti + kalıcı imleç (symLast), Dual 100/10 (kripto 4s LRB, BIST 1g BB), BIST 1g RSI14 30 kırılımı,
ve günlük L/S veri toplama (`lsdata/YYYY-MM-DD.csv`). Sonuçlar `watch.json` (paper-bot-state dalı) → `/api/watch-report` → `/izleme.html`.
ntfy: sinyal mumu başına bir kez, adres yalnız secret'tan (`WATCH_NTFY_URL` → `ELIZI_NTFY_URL` → `NTFY_URL`). İlk tur bildirimsiz tohumlar.
Sonuç takibi: giriş = sinyal sonrası ilk açılış; stop/hedef/**100 mum**. Her sinyalde `ex` (çıkışa kadar) ve `ex100` (çıkıştan bağımsız 100 mum) = MFE/MAE % ve R + ulaşıldığı mum no, `r1/r2/r3` = 1R/2R/3R ilk ulaşılan mum no (ekleme/TP türetmek için). Mumlardan her tur baştan hesaplanır; eski 40 mumluk "süre" kayıtları 100 muma uzar.
Kapatma: `WATCH_OFF=1`. Yerel deneme: `WATCH_DIR=/tmp/x WATCH_DRY=1 npx tsx scripts/paper-bot/watch.ts`.

## Ayrı bot: v12lsdip
`scripts/paper-bot/paper-bot-v12lsdip.yml` (GitHub web arayüzünden `.github/workflows/paper-bot-v12lsdip.yml` olarak eklenmeli — token `workflow` iznine sahip değil; her 30 dk, :05/:35) aynı `run.ts`'i `CONFIG_FILE=config-v12lsdip.json` ile çalıştırır; durum `paper-bot-v12lsdip-state` dalı (state.json + STATS.md). Alarm yok, İzleme kapalı (`WATCH_OFF=1`), mevcut paper-bot'a dokunmaz.
- Sermaye 1000$, işlem başı marjin 10$ (%1), 5x → nominal 50$; pozisyon sınırı yok (`maxSlots` 1e6), marjin bakiyeyi aşabilir (`noMarginCap`; `state.exposure`: kullanılan marjin / bakiye / tepe).
- Kaynaklar: **V12 Çift K2 30dk** (long: K2c<−30 iken pch/comb K2c'yi yukarı keser; short = aynalı: K2c>+30 iken aşağı keser; TP %5, stop yok, 100 mum) ve **LS Dip Uyumsuzluk 2s** (long: L/S POSITION boğa dip uyumsuzluğu, `lsBottom.ts`; TP %25, stop yok; ekleme kapalı). Kural LS Dip'te yalnız long tanımlı.
- Pozisyon kilidi kaynak başına (`lockPerSource`): aynı sembolde V12 ve LS Dip ayrı pozisyon açabilir.
- **Ortak**: iki kaynak aynı sembol + aynı yönde sinyal mumu kapanışları arasında ≤ `commonWindowBars` (5) × `commonBarMs` (30dk = 2,5 saat) ise ortak; aynı mum şart değil. Pozisyonlara `common`/`commonWith`, state'e `commonLog`, STATS.md'ye "ORTAK" tablosu yazılır.
