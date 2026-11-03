/**
 * QUANTEX İZLEME (watch-only) — Grok Bot rutinlerinden robota taşınan taramalar. 31.10.2026.
 * HİÇBİR İŞLEM AÇMAZ: paper-bot state.json'a (pozisyonlar/bakiye) dokunmaz, borsaya emir yok, API anahtarı yok.
 * Yalnız: tarama → sinyal kaydı (watch.json, paper-bot-state dalı) + ntfy uyarısı (sinyal mumu başına bir kez) + 100 mum sonuç izleme.
 *
 * Taramalar (osc-lab Python sürümleriyle aynı kurallar, aynı zaman dilimleri):
 *  ek-crypto-4h  EK v3 dip uyumsuzluk (EMs) — kripto 4s, top-200 USDT-M perp (spot mumu, yoksa perp)   [new2-20261029/v3mm/scanner.py]
 *  ek-bist-1d    EK v3 dip uyumsuzluk (EMs) — BIST 1g, ≤200 hisse (Yahoo)                         [aynı]
 *  ls-2h         L/S 2s top-trader POZİSYON oranı dip uyumsuzluğu — en hacimli 200 USDT perp      [ls-div-20261029/scan_ls.py]
 *  dual-crypto-4h Dual 100/10 LRB (z 0.1, hedef hızlı üst bant) — kripto 4s                      [dual-band-20261029/scan_dual.py]
 *  dual-bist-1d  Dual 100/10 BB (z 0.5, 2R) — BIST 1g                                            [aynı]
 *  rsi30-bist-1d RSI14 30 yukarı kırılım — BIST 1g                                               [matriks-dt-20261030/scan_rsi30_bist.py]
 *  ikili-4h      ✦ İKİLİ: KDC-MACD (30dk KDC K↑D → ≤10s içinde 1s MACD↑) + Umut sinyali < 5 mum arayla — kripto 4s, Umut gibi izlenir (test edilmedi)
 *  umutpg-4h     UMUT+PG: Umut sinyali + Patlama Gücü (PG5 ≥ 50, sinyal mumunda) — kripto 4s, vadeli mumlar; sanal kağıt defter (Umut ile yan yana) [patlama-gucu-20261102]
 *  umut-4h       UMUT: KAL uyumsuzluk + RSI14 uyumsuzluk 5 mum içinde — kripto 4s (TP %10, 2 ATR, 100 mum) [kal-tp-test-20261101/combo3.py]
 *  dip4          DİP 4s (ElifScan): bant çizgileri yer değiştirir — üst bant alt bandı yukarı keser (crossover(upper, lower)), main < 40 — kripto 4s, vadeli mumlar önce; ntfy "Dip" / "dip4 SEMBOL"
 *  dip8 / dip12  DİP (ElifScan, kullanıcının Pine kodu birebir): main alt bandı VEYA üst bant alt bandı yukarı keser, main < 40 — kripto 8s / 12s, vadeli mumlar önce; ntfy kısa: "Dip" / "dip8 SEMBOL" [elifscan-20261102]
 *  donch-1d      DONCHIAN 20/55 günlük kapanış kırılımı (Catching Crypto Trends) + orta çizgi iz süren stop durumu — kripto 1g, top-200, vadeli mumlar; yalnız liste (ntfy yok)
 *  rangedip-1d   RANGE DIP (kullanıcının kuralı): Donchian alt bandında likidite avı + ikili/üçlü dip teyidi → long, hedef üst bant — kripto 1g, top-50; ntfy + sanal defter
 *  + DONCHIAN ENSEMBLE sanal robot (5/10/20/30, top-10, %25 vol hedefi, ≤%200) — giriş/çıkışta ntfy, gerçek emir yok
 *  + L/S günlük veri toplama (top-40, 4 metrik × 1s/2s) → lsdata/YYYY-MM-DD.csv                  [ls-div-20261029/collect.py]
 * ntfy adresi yalnız ortam değişkeninden (WATCH_NTFY_URL → ELIZI_NTFY_URL → NTFY_URL); koda/loga/rapora yazılmaz.
 */
import fs from "node:fs";
import path from "node:path";
import { ekDivergenceV3, emilimV3, type DivParams } from "../../src/lib/watch/ekV3";
import { BIST30, BIST_LIQUID_EXTRA } from "../../src/lib/data/bistLists";
import { BIST_EXTRA } from "../../src/lib/data/bistUniverse";
import { atr14Ewm, atr14Rma, dualBandBuy, rsi30Buy, lsDivergences, type WBar } from "../../src/lib/watch/watchInd";
import { umutSignals, umutTrack, atrW, UMUT, type UmutTrack, type UmutHit } from "../../src/lib/watch/umut";
import { ikiliSignals } from "../../src/lib/watch/sigExt";
import { pgComponents, pgAt, PG, type PGAt } from "../../src/lib/watch/patlama";
import { dipSignals, dipBandSignals, ELIF } from "../../src/lib/watch/elif";
import { paperTrack, paperStats, PAPER, type PTrade, type PStats } from "../../src/lib/watch/paper";
import { cciBullDiv, CCIDIV } from "../../src/lib/watch/ccidiv";
import { restEval, REST } from "../../src/lib/watch/rest";
import { v12k2Eval, V12K2 } from "../../src/lib/watch/v12k2";
import { donchTrail, donchEnsemble, rangeDipSignals, rdTrack, rdStats, donchStep, isCoin, DON, RDIP, type DRobot, type DDay, type RDTrade, type RDStats } from "../../src/lib/watch/donchian";

export const WATCH_CRYPTO = ["BTC","ETH","BNB","SOL","XRP","DOGE","ADA","TRX","AVAX","LINK","DOT","LTC","BCH","NEAR","UNI","ATOM","ETC","XLM","FIL","APT",
  "ARB","OP","INJ","SUI","AAVE","HBAR","ALGO","ICP","SEI","TIA","RUNE","LDO","CRV","SAND","GALA","PEPE","SHIB","WLD","FET","ENA"].map((s) => s + "USDT");
/** BIST evreni (≤200): Grok Bot rutinlerinin BIST100 listesi (health-score lab, 99 hisse) + BIST30 + likit ekler, kalanı tüm BIST evreninden. Yahoo'da verisi olmayan/kısa geçmişli olanlar taramada zararsızca atlanır. */
const BIST_BOX100 = "AEFES AGHOL AKBNK AKSA AKSEN ALARK ARCLK ASELS ASTOR BIMAS BRSAN BRYAT CCOLA CIMSA DOAS DOHOL EGEEN EKGYO ENJSA ENKAI EREGL FROTO GARAN GUBRF HALKB HEKTS ISCTR ISMEN KCHOL KONTR KOZAA TRALT KRDMD MGROS ODAS OTKAR OYAKC PETKM PGSUS SAHOL SASA SISE SKBNK SOKM TAVHL TCELL THYAO TKFEN TOASO TSKB TTKOM TUPRS ULKER VAKBN VESTL YKBNK ZOREN ALBRK ANSGR BAGFS BERA BUCIM CANTE CEMTS DEVA ECILC GESAN GOZDE IPEKE ISGYO KARSN KARTN KORDS LOGO MAVI NETAS NTHOL PRKME QUAGR SELEC SNGYO TATGD TMSN TRGYO TURSG VESBE YATAS ZRGYO ALKIM AYGAZ BRISA CLEBI GOODY KLMSN PARSN TTRAK ADEL AKCNS AKGRS".split(" ");
export const WATCH_BIST = Array.from(new Set([...BIST_BOX100, ...BIST30, ...BIST_LIQUID_EXTRA, ...BIST_EXTRA.map((x) => x.symbol)].map((x) => x.trim().toUpperCase()).filter((x) => /^[A-Z0-9]{3,6}$/.test(x)))).slice(0, 200).map((x) => x + ".IS");
const EMS_PICK: Partial<DivParams> = { osc: "EMs", Lb: 3, R: 5, G1: 5, G2: 60, delta: 0, zone: "lowZ", Z: 50, dz: 0.5, combo: "alone", N: 0, cool: 10 };
/** exit_config.json (IS seçimi): kripto 4s SAR (stop = pivot dip), BIST 1g ATR (stop pivot − 1.5 ATR, hedef giriş + 4 ATR) */
const EK_EXIT: Record<string, { exit: "sar" | "atr"; k: number; tp: number }> = { "4h": { exit: "sar", k: 1.5, tp: 4 }, "1d": { exit: "atr", k: 1.5, tp: 4 } };
const TF_MS: Record<string, number> = { "15m": 9e5, "30m": 18e5, "1h": 36e5, "2h": 72e5, "4h": 144e5, "8h": 288e5, "12h": 432e5, "1d": 864e5 };
/** Zaman bütçesi: Actions işi 12 dk ile sınırlı → süreç bu saniyeyi geçince yeni sembol/tarama başlatılmaz (kapı ilerlemez, sonraki turda tamamlanır) */
/** ntfy tazelik sınırı (sinyal mumu yaşı, mum): varsayılan MAX_AGE (2); ✦ İkili için 0–10 mum (kullanıcı onayı 02.11.2026). Her sinyal yine bir kez bildirilir (anahtar + notified). */
const ALERT_AGE: Partial<Record<ScanId, number>> = { "ikili-4h": 10, "rest-15m": 5, "v12k2-30m": 3, "v12k2-bist-30m": 4 };
const BUDGET_S = Number(process.env.WATCH_BUDGET_S || 510);
const over = () => process.uptime() > BUDGET_S;
/** Dip taramaları: bir sembolün ilk taramasında yalnız son kapanmış mumdaki (yaş 0) sinyal bildirilir (sel önleme); sonra normal kural (yaş ≤ 2). Eskiler yalnız listeye girer. */
const DIP_SCANS = new Set<string>(["dip4", "dip8", "dip12"]);
const MAX_AGE = 2, TRACK_BARS = 100, KEEP_SIG = 300, KEEP_NOTIFIED_MS = 60 * 864e5;

