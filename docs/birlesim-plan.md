# TradeDesk + QUANTEX tam birleşim planı (faz 2)

Faz 1 (v=138, köprü): ortak üst menü (`public/qx-nav.js`), Liste Tarama "Robota bağla" → `qx_signal_bus_v1`, QUANTEX robotu 15 dk turunda yolu okur (EV kapısı, tek pozisyon, global SL aynı, KÂĞIT), TradeDesk'te küçük robot durum paneli.

Faz 2 adımları:
1. **Ortak durum modülü:** `qxbot_*` localStorage okuma/yazmayı `src/lib/robotStore.ts`'e taşı (anahtarlar ve veri aynı kalır, göç yok, silme yok).
2. **Robot motorunu modül yap:** quantex.html içindeki robot (openPos/tick/scanCycle, 4 istek/sn sırası, 418/429 geri çekilme) `src/lib/robot/` altında TS modülüne çıkar; quantex.html aynı modülün derlenmiş paketini yükler.
3. **Tek motor sahibi:** BroadcastChannel ile "lider sekme" seçimi — robotu tek bir sekme çalıştırır (çift işlem yok); TradeDesk tek açıksa da robot çalışır.
4. **Sekmeli tek uygulama:** Next uygulamasına Grafik / Liste Tarama / İzleme / Radar / Robot sekmeleri; İzleme ve Radar önce iframe, sonra React bileşeni.
5. **Tek sinyal havuzu:** İzleme T-taramaları da yola yazar; robot tüm kaynakları tek kuyruktan okur.
6. **EV istatistiği:** Liste kind'leri (Gold, MACD BB, DI, Hull, LDR4, EMA30…) için gerçek kodla offline backtest → ev_stats'e ekle; o zamana kadar "veri az" engelli.
7. **BIST yolu:** BIST sinyallerini BIST kâğıt robotuna (qxbot_bist_v1) bağla.
8. **Temizlik:** eski sayfalar yönlendirme olarak kalır (/quantex.html → /?tab=izleme), bağlantılar kırılmaz.
