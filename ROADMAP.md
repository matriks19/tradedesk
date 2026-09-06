# TradeDesk — enrichment roadmap

## Added (this pass)

- **SHT Flama/Üçgen (açık yaklaşım)**: PatternHit.meta (durum/skor/daralma/hedef/FIBO/RSI/ADX/filtre); `shtFlagTriangle` enricher; PatternPanel kalite kartı + tarama çipi; FormationScanPanel «SHT Flama/Üçgen»; katalog notu (kapalı Pine kopyası değil).

- **Price alerts + webhook bot**: Alarm sidebar tab; poll ticker ~8s; browser Notification; optional webhook via `/api/webhook` proxy (`secret`, `event: price_alert`).
- **Chart draw tools**: cursor / H-line / trend / fib / measure / rect toolbar on each pane; canvas overlay; Escape cancels; clear-pane.
- **Bulk watchlist**: Toplu textarea import (comma/newline, optional `BINANCE:` / `BIST:` prefix); Yeni liste; delete list.
- **Scanner → watchlist**: “Sonuçları izleme listesine ekle” (cap 200 on active list).

## Next wishlist

- Trade journal (entries linked to symbol/TF/screenshot)
- Bar replay / session playback
- Multi-TF sync cursors across panes
- Native Telegram bot (vs generic webhook)
- Volume profile / fixed-range VP
- Alert on indicator cross (RSI, MACD) not only price
- Drawing templates + sync across layouts
- Mobile compact layout
