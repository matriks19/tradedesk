import type { Candle, Exchange, TickerQuote } from "@/lib/types";
import {
  adx,
  aroon,
  atr,
  bollinger,
  cci,
  closes,
  ema,
  ichimoku,
  macd,
  rsi,
  sma,
  stochastic,
  supertrend,
  vwma,
} from "@/lib/indicators/math";
import { adxPumpRadar } from "@/lib/indicators/adxPump";
import { eliziEdge } from "@/lib/indicators/eliziEdge";
import { jurikKaseStoch, jurikStoch } from "@/lib/indicators/jurik";
import { recentRsiPuNu } from "@/lib/indicators/rsiPuNu";
import {
  recentDescendingBreak,
  recentDescendingBreakV2,
} from "@/lib/indicators/descendingBreak";
import { recentDiagonalSr } from "@/lib/indicators/diagonalSr";
import { recentHamJurik } from "@/lib/indicators/hamJurikTpo";

export type ScannerFilter =
  | { type: "rsi"; op: "lt" | "gt"; value: number; period?: number }
  | { type: "changePct"; op: "lt" | "gt"; value: number }
  | { type: "volumeSpike"; mult: number }
  | { type: "emaCross"; direction: "bull" | "bear"; fast?: number; slow?: number }
  | { type: "macdCross"; direction: "bull" | "bear" }
  | { type: "bbSqueeze"; lookback?: number; pctile?: number }
  | { type: "bbBreak"; side: "upper" | "lower" }
  | { type: "supertrendFlip"; direction: "bull" | "bear"; period?: number; mult?: number }
  | { type: "atrPctHigh"; minPct: number; period?: number }
  | { type: "stoch"; zone: "oversold" | "overbought"; kPeriod?: number; level?: number }
  | {
      type: "stochCross";
      direction: "bull" | "bear";
      /** Cross must land with %K inside [zoneLo, zoneHi] (e.g. 15–20 OS bounce). */
      zoneLo?: number;
      zoneHi?: number;
    }
  | {
      type: "jurikStochCross";
      direction: "bull" | "bear";
      variant?: "jurik" | "kase";
      zoneLo?: number;
      zoneHi?: number;
    }
  | { type: "diCross"; direction: "bull" | "bear"; period?: number }
  | { type: "adxAbove"; value: number; period?: number }
  | {
      type: "aroonCross";
      direction: "bull" | "bear";
      period?: number;
    }
  | {
      type: "aroonLong";
      /** Aroon Up above / Down below thresholds (classic Aroon long). */
      upMin?: number;
      downMax?: number;
      period?: number;
    }
  | { type: "consecBars"; color: "green" | "red"; count: number }
  | { type: "nearHod"; pct?: number }
  | { type: "nearLod"; pct?: number }
  | { type: "priceVsSma"; period: 50 | 200; side: "above" | "below" }
  | { type: "rsiDivergence"; direction: "bull" | "bear"; lookback?: number }
  | {
      type: "adxPumpStage";
      /** early | mid | confirm */
      stage: "early" | "mid" | "confirm";
      direction: "bull" | "bear";
      /** Min |score| for early/mid/confirm series (default 25/30/35) */
      minScore?: number;
    }
  | {
      type: "adxPumpMixDi";
      direction: "bull" | "bear";
    }
  | {
      type: "eliziPhase";
      /** armed | fire | exhaust | probe */
      phase: "probe" | "armed" | "fire" | "exhaust";
      direction: "bull" | "bear" | "any";
      minTemp?: number;
      minCoherence?: number;
    }
  | {
      type: "eliziFire";
      direction: "bull" | "bear";
      minTemp?: number;
      minCoherence?: number;
    }
  | {
      type: "eliziExhaust";
      direction: "bull" | "bear" | "any";
      minSurprise?: number;
    }
  | { type: "macdAboveSignal"; side: "above" | "below" }
  | { type: "macdZeroCross"; direction: "bull" | "bear" }
  | {
      type: "priceVsMa";
      kind: "sma" | "ema";
      period: number;
      side: "above" | "below";
    }
  | {
      type: "maStack";
      kind: "sma" | "ema";
      fast: number;
      slow: number;
    }
  | { type: "rsiBetween"; lo: number; hi: number; period?: number }
  | {
      type: "perfBars";
      bars: number;
      op: "gt" | "lt";
      value: number;
    }
  | {
      type: "rsiPuNu";
      direction: "bull" | "bear" | "any";
      maxBarsAgo?: number;
    }
  | { type: "descendingBreak"; maxBarsAgo?: number }
  | { type: "priceVsOpen"; side: "above" | "below" }
  | { type: "adxBelow"; value: number; period?: number }
  | { type: "cci"; op: "gt" | "lt"; value: number; period?: number }
  | { type: "changePctBetween"; lo: number; hi: number }
  | { type: "atrPctBelow"; maxPct: number; period?: number }
  | { type: "ichiTenkanAboveKijun" }
  | { type: "ichiSpanAAboveB" }
  | { type: "volumeMin"; min: number }
  | { type: "perfBarsBetween"; bars: number; lo: number; hi: number }
  | { type: "priceVsVwma"; period?: number; side: "above" | "below" }
  | { type: "descendingBreakV2"; maxBarsAgo?: number }
  | {
      type: "diagonalSr";
      event?: "bounce" | "break" | "twin" | "triple" | "any";
      direction?: "bull" | "bear" | "any";
      slope?: "desc" | "any";
      maxBarsAgo?: number;
    }
  | {
      type: "hamJurik";
      event: "setup" | "confirm" | "histCross" | "rawCrossHist" | "al" | "rawUp";
      maxBarsAgo?: number;
    };

export interface ScannerRow {
  symbol: string;
  exchange: Exchange;
  last: number;
  changePct: number;
  rsi?: number;
  volume?: number;
  quoteVolume?: number;
  atrPct?: number;
  note: string;
}

export interface ScanProgress {
  done: number;
  total: number;
}

export const SCANNER_PRESETS: Record<
  string,
  { label: string; filters: ScannerFilter[]; description?: string }