export type ScanId = "ek-crypto-4h" | "ek-bist-1d" | "ls-2h" | "dual-crypto-4h" | "dual-bist-1d" | "rsi30-bist-1d" | "umut-4h" | "ikili-4h" | "umutpg-4h" | "dip4" | "dip8" | "dip12" | "donch-1d" | "rangedip-1d" | "ccidiv-1d" | "ccidiv-bist-1d" | "rest-15m" | "v12k2-30m" | "v12k2-bist-30m";
export const SCANS: Record<ScanId, { label: string; tf: string; market: "kripto" | "BIST"; note: string }> = {
  "ek-crypto-4h": { label: "EK v3 DIV · kripto 4s", tf: "4h", market: "kripto", note: "EMs dip uyumsuzluk; stop = pivot dip (SAR çıkışı), sabit hedef yok. Backtest IS MAR<0 → yalnız uyarı." },
  "ek-bist-1d": { label: "EK v3 DIV · BIST 1g", tf: "1d", market: "BIST", note: "EMs dip uyumsuzluk; stop = pivot − 1.5 ATR, hedef = giriş + 4 ATR. core=1 BIST testinde güçlü." },
  "ls-2h": { label: "L/S uyumsuzluk · 2s", tf: "2h", market: "kripto", note: "Top-trader L/S POZİSYON oranı boğa uyumsuzluğu (dip bölgesi); stop = pivot dip, hedef = BB(20,2) üst." },
  "dual-crypto-4h": { label: "Dual 100/10 LRB · kripto 4s", tf: "4h", market: "kripto", note: "Hızlı alt banda geri giriş, yavaş %B ≤ 0.1; stop = giriş − 1.5 ATR, hedef = hızlı üst bant (her mum güncellenir)." },
  "dual-bist-1d": { label: "Dual 100/10 BB · BIST 1g", tf: "1d", market: "BIST", note: "Hızlı alt banda geri giriş, yavaş %B ≤ 0.5; stop = giriş − 1.5 ATR, hedef 2R." },
  "rsi30-bist-1d": { label: "RSI14 30 kırılım · BIST 1g", tf: "1d", market: "BIST", note: "RSI14 30'u yukarı keser (10 mum bekleme); stop = giriş − 1.5 ATR, hedef 2R." },
  "umut-4h": { label: "Umut (KAL+RSI uyumsuzluk 4s)", tf: "4h", market: "kripto", note: "KAL boğa uyumsuzluğu + RSI14 boğa uyumsuzluğu 5 mum içinde (ileriye bakmaz). Giriş sonraki açılış; stop = giriş − 2 ATR; R1 +%10 (test edilen), R2 +%20, R3 +%30; 100 mum. Test: 2013 işlem, %42 kazanma, PF 1.15, IS/OOS ≈ +%0.5/işlem. Yalnız izleme." },
  "umutpg-4h": { label: "Umut+PG (Umut + Patlama Gücü ≥50, 4s)", tf: "4h", market: "kripto", note: "Umut sinyali (4s KAL + RSI14 boğa uyumsuzluğu, 5 mum içinde) ve sinyal mumunda Patlama Gücü PG5 ≥ 50 (VPA, SQZ, RS/BTC, TAKER, FUND eşit ağırlık; 200 mum yüzdelik). Vadeli verisi (taker/funding) yoksa PG3 (VPA, SQZ, RS) ile karar verilir ve işaretlenir. Giriş sonraki 4s açılış; stop = giriş − 2 ATR; R1 +%10, R2 +%20, R3 +%30; 100 mum. Mumlar vadeli (USDT-M) önce. Test (80 coin, OOS 2024-04→): 924 işlem, +%0.58/işlem (Umut +%0.48), DD 252 vs 413 — eşiğe hassas (≥60/70 bozuluyor). Sanal kağıt defter: Panel → Umut+PG. GERÇEK İŞLEM YOK." },
  "dip4": { label: "Dip · ElifScan bant kesişimi (4s)", tf: "4h", market: "kripto", note: "ElifScan (kullanıcının Pine kodu birebir, 15/30/10/20): main = (FRAMA(stoch15,10) + FRAMA(stoch30,10))/2; wma1 = WMA(main,20), wma2 = WMA(wma1,20); üst = wma1 + (wma1 − wma2), alt = wma2. Sinyal: kapanmış 4s mumda bant çizgileri yer değiştirir — üst bant alt bandı yukarı keser (crossover(upper, lower)) ve main < 40 (dipte; kesişim mumunda ya da bir önceki mumda). main↑alt koşulu yok. Mumlar vadeli (USDT-M) önce, yoksa spot. ntfy kısa: başlık \"Dip\", metin \"dip4 SEMBOL\" (sinyal mumu başına bir kez). Sonuç izleme: giriş sonraki açılış, stop giriş − 2 ATR, 100 mum (yalnız istatistik). Yalnız izleme." },
  "dip8": { label: "Dip · ElifScan dipten kesim (8s)", tf: "8h", market: "kripto", note: "ElifScan (kullanıcının Pine kodu birebir, 15/30/10/20): main = (FRAMA(stoch15,10) + FRAMA(stoch30,10))/2; wma1 = WMA(main,20), wma2 = WMA(wma1,20), üst/alt = wma1 ± (wma1 − wma2). Sinyal: kapanmış 8s mumda main alt bandı VEYA üst bant alt bandı yukarı keser ve main < 40 (kesişim mumunda ya da bir önceki mumda). Mumlar vadeli (USDT-M) önce, yoksa spot. ntfy kısa: başlık \"Dip\", metin \"dip8 SEMBOL\" (sinyal mumu başına bir kez). Sonuç izleme: giriş sonraki açılış, stop giriş − 2 ATR, 100 mum (yalnız istatistik). Yalnız izleme." },
  "dip12": { label: "Dip · ElifScan dipten kesim (12s)", tf: "12h", market: "kripto", note: "ElifScan (kullanıcının Pine kodu birebir, 15/30/10/20): main = (FRAMA(stoch15,10) + FRAMA(stoch30,10))/2; wma1 = WMA(main,20), wma2 = WMA(wma1,20), üst/alt = wma1 ± (wma1 − wma2). Sinyal: kapanmış 12s mumda main alt bandı VEYA üst bant alt bandı yukarı keser ve main < 40 (kesişim mumunda ya da bir önceki mumda). Mumlar vadeli (USDT-M) önce, yoksa spot. ntfy kısa: başlık \"Dip\", metin \"dip12 SEMBOL\" (sinyal mumu başına bir kez). Sonuç izleme: giriş sonraki açılış, stop giriş − 2 ATR, 100 mum (yalnız istatistik). Yalnız izleme." },
  "donch-1d": { label: "Donchian 20/55 kırılım · 1g", tf: "1d", market: "kripto", note: "Catching Crypto Trends (Zarattini–Pagani–Barbon 2025): günlük KAPANIŞ son 20 (D20) ya da 55 (D55) günün en yüksek kapanışına değer → kırılım (kapanmış mum, vadeli mumlar önce). İz süren stop = Donchian orta çizgisi (en yüksek + en düşük kapanış)/2, yalnız yukarı taşınır; kapanış stopun altına inince 'stop'. Giriş = kırılım kapanışı; Stop sütunu = güncel iz süren stop. Kendi testimiz (10 coin, 2018→, %0.1 maliyet): ensemble 5/10/20/30 Sharpe 1.38 (OOS 2022→ 0.89), MDD −%14. Yalnız liste — ntfy göndermez (sanal robot giriş/çıkışta bildirir). GERÇEK İŞLEM YOK." },
  "rangedip-1d": { label: "Range Dip (likidite avı + ikili/üçlü dip) · 1g", tf: "1d", market: "kripto", note: "Kullanıcının kuralı: Donchian alt bandı (önceki N günün en düşük dibi) range tabanı, üst bant (en yüksek tepe) hedef. Sinyal: kapanmış günlük mumun fitili alt bandın altına iner, kapanış bandın içinde kalır (likidite avı) VE önceki [N, 5] mumda grab dibine ≤ 1.25 ATR yakın en az bir onaylı pivot dip (ikili dip; 2+ = üçlü). RD20 / RD55. Giriş sonraki açılış; stop = fitil − 0.1 ATR; hedef = üst bant; en fazla 3N gün. Test (10 coin, %0.1 maliyet): N55 PF 2.04 (OOS 2022→ PF 1.75), N20 PF 1.21 (OOS 1.06); kazanma ~%20, düşüş büyük; ikili/üçlü dip şartı grab'a ek avantaj göstermedi; 4s'te kârsız. ntfy: yeni sinyal + sanal defterde çıkış. GERÇEK İŞLEM YOK." },
  "ccidiv-1d": { label: "CCI Uyums 1G · kripto", tf: "1d", market: "kripto", note: "CCI20 boğa uyumsuzluğu (günlük): pivot dip sol 5 / sağ 5, önceki pivot dip 5–60 mum geride; fiyat daha düşük dip, CCI daha yüksek dip. CCI = (kapanış − SMA20)/(0.015 × ort. mutlak sapma). Sinyal onay mumu (pivot+5) kapanışında; giriş sonraki açılış; stop = giriş − 2 ATR14, hedef +%10, 100 mum. Test (long80 1g, 66 coin): N 455, ort +%1.56, PF 1.32, IS +%2.00 / OOS +%1.44, p 0.002. Yalnız izleme, işlem yok." },
  "ccidiv-bist-1d": { label: "CCI Uyums 1G · BIST", tf: "1d", market: "BIST", note: "CCI20 boğa uyumsuzluğu (günlük): pivot dip sol 5 / sağ 5, önceki pivot dip 5–60 mum geride; fiyat daha düşük dip, CCI daha yüksek dip. CCI = (kapanış − SMA20)/(0.015 × ort. mutlak sapma). Sinyal onay mumu (pivot+5) kapanışında; giriş sonraki açılış; stop = giriş − 2 ATR14, hedef +%10, 100 mum. Test (long80 1g, 66 coin): N 455, ort +%1.56, PF 1.32, IS +%2.00 / OOS +%1.44, p 0.002. Yalnız izleme, işlem yok. BIST'e aynı kural (test coinlerde yapıldı)." },
  "rest-15m": { label: "REST · MTF Stoch 15dk×30dk", tf: "15m", market: "kripto", note: "MultiTime Stochastics Pro uyarlaması: K1 = 15dk Stoch (140, smoothK 30, D 30), K2 = 30dk Stoch (140/30/30; 15dk mum kapanışında kapanmış son 30dk mumu). K1 K2'yi yukarı keser → LONG, aşağı keser → SHORT (kapanmış mum, iki yön). Saatte bir taranır. TP %10 (ort. girişe göre), stop yok, ters kesişimde çıkış/ters yön. EKLE: pozisyon yönünde fiyat–K1 uyumsuzluğu (pivot 5/5, 5–60 mum) → ilk büyüklükte ekleme, en çok 2. Highest/lowest (MTF uç) mantığı yok. Sanal/paper: paper bot kaynağı rest-15m. Test edilmedi. Yalnız izleme, gerçek emir yok." },
  "v12k2-30m": { label: "V12 Çift K2 Long · 30dk", tf: "30m", market: "kripto", note: "MMSMTF V12 (Mixed 55/15, ATR14 × 1.5 zigzag, ağırlık 1/1/1) + MTF Stoch 140/30/30: K1 = 15dk, K2 = 30dk, K2c = 2·K2 − 100. LONG: kapanmış 30dk mumda priceChannel VEYA combined (0.5·core + 0.5·(K1−K2)) K2c'yi yukarı keser ve o mumda K2c < −30 (iki çizgi şartı yok — kullanıcı kararı 04.11.2026). Yalnız LONG, coin başına tek pozisyon (pozisyondayken yeni kesişim yok sayılır). Giriş sonraki 30dk açılış, TP %5, stop yok, 100 mum (50 saat) süre sınırı. Backtest (30m, 80 coin, çıkış a, %0.1/taraf): N=6896, ort. −%0.20/işlem, PF 0.92, rastgele giriş −%0.22 (p 0.39) — AVANTAJ YOK. Yalnız izleme + sanal kağıt. 30 dakikada bir taranır (vadeli 15dk + 30dk mumlar)." },
  "v12k2-bist-30m": { label: "V12 Çift K2 Long · BIST 30dk", tf: "30m", market: "BIST", note: "MMSMTF V12 (Mixed 55/15, ATR14 × 1.5 zigzag, ağırlık 1/1/1) + MTF Stoch 140/30/30: K1 = 15dk, K2 = 30dk, K2c = 2·K2 − 100. LONG: kapanmış 30dk mumda priceChannel VEYA combined (0.5·core + 0.5·(K1−K2)) K2c'yi yukarı keser ve o mumda K2c < −30 (iki çizgi şartı yok — kullanıcı kararı 04.11.2026). Yalnız LONG, coin başına tek pozisyon (pozisyondayken yeni kesişim yok sayılır). Giriş sonraki 30dk açılış, TP %5, stop yok, 100 mum (50 saat) süre sınırı. Backtest (30m, 80 coin, çıkış a, %0.1/taraf): N=6896, ort. −%0.20/işlem, PF 0.92, rastgele giriş −%0.22 (p 0.39) — AVANTAJ YOK. Yalnız izleme + sanal kağıt. BIST: Yahoo 15dk mumları (en fazla ~60 gün) 30dk'ya birleştirilir; seans içinde (hafta içi 10:00–19:00 TSİ) 30 dakikada bir taranır. Yahoo gecikmeli/eksik olabilir; ~400 mumdan kısa geçmişte hisse atlanır." },
  "ikili-4h": { label: "✦ İkili: KDC-MACD + Uyumsuzluk (4s)", tf: "4h", market: "kripto", note: "Patlama ihtimali: aynı coinde KDC-MACD sinyali (30dk KDC K↑D, ≤10 saat içinde 1s MACD 12/26/9 yukarı kesişim) ile Umut sinyali (4s KAL + RSI14 boğa uyumsuzluğu) birbirinden 5 mumdan az arayla. Giriş sonraki 4s açılış; stop = giriş − 2 ATR; R1 +%10, R2 +%20, R3 +%30; 100 mum. Mumlar vadeli (USDT-M) önce, yoksa spot. ntfy: sinyal mumu 0–10 mum yaşındaysa (tek sefer). Kombinasyon geriye dönük test EDİLMEDİ. Yalnız izleme." },
};

/** Seviye hesabı (giriş kesinleşince yeniden hesaplanır) */
type Calc = { kind: "ek"; exit: "sar" | "atr"; pivlow: number; atr: number; k: number; tpm: number } | { kind: "atr"; atr: number; k: number; rr: number | null } | { kind: "fixed" } | { kind: "umut"; atr: number; k: number; tp: number; pivLow: number } | { kind: "donch"; n: number } | { kind: "tp"; tp: number };
export interface WSig {
  key: string; scan: ScanId; symbol: string; tf: string; t: number; tsi: string; age: number; kind: string;
  price: number; entryBasis: string; stop: number; target: number | null; strength?: number | string; info: string;
  calc: Calc; fillT?: number; entry?: number; status: "bekliyor" | "açık" | "hedef" | "stop" | "süre"; exitPx?: number; exitT?: number; R?: number; bars?: number; last?: number; stop0?: number; target0?: number | null; trackBars?: number; ex?: Excursion; ex100?: Excursion; u?: UmutTrack; pg?: PGAt & { src?: string };
  alerted: "gönderildi" | "gönderilemedi" | "ilk tur (bildirimsiz)" | "liste (bildirimsiz)" | "dry-run" | `eski (yaş>${number})`; foundAt: number;
}
interface Coverage { total: number; covered: number; thisRun: number; okThisRun: number; slotTsi: string; oldestTsi: string; full: boolean }
interface ScanRep { label: string; tf: string; market: string; note: string; lastRun?: number; lastFull?: number; coverage?: Coverage; errCount?: number; lastRunTsi?: string; nSym?: number; nOk?: number; errors?: string[]; newCount?: number; signals: WSig[] }
export interface WatchDoc {
  v: 1; kind: "quantex-watch"; tradeMode: "KAPALI (yalnız izleme)"; created: number; updated?: number; updatedTsi?: string; runs: number; firstRunDone?: boolean;
  gate: Record<string, number>; symLast?: Record<string, Record<string, number>>; univ?: { day?: string; crypto?: string[] }; notified: Record<string, number>; scans: Record<string, ScanRep>; ls?: { lastDay?: string; files?: string[]; lastRows?: number; lastErr?: string; pend?: { day: string; syms: string[]; done: number; rows: number; errs: number } }; log: string[];
  paper?: PaperDoc;
  /** Donchian ensemble sanal robotu (gerçek emir yok) */
  donch?: DRobot;
  /** Range Dip sanal defteri (gerçek emir yok) */
  rdip?: { v: 1; rule: string; start: number; since?: number; trades: RDTrade[]; stats?: RDStats; updated?: number; updatedTsi?: string };
}
/** Sanal kağıt defter (gerçek emir yok): Umut+PG ve düz Umut aynı vadeli mumlarla yan yana */
export interface PaperDoc { v: 1; rule: string; start: number; size: number; fee: number; since?: number; pg: PTrade[]; u: PTrade[]; stats?: { pg: PStats; u: PStats }; updated?: number; updatedTsi?: string }
export interface WatchCtx { dir: string; dry: boolean; futHost: string | null; proxy: string; log?: (m: string) => void }

const trT = (t = Date.now()) => new Date(t).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });
const fmtP = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : (+v).toPrecision(6).replace(/\.?0+$/, ""));
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------- HTTP (salt okunur, herkese açık veri) ----------
const lastReq: Record<string, number> = {}; // host başına hız sınırı (bloklar paralel çalışır)
async function getJson(url: string, gap = 250, tries = 3, headers?: Record<string, string>): Promise<unknown> {
  let err: unknown = null; const host = new URL(url).host;
  for (let k = 0; k < tries; k++) {
    const w = (lastReq[host] || 0) + gap - Date.now(); if (w > 0) await sleep(w); lastReq[host] = Math.max(Date.now(), (lastReq[host] || 0) + gap);
    try {
      const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", ...(headers || {}) }, signal: AbortSignal.timeout(15000) });
      if (r.ok) return await r.json();
      err = new Error("HTTP " + r.status);
      if (r.status === 400 || r.status === 404) break;
      if (r.status === 418 || r.status === 429) await sleep(5000 * (k + 1));
    } catch (e) { err = e; }
    await sleep(800 * 2 ** k);
  }
  throw err instanceof Error ? err : new Error("fetch failed");
}
const KC: Record<string, Promise<WBar[] | null>> = {};
/** Binance SPOT mumları (data-api.binance.vision) — Python taramalarıyla aynı kaynak; yalnız kapanmış mumlar */
function spotBars(sym: string, tf: string): Promise<WBar[] | null> {
  return (KC["s|" + sym + "|" + tf] ||= (async () => {
    const rows = (await getJson(`https://data-api.binance.vision/api/v3/klines?symbol=${sym}&interval=${tf}&limit=1000`, 120, 2)) as (string | number)[][];
    const now = Date.now();
    return rows.filter((r) => Number(r[6]) < now).map((r) => ({ t: Number(r[0]), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5], qv: +r[7], tbq: +r[10] }));
  })().catch(() => null));
}
interface YChart { chart: { result: { timestamp: number[]; indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[] } }[] } }
/** Yahoo günlük (3y); bugün 18:30 TSİ'den önce oluşan günlük mum atılır */
function yahooBars(sym: string): Promise<WBar[] | null> {
  return (KC["y|" + sym] ||= (async () => {
    let j: YChart | null = null;
    for (const h of ["query1", "query2"]) { try { j = (await getJson(`https://${h}.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=3y`, 400, 2)) as YChart; break; } catch { /* sonraki */ } }
    if (!j) return null;
    const r = j.chart.result[0], q = r.indicators.quote[0]; let out: WBar[] = [];
    r.timestamp.forEach((t, i) => { const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i], v = q.volume[i];
      if (o != null && h != null && l != null && c != null && v != null) out.push({ t: t * 1000, open: o, high: h, low: l, close: c, volume: v }); });
    if (out.filter((b) => b.volume > 0).length > 0.5 * out.length) out = out.filter((b) => b.volume > 0);
    const f = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
    const nowS = f(new Date()), lastS = f(new Date(out[out.length - 1].t)), hm = Number(nowS.slice(12, 14)) * 60 + Number(nowS.slice(15, 17));
    if (lastS.slice(0, 10) === nowS.slice(0, 10) && hm < 18 * 60 + 30) out.pop();
    const seen = new Set<number>(); return out.filter((b) => (seen.has(b.t) ? false : (seen.add(b.t), true)));
  })().catch(() => null));
}

