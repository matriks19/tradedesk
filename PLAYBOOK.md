# TradeDesk playbook (TF hatırlatma)

Bakeoff: Crypto10, signal-exit, long-only (aksi yazılmadıkça). Net ≈ 10 coin toplam.

## 4h — sıralı

| # | Preset | Net≈ | Not |
|---|---|---:|---|
| 1 | **SMI Long-only · 4s** | 2918 | kral |
| 2 | **VFI Long · 4s** | 2518 | SMI’ye en yakın niş |
| 3 | **TTM Squeeze · 4s** (bi) | 2261 | short dilimi de + |
| 4 | **KST Long · 4s** | 2181 | sağlam trade sayısı |
| 5 | **TSI Long-only · 4s** | 2080 | Blau ailesi |
| 6 | Hibrit MACD+Pump Long · 4s | 2061 | güçlü long |
| 7 | Squeeze Long · 4s | 2001 | fire-only long |
| — | Exhaust + Delta · 4s short | ince | tek short edge; OR-merge etme |

## 1h — sıralı

| # | Preset | Net≈ | Not |
|---|---|---:|---|
| 1 | **ST×Firefly Long · 1s** | 2383 | Patron setup (ST-div×Firefly); tr≈180 |
| 2 | **HalfTrend Long · 1s** | 2330 | Bayes üstü, tr≈210 |
| 3 | **AO Long · 1s** | 2273 | Bayes üstü, tr≈216 |
| 4 | **VFI Long · 1s** | 2189 | her iki TF’de iyi |
| 5 | Squeeze Long · 1s | 1855 | |
| 6 | Bayesian Trend Long · 1s | 1838 | eski 1h default |
| — | ZLSMA200 + CE Long · 1s | alt | kullanılabilir |
| — | Multi Kernel RQ Long · 1s | alt | 4h’de ölür |

## Kurallar

- Short’u OR-merge etme; sleeve ayır.
- 15m’de edge ince.
- OB/FVG Long net şişik (≈1 trade/coin) — playbook’a koyma.
- STC / Laguerre / RVI / Alligator — elendi.


Not: ST Div-Weighted MPO4 yerine RSI pivot divergence kullanır (orijinal kapalı). Short sleeve toksik — long-only kullan.


## Medyan / PLI

Ortalama tabanlı bantlar (BB) spike’a zayıf → **medyan / MAD / PLI** tercih.

| İndikatör | Ne | UI |
|---|---|---|
| Medyan (Rolling) | Kayan medyan | Ana panel |
| MAD Bantları | med ± k·1.4826·MAD | Ana panel bant |
| Medyan Kanal | med high/low/close | Ana panel |
| PLI Kanal (oran) | TV PLI üst/alt; **oran**=genişlik | Ana + oran alt panel |
| PLI×Delta Hibrit | daralma × işaretli Δhacim | oran/Δ/skor alt; sinyaller hist |

Backtest presetleri: `pliBreakLong`, `pliDeltaHybridLong`, `madBandsLong`, `medianCrossLong`.

Crypto10 bakeoff (signal-exit, long-only, Sep 2026):

| TF | Preset | Net≈ | tr |
|---|---|---:|---:|
| 1h | PLI Break Long | 2174 | 78 |
| 1h | PLI×Delta Hibrit Long | 2013 | 406 |
| 1h | Medyan Cross Long | 1591 | 632 |
| 1h | MAD Bant Long | −155 | 1124 |
| 4h | **PLI×Delta Hibrit Long** | **2199** | 404 |
| 4h | PLI Break Long | 1466 | 79 |
| 4h | Medyan Cross Long | 698 | 659 |
| 4h | MAD Bant Long | −1198 | 992 |

Not: MAD Long overtrade — filtre/sıkılık lazım. PLI×Δ 4h’de SMI’ye yakın (SMI≈2945). BB Break tr≈10 şişik — playbook kral listesine koyma.
Pine referans: Go-10-Pli (dg_factor) — `oran = p1/p2 - 1`, long=crossover(close,p1).



## Formasyon — Inversion FVG (IFVG)

Bar-based ICT setup (her TF): klasik FVG fail → mum gap’i kapatır (inversion) → rol flip + CHoCH → IFVG retest’te AL/SAT.
Süpürme (likidite wick) + inversion birlikte → skor boost (`IFVG·Süp`). UI: Formasyon Tara / Aktif grafik çipi.