> = {
  asiri_satim: {
    label: "Aşırı satım kombosu",
    description: "RSI<30 + Stochastic oversold",
    filters: [
      { type: "rsi", op: "lt", value: 30 },
      { type: "stoch", zone: "oversold" },
    ],
  },
  momentum_breakout: {
    label: "Momentum breakout",
    description: "%Δ>3 + hacim x1.8 + BB üst kırılım",
    filters: [
      { type: "changePct", op: "gt", value: 3 },
      { type: "volumeSpike", mult: 1.8 },
      { type: "bbBreak", side: "upper" },
    ],
  },
  hacim_ema: {
    label: "Hacim+EMA",
    description: "Hacim spike + EMA bull cross",
    filters: [
      { type: "volumeSpike", mult: 2 },
      { type: "emaCross", direction: "bull" },
    ],
  },
  macd_bull: {
    label: "MACD bull",
    description: "MACD çizgisi sinyal üstü kesişim",
    filters: [{ type: "macdCross", direction: "bull" }],
  },
  bb_sikisma: {
    label: "BB sıkışma",
    description: "Bollinger band width sıkışması",
    filters: [{ type: "bbSqueeze" }],
  },
  supertrend_long: {
    label: "Supertrend long",
    description: "Supertrend bullish flip",
    filters: [{ type: "supertrendFlip", direction: "bull" }],
  },
  crypto_gainers: {
    label: "Crypto gainers",
    description: "%Δ > 5 (Binance)",
    filters: [{ type: "changePct", op: "gt", value: 5 }],
  },
  crypto_losers: {
    label: "Crypto losers",
    description: "%Δ < -5 (Binance)",
    filters: [{ type: "changePct", op: "lt", value: -5 }],
  },
  bist_gainers: {
    label: "BIST gainers",
    description: "%Δ > 3 (BIST)",
    filters: [{ type: "changePct", op: "gt", value: 3 }],
  },
  bist_losers: {
    label: "BIST losers",
    description: "%Δ < -3 (BIST)",
    filters: [{ type: "changePct", op: "lt", value: -3 }],
  },
  rsi_oversold: {
    label: "RSI < 30",
    filters: [{ type: "rsi", op: "lt", value: 30 }],
  },
  rsi_overbought: {
    label: "RSI > 70",
    filters: [{ type: "rsi", op: "gt", value: 70 }],
  },
  near_hod: {
    label: "Günün zirvesine yakın",
    description: "24s high'a %1 içinde",
    filters: [{ type: "nearHod", pct: 1 }],
  },
  near_lod: {
    label: "Günün dibine yakın",
    description: "24s low'a %1 içinde",
    filters: [{ type: "nearLod", pct: 1 }],
  },
  above_sma200: {
    label: "SMA200 üstü",
    filters: [{ type: "priceVsSma", period: 200, side: "above" }],
  },
  atr_yuksek: {
    label: "ATR% yüksek",
    description: "Volatilite (ATR/fiyat) > %2",
    filters: [{ type: "atrPctHigh", minPct: 2 }],
  },
  yesil_seri: {
    label: "3 yeşil bar",
    filters: [{ type: "consecBars", color: "green", count: 3 }],
  },
  rsi_div_bull: {
    label: "RSI bull diverjans",
    description: "Basit fiyat LL + RSI HL sketch",
    filters: [{ type: "rsiDivergence", direction: "bull" }],
  },
  multi_long: {
    label: "Multi long combo",
    description: "EMA↑ + MACD bull + RSI>50",
    filters: [
      { type: "emaCross", direction: "bull" },
      { type: "macdCross", direction: "bull" },
      { type: "rsi", op: "gt", value: 50 },
    ],
  },
  multi_mean_rev: {
    label: "Mean reversion combo",
    description: "RSI<30 + BB alt + Stoch OS",
    filters: [
      { type: "rsi", op: "lt", value: 30 },
      { type: "bbBreak", side: "lower" },
      { type: "stoch", zone: "oversold" },
    ],
  },
  jurik_stoch_os_up: {
    label: "Jurik Stoch 15–20 ↑",
    description: "Jurik %K, %D’yi yukarı keser; kesim 15–20 OS bandında",
    filters: [
      {
        type: "jurikStochCross",
        direction: "bull",
        variant: "jurik",
        zoneLo: 15,
        zoneHi: 20,
      },
    ],
  },
  jurik_kase_os_up: {
    label: "Jurik Kase 15–20 ↑",
    description: "Jurik Kase %K↑%D, 15–20 bandı (piyasada sık aranan OS bounce)",
    filters: [
      {
        type: "jurikStochCross",
        direction: "bull",
        variant: "kase",
        zoneLo: 15,
        zoneHi: 20,
      },
    ],
  },
  jurik_stoch_ob_down: {
    label: "Jurik Stoch 80–85 ↓",
    description: "Jurik %K↓%D overbought 80–85",
    filters: [
      {
        type: "jurikStochCross",
        direction: "bear",
        variant: "jurik",
        zoneLo: 80,
        zoneHi: 85,
      },
    ],
  },
  stoch_os_cross_up: {
    label: "Stoch OS ↑ kesim",
    description: "Klasik Stoch %K↑%D, 15–25 bandı",
    filters: [
      { type: "stochCross", direction: "bull", zoneLo: 15, zoneHi: 25 },
    ],
  },
  di_plus_cross_up: {
    label: "DI+ ↑ DI−",
    description: "+DI, −DI’yi yukarı keser (DMI bull)",
    filters: [{ type: "diCross", direction: "bull" }],
  },
  di_minus_cross_up: {
    label: "DI− ↑ DI+",
    description: "−DI, +DI’yi yukarı keser (DMI bear)",
    filters: [{ type: "diCross", direction: "bear" }],
  },
  adx_trend_di_bull: {
    label: "ADX>25 + DI+↑",
    description: "Trend gücü ADX>25 ve +DI −DI üstü kesişim",
    filters: [
      { type: "adxAbove", value: 25 },
      { type: "diCross", direction: "bull" },
    ],
  },
  adx_trend_di_bear: {
    label: "ADX>25 + DI−↑",
    description: "ADX>25 ve −DI +DI üstü kesişim",
    filters: [
      { type: "adxAbove", value: 25 },
      { type: "diCross", direction: "bear" },
    ],
  },
  adx_strong: {
    label: "ADX > 25",
    description: "Güçlü trend (ADX)",
    filters: [{ type: "adxAbove", value: 25 }],
  },
  rsi2_oversold: {
    label: "RSI(2) < 10",
    description: "Connors-style RSI(2) aşırı satım (period=2)",
    filters: [{ type: "rsi", op: "lt", value: 10, period: 2 }],
  },
  rsi2_sma200: {
    label: "RSI(2)<10 + SMA200 üstü",
    description: "RSI(2) OS + bull regime (SMA200)",
    filters: [
      { type: "rsi", op: "lt", value: 10, period: 2 },
      { type: "priceVsSma", period: 200, side: "above" },
    ],
  },
  st_adx_long: {
    label: "ST flip + ADX>25",
    description: "Supertrend bullish flip and ADX strength",
    filters: [
      { type: "supertrendFlip", direction: "bull" },
      { type: "adxAbove", value: 25 },
    ],
  },
  aroon_long: {
    label: "Aroon long",
    description: "Aroon Up↑Down kesişim (Aaron long tarzı)",
    filters: [{ type: "aroonCross", direction: "bull" }],
  },
  aroon_short: {
    label: "Aroon short",
    description: "Aroon Down↑Up kesişim",
    filters: [{ type: "aroonCross", direction: "bear" }],
  },
  aroon_long_zone: {
    label: "Aroon Up>70 Down<30",
    description: "Klasik Aroon long zone (güçlü uptrend)",
    filters: [{ type: "aroonLong", upMin: 70, downMax: 30 }],
  },
  adx_pump_early_long: {
    label: "ADX Pump erken long",
    description: "Erken skor yüksek + bull bias (Mom-ADX + CCI + %B)",
    filters: [{ type: "adxPumpStage", stage: "early", direction: "bull", minScore: 25 }],
  },
  adx_pump_early_short: {
    label: "ADX Pump erken short",
    description: "Erken skor yüksek + bear bias",
    filters: [{ type: "adxPumpStage", stage: "early", direction: "bear", minScore: 25 }],
  },
  adx_pump_mid_long: {
    label: "ADX Pump orta DI",
    description: "Karışım +DI/−DI hizalı mid build (long)",
    filters: [
      { type: "adxPumpStage", stage: "mid", direction: "bull", minScore: 30 },
      { type: "adxPumpMixDi", direction: "bull" },
    ],
  },
  adx_pump_mid_short: {
    label: "ADX Pump orta DI short",
    description: "Karışım DI mid build (short)",
    filters: [
      { type: "adxPumpStage", stage: "mid", direction: "bear", minScore: 30 },
      { type: "adxPumpMixDi", direction: "bear" },
    ],
  },
  adx_pump_confirm_long: {
    label: "ADX Pump onay long",
    description: "Confirm stage + Saf/Medyan ADX gücü (long)",
    filters: [{ type: "adxPumpStage", stage: "confirm", direction: "bull", minScore: 35 }],
  },
  adx_pump_confirm_short: {
    label: "ADX Pump onay short",
    description: "Confirm stage (short)",
    filters: [{ type: "adxPumpStage", stage: "confirm", direction: "bear", minScore: 35 }],
  },
  elizi_fire_long: {
    label: "Elizi Fire long",
    description: "phase armed/fire + yüksek uyum + yükselen edgeTemp (long)",
    filters: [{ type: "eliziFire", direction: "bull", minTemp: 55, minCoherence: 0.55 }],
  },
  elizi_fire_short: {
    label: "Elizi Fire short",
    description: "phase armed/fire + yüksek uyum (short)",
    filters: [{ type: "eliziFire", direction: "bear", minTemp: 55, minCoherence: 0.55 }],
  },
  elizi_exhaust: {
    label: "Elizi Exhaust",
    description: "Faz exhaust — sürpriz climax + verim çöküşü (fade)",
    filters: [{ type: "eliziExhaust", direction: "any", minSurprise: 0.7 }],
  },
  elizi_armed: {
    label: "Elizi Armed",
    description: "phase ≥ armed, uyum yüksek — fire öncesi hazır",
    filters: [{ type: "eliziPhase", phase: "armed", direction: "any", minTemp: 45, minCoherence: 0.5 }],
  },
  // —— TradingView BIST/TR scanner ports
  tv_w_dip: {
    label: "W Dip",
    description:
      "TV W Dip: fiyat>SMA50>SMA200, RSI>50, MACD>sinyal (durum), ADX>20, vol≥SMA20, perf~21b>+5% ve perf~63b<0% (günlükte ≈1A/3A; diğer TF bar sayısı)",
    filters: [
      { type: "priceVsMa", kind: "sma", period: 50, side: "above" },
      { type: "maStack", kind: "sma", fast: 50, slow: 200 },
      { type: "rsi", op: "gt", value: 50 },
      { type: "macdAboveSignal", side: "above" },
      { type: "adxAbove", value: 20 },
      { type: "volumeSpike", mult: 1 },
      { type: "perfBars", bars: 21, op: "gt", value: 5 },
      { type: "perfBars", bars: 63, op: "lt", value: 0 },
    ],
  },
  tv_uzun_vade: {
    label: "Uzun Vade",
    description:
      "TV Uzun Vade: MACD>sinyal, fiyat>SMA50>SMA100>SMA200, ADX>20, RSI≥55, vol≥ort",
    filters: [
      { type: "macdAboveSignal", side: "above" },
      { type: "priceVsMa", kind: "sma", period: 50, side: "above" },
      { type: "maStack", kind: "sma", fast: 50, slow: 100 },
      { type: "maStack", kind: "sma", fast: 100, slow: 200 },
      { type: "priceVsMa", kind: "sma", period: 200, side: "above" },
      { type: "adxAbove", value: 20 },
      { type: "rsiBetween", lo: 55, hi: 100 },
      { type: "volumeSpike", mult: 1 },
    ],
  },
  tv_tobo_avcisi: {
    label: "TOBO Avcısı",
    description:
      "TV TOBO Avcısı filtre yığını (TOBO formasyonu ayrı): fiyat>EMA20>EMA50, perf~63b>+10%, RSI 50–70, rel vol>1.2. Market-cap 1Y filtresi yok (veri yok).",
    filters: [
      { type: "priceVsMa", kind: "ema", period: 20, side: "above" },
      { type: "perfBars", bars: 63, op: "gt", value: 10 },
      { type: "rsiBetween", lo: 50, hi: 70 },
      { type: "volumeSpike", mult: 1.2 },
      { type: "maStack", kind: "ema", fast: 20, slow: 50 },
    ],
  },
  tv_momentum_avi: {
    label: "momentum avı",
    description:
      "TV momentum avı: MACD sıfır çizgisi yukarı kesişim, EMA20>EMA50, fiyat>EMA20, ADX>18, RSI>50, rel vol>1.2",
    filters: [
      { type: "macdZeroCross", direction: "bull" },
      { type: "maStack", kind: "ema", fast: 20, slow: 50 },
      { type: "priceVsMa", kind: "ema", period: 20, side: "above" },
      { type: "adxAbove", value: 18 },
      { type: "rsi", op: "gt", value: 50 },
      { type: "volumeSpike", mult: 1.2 },
    ],
  },

  tv_dusen_kirilimi: {
    label: "DÜŞEN KIRILIMI",
    description:
      "TV Düşen Kırılımı tarama: fiyat>açılış, Price>EMA5>EMA20>EMA50, RSI>50, CCI>-100, rel vol>1, perf~5b (≈1H günlük)<15%",
    filters: [
      { type: "priceVsOpen", side: "above" },
      { type: "maStack", kind: "ema", fast: 5, slow: 20 },
      { type: "maStack", kind: "ema", fast: 20, slow: 50 },
      { type: "priceVsMa", kind: "ema", period: 5, side: "above" },
      { type: "rsi", op: "gt", value: 50 },
      { type: "cci", op: "gt", value: -100 },
      { type: "volumeSpike", mult: 1 },
      { type: "perfBars", bars: 5, op: "lt", value: 15 },
    ],
  },
  tv_duk_dipten_guc: {
    label: "DÜK+Dipten Güç",
    description:
      "TV DÜK+DİPTEN GÜÇ TOPLAYAN: fiyat>EMA20, perf~252b>15% (≈YP günlük), perf~21b>0%, perf~5b −3…+3%, rel vol>1.2, ADX<20, RSI>50",
    filters: [
      { type: "priceVsMa", kind: "ema", period: 20, side: "above" },
      { type: "perfBars", bars: 252, op: "gt", value: 15 },
      { type: "perfBars", bars: 21, op: "gt", value: 0 },
      { type: "perfBarsBetween", bars: 5, lo: -3, hi: 3 },
      { type: "volumeSpike", mult: 1.2 },
      { type: "adxBelow", value: 20 },
      { type: "rsi", op: "gt", value: 50 },
    ],
  },
  tv_dipten_guc: {
    label: "Dipten Güç Toplayanlar",
    description:
      "TV Dipten Güç: fiyat>EMA20, RSI>50, ADX<20, rel vol>1.2, ATR%<5",
    filters: [
      { type: "priceVsMa", kind: "ema", period: 20, side: "above" },
      { type: "rsi", op: "gt", value: 50 },
      { type: "adxBelow", value: 20 },
      { type: "volumeSpike", mult: 1.2 },
      { type: "atrPctBelow", maxPct: 5 },
    ],
  },
  tv_momentum: {
    label: "momentum",
    description:
      "TV momentum: %Δ 1–10, hacim≥1M (quote), MACD↑sinyal kesişim, RSI(7) 50–65, Ichimoku Tenkan>Kijun. Teknik rating yok.",
    filters: [
      { type: "changePctBetween", lo: 1, hi: 10 },
      { type: "volumeMin", min: 1_000_000 },
      { type: "macdCross", direction: "bull" },
      { type: "rsiBetween", lo: 50, hi: 65, period: 7 },
      { type: "ichiTenkanAboveKijun" },
    ],
  },
  tv_macd_ema5_50: {
    label: "MACD×EMA5/50",
    description: "TV kısa: MACD↑sinyal kesişim + EMA5↑EMA50 kesişim",
    filters: [
      { type: "macdCross", direction: "bull" },
      { type: "emaCross", direction: "bull", fast: 5, slow: 50 },
    ],
  },
  tv_dusen_kirilim_v2: {
    label: "Düşen Kırılımı v2",
    description:
      "Pine v2: EMA5>20>50, close>VWMA&EMA5, RSI 50–75, CCI>90, SpanA>SpanB, AroonUp>50 & >Down, vol>1.3×SMA10 — cooldown scan ≤2 bar",
    filters: [{ type: "descendingBreakV2", maxBarsAgo: 2 }],
  },
  diag_dusen_sr: {
    label: "Düşen S/R",
    description: "pikusov alçalan S/R: temas veya kırılım ≤2 bar",
    filters: [{ type: "diagonalSr", event: "any", direction: "any", slope: "desc", maxBarsAgo: 2 }],
  },
  diag_ikili_dip: {
    label: "İkili dip",
    description: "Trend çizgisine 2. dip teması ≤2 bar",
    filters: [{ type: "diagonalSr", event: "twin", direction: "bull", maxBarsAgo: 2 }],
  },
  diag_ikili_tepe: {
    label: "İkili tepe",
    description: "Trend çizgisine 2. tepe teması ≤2 bar",
    filters: [{ type: "diagonalSr", event: "twin", direction: "bear", maxBarsAgo: 2 }],
  },
  diag_uclu_dip: {
    label: "Üçlü dip",
    description: "Trend çizgisine 3. dip teması ≤2 bar",
    filters: [{ type: "diagonalSr", event: "triple", direction: "bull", maxBarsAgo: 2 }],
  },
  diag_uclu_tepe: {
    label: "Üçlü tepe",
    description: "Trend çizgisine 3. tepe teması ≤2 bar",
    filters: [{ type: "diagonalSr", event: "triple", direction: "bear", maxBarsAgo: 2 }],
  },
  diag_sekme: {
    label: "Diag sekme",
    description: "Diyagonal destek/direnç sekmesi ≤2 bar",
    filters: [{ type: "diagonalSr", event: "bounce", direction: "any", maxBarsAgo: 2 }],
  },
  diag_kirilim: {
    label: "Diag kırılım",
    description: "Diyagonal destek/direnç kırılımı ≤2 bar",
    filters: [{ type: "diagonalSr", event: "break", direction: "any", maxBarsAgo: 2 }],
  },
  diag_ham_setup: {
    label: "HAM erken AL",
    description: "Diag destek teması + semi-raw HAM↑ + hist artıya dönüyor ≤2",
    filters: [
      { type: "diagonalSr", event: "bounce", direction: "bull", maxBarsAgo: 2 },
      { type: "hamJurik", event: "setup", maxBarsAgo: 2 },
    ],
  },
  diag_ham_onay: {
    label: "HAM onay",
    description: "Hist artıya geçmiş veya semi-raw hist’i alttan kesmiş ≤2",
    filters: [{ type: "hamJurik", event: "confirm", maxBarsAgo: 2 }],
  },
  diag_ham_al: {
    label: "Diag×HAM AL",
    description: "Destek teması + HAM↑ + (hist+ veya raw×hist) ≤2",
    filters: [
      { type: "diagonalSr", event: "bounce", direction: "bull", maxBarsAgo: 2 },
      { type: "hamJurik", event: "al", maxBarsAgo: 2 },
    ],
  },

};