// ---------- ntfy (yalnız ortam değişkeni; adres hiçbir yere yazılmaz) ----------
const ntfyUrl = () => process.env.WATCH_NTFY_URL || process.env.ELIZI_NTFY_URL || process.env.NTFY_URL || "";
const b64Title = (s: string) => "=?UTF-8?B?" + Buffer.from(s, "utf8").toString("base64") + "?=";
async function ntfySend(title: string, body: string): Promise<number> {
  const u = ntfyUrl(); if (!u) throw new Error("ntfy adresi tanımlı değil");
  const r = await fetch(u, { method: "POST", headers: { "Content-Type": "text/plain; charset=utf-8", Title: b64Title(title), Tags: "mag", Priority: "default" }, body, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("ntfy HTTP " + r.status);
  return r.status;
}

// ---------- doc ----------
function loadDoc(file: string): WatchDoc {
  try { const j = JSON.parse(fs.readFileSync(file, "utf8")); if (j && j.kind === "quantex-watch") return j as WatchDoc; } catch { /* yeni */ }
  return { v: 1, kind: "quantex-watch", tradeMode: "KAPALI (yalnız izleme)", created: Date.now(), runs: 0, gate: {}, notified: {}, scans: {}, log: [] };
}

// ---------- sonuç izleme (işlem değil: sinyalin sonraki mumlarda stop/hedefe değip değmediği) ----------
function levelsFor(s: WSig, entry: number): { stop: number; target: number | null } {
  const c = s.calc;
  if (c.kind === "ek") {
    if (c.exit === "sar") { let st = c.pivlow; if (st >= entry) st = entry - c.atr; return { stop: st, target: null }; }
    let st = c.pivlow - c.k * c.atr; if (st >= entry) st = entry - c.k * c.atr; return { stop: st, target: entry + c.tpm * c.atr };
  }
  if (c.kind === "umut") return { stop: entry - c.k * c.atr, target: entry * (1 + c.tp) };
  if (c.kind === "tp") return { stop: NaN, target: entry * (1 + c.tp) }; // stop yok
  if (c.kind === "atr") { const st = entry - c.k * c.atr; return { stop: st, target: c.rr == null ? null : entry + c.rr * (entry - st) }; }
  return { stop: s.stop, target: s.target };
}
/** Sinyal sonrası hareket istatistikleri (ekleme/TP seviyelerini sonradan türetmek için). k = girişten itibaren mum no (giriş mumu = 1). */
export interface Excursion { mfePct: number; mfeR: number | null; mfeBar: number; maePct: number; maeR: number | null; maeBar: number; r1: number | null; r2: number | null; r3: number | null; bars: number }
function excursion(bars: WBar[], i1: number, upto: number, e: number, risk: number): Excursion {
  let hi = -Infinity, lo = Infinity, hiK = 0, loK = 0; const rk: (number | null)[] = [null, null, null];
  for (let j = i1, k = 1; j <= upto; j++, k++) {
    const b = bars[j];
    if (b.high > hi) { hi = b.high; hiK = k; }
    if (b.low < lo) { lo = b.low; loK = k; }
    if (risk > 0) for (let m = 0; m < 3; m++) if (rk[m] == null && b.high >= e + (m + 1) * risk) rk[m] = k;
  }
  const r2 = (v: number) => +v.toFixed(2);
  return { mfePct: r2((hi - e) / e * 100), mfeR: risk > 0 ? r2((hi - e) / risk) : null, mfeBar: hiK, maePct: r2((lo - e) / e * 100), maeR: risk > 0 ? r2((lo - e) / risk) : null, maeBar: loK, r1: rk[0], r2: rk[1], r3: rk[2], bars: upto - i1 + 1 };
}
/** Sonuç izleme: giriş = sinyal sonrası ilk açılış, stop/hedef/100 mum. Mumlardan her seferinde baştan hesaplanır (deterministik);
 *  40 mumda "süre" ile kapanmış eski sinyaller otomatik 100 muma uzar. Giriş mumu veri penceresinden çıktıysa mevcut kayıt korunur.
 *  ex = işlem süresince (çıkışa kadar) MFE/MAE + 1R/2R/3R mum no; ex100 = çıkıştan bağımsız 100 mumluk pencere (gölge). dyn: her mum değişen hedef. */
function track(s: WSig, bars: WBar[], dyn?: number[]) {
  const i0 = bars.findIndex((b) => b.t > s.t);
  if (i0 < 0) { if (s.calc.kind === "umut" && !s.u) s.u = umutTrack(bars, bars.length, s.price, s.stop, s.calc.pivLow, s.calc.atr); return; }
  if (s.fillT === undefined) { s.fillT = bars[i0].t; s.entry = bars[i0].open; const lv = levelsFor(s, s.entry); s.stop = lv.stop; if (!dyn) s.target = lv.target; s.stop0 = s.stop; s.target0 = s.target; }
  const i1 = bars.findIndex((b) => b.t === s.fillT); if (i1 < 0) return;
  const e = s.entry!; if (s.stop0 === undefined) { s.stop0 = s.stop; s.target0 = dyn ? null : s.target; }
  const stop = s.stop0 ?? NaN, risk = e - stop; // stop yok (tp) → NaN: stop/R hesaplanmaz
  s.status = "açık"; s.exitPx = s.exitT = s.R = undefined; s.trackBars = TRACK_BARS;
  let exitJ = -1;
  for (let j = i1, k = 1; j < bars.length; j++, k++) {
    const b = bars[j], tg = dyn ? (j > 0 && Number.isFinite(dyn[j - 1]) ? dyn[j - 1] : null) : s.target0 ?? null;
    let px: number | null = null, why: WSig["status"] | null = null;
    if (b.open <= stop) { px = b.open; why = "stop"; }
    else if (b.low <= stop) { px = stop; why = "stop"; }
    else if (tg != null && b.high >= tg) { px = Math.max(tg, b.open); why = "hedef"; }
    else if (k >= TRACK_BARS) { px = b.close; why = "süre"; }
    s.bars = k; s.last = b.close;
    if (dyn && Number.isFinite(dyn[j])) s.target = dyn[j];
    if (px != null && why) { s.status = why; s.exitPx = px; s.exitT = b.t; s.R = risk > 0 ? +((px - e) / risk).toFixed(2) : undefined; exitJ = j; break; }
  }
  s.ex = excursion(bars, i1, exitJ >= 0 ? exitJ : bars.length - 1, e, risk);
  s.ex100 = excursion(bars, i1, Math.min(bars.length - 1, i1 + TRACK_BARS - 1), e, risk);
  if (s.calc.kind === "umut") { const A = atrW(bars); s.u = umutTrack(bars, i1, e, stop, s.calc.pivLow, A[bars.length - 1]); }
}

// ---------- taramalar ----------
type Found = Omit<WSig, "alerted" | "foundAt" | "status"> & { title: string; body: string };
const tsiBar = (t: number, tf: string) => (tf === "1d" ? new Date(t).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" }) : trT(t).slice(0, -3));
function ekScan(scan: ScanId, sym: string, tf: string, bars: WBar[], maxAge = MAX_AGE): Found[] {
  const m = tf === "4h" ? 6 : 5, X = EK_EXIT[tf];
  const r = ekDivergenceV3(bars, EMS_PICK, { m }), v = emilimV3(bars, { m }), A = atr14Ewm(bars), n = bars.length;
  const cx = v.fms.map(() => false); let last = -1e9;
  for (let i = 1; i < n; i++) {
    const a = Number.isFinite(v.fms[i - 1]) && v.fms[i - 1] <= 0 && v.fms[i] > 0 && v.depth[i] >= 0.5 && v.ems[i] >= 30;
    if (a) { if (i - last <= 15) continue; cx[i] = true; last = i; }
  }
  const byC = new Map(r.divs.map((d) => [d.confirm, d]));
  const evs: { c: number; d: { p0: number; p: number }; core: boolean; kind: string; dc: number }[] = [];
  r.signal.forEach((s, c) => {
    if (!s) return; const d = byC.get(c); if (!d) return;
    let core = false; for (let j = Math.max(0, c - 10); j <= c; j++) if (cx[j]) core = true;
    evs.push({ c, d, core, kind: "DIV", dc: c });
    for (let j = c + 1; j <= Math.min(n - 1, c + 10); j++) if (cx[j]) { evs.push({ c: j, d, core: true, kind: "CORE+DIV", dc: c }); break; }
  });
  const out: Found[] = [];
  for (const e of evs) {
    const age = n - 1 - e.c; if (age > maxAge) continue;
    const c0 = e.dc, d = e.d;
    const ds = Math.min(1, Math.max(0, (r.osc[d.p] - r.osc[d.p0]) / 20)), deep = v.depth[d.p] >= 0.5 ? 1 : 0, fm = v.fms[c0] > 0 ? 1 : 0;
    let al = 0; for (let j = Math.max(0, c0 - 10); j <= c0; j++) if (v.al[j]) al = 1;
    const strength = Math.round(((ds + deep + fm + al) / 4) * 100) / 100;
    const entry = age >= 1 ? bars[e.c + 1].open : bars[n - 1].close;
    const calc: Calc = { kind: "ek", exit: X.exit, pivlow: bars[d.p].low, atr: A[c0], k: X.k, tpm: X.tp };
    const s0 = { calc } as WSig; const lv = levelsFor(s0, entry);
    const info = `${e.kind !== "DIV" ? e.kind + " · " : ""}güç ${strength.toFixed(2)} (div ${ds.toFixed(2)} deep ${deep} fms ${fm} al ${al} core ${e.core ? 1 : 0})${e.core && tf === "1d" ? " · core: BIST testinde güçlü" : ""}`;
    const t = bars[e.c].t, lbl = SCANS[scan].label;
    out.push({ key: `${scan}|${sym}|${t}|${e.kind}`, scan, symbol: sym, tf, t, tsi: tsiBar(t, tf), age, kind: e.kind, price: entry, entryBasis: age >= 1 ? "sonraki açılış" : "son kapanış (sonraki açılış henüz yok)",
      stop: lv.stop, target: lv.target, strength, info, calc,
      title: `İZLEME | ${lbl} | ${sym} AL${e.kind !== "DIV" ? " (" + e.kind + ")" : ""}`,
      body: `${lbl} — ${sym} ${tf}\nSinyal mumu: ${tsiBar(t, tf)} (TSİ, yaş ${age} mum)\n${info}\nGiriş ref: ${fmtP(entry)} (${age >= 1 ? "sonraki açılış" : "son kapanış"})\nStop: ${fmtP(lv.stop)}${X.exit === "sar" ? " (pivot dip, SAR iz sürer)" : ""}\nHedef: ${lv.target == null ? "yok (SAR çıkışı)" : fmtP(lv.target)}\nDurum: SADECE İZLEME — işlem açılmadı` });
  }
  return out;
}
function dualScan(scan: ScanId, sym: string, tf: string, bars: WBar[], typ: "BB" | "LRB", z: number, mode: "A" | "B", maxAge = MAX_AGE): { found: Found[]; dyn: number[] } {
  const D = dualBandBuy(bars, 100, 10, typ, z), A = atr14Rma(bars), n = bars.length, out: Found[] = [], lbl = SCANS[scan].label;
  for (let i = Math.max(1, n - 1 - maxAge); i < n; i++) {
    if (!D.buy[i] || !Number.isFinite(A[i])) continue;
    const c = bars[i].close, stop = c - 1.5 * A[i], tgt = mode === "A" ? c + 3 * A[i] : D.fastUp[i], t = bars[i].t, age = n - 1 - i;
    const info = `kapanış ${fmtP(c)} · hızlı alt bant ${fmtP(D.fastLow[i])} · yavaş %B(önceki) ${D.pbPrev[i].toFixed(2)}`;
    out.push({ key: `${scan}|${sym}|${t}`, scan, symbol: sym, tf, t, tsi: tsiBar(t, tf), age, kind: "AL", price: c, entryBasis: "sonraki açılış (ref kapanış)", stop, target: tgt, info,
      calc: { kind: "atr", atr: A[i], k: 1.5, rr: mode === "A" ? 2 : null },
      title: `İZLEME | ${lbl} | ${sym} AL`,
      body: `${lbl} — ${sym} ${tf}\nSinyal mumu: ${tsiBar(t, tf)} (TSİ, yaş ${age} mum)\n${info}\nGiriş: sonraki mum açılışı (ref ${fmtP(c)})\nStop: ≈${fmtP(stop)} (giriş − 1.5 ATR)\nHedef: ${mode === "A" ? "≈" + fmtP(tgt) + " (2R)" : "hızlı üst bant, şu an " + fmtP(tgt)}\nZaman: 100 mum\nDurum: SADECE İZLEME — işlem açılmadı` });
  }
  return { found: out, dyn: D.fastUp };
}
function rsi30Scan(sym: string, bars: WBar[], maxAge = MAX_AGE): Found[] {
  const scan: ScanId = "rsi30-bist-1d", R = rsi30Buy(bars), A = atr14Rma(bars), n = bars.length, out: Found[] = [], lbl = SCANS[scan].label;
  for (let i = Math.max(1, n - 1 - maxAge); i < n; i++) {
    if (!R.buy[i] || !Number.isFinite(A[i])) continue;
    const c = bars[i].close, stop = c - 1.5 * A[i], tgt = c + 3 * A[i], t = bars[i].t, age = n - 1 - i;
    const info = `RSI14 ${R.rsi[i - 1].toFixed(1)} → ${R.rsi[i].toFixed(1)} · kapanış ${fmtP(c)}`;
    out.push({ key: `${scan}|${sym}|${t}`, scan, symbol: sym, tf: "1d", t, tsi: tsiBar(t, "1d"), age, kind: "AL", price: c, entryBasis: "sonraki açılış (ref kapanış)", stop, target: tgt, info,
      calc: { kind: "atr", atr: A[i], k: 1.5, rr: 2 },
      title: `İZLEME | ${lbl} | ${sym} AL`,
      body: `${lbl} — ${sym} 1d\nSinyal mumu: ${tsiBar(t, "1d")} (yaş ${age} mum)\n${info}\nGiriş: sonraki mum açılışı (ref ${fmtP(c)})\nStop: ≈${fmtP(stop)} (giriş − 1.5 ATR)\nHedef: ≈${fmtP(tgt)} (2R)\nZaman: 100 mum\nDurum: SADECE İZLEME — işlem açılmadı` });
  }
  return out;
}

/** CCI UYUMS 1G: CCI20 boğa uyumsuzluğu (pivot 5/5, 5–60 mum), onay mumu kapanışı. Giriş ref = sonraki açılış (yoksa son kapanış); stop giriş − 2 ATR, hedef +%10. */
function cciDivScan(scan: "ccidiv-1d" | "ccidiv-bist-1d", sym: string, bars: WBar[], src: string, maxAge = MAX_AGE): Found[] {
  const n = bars.length, out: Found[] = [], lbl = SCANS[scan].label, A = atr14Rma(bars), D = cciBullDiv(bars);
  for (const h of D.hits) {
    const age = n - 1 - h.i; if (age > maxAge || !Number.isFinite(A[h.i])) continue;
    if (Date.now() - bars[h.i].t > (maxAge + 5) * TF_MS["1d"]) continue; // bayat veri
    const entry = age >= 1 ? bars[h.i + 1].open : bars[n - 1].close, stop = entry - CCIDIV.atrK * A[h.i], tgt = entry * (1 + CCIDIV.tp), t = bars[h.i].t;
    const info = `CCI20 boğa uyumsuzluğu · dip ${fmtP(h.low0)} → ${fmtP(h.low)} (${h.p - h.p0} mum) · CCI ${h.cci0.toFixed(0)} → ${h.cci.toFixed(0)} · pivot ${tsiBar(bars[h.p].t, "1d")} · ${src === "perp" ? "vadeli" : src === "yahoo" ? "Yahoo" : "spot"} mum`;
    out.push({ key: `${scan}|${sym}|${t}`, scan, symbol: sym, tf: "1d", t, tsi: tsiBar(t, "1d"), age, kind: "AL", price: entry, entryBasis: age >= 1 ? "sonraki açılış" : "son kapanış (sonraki açılış henüz yok)",
      stop, target: tgt, info, calc: { kind: "umut", atr: A[h.i], k: CCIDIV.atrK, tp: CCIDIV.tp, pivLow: h.low },
      title: `İZLEME | ${lbl} | ${sym} AL`,
      body: `${lbl} — ${sym} 1g\nSinyal (onay) mumu: ${tsiBar(t, "1d")} (yaş ${age} mum)\n${info}\nGiriş: ${fmtP(entry)} (${age >= 1 ? "sonraki açılış" : "ref son kapanış, giriş sonraki açılış"})\nStop: ${fmtP(stop)} (giriş − 2 ATR)\nHedef: ${fmtP(tgt)} (+%10)\nSüre: 100 mum\nDurum: SADECE İZLEME — işlem açılmadı` });
  }
  return out;
}

/** REST: K1 (15dk Stoch 140/30/30) × K2 (30dk). Kesişim → LONG/SHORT; pozisyon yönünde fiyat–K1 uyumsuzluğu → EKLE (kesişimden sonra en çok 2). Sonuç takibi yok (iki yön; paper bot defteri izler). */
function restScan(sym: string, b15: WBar[], b30: WBar[], src: string, maxAge = MAX_AGE): Found[] {
  const scan: ScanId = "rest-15m", n = b15.length, out: Found[] = [], lbl = SCANS[scan].label;
  const R = (b: WBar[]) => ({ t: b.map((x) => x.t), h: b.map((x) => x.high), l: b.map((x) => x.low), c: b.map((x) => x.close) });
  const E = restEval(R(b15), R(b30));
  const push = (i: number, side: "LONG" | "SHORT", kind: string, info: string, head: string) => {
    const age = n - 1 - i; if (age > maxAge) return;
    if (Date.now() - b15[i].t > (maxAge + 4) * TF_MS["15m"]) return; // bayat veri
    const entry = age >= 1 ? b15[i + 1].open : b15[n - 1].close, tgt = side === "LONG" ? entry * (1 + REST.tp) : entry * (1 - REST.tp), t = b15[i].t;
    out.push({ key: `${scan}|${sym}|${t}|${kind}`, scan, symbol: sym, tf: "15m", t, tsi: tsiBar(t, "15m"), age, kind, price: entry, entryBasis: age >= 1 ? "sonraki 15dk açılış" : "son kapanış",
      stop: NaN, target: tgt, info: info + ` · ${src === "perp" ? "vadeli" : "spot"} mum`, calc: { kind: "fixed" },
      title: `İZLEME | REST | ${sym} ${head}`,
      body: `${lbl} — ${sym}\nSinyal mumu: ${tsiBar(t, "15m")} TSİ (yaş ${age} × 15dk)\n${info}\nGiriş ref: ${fmtP(entry)}\nTP %10: ${fmtP(tgt)}\nStop: yok (ters kesişimde çıkış)\nDurum: SADECE İZLEME — gerçek işlem yok (paper bot: rest-15m)` });
  };
  for (const e of E.ev) push(e.i, e.side, e.side === "LONG" ? "AL" : "SAT", `K1 (15dk) ${e.k1.toFixed(1)} ${e.side === "LONG" ? "↑ yukarı" : "↓ aşağı"} keser K2 (30dk) ${e.k2.toFixed(1)}`, e.side);
  for (const d of E.div) {
    const e = E.ev.filter((x) => x.i < d.i).pop(); if (!e || e.side !== d.side) continue;
    const nPrev = E.div.filter((x) => x.side === d.side && x.i > e.i && x.i < d.i).length; if (nPrev >= REST.maxAdds) continue;
    push(d.i, d.side, `EKLE-${d.side === "LONG" ? "L" : "S"}`, `${d.side === "LONG" ? "Boğa" : "Ayı"} uyumsuzluk (fiyat ${fmtP(d.px0)} → ${fmtP(d.px)}, K1 ${d.k0.toFixed(1)} → ${d.k.toFixed(1)}, ${d.p - d.p0} mum) · ${d.side} pozisyonuna ekleme ${nPrev + 1}/${REST.maxAdds} (kesişim ${tsiBar(b15[e.i].t, "15m")})`, `${d.side} EKLEME ${nPrev + 1}/${REST.maxAdds}`);
  }
  return out;
}

/** V12 Çift K2 Long: kapanmış 30dk mumda priceChannel VEYA combined K2c'yi yukarı keser, K2c < −30. b30 = 30dk, b15 = 15dk kapanmış mumlar. */
function v12k2Scan(scan: "v12k2-30m" | "v12k2-bist-30m", sym: string, b30: WBar[], b15: WBar[], src: string, maxAge = MAX_AGE): Found[] {
  const n = b30.length, out: Found[] = [], lbl = SCANS[scan].label, nm = sym.replace(/\.IS$/, "");
  const R = (b: WBar[]) => ({ t: b.map((x) => x.t), o: b.map((x) => x.open), h: b.map((x) => x.high), l: b.map((x) => x.low), c: b.map((x) => x.close), v: b.map((x) => x.volume) });
  const E = v12k2Eval(R(b30), R(b15));
  for (const e of E.ev) {
    const age = n - 1 - e.i; if (age > maxAge || e.i < E.need) continue;
    if (Date.now() - b30[e.i].t > (maxAge + 4) * TF_MS["30m"]) continue; // bayat veri
    const entry = age >= 1 ? b30[e.i + 1].open : b30[n - 1].close, tgt = entry * (1 + V12K2.tp), t = b30[e.i].t;
    const info = `${e.by === "ikisi" ? "priceChannel + combined" : e.by === "pch" ? "priceChannel" : "combined"} K2c'yi (${e.k2c.toFixed(1)} < −30) yukarı keser · pch ${e.pch.toFixed(1)} comb ${e.comb.toFixed(1)} · K1 ${e.k1.toFixed(1)} K2 ${e.k2.toFixed(1)} · ${src === "perp" ? "vadeli" : src === "yahoo" ? "Yahoo" : "spot"} mum`;
    out.push({ key: `${scan}|${sym}|${t}`, scan, symbol: sym, tf: "30m", t, tsi: tsiBar(t, "30m"), age, kind: "AL", price: entry, entryBasis: age >= 1 ? "sonraki 30dk açılış" : "son kapanış (sonraki açılış henüz yok)",
      stop: NaN, target: tgt, info, calc: { kind: "tp", tp: V12K2.tp },
      title: `v12k2 ${nm}`,
      body: `v12k2 ${nm} LONG · 30dk ${tsiBar(t, "30m")} TSİ · giriş ${fmtP(entry)} · TP %5 ${fmtP(tgt)} · stop yok · 100 mum · yalnız izleme/kağıt` });
  }
  return out;
}
/** BIST 15dk mumları (Yahoo, ~60 gün) — yalnız kapanmış mumlar */
function yahooIntra(sym: string): Promise<WBar[] | null> {
  return (KC["y15|" + sym] ||= (async () => {
    let j: YChart | null = null;
    for (const h of ["query1", "query2"]) { try { j = (await getJson(`https://${h}.finance.yahoo.com/v8/finance/chart/${sym}?interval=15m&range=60d`, 400, 2)) as YChart; break; } catch { /* sonraki */ } }
    if (!j || !j.chart?.result?.[0]?.timestamp) return null;
    const r = j.chart.result[0], q = r.indicators.quote[0], now = Date.now(), out: WBar[] = [], seen = new Set<number>();
    r.timestamp.forEach((t, i) => { const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i], v = q.volume[i], tm = t * 1000;
      if (o != null && h != null && l != null && c != null && tm % 9e5 === 0 && tm + 9e5 <= now && !seen.has(tm)) { seen.add(tm); out.push({ t: tm, open: o, high: h, low: l, close: c, volume: v ?? 0 }); } });
    return out;
  })().catch(() => null));
}
/** 15dk → 30dk (kova = UTC 30dk ızgara; kova ancak 2. 15dk mumu ya da sonraki kova gelince kapanmış sayılır) */
function to30(b15: WBar[]): WBar[] {
  const out: WBar[] = []; let cur: WBar | null = null, cnt = 0;
  for (const b of b15) {
    const k = Math.floor(b.t / 18e5) * 18e5;
    if (!cur || cur.t !== k) { if (cur) out.push(cur); cur = { t: k, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }; cnt = 1; }
    else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; cur.volume += b.volume; cnt++; }
    if (cur && b.t + 9e5 >= k + 18e5) { out.push(cur); cur = null; }
  }
  return out; // son eksik kova (yalnız ilk 15dk) dışarıda kalır
}
/** UMUT: KAL + RSI uyumsuzluğu 5 mum içinde (4s). Giriş ref = sonraki açılış (yoksa son kapanış). */
function umutScan(sym: string, bars: WBar[], maxAge = MAX_AGE): Found[] {
  const scan: ScanId = "umut-4h", n = bars.length, out: Found[] = [], lbl = SCANS[scan].label;
  for (const h of umutSignals(bars)) {
    const age = n - 1 - h.i; if (age > maxAge) continue;
    if (Date.now() - bars[h.i].t > (maxAge + 2) * TF_MS["4h"]) continue; // bayat veri (işlem görmeyen/eski sembol)
    const entry = age >= 1 ? bars[h.i + 1].open : bars[n - 1].close, stop = entry - UMUT.atrK * h.atr, t = bars[h.i].t;
    const R = UMUT.tps.map((p) => entry * (1 + p));
    const first = h.kalAt <= h.rsiAt ? "KAL→RSI" : "RSI→KAL", gap = Math.abs(h.kalAt - h.rsiAt);
    const info = `KAL uyumsuzluk + RSI uyumsuzluk (${first}, ${gap} mum arayla) · RSI14 ${h.rsi.toFixed(1)} · KAL ${h.kal.toFixed(1)} · ATR ${fmtP(h.atr)} · dip ${fmtP(h.pivLow)}`;
    out.push({ key: `${scan}|${sym}|${t}`, scan, symbol: sym, tf: "4h", t, tsi: tsiBar(t, "4h"), age, kind: "AL", price: entry, entryBasis: age >= 1 ? "sonraki açılış" : "son kapanış (sonraki açılış henüz yok)",
      stop, target: R[0], info, calc: { kind: "umut", atr: h.atr, k: UMUT.atrK, tp: UMUT.tps[0], pivLow: h.pivLow },
      title: `UMUT | ${sym} 4s AL (KAL+RSI uyumsuzluk)`,
      body: `${lbl} — ${sym} 4s\nSinyal mumu: ${tsiBar(t, "4h")} TSİ (yaş ${age} mum)\n${info}\nGiriş: ${fmtP(entry)} (${age >= 1 ? "sonraki 4s açılış" : "ref son kapanış, giriş sonraki açılış"})\nStop: ${fmtP(stop)} (giriş − 2 ATR)\nR1 +%10: ${fmtP(R[0])} (test edilen hedef)\nR2 +%20: ${fmtP(R[1])}\nR3 +%30: ${fmtP(R[2])}\nSüre: 100 mum\nDurum: SADECE İZLEME — işlem açılmadı` });
  }
  return out;
}

/** Vadeli (USDT-M perp) kapanmış mumlar: fapi doğrudan → Vercel proxy (/api/fklines); yoksa spot. İkili için 4s/1s/30dk aynı kaynaktan. */
/** DONCHIAN 20/55 (günlük kapanış kırılımı). Kırılım = pozisyonsuzken kapanış ≥ üst bant (kapanış tabanlı); stop = orta çizgi. */
function donchScan(sym: string, bars: WBar[], src: string, maxAge = MAX_AGE): Found[] {
  const scan: ScanId = "donch-1d", n = bars.length, out: Found[] = [], c = bars.map((b) => b.close), lbl = SCANS[scan].label;
  for (const N of DON.scanNs) {
    const D = donchTrail(c, N);
    for (let i = Math.max(1, n - 1 - maxAge); i < n; i++) {
      if (!(D.pos[i] && !D.pos[i - 1])) continue;
      const t = bars[i].t, age = n - 1 - i;
      out.push({ key: `${scan}|${sym}|${t}|D${N}`, scan, symbol: sym, tf: "1d", t, tsi: tsiBar(t, "1d"), age, kind: `D${N}`, price: c[i], entryBasis: "kırılım günü kapanışı",
        stop: D.ts[i], target: null, info: `Donchian ${N} üst bant (kapanış) kırılımı · üst ${fmtP(D.up[i])} · iz süren stop (orta) ${fmtP(D.ts[i])} · ${src === "perp" ? "vadeli" : "spot"} mum`, calc: { kind: "donch", n: N },
        title: `İZLEME | Donchian D${N} | ${sym}`, body: `${sym} günlük kapanış Donchian ${N} üst bandında\nKapanış: ${fmtP(c[i])}\nİz süren stop (orta çizgi): ${fmtP(D.ts[i])}\nDurum: SADECE İZLEME` });
    }
  }
  return out;
}
/** Donchian sinyali takibi: giriş = kırılım kapanışı; her gün stop = max(stop, orta çizgi); kapanış ≤ stop → "stop" (o kapanıştan çıkış). */
function donchTrackSig(s: WSig, bars: WBar[]) {
  if (s.calc.kind !== "donch") return;
  const i = bars.findIndex((b) => b.t === s.t); if (i < 0) return;
  const D = donchTrail(bars.map((b) => b.close), s.calc.n); if (!D.pos[i]) return;
  const e = bars[i].close; s.fillT = s.t; s.entry = e; if (s.stop0 === undefined) s.stop0 = D.ts[i];
  const risk = e - s.stop0; s.status = "açık"; s.exitPx = s.exitT = s.R = undefined; s.bars = 0; s.last = e; s.stop = D.ts[i];
  for (let j = i + 1; j < bars.length; j++) {
    s.bars = j - i; s.last = bars[j].close;
    if (!D.pos[j]) { s.status = "stop"; s.exitPx = bars[j].close; s.exitT = bars[j].t; s.R = risk > 0 ? +((s.exitPx - e) / risk).toFixed(2) : undefined; return; }
    s.stop = D.ts[j];
  }
}
/** RANGE DIP (kullanıcının kuralı): likidite avı + ikili/üçlü dip, hedef üst bant. Liste + sanal defter adayları. */
function rangeDipScan(sym: string, bars: WBar[], src: string, maxAge = MAX_AGE): { found: Found[]; cands: RDTrade[] } {
  const scan: ScanId = "rangedip-1d", n = bars.length, found: Found[] = [], cands: RDTrade[] = [], now = Date.now();
  for (const N of RDIP.Ns) for (const h of rangeDipSignals(bars, N)) {
    const age = n - 1 - h.i; if (age > maxAge) continue;
    const b = bars[h.i], t = b.t, tsi = tsiBar(t, "1d"), typ = h.k >= 2 ? "üçlü dip" : "ikili dip";
    const info = `RD${N} · likidite avı: fitil ${fmtP(b.low)} < alt bant ${fmtP(h.dl)}, kapanış ${fmtP(b.close)} içeride · ${typ} (${h.k + 1} dip, ±1.25 ATR) · hedef üst bant ${fmtP(h.du)} · ${src === "perp" ? "vadeli" : "spot"} mum`;
    found.push({ key: `${scan}|${sym}|${t}|RD${N}`, scan, symbol: sym, tf: "1d", t, tsi, age, kind: `RD${N} ${typ}`, price: b.close, entryBasis: "sonraki günlük açılış (sinyalde kapanış referans)",
      stop: h.stop, target: h.du, strength: `${h.k + 1} dip`, info, calc: { kind: "fixed" },
      title: `Range Dip | ${sym} AL (RD${N})`,
      body: `${sym} günlük — likidite avı + ${typ} (Donchian ${N})\nSinyal mumu: ${tsi}\nKapanış (ref): ${fmtP(b.close)} · giriş sonraki açılış\nStop (fitil − 0.1 ATR): ${fmtP(h.stop)}\nHedef (üst bant): ${fmtP(h.du)}\nDurum: SADECE İZLEME — sanal defter, gerçek işlem yok` });
    cands.push({ key: `rd|${sym}|${t}|${N}`, sym, N, t, tsi, stop: h.stop, tp: h.du, dl: h.dl, atr: h.atr, k: h.k, backfill: age > MAX_AGE, foundAt: now, status: "bekliyor" });
  }
  return { found, cands };
}
function futBars(ctx: WatchCtx, sym: string, tf: string): Promise<{ bars: WBar[]; src: "perp" | "spot" } | null> {
  const k = "f|" + sym + "|" + tf;
  return (FC[k] ||= (async () => {
    try {
      const j = (await futGet(ctx, `/fapi/v1/klines?symbol=${sym}&interval=${tf}&limit=1000`, `/api/fklines?symbol=${sym}&interval=${tf}&limit=1000`)) as (string | number)[][];
      if (Array.isArray(j) && j.length >= 100) { const now = Date.now(); return { bars: j.filter((r) => Number(r[6]) < now).map((r) => ({ t: Number(r[0]), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5], qv: +r[7], tbq: +r[10] })), src: "perp" as const }; }
    } catch { /* spot */ }
    const sp = await spotBars(sym, tf); return sp && sp.length ? { bars: sp, src: "spot" as const } : null;
  })());
}
const FC: Record<string, Promise<{ bars: WBar[]; src: "perp" | "spot" } | null>> = {};
/** İkili 4s mumları (vadeli önce) — tarama ve sonuç takibi aynı mumlarla */
async function ikiliBars(ctx: WatchCtx, sym: string, fb: WBar[]): Promise<WBar[]> { const f = await futBars(ctx, sym, "4h"); return f && f.bars.length >= 300 ? f.bars : fb; }

