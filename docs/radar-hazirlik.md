# Radar · Sinyale hazırlık tablosu (feat/radar-okunur)

Yeni işlem mantığı yok; tablo mevcut motorun hesapladıklarını gösterir.

**Hazırlık %** = round((Y_r + 100 · X/Y) / 2), en fazla 99; Y_r = 100 · (1 − r), r = mevcut `proxCoin` / `proxBist` yakınlığı
(YO6 MA → r4 (4s), Loxx → r1 (1s), BIST z−2 → r). Sinyal ateşlediyse (`yo6f`, `lxf`, `bf`; r ≤ 0,03) = 100.
Böylece 48-mum dibine yakın ama fitil/hacim koşulu eksik coinler sabit %40'ta kalmaz (ör. r=0,60 ve 1/6 koşul → %28 Uzak).
Bantlar: 0–40 Uzak (gri) · 40–70 Yaklaşıyor (sarı) · 70–99 Hazır olmak üzere (turuncu) · 100 SİNYAL (yeşil).
↑↓ = aynı hesap (koşul oranı sabit tutularak, r) bir önceki mumda (YO6 için 4s, Loxx/BIST için 1s) ile fark. "Tümü" sekmesinde coinin en hazır bacağı gösterilir.

| Bacak | Koşullar (X/Y) | Kaynak |
|---|---|---|
| YO6 MA · 4s (6) | yeni 48-mum dibi + üstünde kapanış · alt fitil ≥ %40 · hacim ≥ 1,5x (48 mum medyanı) · piyasa stres filtresi · OBV akışı ↑ · 12 mum içinde SMA10 üstü kapanış | `rSweep`, `rT41` (sw/cl/fl/vf/wt/en) |
| Loxx · 1s (5) | z200 > 0 · pst 10–20 · pst↑pss kesişimi · ADX > 0,20 · VI+ > VI− | `prepCoin` s5 |
| BIST z−2 · 1s (2) | z200 −2 altında · −2 üstüne kapanış | `scanBist` cr |

Bekleyen YO6 kurulumunda (wt) ilk 5 koşul tamam sayılır. Eksik metni ilk iki eksik koşulun sayısal açıklamasıdır.
Görünüm: varsayılan Tablo; "2D radar" (merkez %100, halkalar %70/%40, en hazır 15 isim); "3D görünüm" eski galaksi (tablo açıkken 3D çizimi duraklatılır).
Durum `radar_ui_v1.ok12 = {on, tab, vw}`; URL `?gorunum=tablo|radar|3d`; kısayol Y.
