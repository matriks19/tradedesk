# PLI± Yönlü Oran — TradingView (Pine) portu

TradeDesk'teki **PLI Yönlü Oran** göstergesinin birebir Pine v5 karşılığı:
[`pli-yonlu-oran.pine`](./pli-yonlu-oran.pine)

## TradingView'a ekleme (30 saniye)

1. TradingView → alt panel → **Pine Editor** → sağ üst **"Yeni"** (boş gösterge).
2. `docs/pine/pli-yonlu-oran.pine` dosyasının **tamamını** yapıştır (ilk satır `//@version=5` kalmalı).
3. **Kaydet** → **Grafiğe ekle**.

Sonuç: bantlar + Hull MA **fiyat panelinde** (`force_overlay`), yönlü histogram **kendi panelinde**.
TradeDesk'teki "Ana panel + alt panel" görünümünün aynısı; tek script yeter.

## Ne hesaplıyor

| Adım | Formül | TradeDesk |
|---|---|---|
| Bantlar | `upper = percentile_linear_interpolation(src, len, 100−x)`<br>`lower = ... (x)` · `med = ... (50)` | `pliDir()` |
| Oran (genişlik) | `oran = upper / lower − 1` | ✅ |
| Yön | `upMove = upper/upper[k] − 1`<br>`dnMove = lower[k]/lower − 1`<br>`d = upMove − dnMove`<br>`yön = d>0 ? +1 : d<0 ? −1 : (src ≥ med ? +1 : −1)` | ✅ |
| Yönlü oran | `yönlü = oran · yön` → histogram (≥0 yeşil, <0 kırmızı) | ✅ |
| Sıkışma | `gate = PLI(oran, sqLookback, sqPct)` · `oran ≤ gate` → son `sqMemory` mumda görüldüyse **S** | ✅ |
| Hull MA | `wma(2·wma(src, ⌊n/2⌋) − wma(src, n), ⌊√n⌋)`, eğim rengi yeşil↑/kırmızı↓ | ✅ |

## Girdiler (TradeDesk varsayılanları)

| Girdi | Varsayılan | Not |
|---|---|---|
| Uzunluk (`len`) | 50 | PLI penceresi |
| Percentil X | 5 | `upper` için 100−x, `lower` için x |
| Yön geriye bakış `k` | 5 | `upper[k]` / `lower[k]` |
| Kaynak | close | `src` |
| Sıkışma lookback / % / bellek | 50 / 25 / 5 | S işareti |
| Hull MA | 55 | kesen çizgi varsayılanı |
| Bant kesen çizgi | Hull | `Fiyat (kaynak)` yapılabilir |

## İşaretler

| İşaret | Anlam | Yön |
|---|---|---|
| **PLI↑ / PLI↓** | `yönlü` 0'ı yukarı / aşağı kesti | alt / üst |
| **PLI↑ S / PLI↓ S** | Aynı kesişim + son 5 mumda sıkışma (mor daire) | alt / üst |
| **A↑** | Kesen çizgi alt bandı yukarı kesti | alt |
| **Ü↑** | Kesen çizgi üst bandı yukarı kesti (kırılım) | alt |
| **O↑ / O↓** | Kesen çizgi medyanı yukarı / aşağı kesti | alt / üst |

## Alarm

`alertcondition()` başlıkları TradeDesk tarama koşullarıyla **aynı id** ile tanımlı:

`pli_up` · `pli_dn` · `pli_up_sq` · `pli_dn_sq` · `pli_lo_up` · `pli_hi_up` · `pli_mid_up` · `pli_mid_dn`

Alarm kur → Koşul: **PLI± Yönlü Oran (TradeDesk)** → istediğin koşul → "Bir kez mum kapanışında".

## Kaynak kod nerede

| Dosya | Ne |
|---|---|
| `src/lib/indicators/median.ts:498` | `pliDir()` — hesabın tamamı |
| `src/lib/indicators/median.ts:477` | `hmaTv()` — TradingView formüllü Hull |
| `src/lib/indicators/median.ts:124` | `percentileLinearInterpolation()` |
| `src/lib/indicators/registry.ts:532` | Gösterge tanımı (girdiler, varsayılanlar) |
| `src/lib/indicators/registry.ts:3466` | Çizim: renkler, işaretler, paneller |
| `src/lib/scanner/listScan.ts` | Tarama koşulları (`pli_up`, `pli_hi_up`, …) |

## Farklar / notlar

- **Geçmiş başı:** Pine `ta.percentile_linear_interpolation`, pencerede `na` varsa `na` döner; TS sürümü de tam pencere ister → ilk `len−1` mum boş, aynı.
- **Sıkışma kapısı:** TS, `oran` penceresi tamamen dolmadan kapı üretmez. Pine'da `bar_index < (len−1) + (sqLookback−1)` iken kapı `na` yapılır → birebir aynı.
- **Doğrulama:** `upper / lower / med / oran / d / yön / yönlü / sıkışma / S / kesişimler / Hull` çıktıları, `pliDir()` ile 3 farklı sentetik seride (400 mum) bar bar karşılaştırıldı — 16 serinin tamamı birebir aynı.
- **Repaint:** Tüm hesap kapanmış mumlarla aynı; canlı mumda son değer değişebilir. Tarama/alarm için "mum kapanışında" seç.
- Bant kesen çizgi `Fiyat` seçilirse TradeDesk'teki `crossSrc = price` ile aynı davranış.