/** ✦ İKİLİ: KDC-MACD + Umut (KAL/RSI uyumsuzluk) < 5 mum arayla (4s). Mumlar vadeli önce (yoksa spot): 4s + 30dk + 1s; 30dk/1s yalnız yakın Umut sinyali olan coinde çekilir. */
async function ikiliScan(ctx: WatchCtx, sym: string, b4: WBar[], maxAge = MAX_AGE): Promise<Found[]> {
  const scan: ScanId = "ikili-4h", n = b4.length, out: Found[] = [], lbl = SCANS[scan].label;
  const U = umutSignals(b4);
  if (!U.some((u) => n - 1 - u.i <= maxAge + UMUT.N)) return out;
  const [f30, f1] = await Promise.all([futBars(ctx, sym, "30m"), futBars(ctx, sym, "1h")]);
  const b30 = f30?.bars, b1 = f1?.bars;
  if (!b30 || !b1 || b30.length < 200 || b1.length < 100) return out;
  const A = atrW(b4);
  for (const h of ikiliSignals(b4, b30, b1, U).hits) {
    const age = n - 1 - h.i; if (age > maxAge) continue;
    if (Date.now() - b4[h.i].t > (maxAge + 2) * TF_MS["4h"]) continue;
    const atr = A[h.i]; if (!(atr > 0)) continue;
    const entry = age >= 1 ? b4[h.i + 1].open : b4[n - 1].close, stop = entry - UMUT.atrK * atr, t = b4[h.i].t;
    const R = UMUT.tps.map((p) => entry * (1 + p)), u = h.umut, k = h.kdc;
    const d = h.kdcI4 - h.umutI, ord = d === 0 ? "aynı mumda" : d > 0 ? `Umut → KDC-MACD, ${d} mum arayla` : `KDC-MACD → Umut, ${-d} mum arayla`;
    const info = `KDC-MACD (1s MACD↑ ${tsiBar(b1[k.i].t, "1h")} TSİ, KDC K↑D ${k.lagH.toFixed(1)} saat önce) + Umut (KAL+RSI uyumsuzluk) · ${ord} · RSI14 ${u.rsi.toFixed(1)} · KAL ${u.kal.toFixed(1)} · ATR ${fmtP(atr)} · dip ${fmtP(u.pivLow)}`;
    out.push({ key: `${scan}|${sym}|${t}`, scan, symbol: sym, tf: "4h", t, tsi: tsiBar(t, "4h"), age, kind: "AL", price: entry, entryBasis: age >= 1 ? "sonraki açılış" : "son kapanış (sonraki açılış henüz yok)",
      stop, target: R[0], info, calc: { kind: "umut", atr, k: UMUT.atrK, tp: UMUT.tps[0], pivLow: u.pivLow },
      title: `✦ İKİLİ | ${sym} 4s AL (KDC-MACD + KAL/RSI uyumsuzluk)`,
      body: `${lbl} — ${sym} 4s · patlama ihtimali\nSinyal mumu: ${tsiBar(t, "4h")} TSİ (yaş ${age} mum)\n${info}\nGiriş: ${fmtP(entry)} (${age >= 1 ? "sonraki 4s açılış" : "ref son kapanış, giriş sonraki açılış"})\nStop: ${fmtP(stop)} (giriş − 2 ATR)\nR1 +%10: ${fmtP(R[0])}\nR2 +%20: ${fmtP(R[1])}\nR3 +%30: ${fmtP(R[2])}\nSüre: 100 mum\nNot: kombinasyon test edilmedi\nDurum: SADECE İZLEME — işlem açılmadı` });
  }
  return out;
}