const CANDLE_FILTERS = new Set([
  "rsi",
  "volumeSpike",
  "emaCross",
  "macdCross",
  "bbSqueeze",
  "bbBreak",
  "supertrendFlip",
  "atrPctHigh",
  "stoch",
  "stochCross",
  "jurikStochCross",
  "diCross",
  "adxAbove",
  "aroonCross",
  "aroonLong",
  "consecBars",
  "priceVsSma",
  "priceVsMa",
  "maStack",
  "macdAboveSignal",
  "macdZeroCross",
  "rsiBetween",
  "perfBars",
  "rsiDivergence",
  "rsiPuNu",
  "descendingBreak",
  "priceVsOpen",
  "adxBelow",
  "cci",
  "changePctBetween",
  "atrPctBelow",
  "ichiTenkanAboveKijun",
  "ichiSpanAAboveB",
  "volumeMin",
  "perfBarsBetween",
  "priceVsVwma",
  "descendingBreakV2",
  "diagonalSr",
  "hamJurik",
  "adxPumpStage",
  "adxPumpMixDi",
  "eliziPhase",
  "eliziFire",
  "eliziExhaust",
]);

/** Reuse radar within a matchFilters pass (and across filters sharing candles ref). */
const ADX_PUMP_CACHE = new WeakMap<Candle[], ReturnType<typeof adxPumpRadar>>();