/** Funding geçmişi (USDT-M, son 1000 kayıt ≈ 333 gün): fapi doğrudan → Vercel proxy (/api/ffunding). Yoksa null (PG3'e düşülür). */
const FUNDC: Record<string, Promise<[number, number][] | null>> = {};
function fundHist(ctx: WatchCtx, sym: string): Promise<[number, number][] | null> {
  return (FUNDC[sym] ||= (async () => {
    try {
      const j = (await futGet(ctx, `/fapi/v1/fundingRate?symbol=${sym}&limit=1000`, `/api/ffunding?symbol=${sym}&limit=1000`)) as { fundingTime: number; fundingRate: string }[];
      if (!Array.isArray(j) || !j.length) return null;
      return j.map((x) => [Number(x.fundingTime), Number(x.fundingRate)] as [number, number]).filter((x) => Number.isFinite(x[1])).sort((a, b) => a[0] - b[0]);
    } catch { return null; }
  })());
}
let BTC4: Promise<Map<number, number> | null> | null = null;
const btcMap = (ctx: WatchCtx) => (BTC4 ||= futBars(ctx, "BTCUSDT", "4h").then((f) => (f && f.bars.length ? new Map(f.bars.map((b) => [b.t, b.close])) : null)).catch(() => null));

/** UMUT+PG: Umut sinyalleri (vadeli 4s) + sinyal mumunda Patlama Gücü. Dönüş: PG ≥ 50 olanlar (izleme/ntfy) + tüm Umut adayları (kağıt defter, düz Umut kıyası). */
async function umutpgScan(ctx: WatchCtx, sym: string, b4: WBar[], src: string, maxAge: number): Promise<{ found: Found[]; cands: PTrade[] }> {
  const scan: ScanId = "umutpg-4h", n = b4.length, out: Found[] = [], cands: PTrade[] = [], lbl = SCANS[scan].label, now = Date.now();
  const U = umutSignals(b4).filter((h) => n - 1 - h.i <= maxAge && now - b4[h.i].t <= (maxAge + 2) * TF_MS["4h"]);
  if (!U.length) return { found: out, cands };
  const [btc, fund] = await Promise.all([sym === "BTCUSDT" ? Promise.resolve(new Map(b4.map((b) => [b.t, b.close]))) : btcMap(ctx), fundHist(ctx, sym)]);
  const C = pgComponents(b4, { btc, fund });
  for (const h of U) {
    const age = n - 1 - h.i, p = pgAt(C, h.i), t = b4[h.i].t, pgv = { ...p, score: Number.isFinite(p.score) ? +p.score.toFixed(1) : NaN, src };
    cands.push({ key: `paper|${sym}|${t}`, sym, t, tsi: tsiBar(t, "4h"), atr: h.atr, pg: pgv.score, pgMode: p.mode, pgC: p.comps as Record<string, number>, backfill: age > MAX_AGE, foundAt: now, status: "bekliyor" });
    if (!(p.score >= PG.pass) || p.mode === "PG-eksik") continue;
    const entry = age >= 1 ? b4[h.i + 1].open : b4[n - 1].close, stop = entry - UMUT.atrK * h.atr;
    const R = UMUT.tps.map((q) => entry * (1 + q)), first = h.kalAt <= h.rsiAt ? "KAL→RSI" : "RSI→KAL", gap = Math.abs(h.kalAt - h.rsiAt);
    const cs = Object.entries(p.comps).map(([k, v]) => `${k} ${Math.round(v as number)}`).join(" · ");
    const info = `PG ${pgv.score.toFixed(0)} (${p.mode}${p.mode === "PG3" ? " — vadeli verisi eksik: " + p.missing.join("/") : ""}) · ${cs} · Umut ${first} ${gap} mum arayla · RSI14 ${h.rsi.toFixed(1)} · KAL ${h.kal.toFixed(1)} · ATR ${fmtP(h.atr)} · mum ${src}`;
    out.push({ key: `${scan}|${sym}|${t}`, scan, symbol: sym, tf: "4h", t, tsi: tsiBar(t, "4h"), age, kind: "AL", price: entry, entryBasis: age >= 1 ? "sonraki açılış" : "son kapanış (sonraki açılış henüz yok)",
      stop, target: R[0], strength: pgv.score, info, pg: pgv, calc: { kind: "umut", atr: h.atr, k: UMUT.atrK, tp: UMUT.tps[0], pivLow: h.pivLow },
      title: `UMUT+PG | ${sym} 4s AL (PG ${pgv.score.toFixed(0)}${p.mode === "PG3" ? " · PG3" : ""})`,
      body: `${lbl} — ${sym} 4s\nSinyal mumu: ${tsiBar(t, "4h")} TSİ (yaş ${age} mum)\nPatlama Gücü: ${pgv.score.toFixed(1)} (${p.mode}) · ${cs}\nUmut: KAL + RSI uyumsuzluk (${first}, ${gap} mum arayla) · RSI14 ${h.rsi.toFixed(1)}\nGiriş: ${fmtP(entry)} (${age >= 1 ? "sonraki 4s açılış" : "ref son kapanış, giriş sonraki açılış"})\nStop: ${fmtP(stop)} (giriş − 2 ATR)\nR1 +%10: ${fmtP(R[0])}\nR2 +%20: ${fmtP(R[1])}\nR3 +%30: ${fmtP(R[2])}\nSüre: 100 mum\nDurum: SANAL KAĞIT İŞLEM — gerçek işlem açılmadı` });
  }
  return { found: out, cands };
}

/** DİP (ElifScan dipten kesim) — dip4 (4s, yalnız üst↑alt bant kesişimi) / dip8 (8s) / dip12 (12s). Yalnız kapanmış mumlar (futBars kapanmamış mumu atar). ntfy kısa: "Dip" / "dip8 SEMBOL". */
function dipScan(scan: "dip4" | "dip8" | "dip12", sym: string, bars: WBar[], src: string, maxAge: number): Found[] {
  const tf = SCANS[scan].tf, n = bars.length, out: Found[] = [], A = atrW(bars), now = Date.now();
  for (const h of scan === "dip4" ? dipBandSignals(bars) : dipSignals(bars)) {
    const age = n - 1 - h.i; if (age > maxAge) continue;
    if (now - bars[h.i].t > (maxAge + 2) * TF_MS[tf]) continue; // bayat veri (işlem görmeyen sembol)
    const atr = A[h.i], t = bars[h.i].t, entry = age >= 1 ? bars[h.i + 1].open : bars[n - 1].close;
    const stop = Number.isFinite(atr) && atr > 0 ? entry - 2 * atr : bars[h.i].low;
    const info = `ElifScan ${ELIF.ss}/${ELIF.sl}/${ELIF.fp}/${ELIF.dsl} · ${h.via === "ikisi" ? "main↑alt + üst↑alt" : h.via} · main ${h.main.toFixed(1)} · üst ${h.upper.toFixed(1)} · alt ${h.lower.toFixed(1)} · ATR ${fmtP(atr)} · mum ${src}`;
    out.push({ key: `${scan}|${sym}|${t}`, scan, symbol: sym, tf, t, tsi: tsiBar(t, tf), age, kind: "AL", price: entry, entryBasis: age >= 1 ? "sonraki açılış" : "son kapanış (sonraki açılış henüz yok)",
      stop, target: null, strength: +h.main.toFixed(1), info, calc: Number.isFinite(atr) && atr > 0 ? { kind: "atr", atr, k: 2, rr: null } : { kind: "fixed" },
      title: "Dip", body: `${scan} ${sym}` });
  }
  return out;
}

// ---------- L/S (perp) veri ----------
async function futGet(ctx: WatchCtx, pathQ: string, proxyPath: string): Promise<unknown> {
  if (ctx.futHost) { try { return await getJson(ctx.futHost + pathQ, 250, 2); } catch { /* proxy */ } }
  return await getJson(ctx.proxy + proxyPath, 150, 3);
}
async function lsUniverse(ctx: WatchCtx, top = 200): Promise<string[]> {
  const tk = (await futGet(ctx, "/fapi/v1/ticker/24hr", "/api/fapi/v1/ticker/24hr")) as { symbol: string; quoteVolume: string }[];
  let perps: Set<string> | null = null;
  try {
    const info = (await futGet(ctx, "/fapi/v1/exchangeInfo", "/api/fapi/v1/exchangeInfo")) as { symbols?: { symbol: string; contractType?: string; quoteAsset?: string; status?: string }[] };
    const ok = (info.symbols || []).filter((x) => x.contractType === "PERPETUAL" && x.quoteAsset === "USDT" && x.status === "TRADING").map((x) => x.symbol);
    if (ok.length > 50) perps = new Set(ok);
  } catch { /* yalnız ticker */ }
  return tk.filter((t) => /USDT$/.test(t.symbol) && (!perps || perps.has(t.symbol)) && !/^(USDC|FDUSD|TUSD|BUSD|USDP|DAI|USDE|USD1)USDT$/.test(t.symbol))
    .sort((a, b) => +b.quoteVolume - +a.quoteVolume).slice(0, top).map((t) => t.symbol);
}
const LS_METRIC: Record<string, string> = { topPos: "topLongShortPositionRatio", topAcc: "topLongShortAccountRatio", globAcc: "globalLongShortAccountRatio", taker: "takerlongshortRatio" };
async function lsSeries(ctx: WatchCtx, sym: string, metric: string, period: string, limit: number): Promise<Record<string, string | number>[]> {
  const ep = LS_METRIC[metric];
  const j = await futGet(ctx, `/futures/data/${ep}?symbol=${sym}&period=${period}&limit=${limit}`, `/api/lsratio?symbol=${sym}&period=${period}&limit=${limit}&metric=${metric}`);
  return Array.isArray(j) ? (j as Record<string, string | number>[]) : [];
}
async function perp2h(ctx: WatchCtx, sym: string): Promise<{ bars: WBar[]; px: number } | null> {
  const j = (await futGet(ctx, `/fapi/v1/klines?symbol=${sym}&interval=2h&limit=500`, `/api/fklines?symbol=${sym}&interval=2h&limit=500`)) as (string | number)[][];
  if (!Array.isArray(j) || j.length < 120) return null;
  const all = j.map((r) => ({ t: Number(r[0]), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] }));
  const px = all[all.length - 1].close, now = Date.now();
  return { bars: all.filter((b) => b.t + TF_MS["2h"] <= now), px };
}

/** Kripto 4s mumları: önce Binance spot (Python taramalarıyla aynı), spotta olmayan futures-only semboller için perp (fapi/proxy) */
async function coinBars(ctx: WatchCtx, sym: string): Promise<{ bars: WBar[] | null; src: string }> {
  const sp = await spotBars(sym, "4h"); if (sp && sp.length >= 300) return { bars: sp, src: "spot" };
  try {
    const j = (await futGet(ctx, `/fapi/v1/klines?symbol=${sym}&interval=4h&limit=1000`, `/api/fklines?symbol=${sym}&interval=4h&limit=1000`)) as (string | number)[][];
    if (Array.isArray(j) && j.length) { const now = Date.now(); return { bars: j.map((r) => ({ t: Number(r[0]), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] })).filter((b) => b.t + TF_MS["4h"] <= now), src: "perp" }; }
  } catch { /* yok */ }
  return { bars: sp, src: "spot" };
}