function getAdxPumpRadar(candles: Candle[]): ReturnType<typeof adxPumpRadar> {
  let r = ADX_PUMP_CACHE.get(candles);
  if (!r) {
    r = adxPumpRadar(candles);
    ADX_PUMP_CACHE.set(candles, r);
  }
  return r;
}

/** Reuse Elizi Edge within a matchFilters pass. */
const ELIZI_CACHE = new WeakMap<Candle[], ReturnType<typeof eliziEdge>>();

function getEliziEdge(candles: Candle[]): ReturnType<typeof eliziEdge> {
  let r = ELIZI_CACHE.get(candles);
  if (!r) {
    r = eliziEdge(candles);
    ELIZI_CACHE.set(candles, r);
  }
  return r;
}



function crossedAbove(
  a: (number | null)[],
  b: (number | null)[]
): boolean {
  const i = a.length - 1;
  if (i < 1) return false;
  const a0 = a[i - 1];
  const a1 = a[i];
  const b0 = b[i - 1];
  const b1 = b[i];
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false;
  return a0 <= b0 && a1 > b1;
}

function crossedBelow(
  a: (number | null)[],
  b: (number | null)[]
): boolean {
  const i = a.length - 1;
  if (i < 1) return false;
  const a0 = a[i - 1];
  const a1 = a[i];
  const b0 = b[i - 1];
  const b1 = b[i];
  if (a0 == null || a1 == null || b0 == null || b1 == null) return false;
  return a0 >= b0 && a1 < b1;
}

function inZone(v: number | null | undefined, lo: number, hi: number): boolean {
  if (v == null) return false;
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  return v >= a && v <= b;
}

export function filtersNeedCandles(filters: ScannerFilter[]): boolean {
  return filters.some((f) => CANDLE_FILTERS.has(f.type));
}