// ---------- ana tur ----------
export async function runWatch(ctx: WatchCtx): Promise<{ newSignals: number; sent: number; ran: string[]; summary: string }> {
  const file = path.join(ctx.dir, ctx.dry ? "watch.dry.json" : "watch.json");
  const doc = loadDoc(ctx.dry && !fs.existsSync(file) ? path.join(ctx.dir, "watch.json") : file);
  const lg = (m: string) => { const l = trT() + " İZLEME " + m; doc.log.push(l); (ctx.log || console.log)(l); };
  const now = Date.now(); doc.runs++;
  const first = !doc.firstRunDone;
  const ran: string[] = []; const found: { f: Found; bars: WBar[]; dyn?: number[] }[] = [];
  const touched: { scan: ScanId; sym: string; bars: WBar[]; dyn?: number[] }[] = [];
  const paperIn: { sym: string; bars: WBar[]; cands: PTrade[] }[] = [];
  const rdIn: { sym: string; bars: WBar[]; cands: RDTrade[] }[] = [];
  const rep = (id: ScanId) => (doc.scans[id] ||= { ...SCANS[id], signals: [] });
  for (const id of Object.keys(SCANS) as ScanId[]) Object.assign(rep(id), { label: SCANS[id].label, note: SCANS[id].note, tf: SCANS[id].tf, market: SCANS[id].market });
  const mark = (ids: ScanId[], extra: Partial<ScanRep>) => { for (const id of ids) Object.assign(rep(id), { lastRun: now, lastRunTsi: trT(now) }, extra); };
  const symLast = (doc.symLast ||= {});
  /** Evrene yeni giren (hiç taranmamış) sembolün ilk taraması bildirimsiz tohumlanır → evren büyütmede toplu ntfy patlaması olmaz */
  const seedSyms = new Set<string>();

  /** Dönen parti (rotating batch): her blokta semboller "en eski taranan önce" sırayla işlenir, kalıcı imleç = sembol başı son tarama zamanı.
   *  Bu mum aralığında (slot) taranmış sembol tekrar taranmaz; bütçe biterse kalanlar sonraki turda devam eder → uzun vadede hiçbir sembol atlanmaz.
   *  Pencere (yaş): sembolün son taramasından beri kapanan mumlar da rapora girer; ntfy yalnız yaş ≤ 2. */
  async function runBlock(blk: string, ids: ScanId[], tf: string, slotMs: number, syms: string[], conc: number, one: (sym: string, maxAge: number) => Promise<string | null>, needs?: (sym: string) => boolean) {
    const L = (symLast[blk] ||= {}), slotStart = Math.floor(now / slotMs) * slotMs;
    for (const k of Object.keys(L)) if (!syms.includes(k) && now - L[k] > 7 * 864e5) delete L[k];
    const pend = syms.filter((x) => !(L[x] >= slotStart) || (needs ? needs(x) : false)).sort((x, y) => (L[x] || 0) - (L[y] || 0));
    const errs: string[] = []; let done = 0, ok = 0, i = 0;
    const worker = async () => {
      while (i < pend.length && !over()) {
        const sym = pend[i++]; const last = L[sym];
        if (!last) for (const id of ids) seedSyms.add(id + "|" + sym);
        const maxAge = last ? Math.min(30, Math.max(MAX_AGE, Math.ceil((now - last) / TF_MS[tf]) + 1)) : MAX_AGE;
        let e: string | null = null;
        try { e = await one(sym, maxAge); } catch (x) { e = (x as Error).message; }
        L[sym] = now; done++; if (e) errs.push(`${sym}: ${e}`); else ok++;
      }
    };
    if (pend.length) await Promise.all(Array.from({ length: conc }, worker));
    const covered = syms.filter((x) => L[x] >= slotStart).length;
    const oldest = syms.reduce((m, x) => Math.min(m, L[x] || 0), Infinity);
    const cov = { total: syms.length, covered, thisRun: done, okThisRun: ok, slotTsi: trT(slotStart), oldestTsi: oldest && oldest !== Infinity ? trT(oldest) : "hiç", full: covered >= syms.length };
    if (pend.length) {
      mark(ids, { nSym: syms.length, nOk: covered, coverage: cov, ...(errs.length || done ? { errors: errs.slice(0, 15), errCount: errs.length } : {}) });
      ran.push(...ids);
      lg(`${blk}: bu tur ${done} sembol (hatasız ${ok}) · kapsam ${covered}/${syms.length}${covered < syms.length ? " — kalan sonraki turda" : " ✓"}${errs.length ? " · hata " + errs.length : ""}`);
    } else for (const id of ids) Object.assign(rep(id), { nSym: syms.length, nOk: covered, coverage: cov });
  }

  // evrenler: kripto = USDT-M perp hacim sıralı ilk 200 (günde bir yenilenir), BIST = 200'e kadar
  const today = new Date(now).toISOString().slice(0, 10);
  const U = (doc.univ ||= {});
  if (U.day !== today || !U.crypto?.length) {
    try { const u = await lsUniverse(ctx, 200); if (u.length >= 50) { U.crypto = u; U.day = today; lg(`kripto evreni yenilendi: ${u.length} sembol (hacim sıralı)`); } }
    catch (e) { lg("kripto evreni alınamadı (önceki liste kullanılıyor): " + (e as Error).message); }
  }
  const CRYPTO = U.crypto?.length ? U.crypto : WATCH_CRYPTO;

  const blkCrypto = () => runBlock("kripto 4s", ["ek-crypto-4h", "dual-crypto-4h", "umut-4h", "ikili-4h", "umutpg-4h"], "4h", TF_MS["4h"], CRYPTO, 2, async (sym, maxAge) => {
    const uSeed = (symLast["umut-seed"] ||= {}), uAge = uSeed[sym] ? maxAge : 30; uSeed[sym] = now;
    const { bars: b } = await coinBars(ctx, sym);
    if (!b || b.length < 300) return b ? `${b.length} mum (<300, atlandı)` : "veri yok";
    // UMUT: sembolün ilk Umut taramasında son 30 mum (5 gün) geriye doldurulur (yaş>2 → bildirimsiz), sonra normal pencere
    for (const f of umutScan(sym, b, uAge)) found.push({ f, bars: b });
    touched.push({ scan: "umut-4h", sym, bars: b });
    // ✦ İKİLİ: ilk taramada son 30 mum geriye doldurulur; 30dk/1s yalnız yakın Umut sinyali varsa çekilir (12 dk bütçesi)
    // vadeli mumlara geçiş (01.11.2026): yeni tohum anahtarı → 200 coinin hepsi bir kez son 30 mum geriye doldurulur (yaş>2 bildirimsiz)
    const iSeed = (symLast["ikili-seed-f"] ||= {}), iAge = iSeed[sym] ? Math.max(maxAge, ALERT_AGE["ikili-4h"]!) : 30;
    try {
      const bi = await ikiliBars(ctx, sym, b);
      for (const f of await ikiliScan(ctx, sym, bi, iAge)) found.push({ f, bars: bi });
      touched.push({ scan: "ikili-4h", sym, bars: bi }); iSeed[sym] = now;
    } catch { /* sonraki tur */ }
    // UMUT+PG: vadeli 4s mumlar (İkili ile aynı önbellek, ek kline isteği yok) + funding yalnız yakın Umut sinyali varsa; ilk taramada son 30 mum geriye doldurulur
    const pSeed = (symLast["umutpg-seed"] ||= {}), pAge = pSeed[sym] ? maxAge : 30;
    try {
      const fb = await futBars(ctx, sym, "4h"), pb = fb && fb.bars.length >= 300 ? fb.bars : b, psrc = fb && fb.bars.length >= 300 ? fb.src : "spot";
      const r = await umutpgScan(ctx, sym, pb, psrc, pAge);
      for (const f of r.found) found.push({ f, bars: pb });
      paperIn.push({ sym, bars: pb, cands: r.cands });
      touched.push({ scan: "umutpg-4h", sym, bars: pb }); pSeed[sym] = now;
    } catch { /* sonraki tur */ }
    for (const f of ekScan("ek-crypto-4h", sym, "4h", b, maxAge)) found.push({ f, bars: b });
    touched.push({ scan: "ek-crypto-4h", sym, bars: b });
    const d = dualScan("dual-crypto-4h", sym, "4h", b, "LRB", 0.1, "B", maxAge); for (const f of d.found) found.push({ f, bars: b, dyn: d.dyn });
    touched.push({ scan: "dual-crypto-4h", sym, bars: b, dyn: d.dyn });
    return null;
  }, (sym) => !(symLast["umut-seed"] || {})[sym] || !(symLast["ikili-seed-f"] || {})[sym] || !(symLast["umutpg-seed"] || {})[sym]); // yeni eklenen Umut taraması: henüz Umut ile taranmamış semboller bu mum aralığında da taranır
  const blkBist = () => runBlock("BIST 1g", ["ek-bist-1d", "dual-bist-1d", "rsi30-bist-1d", "ccidiv-bist-1d"], "1d", TF_MS["2h"], WATCH_BIST, 2, async (sym, maxAge) => {
    const cs = (symLast["ccidiv-bist-seed"] ||= {}), cAge = cs[sym] ? maxAge : 30; cs[sym] = now;
    const b = await yahooBars(sym);
    if (!b || b.length < 100) return b ? `${b.length} mum (<100, atlandı)` : "veri yok";
    // CCI Uyums 1G: ilk taramada son 30 gün listeye geriye doldurulur (yaş>2 bildirimsiz), sonra normal pencere
    for (const f of cciDivScan("ccidiv-bist-1d", sym, b, "yahoo", cAge)) found.push({ f, bars: b });
    touched.push({ scan: "ccidiv-bist-1d", sym, bars: b });
    if (b.length >= 100) { for (const f of rsi30Scan(sym, b, maxAge)) found.push({ f, bars: b }); touched.push({ scan: "rsi30-bist-1d", sym, bars: b }); }
    if (b.length < 300) return `${b.length} mum (EK/Dual için <300, yalnız RSI30)`;
    for (const f of ekScan("ek-bist-1d", sym, "1d", b, maxAge)) found.push({ f, bars: b });
    touched.push({ scan: "ek-bist-1d", sym, bars: b });
    const d = dualScan("dual-bist-1d", sym, "1d", b, "BB", 0.5, "A", maxAge); for (const f of d.found) found.push({ f, bars: b });
    touched.push({ scan: "dual-bist-1d", sym, bars: b });
    return null;
  }, (sym) => !(symLast["ccidiv-bist-seed"] || {})[sym]);
  const blkLs = () => runBlock("L/S 2s", ["ls-2h"], "2h", TF_MS["2h"], CRYPTO, 3, async (sym, maxAge) => {
    const k = await perp2h(ctx, sym); if (!k) return "mum yok";
    const rs = await lsSeries(ctx, sym, "topPos", "2h", 500); if (!rs.length) return "oran yok";
    const mp = new Map<number, number>(rs.map((x) => [Number(x.timestamp), Number(x.longShortRatio)]));
    const ratio = k.bars.map((b) => (mp.has(b.t) ? mp.get(b.t)! : null));
    for (const d of lsDivergences(k.bars, ratio, maxAge)) {
      const t = k.bars[d.p].t, tc = k.bars[d.c].t;
      const info = `güç ${d.strength} · oran ${d.prev.toFixed(3)} → ${d.ratio.toFixed(3)} (+${d.rr.toFixed(1)}%) · BB alt bant ${d.bb ? "EVET" : "hayır"} · pivot ${tsiBar(t, "2h")}`;
      found.push({ bars: k.bars, f: { key: `ls-2h|${sym}|${t}`, scan: "ls-2h", symbol: sym, tf: "2h", t: tc, tsi: tsiBar(tc, "2h"), age: d.age, kind: "AL", price: k.px, entryBasis: "anlık fiyat",
        stop: d.stop, target: d.target, strength: d.strength, info, calc: { kind: "fixed" },
        title: `İZLEME | L/S DIP UYUMSUZLUK 2s | ${sym} [${d.strength}]`,
        body: `${sym} 2s top-trader L/S POZİSYON oranı boğa uyumsuzluğu (dip bölgesi)\nGüç: ${d.strength} (oran ${d.prev.toFixed(3)} → ${d.ratio.toFixed(3)}, +${d.rr.toFixed(1)}%)\nBB alt bant: ${d.bb ? "EVET" : "hayır"}\nPivot dip: ${tsiBar(t, "2h")} TSİ, onay ${d.age} mum önce\nGiriş (anlık): ${fmtP(k.px)}\nStop (dip): ${fmtP(d.stop)}\nHedef (BB üst): ${fmtP(d.target)}\nDurum: SADECE İZLEME — işlem açılmadı` } });
    }
    touched.push({ scan: "ls-2h", sym, bars: k.bars });
    return null;
  });
  // DİP (ElifScan) 8s / 12s: vadeli mumlar önce (yoksa spot); mum aralığı başına sembol başı tek istek. İlk taramada son 30 mum listeye geriye doldurulur (yaş>2 bildirimsiz).
  const blkDip = (scan: "dip4" | "dip8" | "dip12") => runBlock(scan === "dip4" ? "dip 4s" : scan === "dip8" ? "dip 8s" : "dip 12s", [scan], SCANS[scan].tf, TF_MS[SCANS[scan].tf], CRYPTO, 2, async (sym, maxAge) => {
    const tf = SCANS[scan].tf, f = await futBars(ctx, sym, tf);
    if (!f || f.bars.length < 150) return f ? `${f.bars.length} mum (<150, atlandı)` : "veri yok";
    const seed = (symLast[scan + "-seed"] ||= {}), age = seed[sym] ? maxAge : 30;
    for (const x of dipScan(scan, sym, f.bars, f.src, age)) found.push({ f: x, bars: f.bars });
    touched.push({ scan, sym, bars: f.bars }); seed[sym] = now;
    return null;
  });
  // DONCHIAN 20/55 (top-200) + RANGE DIP (top-50): günlük vadeli mumlar, gün başına sembol başı tek istek; ilk taramada son 30 gün listeye geriye doldurulur (bildirimsiz)
  const D1 = CRYPTO.filter(isCoin); // yalnız kripto coinler (TradFi hisse/emtia perp'leri hariç)
  const blkD1 = () => runBlock("kripto 1g", ["donch-1d", "rangedip-1d", "ccidiv-1d"], "1d", TF_MS["1d"], D1, 2, async (sym, maxAge) => {
    const cs = (symLast["ccidiv-seed"] ||= {}), cAge = cs[sym] ? maxAge : 30; cs[sym] = now;
    const f = await futBars(ctx, sym, "1d");
    if (!f || f.bars.length < 120) return f ? `${f.bars.length} mum (<120, atlandı)` : "veri yok";
    const seed = (symLast["d1-seed"] ||= {}), age = seed[sym] ? maxAge : 30;
    for (const x of donchScan(sym, f.bars, f.src, age)) found.push({ f: x, bars: f.bars });
    touched.push({ scan: "donch-1d", sym, bars: f.bars });
    for (const x of cciDivScan("ccidiv-1d", sym, f.bars, f.src, cAge)) found.push({ f: x, bars: f.bars });
    touched.push({ scan: "ccidiv-1d", sym, bars: f.bars });
    if (D1.indexOf(sym) < RDIP.top) {
      const r = rangeDipScan(sym, f.bars, f.src, age);
      for (const x of r.found) found.push({ f: x, bars: f.bars });
      rdIn.push({ sym, bars: f.bars, cands: r.cands }); touched.push({ scan: "rangedip-1d", sym, bars: f.bars });
    }
    seed[sym] = now;
    return null;
  }, (sym) => !(symLast["ccidiv-seed"] || {})[sym]);
  // REST (MTF Stoch 15dk×30dk): saatte bir (mum aralığı = 1 saat), kripto coinler; vadeli 15dk + 30dk mumlar
  const blkRest = () => runBlock("REST 15dk", ["rest-15m"], "15m", TF_MS["1h"], D1, 2, async (sym, maxAge) => {
    const [f15, f30] = await Promise.all([futBars(ctx, sym, "15m"), futBars(ctx, sym, "30m")]);
    if (!f15 || !f30 || f15.bars.length < 300 || f30.bars.length < 220) return "mum yetersiz";
    for (const x of restScan(sym, f15.bars, f30.bars, f15.src, Math.max(maxAge, ALERT_AGE["rest-15m"]!))) found.push({ f: x, bars: f15.bars });
    return null;
  });
  // V12 Çift K2 Long: 30 dakikada bir, kripto coinler (vadeli 15dk + 30dk); BIST seans içinde Yahoo 15dk → 30dk
  const blkV12 = () => runBlock("V12K2 30dk", ["v12k2-30m"], "30m", TF_MS["30m"], D1, 2, async (sym, maxAge) => {
    const [f30, f15] = await Promise.all([futBars(ctx, sym, "30m"), futBars(ctx, sym, "15m")]);
    if (!f30 || !f15 || f30.bars.length < 600 || f15.bars.length < 300) return "mum yetersiz";
    for (const x of v12k2Scan("v12k2-30m", sym, f30.bars, f15.bars, f30.src, Math.max(maxAge, ALERT_AGE["v12k2-30m"]!))) found.push({ f: x, bars: f30.bars });
    touched.push({ scan: "v12k2-30m", sym, bars: f30.bars });
    return null;
  });
  const tsiHm = (() => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now)); const g = (k: string) => p.find((x) => x.type === k)?.value || ""; return { wd: g("weekday"), hm: Number(g("hour")) * 60 + Number(g("minute")) }; })();
  const bistOpen = !["Sat", "Sun"].includes(tsiHm.wd) && tsiHm.hm >= 10 * 60 + 15 && tsiHm.hm <= 19 * 60;
  const blkV12B = () => bistOpen ? runBlock("V12K2 BIST 30dk", ["v12k2-bist-30m"], "30m", TF_MS["30m"], WATCH_BIST, 2, async (sym, maxAge) => {
    const b15 = await yahooIntra(sym);
    if (!b15 || b15.length < 300) return b15 ? `${b15.length} 15dk mum (<300, atlandı)` : "Yahoo 15dk veri yok";
    const b30 = to30(b15); if (b30.length < 400) return `${b30.length} 30dk mum (<400, atlandı)`;
    for (const x of v12k2Scan("v12k2-bist-30m", sym, b30, b15, "yahoo", Math.max(maxAge, ALERT_AGE["v12k2-bist-30m"]!))) found.push({ f: x, bars: b30 });
    touched.push({ scan: "v12k2-bist-30m", sym, bars: b30 });
    return null;
  }) : Promise.resolve();
  // bloklar paralel (farklı veri kaynakları: Binance spot / Yahoo / proxy), her biri kendi dönen partisiyle
  await Promise.all([blkCrypto(), blkBist(), blkLs(), blkDip("dip4"), blkDip("dip8"), blkDip("dip12"), blkD1(), blkRest(), blkV12(), blkV12B()]);

  // 4) yeni sinyaller → rapor + ntfy (sinyal mumu başına bir kez; ilk turda bildirimsiz tohumlama)
  let sent = 0, nNew = 0;
  for (const { f, bars, dyn } of found) {
    const r = rep(f.scan); if (r.signals.some((s) => s.key === f.key)) continue;
    // Umut: testteki gibi coin başına tek açık izleme — önceki Umut sinyali hâlâ açıksa (R1/stop/süre olmadı) yenisi kaydedilmez
    if ((f.scan === "umut-4h" || f.scan === "ikili-4h" || f.scan === "umutpg-4h" || f.scan === "v12k2-30m" || f.scan === "v12k2-bist-30m") && r.signals.some((s) => s.symbol === f.symbol && s.t < f.t && (s.exitT == null || s.exitT >= f.t))) continue;
    nNew++;
    const { title, body, ...rest } = f;
    const s: WSig = { ...rest, status: "bekliyor", alerted: "dry-run", foundAt: now };
    if (doc.notified[f.key]) s.alerted = "gönderildi";
    else if (f.scan === "donch-1d") s.alerted = "liste (bildirimsiz)";
    else if (f.age > (ALERT_AGE[f.scan] ?? MAX_AGE)) s.alerted = `eski (yaş>${ALERT_AGE[f.scan] ?? MAX_AGE})`;
    else if (first || (seedSyms.has(f.scan + "|" + f.symbol) && (!DIP_SCANS.has(f.scan) || f.age > 0))) { s.alerted = "ilk tur (bildirimsiz)"; doc.notified[f.key] = now; }
    else if (ctx.dry) { s.alerted = "dry-run"; console.log(`--- ntfy (dry-run, gönderilmedi) ---\n${title}\n${body}`); }
    else {
      try { await ntfySend(title, body); s.alerted = "gönderildi"; doc.notified[f.key] = now; sent++; }
      catch (e) { s.alerted = "gönderilemedi"; lg(`ntfy hata ${f.scan} ${f.symbol}: ${(e as Error).message.replace(/https?:\/\/\S+/g, "<url>")}`); }
    }
    if (s.calc.kind === "donch") donchTrackSig(s, bars); else if (f.scan !== "rest-15m") track(s, bars, dyn);
    r.signals.unshift(s); r.newCount = (r.newCount || 0) + 1;
    lg(`SİNYAL ${SCANS[f.scan].label} ${f.symbol} ${f.tsi} @${fmtP(f.price)} stop ${fmtP(f.stop)} hedef ${fmtP(f.target)} · ntfy ${s.alerted}`);
  }
  // 5) eski sinyallerin sonuç takibi (yalnız bu turda verisi olan semboller)
  for (const tc of touched) for (const s of rep(tc.scan).signals) if (s.symbol === tc.sym) { if (s.calc.kind === "donch") donchTrackSig(s, tc.bars); else track(s, tc.bars, tc.dyn); }
  // 5b) SANAL KAĞIT DEFTER (gerçek emir yok): Umut+PG (PG ≥ 50) ve düz Umut, aynı vadeli mumlarla; coin başına tek işlem (defter bazında)
  try { paperUpdate(doc, paperIn, now); } catch (e) { lg("kağıt defter hata: " + (e as Error).message); }
  // 5c) RANGE DIP sanal defteri + DONCHIAN ENSEMBLE sanal robotu (gerçek emir yok; giriş/çıkışta ntfy)
  const say = async (key: string, title: string, body: string): Promise<string> => {
    if (doc.notified[key]) return "gönderildi";
    if (first) { doc.notified[key] = now; return "ilk tur (bildirimsiz)"; }
    if (ctx.dry) { console.log(`--- ntfy (dry-run, gönderilmedi) ---\n${title}\n${body}`); return "dry-run"; }
    try { await ntfySend(title, body); doc.notified[key] = now; sent++; return "gönderildi"; }
    catch (e) { lg(`ntfy hata ${key}: ${(e as Error).message.replace(/https?:\/\/\S+/g, "<url>")}`); return "gönderilemedi"; }
  };
  try { await rdUpdate(doc, rdIn, now, say); } catch (e) { lg("Range Dip defteri hata: " + (e as Error).message); }
  try { await donchRobot(ctx, doc, CRYPTO, now, say, lg); } catch (e) { (doc.donch ||= newRobot()).err = (e as Error).message; lg("Donchian robot hata: " + (e as Error).message); }
  // retry: bildirimi başarısız kalan güncel sinyaller
  if (!ctx.dry) for (const r of Object.values(doc.scans)) for (const s of r.signals) {
    if (s.alerted !== "gönderilemedi" || now - s.foundAt > 6 * 36e5) continue;
    try { if (DIP_SCANS.has(s.scan)) await ntfySend("Dip", `${s.scan} ${s.symbol}`); else if (s.scan.startsWith("v12k2")) await ntfySend(`v12k2 ${s.symbol.replace(/\.IS$/, "")}`, `v12k2 ${s.symbol.replace(/\.IS$/, "")} LONG · 30dk ${s.tsi} TSİ · giriş ${fmtP(s.price)} · TP %5 ${fmtP(s.target)}`); else await ntfySend(`İZLEME | ${r.label} | ${s.symbol} ${s.scan === "rest-15m" ? s.kind : "AL"}`, `${r.label} — ${s.symbol} ${s.tf}\nSinyal mumu: ${s.tsi}\n${s.info}\nGiriş ref: ${fmtP(s.price)}\nStop: ${fmtP(s.stop)}\nHedef: ${fmtP(s.target)}\nDurum: SADECE İZLEME — işlem açılmadı`); s.alerted = "gönderildi"; doc.notified[s.key] = now; sent++; } catch { /* sonraki tur */ }
  }
  for (const r of Object.values(doc.scans)) r.signals = r.signals.slice(0, KEEP_SIG);
  for (const [k, t] of Object.entries(doc.notified)) if (now - t > KEEP_NOTIFIED_MS) delete doc.notified[k];

  // 6) L/S günlük veri toplama (dün UTC günü tamamlanınca bir kez)
  if (!ctx.dry) { try { await lsCollect(ctx, doc, lg); } catch (e) { doc.ls = { ...(doc.ls || {}), lastErr: (e as Error).message }; lg("L/S veri toplama hata: " + (e as Error).message); } }

  doc.firstRunDone = true; doc.updated = Date.now(); doc.updatedTsi = trT(); doc.log = doc.log.slice(-200);
  fs.writeFileSync(file, JSON.stringify(doc, null, 1));
  const summary = `İzleme: ${ran.length ? ran.join(", ") : over() ? "zaman bütçesi doldu (sonraki turda)" : "bu tur taranacak yeni mum yok"} · yeni sinyal ${nNew} · ntfy ${sent}${ctx.dry ? " (dry-run)" : ""}${first ? " · ilk tur: bildirimsiz tohumlama" : ""}`;
  lg(summary);
  return { newSignals: nNew, sent, ran, summary };
}

function paperUpdate(doc: WatchDoc, inp: { sym: string; bars: WBar[]; cands: PTrade[] }[], now: number) {
  const P = (doc.paper ||= { v: 1, rule: "", start: PAPER.start, size: PAPER.size, fee: PAPER.fee, pg: [], u: [] });
  P.rule = `Sanal kağıt: giriş sonraki 4s açılış · stop giriş − 2 ATR · 1/3 R1 +%10, 1/3 R2 +%20, 1/3 R3 +%30 (kalan stop/100 mum) · ücret %${PAPER.fee * 100}/taraf · işlem başı ${PAPER.size}$ · başlangıç ${PAPER.start}$ · coin başına tek işlem · gerçek emir yok`;
  Object.assign(P, { start: PAPER.start, size: PAPER.size, fee: PAPER.fee });
  for (const { sym, bars, cands } of inp) {
    for (const book of ["pg", "u"] as const) {
      const L = P[book];
      for (const tr of L) if (tr.sym === sym) paperTrack(tr, bars);
      for (const c of cands.slice().sort((a, b) => a.t - b.t)) {
        if (book === "pg" && !(c.pg != null && c.pg >= PG.pass && c.pgMode !== "PG-eksik")) continue;
        if (L.some((x) => x.key === c.key)) continue;
        if (L.some((x) => x.sym === sym && x.t < c.t && (x.exitT == null || x.exitT >= c.t))) continue; // coin başına tek işlem
        const tr: PTrade = { ...c, pgC: c.pgC ? { ...c.pgC } : undefined }; paperTrack(tr, bars); L.unshift(tr);
        if (P.since == null || tr.t < P.since) P.since = tr.t;
      }
    }
  }
  for (const book of ["pg", "u"] as const) { P[book].sort((a, b) => b.t - a.t); P[book] = P[book].slice(0, 400); }
  P.stats = { pg: paperStats(P.pg), u: paperStats(P.u) }; P.updated = now; P.updatedTsi = trT(now);
}

/** RANGE DIP sanal defteri: coin başına tek işlem; giriş sonraki açılış, stop fitil altı, hedef üst bant, en fazla 3N gün. Çıkışta ntfy (çıkış günü ≤ 2 gün önce ise). */
async function rdUpdate(doc: WatchDoc, inp: { sym: string; bars: WBar[]; cands: RDTrade[] }[], now: number, say: (k: string, t: string, b: string) => Promise<string>) {
  const P = (doc.rdip ||= { v: 1, rule: "", start: RDIP.start, trades: [] });
  P.rule = `Sanal defter: likidite avı + ikili/üçlü dip (RD20 ve RD55) · giriş sonraki günlük açılış · stop = fitil − 0.1 ATR · hedef = üst bant (sinyal anında sabit) · en fazla 3N gün · aynı mumda stop önce · risk işlem başı ${RDIP.start * RDIP.risk}$ (başlangıç ${RDIP.start}$'ın %${RDIP.risk * 100}'i), nominal ≤ ${RDIP.start}$ · ücret %${RDIP.fee * 100}/taraf · coin başına tek işlem · ileriye dönük: yalnız kurulumdan sonraki taze (≤2 gün) sinyaller · top-50 kripto (TradFi hariç) · gerçek emir yok`;
  const L = P.trades;
  for (const { sym, bars, cands } of inp) {
    for (const tr of L) if (tr.sym === sym) rdTrack(tr, bars);
    for (const c of cands.slice().sort((a, b) => a.t - b.t)) {
      if (c.backfill || L.some((x) => x.key === c.key)) continue; // ileriye dönük: yalnız taze (≤2 gün) sinyaller deftere girer
      if (L.some((x) => x.sym === sym && x.status !== "iptal" && x.t <= c.t && (x.exitT == null || x.exitT >= c.t))) continue; // coin başına tek işlem
      const tr: RDTrade = { ...c }; rdTrack(tr, bars); L.unshift(tr);
      if (P.since == null || tr.t < P.since) P.since = tr.t;
    }
    for (const tr of L) {
      if (tr.sym !== sym || tr.status !== "kapandı" || tr.exitNote || tr.exitT == null) continue;
      if (now - tr.exitT > 3 * 864e5) { tr.exitNote = "eski (bildirimsiz)"; continue; }
      tr.exitNote = await say(`rdx|${tr.key}`, `Range Dip ÇIKIŞ | ${sym} ${tr.why}`, `${sym} RD${tr.N} sanal işlem kapandı (${tr.why})\nGiriş: ${fmtP(tr.entry)} · Çıkış: ${fmtP(tr.exitPx)}\nSonuç: ${(tr.R || 0) > 0 ? "+" : ""}${tr.R}R · ${(tr.usd || 0) > 0 ? "+" : ""}${tr.usd}$ (${tr.bars} gün)\nDurum: SANAL — gerçek işlem yok`);
      if (tr.exitNote === "gönderilemedi") tr.exitNote = undefined;
    }
  }
  P.trades = L.sort((a, b) => b.t - a.t).slice(0, 400);
  P.stats = rdStats(P.trades); P.updated = now; P.updatedTsi = trT(now);
}

const newRobot = (): DRobot => ({ v: 1, rule: "", start: DON.start, members: [], cash: DON.start, sl: {}, ev: [], trades: [], curve: [] });
/** DONCHIAN ENSEMBLE sanal robotu: her yeni günlük kapanışta bir kez (UTC 00:00 = 03:00 TSİ sonrası). Evren = hacim sıralı ilk 10 perp (≥365 gün geçmiş), ay başında yenilenir. */
async function donchRobot(ctx: WatchCtx, doc: WatchDoc, CRYPTO: string[], now: number, say: (k: string, t: string, b: string) => Promise<string>, lg: (m: string) => void) {
  const R = (doc.donch ||= newRobot());
  R.rule = `Sanal robot: Donchian ensemble ${DON.lbs.join("/")} gün (kapanış kırılımı, orta çizgi iz süren stop) · hacim sıralı ilk ${DON.top} perp (≥${DON.minBars} gün geçmiş), ay başında yenilenir · coin başı 1/${DON.top} dilim · ağırlık = aktif model oranı × min(%${DON.tv * 100} / 90g vol, %${DON.cap * 100}) · %${DON.thr * 100} eşik · ücret %${DON.fee * 100} · başlangıç ${DON.start}$ · günlük kapanışta işlenir · gerçek emir yok`;
  const lastClosed = Math.floor(now / 864e5) * 864e5 - 864e5; // son kapanmış günlük mumun açılış zamanı (UTC)
  if (R.lastT != null && R.lastT >= lastClosed) return;
  if (over()) return;
  const pool = CRYPTO.filter(isCoin).slice(0, DON.top + 8), data: Record<string, { bars: WBar[]; idx: Map<number, number>; E: ReturnType<typeof donchEnsemble> }> = {};
  await Promise.all(pool.map(async (sym) => {
    const f = await futBars(ctx, sym, "1d"); if (!f || f.bars.length < 120) return;
    const c = f.bars.map((b) => b.close); data[sym] = { bars: f.bars, idx: new Map(f.bars.map((b, i) => [b.t, i])), E: donchEnsemble(c) };
  }));
  const eligible = pool.filter((s) => data[s] && data[s].bars.length >= DON.minBars && data[s].bars[data[s].bars.length - 1].t === lastClosed).slice(0, DON.top);
  if (eligible.length < DON.top / 2) throw new Error(`evren eksik (${eligible.length} coin)`);
  const days: number[] = []; for (let t = R.lastT == null ? lastClosed : R.lastT + 864e5; t <= lastClosed; t += 864e5) days.push(t);
  const init = R.lastT == null; if (init) R.since = lastClosed;
  for (const t of days.slice(-30)) {
    const month = new Date(t).toISOString().slice(0, 7), syms = new Set([...R.members, ...eligible]), day: Record<string, DDay | undefined> = {};
    for (const s of syms) {
      const d = data[s]; const i = d?.idx.get(t); if (!d || i == null || i < 1) continue;
      const tsA = d.E.ts.map((a) => a[i]).filter((x) => Number.isFinite(x));
      day[s] = { c: d.bars[i].close, r: d.bars[i].close / d.bars[i - 1].close - 1, frac: d.E.frac[i], on: d.E.on[i], w: d.E.w[i], ts: tsA.length ? Math.max(...tsA) : NaN };
    }
    const newM = R.month !== month || !R.members.length ? eligible : null; if (newM) R.month = month;
    const ev = donchStep(R, t, tsiBar(t, "1d"), day, newM);
    for (const e of ev) {
      if (init) { e.alerted = "başlangıç (bildirimsiz)"; continue; }
      if (now - t > 3 * 864e5) { e.alerted = "eski (bildirimsiz)"; continue; }
      const body = e.type === "GİRİŞ" ? `${e.sym} GİRİŞ (sanal) — ${e.why}\nKapanış: ${fmtP(e.px)} · ağırlık %${e.w} (dilim)\nİz süren stop: orta çizgi\nDurum: SANAL ROBOT — gerçek işlem yok`
        : `${e.sym} ÇIKIŞ (sanal) — ${e.why}\nKapanış: ${fmtP(e.px)} · sonuç ${(e.pct || 0) > 0 ? "+" : ""}${e.pct}% (${(e.pnl || 0) > 0 ? "+" : ""}${e.pnl}$)\nDurum: SANAL ROBOT — gerçek işlem yok`;
      e.alerted = await say(`dn|${e.sym}|${t}|${e.type}`, `Donchian Robot | ${e.type} ${e.sym}`, body);
    }
    if (ev.length) lg(`Donchian robot ${tsiBar(t, "1d")}: ${ev.map((e) => e.type + " " + e.sym).join(", ")}`);
  }
  R.err = undefined; R.updated = now; R.updatedTsi = trT(now);
  lg(`Donchian robot: özsermaye ${R.equity}$ · ${Object.values(R.sl).filter((x) => x.frac > 0).length}/${R.members.length} coin pozisyonda`);
}

/** collect.py karşılığı: kripto evreni (top-200 perp), 4 metrik × (1s, 2s), dünün (UTC) satırları → lsdata/YYYY-MM-DD.csv (gün başına bir dosya, bir kez yazılır) */
async function lsCollect(ctx: WatchCtx, doc: WatchDoc, lg: (m: string) => void) {
  const now = Date.now(), dayStart = Math.floor(now / 864e5) * 864e5, day = new Date(dayStart - 864e5).toISOString().slice(0, 10);
  if (now - dayStart < 30 * 6e4) return; // 00:30 UTC sonrası (son 2s oranı yayımlansın)
  const L = (doc.ls ||= {});
  if (over()) return;
  if (L.pend && L.pend.day !== day && L.pend.done < L.pend.syms.length) { /* önceki günü bitir */ }
  else { if (L.lastDay === day) return; if (!L.pend || L.pend.day !== day) L.pend = { day, syms: (doc.univ?.crypto?.length ? doc.univ.crypto : await lsUniverse(ctx, 200)), done: 0, rows: 0, errs: 0 }; }
  const P = L.pend; if (!P.syms.length) throw new Error("evren boş");
  const pd0 = Date.parse(P.day + "T00:00:00Z"), pd1 = pd0 + 864e5, pday = P.day;
  const dir = path.join(ctx.dir, "lsdata"), file = path.join(dir, pday + ".csv"); fs.mkdirSync(dir, { recursive: true });
  if (P.done === 0) fs.writeFileSync(file, "symbol,metric,period,ts,ratio,long_v,short_v\n");
  while (P.done < P.syms.length && !over()) {
    const sym = P.syms[P.done], rows: string[] = [];
    for (const metric of Object.keys(LS_METRIC)) for (const period of ["1h", "2h"]) {
      try {
        const d = await lsSeries(ctx, sym, metric, period, period === "1h" ? 60 : 36);
        for (const x of d) {
          const ts = Number(x.timestamp); if (ts < pd0 || ts >= pd1) continue;
          if (metric === "taker") rows.push(`${sym},${metric},${period},${ts},${x.buySellRatio},${x.buyVol},${x.sellVol}`);
          else rows.push(`${sym},${metric},${period},${ts},${x.longShortRatio},${x.longAccount},${x.shortAccount}`);
        }
      } catch { P.errs++; }
    }
    if (rows.length) fs.appendFileSync(file, rows.join("\n") + "\n");
    P.rows += rows.length; P.done++;
  }
  if (P.done < P.syms.length) { lg(`L/S veri toplama ${pday}: ${P.done}/${P.syms.length} sembol (sonraki turda devam)`); return; }
  L.lastDay = pday; L.files = [...(L.files || []).filter((f) => f !== pday + ".csv"), pday + ".csv"].slice(-60); L.lastRows = P.rows; L.lastErr = P.errs ? `${P.errs} istek hatası` : undefined; delete L.pend;
  lg(`L/S veri toplama ${pday}: ${P.rows} satır, ${P.syms.length} sembol${P.errs ? ", hata " + P.errs : ""}`);
}

// Tek başına çalıştırma (yerel deneme): WATCH_DIR=/tmp/x WATCH_DRY=1 npx tsx scripts/paper-bot/watch.ts
if (process.argv[1] && /watch\.ts$/.test(process.argv[1])) {
  const dir = process.env.WATCH_DIR || process.cwd();
  runWatch({ dir, dry: process.env.WATCH_DRY === "1", futHost: process.env.WATCH_FUT_HOST || null, proxy: (process.env.QX_PROXY || "https://tradedesk-ochre.vercel.app").replace(/\/$/, "") })
    .then((r) => console.log(r.summary)).catch((e) => { console.error(e); process.exit(1); });
}