export function matchFilters(
  quote: TickerQuote,
  candles: Candle[] | null,
  filters: ScannerFilter[]
): { ok: boolean; note: string; rsi?: number; atrPct?: number } {
  const notes: string[] = [];
  let lastRsi: number | undefined;
  let lastAtrPct: number | undefined;

  const needsPump = filters.some(
    (f) => f.type === "adxPumpStage" || f.type === "adxPumpMixDi"
  );
  const pumpRadar =
    needsPump && candles && candles.length >= 50
      ? getAdxPumpRadar(candles)
      : null;
  const needsElizi = filters.some(
    (f) =>
      f.type === "eliziPhase" ||
      f.type === "eliziFire" ||
      f.type === "eliziExhaust"
  );
  const elizi =
    needsElizi && candles && candles.length >= 50
      ? getEliziEdge(candles)
      : null;

  for (const f of filters) {
    if (f.type === "changePct") {
      const ok =
        f.op === "gt" ? quote.changePct > f.value : quote.changePct < f.value;
      if (!ok) return { ok: false, note: "" };
      notes.push(`%Δ ${quote.changePct.toFixed(2)}`);
    } else if (f.type === "nearHod") {
      const hi = quote.high24h;
      if (!hi || hi <= 0) return { ok: false, note: "" };
      const pct = ((hi - quote.last) / hi) * 100;
      if (pct < 0 || pct > (f.pct ?? 1)) return { ok: false, note: "" };
      notes.push(`HOD −${pct.toFixed(2)}%`);
    } else if (f.type === "nearLod") {
      const lo = quote.low24h;
      if (!lo || lo <= 0) return { ok: false, note: "" };
      const pct = ((quote.last - lo) / lo) * 100;
      if (pct < 0 || pct > (f.pct ?? 1)) return { ok: false, note: "" };
      notes.push(`LOD +${pct.toFixed(2)}%`);
    } else if (f.type === "rsi") {
      if (!candles || candles.length < 30) return { ok: false, note: "" };
      const r = rsi(closes(candles), f.period ?? 14);
      const v = r[r.length - 1];
      if (v == null) return { ok: false, note: "" };
      lastRsi = v;
      const ok = f.op === "gt" ? v > f.value : v < f.value;
      if (!ok) return { ok: false, note: "" };
      notes.push(`RSI ${v.toFixed(1)}`);
    } else if (f.type === "volumeSpike") {
      if (!candles || candles.length < 25) return { ok: false, note: "" };
      const vols = candles.map((c) => c.volume);
      const last = vols[vols.length - 1];
      const avg =
        vols.slice(-21, -1).reduce((a, b) => a + b, 0) /
        Math.min(20, vols.length - 1);
      if (!(last > avg * f.mult)) return { ok: false, note: "" };
      notes.push(`Vol x${(last / avg).toFixed(1)}`);
    } else if (f.type === "emaCross") {
      if (!candles || candles.length < 60) return { ok: false, note: "" };
      const fast = ema(closes(candles), f.fast ?? 9);
      const slow = ema(closes(candles), f.slow ?? 21);
      const i = candles.length - 1;
      const j = i - 1;
      if (
        fast[i] == null ||
        slow[i] == null ||
        fast[j] == null ||
        slow[j] == null
      )
        return { ok: false, note: "" };
      const bull =
        (fast[j] as number) <= (slow[j] as number) &&
        (fast[i] as number) > (slow[i] as number);
      const bear =
        (fast[j] as number) >= (slow[j] as number) &&
        (fast[i] as number) < (slow[i] as number);
      if (f.direction === "bull" && !bull) return { ok: false, note: "" };
      if (f.direction === "bear" && !bear) return { ok: false, note: "" };
      notes.push(f.direction === "bull" ? "EMA↑ cross" : "EMA↓ cross");
    } else if (f.type === "macdCross") {
      if (!candles || candles.length < 50) return { ok: false, note: "" };
      const m = macd(closes(candles));
      const i = candles.length - 1;
      const j = i - 1;
      if (
        m.macd[i] == null ||
        m.signal[i] == null ||
        m.macd[j] == null ||
        m.signal[j] == null
      )
        return { ok: false, note: "" };
      const bull =
        (m.macd[j] as number) <= (m.signal[j] as number) &&
        (m.macd[i] as number) > (m.signal[i] as number);
      const bear =
        (m.macd[j] as number) >= (m.signal[j] as number) &&
        (m.macd[i] as number) < (m.signal[i] as number);
      if (f.direction === "bull" && !bull) return { ok: false, note: "" };
      if (f.direction === "bear" && !bear) return { ok: false, note: "" };
      notes.push(f.direction === "bull" ? "MACD↑" : "MACD↓");
    } else if (f.type === "bbSqueeze") {
      if (!candles || candles.length < 40) return { ok: false, note: "" };
      const c = closes(candles);
      const bb = bollinger(c, 20, 2);
      const widths: number[] = [];
      for (let i = 0; i < c.length; i++) {
        if (bb.upper[i] != null && bb.lower[i] != null && bb.mid[i] != null) {
          widths.push(
            (((bb.upper[i] as number) - (bb.lower[i] as number)) /
              (bb.mid[i] as number)) *
              100
          );
        }
      }
      if (widths.length < 20) return { ok: false, note: "" };
      const lookback = Math.min(f.lookback ?? 50, widths.length);
      const window = widths.slice(-lookback);
      const last = window[window.length - 1];
      const sorted = [...window].sort((a, b) => a - b);
      const pctile = f.pctile ?? 20;
      const thresh = sorted[Math.floor((pctile / 100) * (sorted.length - 1))];
      if (!(last <= thresh)) return { ok: false, note: "" };
      notes.push(`BB sq ${last.toFixed(2)}%`);
    } else if (f.type === "bbBreak") {
      if (!candles || candles.length < 25) return { ok: false, note: "" };
      const c = closes(candles);
      const bb = bollinger(c, 20, 2);
      const i = c.length - 1;
      if (bb.upper[i] == null || bb.lower[i] == null)
        return { ok: false, note: "" };
      if (f.side === "upper" && !(c[i] > (bb.upper[i] as number)))
        return { ok: false, note: "" };
      if (f.side === "lower" && !(c[i] < (bb.lower[i] as number)))
        return { ok: false, note: "" };
      notes.push(f.side === "upper" ? "BB↑ break" : "BB↓ break");
    } else if (f.type === "supertrendFlip") {
      if (!candles || candles.length < 40) return { ok: false, note: "" };
      const st = supertrend(candles, f.period ?? 10, f.mult ?? 3);
      const i = candles.length - 1;
      const j = i - 1;
      if (st.direction[i] == null || st.direction[j] == null)
        return { ok: false, note: "" };
      const bull = st.direction[j] === -1 && st.direction[i] === 1;
      const bear = st.direction[j] === 1 && st.direction[i] === -1;
      if (f.direction === "bull" && !bull) return { ok: false, note: "" };
      if (f.direction === "bear" && !bear) return { ok: false, note: "" };
      notes.push(f.direction === "bull" ? "ST↑ flip" : "ST↓ flip");
    } else if (f.type === "atrPctHigh") {
      if (!candles || candles.length < 20) return { ok: false, note: "" };
      const a = atr(candles, f.period ?? 14);
      const i = candles.length - 1;
      if (a[i] == null || candles[i].close <= 0) return { ok: false, note: "" };
      const pct = ((a[i] as number) / candles[i].close) * 100;
      lastAtrPct = pct;
      if (!(pct >= f.minPct)) return { ok: false, note: "" };
      notes.push(`ATR% ${pct.toFixed(2)}`);
    } else if (f.type === "stoch") {
      if (!candles || candles.length < 25) return { ok: false, note: "" };
      const s = stochastic(candles, f.kPeriod ?? 14, 3);
      const v = s.k[s.k.length - 1];
      if (v == null) return { ok: false, note: "" };
      const level = f.level ?? (f.zone === "oversold" ? 20 : 80);
      if (f.zone === "oversold" && !(v < level)) return { ok: false, note: "" };
      if (f.zone === "overbought" && !(v > level)) return { ok: false, note: "" };
      notes.push(`Stoch ${v.toFixed(0)}`);
    } else if (f.type === "consecBars") {
      if (!candles || candles.length < f.count) return { ok: false, note: "" };
      for (let i = candles.length - f.count; i < candles.length; i++) {
        const green = candles[i].close >= candles[i].open;
        if (f.color === "green" && !green) return { ok: false, note: "" };
        if (f.color === "red" && green) return { ok: false, note: "" };
      }
      notes.push(`${f.count}×${f.color === "green" ? "yeşil" : "kırmızı"}`);
    } else if (f.type === "priceVsSma") {
      if (!candles || candles.length < f.period + 5)
        return { ok: false, note: "" };
      const s = sma(closes(candles), f.period);
      const v = s[s.length - 1];
      if (v == null) return { ok: false, note: "" };
      const last = candles[candles.length - 1].close;
      if (f.side === "above" && !(last > v)) return { ok: false, note: "" };
      if (f.side === "below" && !(last < v)) return { ok: false, note: "" };
      notes.push(`vs SMA${f.period} ${f.side}`);
    } else if (f.type === "stochCross") {
      if (!candles || candles.length < 30) return { ok: false, note: "" };
      const s = stochastic(candles, 14, 3);
      const bull = crossedAbove(s.k, s.d);
      const bear = crossedBelow(s.k, s.d);
      if (f.direction === "bull" && !bull) return { ok: false, note: "" };
      if (f.direction === "bear" && !bear) return { ok: false, note: "" };
      const k = s.k[s.k.length - 1];
      const lo = f.zoneLo;
      const hi = f.zoneHi;
      if (lo != null && hi != null && !inZone(k, lo, hi))
        return { ok: false, note: "" };
      notes.push(
        f.direction === "bull"
          ? `Stoch↑ ${k != null ? k.toFixed(0) : ""}`
          : `Stoch↓ ${k != null ? k.toFixed(0) : ""}`
      );
    } else if (f.type === "jurikStochCross") {
      if (!candles || candles.length < 40) return { ok: false, note: "" };
      const variant = f.variant ?? "kase";
      const s =
        variant === "jurik" ? jurikStoch(candles) : jurikKaseStoch(candles);
      const bull = crossedAbove(s.k, s.d);
      const bear = crossedBelow(s.k, s.d);
      if (f.direction === "bull" && !bull) return { ok: false, note: "" };
      if (f.direction === "bear" && !bear) return { ok: false, note: "" };
      const k = s.k[s.k.length - 1];
      const lo = f.zoneLo;
      const hi = f.zoneHi;
      if (lo != null && hi != null && !inZone(k, lo, hi))
        return { ok: false, note: "" };
      const tag = variant === "jurik" ? "JStoch" : "JKase";
      notes.push(
        f.direction === "bull"
          ? `${tag}↑ ${k != null ? k.toFixed(0) : ""}`
          : `${tag}↓ ${k != null ? k.toFixed(0) : ""}`
      );
    } else if (f.type === "diCross") {
      if (!candles || candles.length < 40) return { ok: false, note: "" };
      const d = adx(candles, f.period ?? 14);
      const bull = crossedAbove(d.plusDI, d.minusDI);
      const bear = crossedAbove(d.minusDI, d.plusDI);
      if (f.direction === "bull" && !bull) return { ok: false, note: "" };
      if (f.direction === "bear" && !bear) return { ok: false, note: "" };
      notes.push(f.direction === "bull" ? "DI+↑DI−" : "DI−↑DI+");
    } else if (f.type === "adxAbove") {
      if (!candles || candles.length < 40) return { ok: false, note: "" };
      const d = adx(candles, f.period ?? 14);
      const v = d.adx[d.adx.length - 1];
      if (v == null || !(v > f.value)) return { ok: false, note: "" };
      notes.push(`ADX ${v.toFixed(0)}`);
    } else if (f.type === "aroonCross") {
      if (!candles || candles.length < 30) return { ok: false, note: "" };
      const a = aroon(candles, f.period ?? 14);
      const bull = crossedAbove(a.up, a.down);
      const bear = crossedAbove(a.down, a.up);
      if (f.direction === "bull" && !bull) return { ok: false, note: "" };
      if (f.direction === "bear" && !bear) return { ok: false, note: "" };
      notes.push(f.direction === "bull" ? "Aroon↑ long" : "Aroon↓ short");
    } else if (f.type === "aroonLong") {
      if (!candles || candles.length < 30) return { ok: false, note: "" };
      const a = aroon(candles, f.period ?? 14);
      const i = a.up.length - 1;
      const up = a.up[i];
      const down = a.down[i];
      const upMin = f.upMin ?? 70;
      const downMax = f.downMax ?? 30;
      if (up == null || down == null) return { ok: false, note: "" };
      if (!(up >= upMin && down <= downMax)) return { ok: false, note: "" };
      notes.push(`Aroon ${up.toFixed(0)}/${down.toFixed(0)}`);

    } else if (f.type === "adxPumpStage") {
      if (!pumpRadar) return { ok: false, note: "" };
      const r = pumpRadar;
      const i = r.stage.length - 1;
      const bias = r.bias[i];
      const st = r.stage[i];
      if (bias == null || st == null) return { ok: false, note: "" };
      const wantBull = f.direction === "bull";
      if (wantBull && bias <= 0) return { ok: false, note: "" };
      if (!wantBull && bias >= 0) return { ok: false, note: "" };
      const scoreSeries =
        f.stage === "early" ? r.early : f.stage === "mid" ? r.mid : r.confirm;
      const score = scoreSeries[i];
      const min =
        f.minScore ??
        (f.stage === "early" ? 25 : f.stage === "mid" ? 30 : 35);
      if (score == null || Math.abs(score) < min) return { ok: false, note: "" };
      const absSt = Math.abs(st);
      const need =
        f.stage === "early" ? 1 : f.stage === "mid" ? 2 : 3;
      if (absSt < need && f.stage !== "early") {
        // allow early on score alone; mid/confirm prefer stage level
        if (f.stage === "confirm" && absSt < 3) return { ok: false, note: "" };
        if (f.stage === "mid" && absSt < 2) return { ok: false, note: "" };
      }
      const tag =
        f.stage === "early" ? "Erken" : f.stage === "mid" ? "Orta" : "Onay";
      notes.push(
        `Pump ${tag} ${wantBull ? "L" : "S"} ${score.toFixed(0)}`
      );
    } else if (f.type === "adxPumpMixDi") {
      if (!pumpRadar) return { ok: false, note: "" };
      const r = pumpRadar;
      const i = r.plusDIMix.length - 1;
      const p = r.plusDIMix[i];
      const m = r.minusDIMix[i];
      if (p == null || m == null) return { ok: false, note: "" };
      if (f.direction === "bull" && !(p > m)) return { ok: false, note: "" };
      if (f.direction === "bear" && !(m > p)) return { ok: false, note: "" };
      notes.push(f.direction === "bull" ? "Mix +DI>+DI−" : "Mix −DI>+DI");


    } else if (f.type === "eliziFire") {
      if (!elizi) return { ok: false, note: "" };
      const r = elizi;
      const i = r.phase.length - 1;
      const ph = r.phase[i];
      const temp = r.edgeTemp[i];
      const coh = r.coherence[i];
      const bias = r.bias[i];
      if (ph == null || temp == null || coh == null || bias == null)
        return { ok: false, note: "" };
      const absPh = Math.abs(ph);
      const wantBull = f.direction === "bull";
      if (wantBull && bias <= 0) return { ok: false, note: "" };
      if (!wantBull && bias >= 0) return { ok: false, note: "" };
      if (absPh < 2) return { ok: false, note: "" };
      const minTemp = f.minTemp ?? 55;
      const minCoh = f.minCoherence ?? 0.55;
      if (temp < minTemp || coh < minCoh) return { ok: false, note: "" };
      const tempPrev = i > 0 ? r.edgeTemp[i - 1] : null;
      if (tempPrev != null && temp < tempPrev) return { ok: false, note: "" };
      notes.push(
        `Elizi Fire ${wantBull ? "L" : "S"} T${temp.toFixed(0)} C${(coh * 100).toFixed(0)}`
      );
    } else if (f.type === "eliziPhase") {
      if (!elizi) return { ok: false, note: "" };
      const r = elizi;
      const i = r.phase.length - 1;
      const ph = r.phase[i];
      const temp = r.edgeTemp[i];
      const coh = r.coherence[i];
      const bias = r.bias[i];
      if (ph == null || temp == null || coh == null || bias == null)
        return { ok: false, note: "" };
      const absPh = Math.abs(ph);
      if (f.phase === "exhaust") {
        if (absPh !== 4) return { ok: false, note: "" };
      } else {
        const need =
          f.phase === "probe" ? 1 : f.phase === "armed" ? 2 : 3;
        if (absPh < need) return { ok: false, note: "" };
      }
      if (f.direction === "bull" && bias <= 0) return { ok: false, note: "" };
      if (f.direction === "bear" && bias >= 0) return { ok: false, note: "" };
      const minTemp = f.minTemp ?? 0;
      const minCoh = f.minCoherence ?? 0;
      if (temp < minTemp || coh < minCoh) return { ok: false, note: "" };
      notes.push(`Elizi ${f.phase} T${temp.toFixed(0)}`);
    } else if (f.type === "eliziExhaust") {
      if (!elizi) return { ok: false, note: "" };
      const r = elizi;
      const i = r.phase.length - 1;
      const ph = r.phase[i];
      const sur = r.volSurprise[i];
      const eff = r.pathEfficiency[i];
      const bias = r.bias[i];
      if (ph == null || bias == null) return { ok: false, note: "" };
      if (Math.abs(ph) !== 4) return { ok: false, note: "" };
      if (f.direction === "bull" && bias <= 0) return { ok: false, note: "" };
      if (f.direction === "bear" && bias >= 0) return { ok: false, note: "" };
      const minSur = f.minSurprise ?? 0.7;
      if (sur != null && sur < minSur) return { ok: false, note: "" };
      notes.push(
        `Elizi Exhaust${eff != null ? ` ER${(eff * 100).toFixed(0)}` : ""}`
      );

    } else if (f.type === "macdAboveSignal") {
      if (!candles || candles.length < 50) return { ok: false, note: "" };
      const m = macd(closes(candles));
      const i = candles.length - 1;
      const mv = m.macd[i];
      const sv = m.signal[i];
      if (mv == null || sv == null) return { ok: false, note: "" };
      if (f.side === "above" && !(mv > sv)) return { ok: false, note: "" };
      if (f.side === "below" && !(mv < sv)) return { ok: false, note: "" };
      notes.push(f.side === "above" ? "MACD>sig" : "MACD<sig");
    } else if (f.type === "macdZeroCross") {
      if (!candles || candles.length < 50) return { ok: false, note: "" };
      const m = macd(closes(candles));
      const i = m.macd.length - 1;
      if (i < 1) return { ok: false, note: "" };
      const a0 = m.macd[i - 1];
      const a1 = m.macd[i];
      if (a0 == null || a1 == null) return { ok: false, note: "" };
      const bull = a0 <= 0 && a1 > 0;
      const bear = a0 >= 0 && a1 < 0;
      if (f.direction === "bull" && !bull) return { ok: false, note: "" };
      if (f.direction === "bear" && !bear) return { ok: false, note: "" };
      notes.push(f.direction === "bull" ? "MACD 0↑" : "MACD 0↓");
    } else if (f.type === "priceVsMa") {
      if (!candles || candles.length < f.period + 5)
        return { ok: false, note: "" };
      const c = closes(candles);
      const s = f.kind === "ema" ? ema(c, f.period) : sma(c, f.period);
      const v = s[s.length - 1];
      if (v == null) return { ok: false, note: "" };
      const last = candles[candles.length - 1]!.close;
      if (f.side === "above" && !(last > v)) return { ok: false, note: "" };
      if (f.side === "below" && !(last < v)) return { ok: false, note: "" };
      const tag = f.kind === "ema" ? "EMA" : "SMA";
      notes.push(`vs ${tag}${f.period} ${f.side}`);
    } else if (f.type === "maStack") {
      const need = Math.max(f.fast, f.slow) + 5;
      if (!candles || candles.length < need) return { ok: false, note: "" };
      const c = closes(candles);
      const a =
        f.kind === "ema" ? ema(c, f.fast) : sma(c, f.fast);
      const b =
        f.kind === "ema" ? ema(c, f.slow) : sma(c, f.slow);
      const i = c.length - 1;
      if (a[i] == null || b[i] == null) return { ok: false, note: "" };
      if (!((a[i] as number) > (b[i] as number)))
        return { ok: false, note: "" };
      const tag = f.kind === "ema" ? "EMA" : "SMA";
      notes.push(`${tag}${f.fast}>${tag}${f.slow}`);
    } else if (f.type === "rsiBetween") {
      if (!candles || candles.length < 30) return { ok: false, note: "" };
      const r = rsi(closes(candles), f.period ?? 14);
      const v = r[r.length - 1];
      if (v == null) return { ok: false, note: "" };
      lastRsi = v;
      const lo = Math.min(f.lo, f.hi);
      const hi = Math.max(f.lo, f.hi);
      if (!(v >= lo && v <= hi)) return { ok: false, note: "" };
      notes.push(`RSI ${v.toFixed(1)} ∈[${lo},${hi}]`);
    } else if (f.type === "perfBars") {
      if (!candles || candles.length <= f.bars)
        return { ok: false, note: "" };
      const end = candles.length - 1;
      const start = end - f.bars;
      const c0 = candles[start]!.close;
      const c1 = candles[end]!.close;
      if (!(c0 > 0)) return { ok: false, note: "" };
      const pct = ((c1 - c0) / c0) * 100;
      const ok = f.op === "gt" ? pct > f.value : pct < f.value;
      if (!ok) return { ok: false, note: "" };
      notes.push(`perf${f.bars} ${pct.toFixed(1)}%`);
    } else if (f.type === "rsiPuNu") {
      if (!candles || candles.length < 60) return { ok: false, note: "" };
      const hit = recentRsiPuNu(
        candles,
        f.direction,
        f.maxBarsAgo ?? 2
      );
      if (!hit.ok) return { ok: false, note: "" };
      notes.push(
        hit.kind === "pu"
          ? `RSI PU (−${hit.barsAgo})`
          : `RSI NU (−${hit.barsAgo})`
      );
    } else if (f.type === "descendingBreak") {
      if (!candles || candles.length < 80) return { ok: false, note: "" };
      const hit = recentDescendingBreak(candles, f.maxBarsAgo ?? 2);
      if (!hit.ok) return { ok: false, note: "" };
      notes.push(`Düşen kırılım (−${hit.barsAgo})`);
    } else if (f.type === "priceVsOpen") {
      if (!candles || candles.length < 1) return { ok: false, note: "" };
      const c = candles[candles.length - 1]!;
      const ok =
        f.side === "above" ? c.close > c.open : c.close < c.open;
      if (!ok) return { ok: false, note: "" };
      notes.push(f.side === "above" ? "kapanış>açılış" : "kapanış<açılış");
    } else if (f.type === "adxBelow") {
      if (!candles || candles.length < 40) return { ok: false, note: "" };
      const d = adx(candles, f.period ?? 14);
      const v = d.adx[d.adx.length - 1];
      if (v == null || !(v < f.value)) return { ok: false, note: "" };
      notes.push(`ADX ${v.toFixed(0)}<${f.value}`);
    } else if (f.type === "cci") {
      if (!candles || candles.length < 40) return { ok: false, note: "" };
      const series = cci(candles, f.period ?? 20);
      const v = series[series.length - 1];
      if (v == null) return { ok: false, note: "" };
      const ok = f.op === "gt" ? v > f.value : v < f.value;
      if (!ok) return { ok: false, note: "" };
      notes.push(`CCI ${v.toFixed(0)}`);
    } else if (f.type === "changePctBetween") {
      const v = quote.changePct;
      if (!(v >= f.lo && v <= f.hi)) return { ok: false, note: "" };
      notes.push(`%Δ ${v.toFixed(2)}`);
    } else if (f.type === "atrPctBelow") {
      if (!candles || candles.length < 20) return { ok: false, note: "" };
      const a = atr(candles, f.period ?? 14);
      const i = candles.length - 1;
      if (a[i] == null || candles[i]!.close <= 0) return { ok: false, note: "" };
      const pct = ((a[i] as number) / candles[i]!.close) * 100;
      lastAtrPct = pct;
      if (!(pct < f.maxPct)) return { ok: false, note: "" };
      notes.push(`ATR% ${pct.toFixed(2)}`);
    } else if (f.type === "ichiTenkanAboveKijun") {
      if (!candles || candles.length < 60) return { ok: false, note: "" };
      const ich = ichimoku(candles);
      const i = candles.length - 1;
      if (ich.tenkan[i] == null || ich.kijun[i] == null)
        return { ok: false, note: "" };
      if (!((ich.tenkan[i] as number) > (ich.kijun[i] as number)))
        return { ok: false, note: "" };
      notes.push("Tenkan>Kijun");
    } else if (f.type === "ichiSpanAAboveB") {
      if (!candles || candles.length < 60) return { ok: false, note: "" };
      const ich = ichimoku(candles);
      const i = candles.length - 1;
      if (ich.spanA[i] == null || ich.spanB[i] == null)
        return { ok: false, note: "" };
      if (!((ich.spanA[i] as number) > (ich.spanB[i] as number)))
        return { ok: false, note: "" };
      notes.push("SpanA>SpanB");
    } else if (f.type === "volumeMin") {
      const vol = quote.quoteVolume ?? quote.volume ?? 0;
      if (!(vol >= f.min)) return { ok: false, note: "" };
      notes.push(`Vol≥${f.min}`);
    } else if (f.type === "perfBarsBetween") {
      if (!candles || candles.length <= f.bars)
        return { ok: false, note: "" };
      const end = candles.length - 1;
      const start = end - f.bars;
      const c0 = candles[start]!.close;
      const c1 = candles[end]!.close;
      if (!(c0 > 0)) return { ok: false, note: "" };
      const pct = ((c1 - c0) / c0) * 100;
      if (!(pct >= f.lo && pct <= f.hi)) return { ok: false, note: "" };
      notes.push(`perf${f.bars}b ${pct.toFixed(1)}%`);
    } else if (f.type === "priceVsVwma") {
      const period = f.period ?? 20;
      if (!candles || candles.length < period + 5)
        return { ok: false, note: "" };
      const v = vwma(candles, period);
      const i = candles.length - 1;
      if (v[i] == null) return { ok: false, note: "" };
      const last = candles[i]!.close;
      if (f.side === "above" && !(last > (v[i] as number)))
        return { ok: false, note: "" };
      if (f.side === "below" && !(last < (v[i] as number)))
        return { ok: false, note: "" };
      notes.push(`vs VWMA${period}`);
    } else if (f.type === "descendingBreakV2") {
      if (!candles || candles.length < 80) return { ok: false, note: "" };
      const hit = recentDescendingBreakV2(candles, f.maxBarsAgo ?? 2);
      if (!hit.ok) return { ok: false, note: "" };
      notes.push(`Düşen kırılım v2 (−${hit.barsAgo})`);
    } else if (f.type === "diagonalSr") {
      if (!candles || candles.length < 40) return { ok: false, note: "" };
      const hit = recentDiagonalSr(candles, {
        event: f.event ?? "any",
        direction: f.direction ?? "any",
        slope: f.slope ?? "any",
        maxBarsAgo: f.maxBarsAgo ?? 2,
      });
      if (!hit.ok) return { ok: false, note: "" };
      notes.push(hit.note);
    } else if (f.type === "hamJurik") {
      if (!candles || candles.length < 80) return { ok: false, note: "" };
      const hit = recentHamJurik(candles, f.event, f.maxBarsAgo ?? 2);
      if (!hit.ok) return { ok: false, note: "" };
      notes.push(hit.note);
    } else if (f.type === "rsiDivergence") {
      // Prefer Pine-style PU/NU; fall back only if no recent pivot signal
      if (!candles || candles.length < 60) return { ok: false, note: "" };
      const dir = f.direction === "bull" ? "bull" : "bear";
      const lookback = f.lookback ?? 20;
      const hit = recentRsiPuNu(candles, dir, Math.max(2, Math.min(lookback, 10)));
      if (hit.ok) {
        notes.push(dir === "bull" ? "RSI PU" : "RSI NU");
      } else {
        // Legacy sketch fallback
        const c = closes(candles);
        const r = rsi(c, 14);
        const end = c.length - 1;
        const start = Math.max(0, end - lookback);
        let priceExt = start;
        let rsiExt = start;
        for (let i = start; i <= end; i++) {
          if (r[i] == null) continue;
          if (f.direction === "bull") {
            if (c[i]! <= c[priceExt]!) priceExt = i;
            if ((r[i] as number) <= (r[rsiExt] as number)) rsiExt = i;
          } else {
            if (c[i]! >= c[priceExt]!) priceExt = i;
            if ((r[i] as number) >= (r[rsiExt] as number)) rsiExt = i;
          }
        }
        if (r[end] == null || r[priceExt] == null) return { ok: false, note: "" };
        let ok = false;
        if (f.direction === "bull") {
          ok =
            priceExt > start &&
            priceExt >= end - 5 &&
            c[priceExt]! < c[start]! &&
            (r[priceExt] as number) > (r[rsiExt] as number) * 0.98 &&
            (r[end] as number) > (r[priceExt] as number);
        } else {
          ok =
            priceExt > start &&
            priceExt >= end - 5 &&
            c[priceExt]! > c[start]! &&
            (r[priceExt] as number) < (r[rsiExt] as number) * 1.02 &&
            (r[end] as number) < (r[priceExt] as number);
        }
        if (!ok) return { ok: false, note: "" };
        lastRsi = r[end] as number;
        notes.push(f.direction === "bull" ? "RSI↑ div" : "RSI↓ div");
      }
    }
  }
  return { ok: true, note: notes.join(" · "), rsi: lastRsi, atrPct: lastAtrPct };
}

/** Run async work over items with limited concurrency. Supports AbortSignal. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length || 1) },
    async () => {
      while (true) {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const i = next++;
        if (i >= items.length) break;
        results[i] = await fn(items[i], i);
        done++;
        onProgress?.(done, items.length);
      }
    }
  );
  await Promise.all(workers);
  return results;
}
