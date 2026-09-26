"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDeskStore } from "@/store/desk";
import type { Candle, Exchange, Timeframe, AlertScanKey, Watchlist, TickerQuote, BuiltinIndicatorId } from "@/lib/types";
import {
  binancePerpWatchlistMeta,
  binanceTradfiWatchlistMeta,
  sortPerpsAiFirst,
  PERP_ALL_ID,
  PERP_ALL_NAME,
  PERP_CRYPTO_NAME,
} from "@/lib/data/binanceLists";
import { sectorWatchlistMeta } from "@/lib/data/bistSectors";
import {
  mapPool,
  matchFilters,
  type ScannerFilter,
} from "@/lib/scanner/engine";
import { fetchWatchlistQuotes } from "@/lib/scanner/watchlistQuotes";
import {
  scanSymbol,
  indicatorParamsFromConfig,
  KIND_TO_INDICATOR,
  type HamCond,
  type MacdCond,
  type StochCond,
  type DiagCond,
  type DiCond,
  type HullCond,
  type HamAoCond,
  type GoldCond,
  type Gold2Cond,
  type DivOscId,
  type DivTypeId,
  type ListScanConfig,
  DOKTOR_HULL_FETCH_LIMIT,
  DOKTOR_HULL_MIN_BARS,
  HAM_AO_JRMA_Z_MIN_BARS,
  AOHAM_JRMA_MIN_BARS,
  GOLD_KEKO_MIN_BARS,
  GOLD_KEKO_FETCH_LIMIT,
  DIV_SCAN_FETCH_LIMIT,
  DIV_SCAN_MIN_BARS,
  ALL_GOLD_CONDS,
  ALL_GOLD2_CONDS,
  DEFAULT_DIV_OSC,
  DEFAULT_DIV_TYPES,
  ALL_DIV_OSC,
  ALL_DIV_TYPES,
  DIV_OSC_LABEL,
  DIV_TYPE_LABEL,
  DIV_OSC_TO_INDICATOR,
  ALL_MULTI_DIP_CONDS,
  DEFAULT_MULTI_DIP_CONDS,
  MULTI_DIP_MIN_BARS,
  MULTI_DIP_FETCH_LIMIT,
  type MultiDipCond,
  ALL_BB_DIV_LG_CONDS,
  DEFAULT_BB_DIV_LG_CONDS,
  BB_DIV_LG_MIN_BARS,
  BB_DIV_LG_FETCH_LIMIT,
  type BbDivLgCond,
  ALL_OB_FALL_CONDS,
  DEFAULT_OB_FALL_CONDS,
  OB_FALL_MIN_BARS,
  OB_FALL_FETCH_LIMIT,
  type ObFallCond,
  ALL_MA_SIMPLE_CONDS,
  DEFAULT_MA_SIMPLE_CONDS,
  MA_SIMPLE_MIN_BARS,
  MA_SIMPLE_FETCH_LIMIT,
  type MaSimpleCond,
  DEFAULT_KIJUN_BB_CONDS,
  KIJUN_BB_MIN_BARS,
  KIJUN_BB_FETCH_LIMIT,
  type KijunBbCond,
  DEFAULT_PDO_CONDS,
  PDO_MIN_BARS,
  PDO_FETCH_LIMIT,
  type PdoCond,
  DEFAULT_CMO_CONDS,
  CMO_MIN_BARS,
  CMO_FETCH_LIMIT,
  CMO_DEFAULTS,
  cmoCondLabel,
  type CmoCond,
  DEFAULT_PLI_DIR_CONDS,
  PLI_DIR_MIN_BARS,
  PLI_DIR_FETCH_LIMIT,
  PLI_DIR_DEFAULTS,
  PLI_DIR_COND_LABEL,
  type PliDirCond,
  DEFAULT_PLI_DMI_CONDS,
  PLI_DMI_MIN_BARS,
  PLI_DMI_FETCH_LIMIT,
  PLI_DMI_DEFAULTS,
  PLI_DMI_COND_LABEL,
  type PliDmiCond,
  type ListScanHit,
  type ListScanKind,
  type PineCond,
} from "@/lib/scanner/listScan";
import { convertAny } from "@/lib/scripts/pine/translate";
import type { CustomScript } from "@/lib/types";
import clsx from "clsx";

const TFS: Timeframe[] = [
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "8h",
  "12h",
  "1d",
  "2d",
  "3d",
];

const HAM_CHIPS: { id: HamCond; label: string }[] = [
  { id: "raw_up", label: "Raw↑" },
  { id: "raw_dn", label: "Raw↓" },
  { id: "hist_zero_up", label: "Hist0↑" },
  { id: "hist_zero_dn", label: "Hist0↓" },
  { id: "hist_pos", label: "Hist+" },
  { id: "hist_neg", label: "Hist−" },
  { id: "hist_turn", label: "Hist→" },
  { id: "dual_up", label: "Osc H×Y↑" },
  { id: "dual_dn", label: "Osc H×Y↓" },
  { id: "raw_dual_up", label: "Raw H×Y↑" },
  { id: "raw_dual_dn", label: "Raw H×Y↓" },
  { id: "raw_slow_up", label: "RawY↑" },
  { id: "raw_slow_dn", label: "RawY↓" },
  { id: "raw_slow_x_osc_up", label: "RawY×Osc↑" },
  { id: "raw_slow_x_osc_dn", label: "RawY×Osc↓" },
  { id: "osc_fast_up", label: "OscH↑" },
  { id: "osc_fast_dn", label: "OscH↓" },
  { id: "osc_slow_up", label: "OscY↑" },
  { id: "osc_slow_dn", label: "OscY↓" },
  { id: "osc_fast_zero_up", label: "OscH 0↑" },
  { id: "osc_fast_zero_dn", label: "OscH 0↓" },
  { id: "osc_slow_zero_up", label: "OscY 0↑" },
  { id: "osc_slow_zero_dn", label: "OscY 0↓" },
  { id: "raw_x_osc_up", label: "Raw×Osc↑" },
  { id: "raw_x_osc_dn", label: "Raw×Osc↓" },
  { id: "raw_x_hist_up", label: "Raw×H↑" },
  { id: "raw_x_hist_dn", label: "Raw×H↓" },
  { id: "setup", label: "Setup" },
  { id: "confirm", label: "Onay" },
  { id: "al", label: "AL" },
];

const DIAG_CHIPS: { id: DiagCond; label: string }[] = [
  { id: "bounce", label: "Temas" },
  { id: "break", label: "Kırılım" },
  { id: "twin_bull", label: "İkili↑" },
  { id: "twin_bear", label: "İkili↓" },
  { id: "triple_bull", label: "Üçlü↑" },
  { id: "triple_bear", label: "Üçlü↓" },
];

const MACD_CHIPS: { id: MacdCond; label: string }[] = [
  { id: "cross_up", label: "×Sig↑" },
  { id: "cross_dn", label: "×Sig↓" },
  { id: "hist_zero_up", label: "Hist0↑" },
  { id: "hist_zero_dn", label: "Hist0↓" },
  { id: "hist_pos", label: "Hist+" },
  { id: "hist_neg", label: "Hist−" },
];

const STOCH_CHIPS: { id: StochCond; label: string }[] = [
  { id: "os", label: "OS" },
  { id: "ob", label: "OB" },
  { id: "kx_up", label: "K×D↑" },
  { id: "kx_dn", label: "K×D↓" },
  { id: "kx_up_os", label: "↑15–25" },
  { id: "kx_dn_ob", label: "↓75–85" },
];

const DI_CHIPS: { id: DiCond; label: string }[] = [
  { id: "plus_x_minus", label: "+DI×−DI↑" },
  { id: "minus_x_plus", label: "−DI×+DI↑" },
  { id: "plus_above", label: "+DI>−DI" },
  { id: "minus_above", label: "−DI>+DI" },
  { id: "adx_above", label: "ADX>25" },
];

const HULL_CHIPS: { id: HullCond; label: string }[] = [
  { id: "al", label: "AL 100↑200" },
  { id: "sat", label: "SAT 21↓100" },
  { id: "c50_100", label: "50↑100" },
  { id: "c50_200", label: "50↑200" },
  { id: "c100_200", label: "100↑200" },
  { id: "c21_50", label: "21↑50" },
  { id: "c21_100", label: "21↑100" },
  { id: "chart_al", label: "Grafik AL 13↑50" },
  { id: "chart_sat", label: "Grafik SAT 21↓50" },
];

const MULTI_DIP_CHIPS: { id: MultiDipCond; label: string }[] = [
  { id: "double_dip_bb", label: "İkili" },
  { id: "triple_dip_bb", label: "Üçlü" },
  { id: "any_dip_bb", label: "Herhangi" },
  { id: "dip_sr", label: "Dip+S/R" },
  { id: "dip_bb_sr", label: "BB+S/R" },
  { id: "maj_res_break", label: "Majör kırılım" },
  { id: "dip_bb_break", label: "Dip+BB+Kırılım" },
];

const BB_DIV_LG_CHIPS: { id: BbDivLgCond; label: string }[] = [
  { id: "lg", label: "LG" },
  { id: "div_bb", label: "Div BB" },
  { id: "signal", label: "Sinyal" },
  { id: "buy", label: "BUY" },
  { id: "bb_os", label: "BB+OS" },
  { id: "lower_x_up", label: "Alt↑" },
  { id: "at_lower", label: "Alt değdi" },
  { id: "upper_x_dn", label: "Üst↓" },
  { id: "at_upper", label: "Üst değdi" },
];

const OB_FALL_CHIPS: { id: ObFallCond; label: string }[] = [
  { id: "ob_bull", label: "Bull OB" },
  { id: "fall_break", label: "Düşen kırılım" },
  { id: "ob_fall", label: "OB+Düşen" },
  { id: "ob_bear", label: "Bear OB" },
];

const MA_SIMPLE_CHIPS: { id: MaSimpleCond; label: string }[] = [
  { id: "stack_bull", label: "Boğa yığını" },
  { id: "stack_bear", label: "Ayı yığını" },
  { id: "x_20_50", label: "SMA20↑50" },
  { id: "x_20_100", label: "SMA20↑100" },
  { id: "x_20_200", label: "SMA20↑200" },
  { id: "x_50_100", label: "SMA50↑100" },
  { id: "x_50_200", label: "SMA50↑200" },
  { id: "x_100_200", label: "SMA100↑200" },
  { id: "price_x_20", label: "Fiyat↑SMA20" },
  { id: "price_x_50", label: "Fiyat↑SMA50" },
  { id: "price_x_100", label: "Fiyat↑SMA100" },
  { id: "price_x_200", label: "Fiyat↑SMA200" },
  { id: "ema10_x_sma20", label: "EMA10↑SMA20" },
  { id: "ema10_x_sma20_dn", label: "EMA10↓SMA20" },
];

const PDO_CHIPS: { id: PdoCond; label: string; title: string }[] = [
  { id: "trend_up", label: "PDO trend↑ (yeşil)", title: "Trend kesişimi: yeşil P (PUMP skoru, EMA2) çizgisi kırmızı D (DUMP skoru) çizgisini yukarı keser" },
  { id: "trend_dn", label: "PDO trend↓ (kırmızı)", title: "Trend kesişimi: kırmızı D çizgisi yeşil P çizgisini yukarı keser (P aşağı)" },
  { id: "al", label: "PDO AL (yeni)", title: "YENİ kesişim: mavi PDO turuncu sinyali yukarı keser, son 5 barda PDO ≤ 30 (referans AL ▲)" },
  { id: "sat", label: "PDO SAT (yeni)", title: "YENİ kesişim: PDO sinyali aşağı keser, son 5 barda PDO ≥ 70 (referans SAT ▼)" },
  { id: "t10_al", label: "T10 AL", title: "T10: AL kesişimi (≤8 mum) + FARKLI mumda alt Bollinger teması (±20 mum, %2)" },
  { id: "t10_sat", label: "T10 SAT", title: "T10: SAT kesişimi (≤8 mum) + farklı mumda alt Bollinger teması (referansla aynı)" },
  { id: "ua", label: "T11 UA", title: "T11: son 4 mumda fiyat/PDO boğa uyumsuzluğu (pivot teyitli veya canlı)" },
  { id: "us", label: "T11 US", title: "T11: son 4 mumda fiyat/PDO ayı uyumsuzluğu" },
  { id: "d2", label: "2D AL", title: "Simetrik ikili dip (pivot teyit mumu)" },
  { id: "d3", label: "3D AL", title: "Simetrik üçlü dip" },
  { id: "t2", label: "2T SAT", title: "Simetrik ikili tepe" },
  { id: "t3", label: "3T SAT", title: "Simetrik üçlü tepe" },
  { id: "touch_dip", label: "Dip teması", title: "Canlı: fiyat son teyitli dip seviyesine değiyor (2D/3D oluşuyor)" },
  { id: "touch_top", label: "Tepe teması", title: "Canlı: fiyat son teyitli tepe seviyesine değiyor (2T/3T)" },
  { id: "x_up", label: "PDO×Sin↑", title: "Bölge şartsız yukarı kesişim" },
  { id: "x_dn", label: "PDO×Sin↓", title: "Bölge şartsız aşağı kesişim" },
  { id: "exit30", label: "PDO 30↑", title: "PDO dip bölgesinden çıkış (30'u yukarı keser)" },
  { id: "exit70", label: "PDO 70↓", title: "PDO tepe bölgesinden çıkış (70'i aşağı keser)" },
  { id: "old_up", label: "Eski PDO↑", title: "ESKİ kesişim: (0,4K+0,6D)·%70 + yapı → EMA5, sinyal = EMA5(PDO); bölge şartı yok, her yukarı kesişim" },
  { id: "old_dn", label: "Eski PDO↓", title: "ESKİ kesişim: her aşağı kesişim (bölge şartsız, EMA5/EMA5)" },
  { id: "zone_low", label: "PDO ≤30", title: "Durum: PDO dip bölgesinde (alarm çalmaz)" },
  { id: "zone_high", label: "PDO ≥70", title: "Durum: PDO tepe bölgesinde (alarm çalmaz)" },
];

const CMO_CHIPS: { id: CmoCond; title: string }[] = [
  { id: "cmo_up_lo", title: "CMO alt seviyeyi (varsayılan −50) yukarı keser: önceki ≤ seviye, şimdiki > seviye" },
  { id: "cmo_dn_hi", title: "CMO üst seviyeyi (varsayılan 75) aşağı keser: önceki ≥ seviye, şimdiki < seviye" },
  { id: "cmo_zero_up", title: "Ek: CMO 0'ı yukarı keser (varsayılan kapalı)" },
  { id: "cmo_zero_dn", title: "Ek: CMO 0'ı aşağı keser (varsayılan kapalı)" },
];

const PLI_DIR_CHIPS: { id: PliDirCond; title: string }[] = [
  { id: "pli_up", title: "Yönlü oran (oran·yön) 0'ı yukarı keser: kanal genişlemesi yukarı yönlü oldu" },
  { id: "pli_dn", title: "Yönlü oran 0'ı aşağı keser: kanal genişlemesi aşağı yönlü oldu" },
  { id: "pli_up_sq", title: "Yükseliş kesişimi + son 5 mumda oran kendi son 50 değerinin alt %25'inde (sıkışma çıkışı) — varsayılan kapalı" },
  { id: "pli_dn_sq", title: "Düşüş kesişimi + son 5 mumda sıkışma (oran alt %25) — varsayılan kapalı" },
];

const PLI_DMI_CHIPS: { id: PliDmiCond; title: string }[] = [
  { id: "comb_top", title: "Kombine T!!: erken T? uyarısı ve ADX tepe çekirdeği ≤ kombine pencere mum arayla (en güçlü)" },
  { id: "comb_bot", title: "Kombine D!!: erken D? uyarısı ve ADX dip çekirdeği ≤ kombine pencere mum arayla (en güçlü)" },
  { id: "core_top", title: "ADX T: ADX zirvesi (≥ ADX min) + DI+ baskın + konum üst uç bölgede → tepe onayı" },
  { id: "core_bot", title: "ADX D: ADX zirvesi + DI− baskın + konum alt uç bölgede → dip onayı" },
  { id: "early_top", title: "Erken T?: PLI± yön 1→−1 döndü, izlenen tepeden salınım ≥ % eşik (yeni tepe gelirse iptal)" },
  { id: "early_bot", title: "Erken D?: PLI± yön −1→1 döndü, izlenen dipten salınım ≥ % eşik (yeni dip gelirse iptal)" },
];

const KIJUN_BB_CHIPS: { id: KijunBbCond; label: string }[] = [
  { id: "px_lower_up", label: "Fiyat alt↑" },
  { id: "px_lower_dn", label: "Fiyat alt↓" },
  { id: "px_upper_up", label: "Fiyat üst↑" },
  { id: "kijun_mid_up", label: "Kijun orta↑" },
  { id: "kijun_mid_dn", label: "Kijun orta↓" },
];


const HAM_AO_CHIPS: { id: HamAoCond; label: string }[] = [
  { id: "rma_up_pt", label: "RMA↑ PT" },
  { id: "ao_up_pt", label: "AO↑ PT" },
  { id: "ao_up_nt", label: "AO↑ NT" },
  { id: "pt_x_nt", label: "PT↑ NT" },
  { id: "nt_x_pt", label: "NT↑ PT" },
];

const GOLD_CHIPS: { id: GoldCond; label: string }[] = [
  { id: "ao_x_score_al", label: "AO↑ Score" },
  { id: "ao_x_rma_al", label: "AO↑ RMA" },
  { id: "ao_x_score_sat", label: "AO↓ Score" },
  { id: "ao_x_rma_sat", label: "AO↓ RMA" },
  { id: "pt_x_nt", label: "PT↑ NT" },
  { id: "nt_x_pt", label: "NT↑ PT" },
  { id: "div_bull", label: "Uyumsuzluk AL" },
  { id: "div_bear", label: "Uyumsuzluk SAT" },
  { id: "div_hid_bull", label: "Gizli AL" },
  { id: "div_hid_bear", label: "Gizli SAT" },
];

const GOLD2_CHIPS: { id: Gold2Cond; label: string }[] = [
  { id: "raw_x_rma_al", label: "Raw↑ RMA AL" },
  { id: "raw_x_rma_sat", label: "Raw↓ RMA SAT" },
  { id: "core_x_rma_al", label: "Core↑ RMA AL" },
  { id: "core_x_rma_sat", label: "Core↓ RMA SAT" },
  { id: "disp_x_rma_al", label: "Disp↑ RMA AL" },
  { id: "disp_x_rma_sat", label: "Disp↓ RMA SAT" },
  { id: "breakout_up_aligned", label: "Kırılım↑ onay" },
  { id: "breakout_down_aligned", label: "Kırılım↓ onay" },
  { id: "breakout_up_counter", label: "Kırılım↑ şüphe" },
  { id: "breakout_down_counter", label: "Kırılım↓ şüphe" },
  { id: "charge_full_bull", label: "Şarj+ doldu" },
  { id: "charge_full_bear", label: "Şarj− doldu" },
  { id: "polarity_flip_up", label: "Kutup↑" },
  { id: "polarity_flip_down", label: "Kutup↓" },
  { id: "div_bull", label: "Uyumsuzluk AL" },
  { id: "div_bear", label: "Uyumsuzluk SAT" },
  { id: "div_hid_bull", label: "Gizli AL" },
  { id: "div_hid_bear", label: "Gizli SAT" },
];


const DIV_OSC_CHIPS: { id: DivOscId; label: string }[] = ALL_DIV_OSC.map((id) => ({
  id,
  label: DIV_OSC_LABEL[id],
}));

const DIV_TYPE_CHIPS: { id: DivTypeId; label: string }[] = ALL_DIV_TYPES.map((id) => ({
  id,
  label: DIV_TYPE_LABEL[id],
}));

const EXTRA_CHIPS: { id: string; label: string; filter: ScannerFilter }[] = [
  { id: "rsi30", label: "RSI<30", filter: { type: "rsi", op: "lt", value: 30 } },
  { id: "rsi70", label: "RSI>70", filter: { type: "rsi", op: "gt", value: 70 } },
  { id: "vol2", label: "Vol×2", filter: { type: "volumeSpike", mult: 2 } },
  { id: "ema_b", label: "EMA↑", filter: { type: "emaCross", direction: "bull" } },
  {
    id: "rsi_div_bull",
    label: "RSI Uyumsuzluk AL",
    filter: {
      type: "rsiPuNu",
      direction: "bull",
      maxBarsAgo: 50,
      rangeLower: 5,
      rangeUpper: 60,
      lbL: 5,
      lbR: 3,
    },
  },
  {
    id: "rsi_div_bear",
    label: "RSI Uyumsuzluk SAT",
    filter: {
      type: "rsiPuNu",
      direction: "bear",
      maxBarsAgo: 50,
      rangeLower: 5,
      rangeUpper: 60,
      lbL: 5,
      lbR: 3,
    },
  },
  {
    id: "rsi_div_hid_bull",
    label: "RSI Gizli AL",
    filter: {
      type: "rsiPuNu",
      direction: "bull",
      divKind: "hidden",
      maxBarsAgo: 50,
      rangeLower: 5,
      rangeUpper: 60,
      lbL: 5,
      lbR: 3,
    },
  },
  {
    id: "rsi_div_hid_bear",
    label: "RSI Gizli SAT",
    filter: {
      type: "rsiPuNu",
      direction: "bear",
      divKind: "hidden",
      maxBarsAgo: 50,
      rangeLower: 5,
      rangeUpper: 60,
      lbL: 5,
      lbR: 3,
    },
  },
];

type UniSrc = "crypto" | "bist" | "sector" | "active";
type UniOpt = { id: string; name: string; symbols: { symbol: string; exchange: Exchange }[] };

function classifyList(w: Watchlist): "crypto" | "bist" {
  if (w.id.startsWith("binance-")) return "crypto";
  if (w.id.startsWith("bist-")) return "bist";
  const bn = w.symbols.filter((s) => s.exchange === "binance").length;
  const bi = w.symbols.filter((s) => s.exchange === "bist").length;
  return bn >= bi ? "crypto" : "bist";
}

function isSectorId(id: string): boolean {
  return id.startsWith("bist-") && id !== "bist-all";
}

/** Canlı exchangeInfo perp evreni (/api/symbols?market=perp) */
type LivePerps = { crypto: string[]; tradfi: string[] };

function cryptoOptions(watchlists: Watchlist[], live: LivePerps | null): UniOpt[] {
  const byId = new Map<string, UniOpt>();
  for (const m of [...binancePerpWatchlistMeta(), ...binanceTradfiWatchlistMeta()]) {
    byId.set(m.id, {
      id: m.id,
      name: m.name,
      symbols: m.symbols.map((symbol) => ({ symbol, exchange: "binance" as const })),
    });
  }
  for (const w of watchlists) {
    if (classifyList(w) !== "crypto") continue;
    const prev = byId.get(w.id);
    if (!prev || w.symbols.length >= prev.symbols.length) {
      byId.set(w.id, { id: w.id, name: w.name, symbols: w.symbols });
    }
  }
  const asOpts = (syms: string[]) => syms.map((symbol) => ({ symbol, exchange: "binance" as const }));
  if (live && live.crypto.length >= 400) {
    byId.set("binance-perp-usdt", { id: "binance-perp-usdt", name: PERP_CRYPTO_NAME, symbols: asOpts(sortPerpsAiFirst(live.crypto)) });
  }
  if (live && live.tradfi.length >= 50) {
    const prev = byId.get("binance-tradfi-usdt");
    byId.set("binance-tradfi-usdt", { id: "binance-tradfi-usdt", name: prev?.name ?? "BN TradFi · Tümü", symbols: asOpts([...live.tradfi].sort()) });
  }
  // Kripto-yalnız liste adı sabit; varsayılan Tümü = kripto ∪ TradFi (canlı/izleme listesi güncel)
  const cryptoOnly = byId.get("binance-perp-usdt");
  if (cryptoOnly) byId.set("binance-perp-usdt", { ...cryptoOnly, name: PERP_CRYPTO_NAME });
  const tfAll = byId.get("binance-tradfi-usdt");
  const seen = new Set<string>();
  const union: UniOpt["symbols"] = [];
  for (const s of [...(cryptoOnly?.symbols ?? []), ...(tfAll?.symbols ?? [])]) {
    if (seen.has(s.symbol)) continue;
    seen.add(s.symbol);
    union.push(s);
  }
  byId.set(PERP_ALL_ID, { id: PERP_ALL_ID, name: PERP_ALL_NAME, symbols: union });
  return [...byId.values()].sort((a, b) =>
    a.id === PERP_ALL_ID ? -1 : b.id === PERP_ALL_ID ? 1 : a.name.localeCompare(b.name, "tr")
  );
}

function bistOptions(watchlists: Watchlist[]): UniOpt[] {
  const byId = new Map<string, UniOpt>();
  for (const m of sectorWatchlistMeta()) {
    if (m.id !== "bist-all") continue;
    byId.set(m.id, {
      id: m.id,
      name: m.name,
      symbols: m.symbols.map((symbol) => ({ symbol, exchange: "bist" as const })),
    });
  }
  for (const w of watchlists) {
    if (classifyList(w) !== "bist" || isSectorId(w.id)) continue;
    const prev = byId.get(w.id);
    if (!prev || w.symbols.length >= prev.symbols.length) {
      byId.set(w.id, { id: w.id, name: w.name, symbols: w.symbols });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

function sectorOptions(): UniOpt[] {
  return sectorWatchlistMeta()
    .filter((m) => m.id !== "bist-all")
    .map((m) => ({
      id: m.id,
      name: m.name,
      symbols: m.symbols.map((symbol) => ({ symbol, exchange: "bist" as const })),
    }));
}

type ResultRow = ListScanHit & {
  symbol: string;
  exchange: Exchange;
};

function toggleIn<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

/** Add id if missing — used when turning a scanner card on via chip. */
function ensureCond<T>(arr: T[], id: T): T[] {
  return arr.includes(id) ? arr : [...arr, id];
}

/** Toggle id but never empty the array (last chip stays selected). */
function toggleCondKeepOne<T>(arr: T[], id: T): T[] {
  if (!arr.includes(id)) return [...arr, id];
  if (arr.length <= 1) return arr;
  return arr.filter((x) => x !== id);
}

function Chip({
  active,
  label,
  onClick,
  title,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      className={clsx(
        "px-1.5 py-0.5 rounded text-2xs border",
        active
          ? "border-desk-accent bg-desk-accent/20 text-desk-accent"
          : "border-desk-border/50 text-desk-muted hover:border-desk-border"
      )}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function NumInput({
  label,
  value,
  onChange,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  hint?: string;
}) {
  return (
    <label
      className="text-2xs text-desk-muted flex flex-col gap-0.5 min-w-0"
      title={hint}
    >
      <span className="truncate">{label}</span>
      <input
        type="number"
        className="input text-2xs py-0.5"
        value={value}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
      <span>{label}</span>
      <input
        type="color"
        className="h-6 w-full cursor-pointer bg-transparent border border-desk-border/40 rounded"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function SectionCard({
  title,
  enabled,
  onToggle,
  open,
  onOpen,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: () => void;
  open: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  // Bring a freshly opened (full-row) card into view inside the scroll area
  // (skip initial mount so the panel doesn't jump on load)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (open) ref.current?.scrollIntoView({ block: "nearest" });
  }, [open]);
  return (
    <div
      ref={ref}
      className={clsx(
        "border border-desk-border/40 rounded min-w-0",
        // Open card spans the full row so its inputs keep usable width
        open && "col-span-full",
        enabled && "border-desk-accent/50"
      )}
    >
      <div className="flex items-center gap-1.5 px-1.5 py-1 bg-desk-elevated/50 min-w-0">
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          className="accent-desk-accent shrink-0"
        />
        <button
          type="button"
          className="flex-1 min-w-0 text-left text-xs font-medium truncate"
          title={title}
          onClick={onOpen}
        >
          {title} {open ? "▾" : "▸"}
        </button>
      </div>
      {open && <div className="p-2 space-y-2 min-w-0">{children}</div>}
    </div>
  );
}

function hamCondToScanKey(cond: string): AlertScanKey | null {
  if (cond === "setup") return "ham_setup";
  if (cond === "confirm") return "ham_confirm";
  if (cond === "al") return "ham_al";
  if (cond === "dual_up") return "ham_dual_up";
  if (cond === "dual_dn") return "ham_dual_dn";
  return null;
}

function diagCondToScanKey(cond: string): AlertScanKey | null {
  if (cond === "bounce") return "diag_bounce";
  if (cond === "break") return "diag_break";
  return null;
}

export function ListScanPanel() {
  const watchlists = useDeskStore((s) => s.watchlists);
  const activeWatchlistId = useDeskStore((s) => s.activeWatchlistId);
  const panes = useDeskStore((s) => s.panes);
  const activePaneId = useDeskStore((s) => s.activePaneId);
  const openSymbolInActive = useDeskStore((s) => s.openSymbolInActive);
  const addIndicator = useDeskStore((s) => s.addIndicator);
  const updateIndicatorParams = useDeskStore((s) => s.updateIndicatorParams);
  const addAlertsBulk = useDeskStore((s) => s.addAlertsBulk);
  const scripts = useDeskStore((s) => s.scripts);
  const upsertScript = useDeskStore((s) => s.upsertScript);
  const applyScriptToActive = useDeskStore((s) => s.applyScriptToActive);

  const pane = panes.find((p) => p.id === activePaneId) ?? panes[0];
  const activeList =
    watchlists.find((w) => w.id === activeWatchlistId) ?? watchlists[0];

  const [uniSrc, setUniSrc] = useState<UniSrc>("crypto");
  const [uniId, setUniId] = useState(PERP_ALL_ID);
  const [livePerps, setLivePerps] = useState<LivePerps | null>(null);
  // Canlı perp evreni (PERPETUAL + TRADIFI_PERPETUAL); sunucu snapshot'a düşer.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/symbols?exchange=binance&market=perp&limit=5000")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { symbols?: { symbol: string; name?: string }[] } | null) => {
        if (cancelled || !j?.symbols?.length) return;
        const crypto: string[] = [];
        const tradfi: string[] = [];
        for (const s of j.symbols) {
          if (!/\.P$/i.test(s.symbol)) continue;
          (s.name === "TRADFI PERP" ? tradfi : crypto).push(s.symbol);
        }
        if (crypto.length >= 400) setLivePerps({ crypto, tradfi });
      })
      .catch(() => {
        /* snapshot */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cryptoOpts = useMemo(() => cryptoOptions(watchlists, livePerps), [watchlists, livePerps]);
  const bistOpts = useMemo(() => bistOptions(watchlists), [watchlists]);
  const sectorOpts = useMemo(() => sectorOptions(), []);
  const uniOpts = useMemo(() => {
    if (uniSrc === "crypto") return cryptoOpts;
    if (uniSrc === "bist") return bistOpts;
    if (uniSrc === "sector") return sectorOpts;
    return [];
  }, [uniSrc, cryptoOpts, bistOpts, sectorOpts]);

  const universe = useMemo(() => {
    if (uniSrc === "active") {
      return {
        id: activeList?.id ?? "active",
        name: activeList?.name ?? "Aktif",
        symbols: activeList?.symbols ?? [],
      } satisfies UniOpt;
    }
    return uniOpts.find((o) => o.id === uniId) ?? uniOpts[0] ?? {
      id: "",
      name: "—",
      symbols: [],
    };
  }, [uniSrc, uniId, uniOpts, activeList]);

  const [tf, setTf] = useState<Timeframe>(
    () => (pane?.timeframe as Timeframe) || "15m"
  );
  const [maxBars, setMaxBars] = useState(2);
  const [matchMode, setMatchMode] = useState<"any" | "all">("any");

  const [hamOn, setHamOn] = useState(true);
  const [diagOn, setDiagOn] = useState(false);
  const [macdOn, setMacdOn] = useState(false);
  const [stochOn, setStochOn] = useState(false);
  const [diOn, setDiOn] = useState(false);
  const [hullOn, setHullOn] = useState(false);
  const [hamAoOn, setHamAoOn] = useState(false);
  const [goldOn, setGoldOn] = useState(false);
  const [gold2On, setGold2On] = useState(false);
  /** Uyumsuzluk — off until user toggles (avoids unexpected lag). */
  const [divScanOn, setDivScanOn] = useState(false);
  /** Multi-Dip + BB — off by default. */
  const [multiDipOn, setMultiDipOn] = useState(false);
  /** BB+RSI Div + LG — off by default. */
  const [bbDivLgOn, setBbDivLgOn] = useState(false);
  const [obFallOn, setObFallOn] = useState(false);
  const [maSimpleOn, setMaSimpleOn] = useState(false);
  const [kijunBbOn, setKijunBbOn] = useState(false);
  const [pdoOn, setPdoOn] = useState(false);
  const [pdoConds, setPdoConds] = useState<PdoCond[]>([...DEFAULT_PDO_CONDS]);
  const [cmoOn, setCmoOn] = useState(false);
  const [cmoConds, setCmoConds] = useState<CmoCond[]>([...DEFAULT_CMO_CONDS]);
  const [cmoLen, setCmoLen] = useState<number>(CMO_DEFAULTS.length);
  const [cmoLo, setCmoLo] = useState<number>(CMO_DEFAULTS.lower);
  const [cmoHi, setCmoHi] = useState<number>(CMO_DEFAULTS.upper);
  const [pliDirOn, setPliDirOn] = useState(false);
  const [pliDirConds, setPliDirConds] = useState<PliDirCond[]>([...DEFAULT_PLI_DIR_CONDS]);
  const [pliLen, setPliLen] = useState<number>(PLI_DIR_DEFAULTS.length);
  const [pliX, setPliX] = useState<number>(PLI_DIR_DEFAULTS.x);
  const [pliK, setPliK] = useState<number>(PLI_DIR_DEFAULTS.k);
  const [pliDmiOn, setPliDmiOn] = useState(false);
  const [pliDmiConds, setPliDmiConds] = useState<PliDmiCond[]>([...DEFAULT_PLI_DMI_CONDS]);
  const [pdLen, setPdLen] = useState<number>(PLI_DMI_DEFAULTS.length);
  const [pdX, setPdX] = useState<number>(PLI_DMI_DEFAULTS.x);
  const [pdK, setPdK] = useState<number>(PLI_DMI_DEFAULTS.k);
  const [pdSw, setPdSw] = useState<number>(PLI_DMI_DEFAULTS.earlySw);
  const [pdWin, setPdWin] = useState<number>(PLI_DMI_DEFAULTS.combWin);
  const [pdAdxMin, setPdAdxMin] = useState<number>(PLI_DMI_DEFAULTS.adxMin);
  const [pdBand, setPdBand] = useState(false);
  const [pdWk, setPdWk] = useState(true);

  const [hamConds, setHamConds] = useState<HamCond[]>(["raw_dual_up"]);
  const [diagConds, setDiagConds] = useState<DiagCond[]>(["bounce"]);
  const [macdConds, setMacdConds] = useState<MacdCond[]>(["cross_up"]);
  const [stochConds, setStochConds] = useState<StochCond[]>(["kx_up_os"]);
  const [diConds, setDiConds] = useState<DiCond[]>(["plus_x_minus"]);
  const [hullConds, setHullConds] = useState<HullCond[]>(["al"]);
  const [hamAoConds, setHamAoConds] = useState<HamAoCond[]>([
    "rma_up_pt",
    "ao_up_pt",
    "pt_x_nt",
  ]);
  const [goldConds, setGoldConds] = useState<GoldCond[]>([
    "ao_x_score_al",
    "ao_x_rma_al",
    "ao_x_score_sat",
    "ao_x_rma_sat",
    "pt_x_nt",
    "nt_x_pt",
  ]);
  const [gold2Conds, setGold2Conds] = useState<Gold2Cond[]>([
    "raw_x_rma_al",
    "raw_x_rma_sat",
    "core_x_rma_al",
    "core_x_rma_sat",
    "disp_x_rma_al",
    "disp_x_rma_sat",
  ]);
  const [divOscs, setDivOscs] = useState<DivOscId[]>([...DEFAULT_DIV_OSC]);
  const [divTypes, setDivTypes] = useState<DivTypeId[]>([...DEFAULT_DIV_TYPES]);
  const [multiDipConds, setMultiDipConds] = useState<MultiDipCond[]>([
    ...DEFAULT_MULTI_DIP_CONDS,
  ]);
  /** Pine default HTF 60 → 1h; scan uses this TF's candles (no security clone). */
  const [multiDipTf, setMultiDipTf] = useState<Timeframe>("1h");
  const [bbDivLgConds, setBbDivLgConds] = useState<BbDivLgCond[]>([
    ...DEFAULT_BB_DIV_LG_CONDS,
  ]);
  const [bbDivLgUseTrend, setBbDivLgUseTrend] = useState(true);
  const [bbDivLgUseAdx, setBbDivLgUseAdx] = useState(true);
  const [obFallConds, setObFallConds] = useState<ObFallCond[]>([
    ...DEFAULT_OB_FALL_CONDS,
  ]);
  const [maSimpleConds, setMaSimpleConds] = useState<MaSimpleCond[]>([
    ...DEFAULT_MA_SIMPLE_CONDS,
  ]);
  const [kijunBbConds, setKijunBbConds] = useState<KijunBbCond[]>([
    ...DEFAULT_KIJUN_BB_CONDS,
  ]);

  const [hamLen, setHamLen] = useState(21);
  const [hamLenSlow, setHamLenSlow] = useState(34);
  const [rawLen, setRawLen] = useState(10);
  const [rawLenSlow, setRawLenSlow] = useState(21);
  const [momSpan, setMomSpan] = useState(10);
  const [normLen, setNormLen] = useState(80);
  const [jLen, setJLen] = useState(20);
  const [jPhase, setJPhase] = useState(0);
  const [postSmooth, setPostSmooth] = useState(5);
  const [colorOsc, setColorOsc] = useState("#18d0bd");
  const [colorSlow, setColorSlow] = useState("#ffb74d");
  const [colorRaw, setColorRaw] = useState("#8b95a8");
  const [colorRawSlow, setColorRawSlow] = useState("#ce93d8");
  const [colorHistUp, setColorHistUp] = useState("#00c878");
  const [colorHistDn, setColorHistDn] = useState("#dc283c");

  const [pivotWindow, setPivotWindow] = useState(6);
  const [historyBars, setHistoryBars] = useState(300);
  const [left, setLeft] = useState(30);
  const [right, setRight] = useState(30);
  const [colorSup, setColorSup] = useState("#7BCB8B");
  const [colorRes, setColorRes] = useState("#ff77ad");

  const [macdFast, setMacdFast] = useState(12);
  const [macdSlow, setMacdSlow] = useState(26);
  const [macdSignal, setMacdSignal] = useState(9);
  const [colorMacd, setColorMacd] = useState("#2962ff");
  const [colorSignal, setColorSignal] = useState("#ff6d00");
  const [colorHist, setColorHist] = useState("#26a69a");

  const [kPeriod, setKPeriod] = useState(14);
  const [dPeriod, setDPeriod] = useState(3);
  const [stochOs, setStochOs] = useState(20);
  const [stochOb, setStochOb] = useState(80);
  const [colorK, setColorK] = useState("#2962ff");
  const [colorD, setColorD] = useState("#ff6d00");

  const [diPeriod, setDiPeriod] = useState(14);
  const [diAdxMin, setDiAdxMin] = useState(25);

  const [hullMode, setHullMode] = useState<"Hma" | "Ehma" | "Thma">("Hma");
  /** Pine tfScan default 240 → 4h; used when Hull is on */
  const [hullTf, setHullTf] = useState<Timeframe>("4h");
  const [colorH8, setColorH8] = useState("#00ff00");
  const [colorH13, setColorH13] = useState("#7cfc00");
  const [colorH21, setColorH21] = useState("#ffff00");
  const [colorH50, setColorH50] = useState("#ff8c00");
  const [colorH100, setColorH100] = useState("#ff0000");
  const [colorH200, setColorH200] = useState("#8b0000");

  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [openCard, setOpenCard] = useState<string | null>("ham");
  const [extraOpen, setExtraOpen] = useState(false);
  const [pineDraft, setPineDraft] = useState(
    '//@version=6\nindicator("Liste Pine", overlay=false)\nplot(ta.rsi(close, 14) - 50, "RSI50")\n'
  );
  const [pineName, setPineName] = useState("Liste Pine");
  const [pineIds, setPineIds] = useState<string[]>([]);

  /**
   * Enable Gold without killing HAM/etc. Only: matchMode=any (so Hepsi can't
   * AND-gate with ham), mutual-exclude Gold2, reset conds to full chip list.
   */
  const enableGold = useCallback(() => {
    setGoldOn(true);
    setGold2On(false);
    setMatchMode("any");
    setGoldConds([...ALL_GOLD_CONDS]);
  }, []);
  const enableGold2 = useCallback(() => {
    setGold2On(true);
    setGoldOn(false);
    setMatchMode("any");
    setGold2Conds([...ALL_GOLD2_CONDS]);
  }, []);
  const enableDivScan = useCallback(() => {
    setDivScanOn(true);
    setMatchMode("any");
    setDivOscs([...DEFAULT_DIV_OSC]);
    setDivTypes([...DEFAULT_DIV_TYPES]);
    // User "en az 50 mum geriyi kontrol et" = lookback (maxBars), not pivot rangeLower
    setMaxBars((m) => (m < 50 ? 50 : m));
  }, []);
  const enableMultiDip = useCallback(() => {
    setMultiDipOn(true);
    setMatchMode("any");
    setMultiDipConds([...ALL_MULTI_DIP_CONDS]);
  }, []);
  const enableBbDivLg = useCallback(() => {
    setBbDivLgOn(true);
    setMatchMode("any");
    setBbDivLgConds([...ALL_BB_DIV_LG_CONDS]);
  }, []);
  const enableObFall = useCallback(() => {
    setObFallOn(true);
    setMatchMode("any");
    setObFallConds([...ALL_OB_FALL_CONDS]);
  }, []);
  const enableMaSimple = useCallback(() => {
    setMaSimpleOn(true);
    setMatchMode("any");
    setMaSimpleConds([...DEFAULT_MA_SIMPLE_CONDS]);
  }, []);
  const enablePdo = useCallback(() => {
    setPdoOn(true);
    setMatchMode("any");
    setPdoConds([...DEFAULT_PDO_CONDS]);
  }, []);
  const enableCmo = useCallback(() => {
    setCmoOn(true);
    setMatchMode("any");
    setCmoConds([...DEFAULT_CMO_CONDS]);
  }, []);
  const enablePliDir = useCallback(() => {
    setPliDirOn(true);
    setMatchMode("any");
    setPliDirConds([...DEFAULT_PLI_DIR_CONDS]);
  }, []);
  const enablePliDmi = useCallback(() => {
    setPliDmiOn(true);
    setMatchMode("any");
    setPliDmiConds([...DEFAULT_PLI_DMI_CONDS]);
  }, []);
  const enableKijunBb = useCallback(() => {
    setKijunBbOn(true);
    setMatchMode("any");
    setKijunBbConds([...DEFAULT_KIJUN_BB_CONDS]);
  }, []);

  /** If enabling a kind while another is already on → force Herhangi (any). */
  const bumpMatchModeOnSecondKind = useCallback(
    (alreadyOn: boolean, otherOns: boolean[]) => {
      if (!alreadyOn && otherOns.some(Boolean)) setMatchMode("any");
    },
    []
  );
  const [pineConds, setPineConds] = useState<PineCond[]>(["zero_up", "cross_up"]);
  const [pineStatus, setPineStatus] = useState("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [status, setStatus] = useState("");
  const [hits, setHits] = useState<ResultRow[]>([]);

  const buildConfig = useCallback((): ListScanConfig => {
    return {
      matchMode,
      ham: {
        enabled: hamOn,
        conds: hamConds,
        hamLen,
        hamLenSlow,
        rawLen,
        rawLenSlow,
        momSpan,
        normLen,
        jLen,
        jPhase,
        postSmooth,
        colorOsc,
        colorSlow,
        colorRaw,
        colorRawSlow,
        colorHistUp,
        colorHistDn,
      },
      diag: {
        enabled: diagOn,
        conds: diagConds,
        pivotWindow,
        historyBars,
        left,
        right,
        colorSup,
        colorRes,
      },
      macd: {
        enabled: macdOn,
        conds: macdConds,
        fast: macdFast,
        slow: macdSlow,
        signal: macdSignal,
        colorMacd,
        colorSignal,
        colorHist,
      },
      stoch: {
        enabled: stochOn,
        conds: stochConds,
        kPeriod,
        dPeriod,
        os: stochOs,
        ob: stochOb,
        colorK,
        colorD,
      },
      di: {
        enabled: diOn,
        conds: diConds,
        period: diPeriod,
        adxMin: diAdxMin,
      },
      hull: {
        enabled: hullOn,
        conds: hullConds,
        mode: hullMode,
        tf: hullTf,
        color8: colorH8,
        color13: colorH13,
        color21: colorH21,
        color50: colorH50,
        color100: colorH100,
        color200: colorH200,
      },
      hamAo: {
        enabled: hamAoOn,
        conds: hamAoConds,
      },
      gold: {
        enabled: goldOn,
        conds: goldConds,
      },
      gold2: {
        enabled: gold2On,
        conds: gold2Conds,
      },
      divScan: {
        enabled: divScanOn,
        oscillators: divOscs,
        types: divTypes,
      },
      multiDip: {
        enabled: multiDipOn,
        conds: multiDipConds,
        tf: multiDipTf,
      },
      bbDivLg: {
        enabled: bbDivLgOn,
        conds: bbDivLgConds,
        useTrend: bbDivLgUseTrend,
        useADX: bbDivLgUseAdx,
      },
      obFall: {
        enabled: obFallOn,
        conds: obFallConds,
      },
      maSimple: {
        enabled: maSimpleOn,
        conds: maSimpleConds,
      },
      pdo: {
        enabled: pdoOn,
        conds: pdoConds,
        crossMode: "kd",
      },
      cmo: {
        enabled: cmoOn,
        conds: cmoConds,
        length: Math.max(1, Math.round(Number(cmoLen) || CMO_DEFAULTS.length)),
        lower: Number.isFinite(cmoLo) ? cmoLo : CMO_DEFAULTS.lower,
        upper: Number.isFinite(cmoHi) ? cmoHi : CMO_DEFAULTS.upper,
      },
      pliDir: {
        enabled: pliDirOn,
        conds: pliDirConds,
        length: Math.max(2, Math.round(Number(pliLen) || PLI_DIR_DEFAULTS.length)),
        x: Number.isFinite(pliX) && pliX > 0 && pliX < 50 ? pliX : PLI_DIR_DEFAULTS.x,
        k: Math.max(0, Math.round(Number.isFinite(pliK) ? pliK : PLI_DIR_DEFAULTS.k)),
      },
      pliDmi: {
        enabled: pliDmiOn,
        conds: pliDmiConds,
        length: Math.max(2, Math.round(Number(pdLen) || PLI_DMI_DEFAULTS.length)),
        x: Number.isFinite(pdX) && pdX >= 0.5 && pdX <= 40 ? pdX : PLI_DMI_DEFAULTS.x,
        k: Math.max(1, Math.round(Number(pdK) || PLI_DMI_DEFAULTS.k)),
        earlySw: Number.isFinite(pdSw) && pdSw >= 0 ? pdSw : PLI_DMI_DEFAULTS.earlySw,
        combWin: Math.max(0, Math.round(Number.isFinite(pdWin) ? pdWin : PLI_DMI_DEFAULTS.combWin)),
        adxMin: Number.isFinite(pdAdxMin) ? pdAdxMin : PLI_DMI_DEFAULTS.adxMin,
        dmSrc: pdBand ? "band" : "price",
        useWk: pdWk,
      },
      kijunBb: {
        enabled: kijunBbOn,
        conds: kijunBbConds,
        basePeriods: 26,
        bbLength: 24,
        bbStdDev: 2,
      },
      extraFilters: EXTRA_CHIPS.filter((c) => extraIds.includes(c.id)).map(
        (c) => c.filter
      ),
      pine: {
        enabled: pineIds.length > 0,
        scripts: scripts
          .filter((s) => pineIds.includes(s.id))
          .map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
            language: s.language,
            conds: pineConds,
          })),
      },
    };
  }, [
    matchMode,
    hamOn,
    hamConds,
    hamLen,
    hamLenSlow,
    rawLen,
    rawLenSlow,
    momSpan,
    normLen,
    jLen,
    jPhase,
    postSmooth,
    colorOsc,
    colorSlow,
    colorRaw,
    colorRawSlow,
    colorHistUp,
    colorHistDn,
    diagOn,
    diagConds,
    pivotWindow,
    historyBars,
    left,
    right,
    colorSup,
    colorRes,
    macdOn,
    macdConds,
    macdFast,
    macdSlow,
    macdSignal,
    colorMacd,
    colorSignal,
    colorHist,
    stochOn,
    stochConds,
    kPeriod,
    dPeriod,
    stochOs,
    stochOb,
    colorK,
    colorD,
    diOn,
    diConds,
    diPeriod,
    diAdxMin,
    hullOn,
    hullConds,
    hullMode,
    hullTf,
    hamAoOn,
    hamAoConds,
    goldOn,
    goldConds,
    gold2On,
    gold2Conds,
    divScanOn,
    divOscs,
    divTypes,
    multiDipOn,
    multiDipConds,
    multiDipTf,
    bbDivLgOn,
    bbDivLgConds,
    bbDivLgUseTrend,
    bbDivLgUseAdx,
    obFallOn,
    obFallConds,
    maSimpleOn,
    maSimpleConds,
    kijunBbOn,
    kijunBbConds,
    pdoOn,
    pdoConds,
    cmoOn,
    cmoConds,
    cmoLen,
    cmoLo,
    cmoHi,
    pliDirOn,
    pliDirConds,
    pliLen,
    pliX,
    pliK,
    pliDmiOn,
    pliDmiConds,
    pdLen,
    pdX,
    pdK,
    pdSw,
    pdWin,
    pdAdxMin,
    pdBand,
    pdWk,
    colorH8,
    colorH13,
    colorH21,
    colorH50,
    colorH100,
    colorH200,
    extraIds,
    pineIds,
    pineConds,
    scripts,
  ]);

  const abortRef = useRef<AbortController | null>(null);

  const stopScan = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const runScan = useCallback(async () => {
    if (!universe.symbols.length) {
      setStatus("Liste boş — kripto / BIST / sektör seç");
      return;
    }
    const cfg = buildConfig();
    if (!cfg.ham?.enabled && !cfg.diag?.enabled && !cfg.macd?.enabled && !cfg.stoch?.enabled && !cfg.di?.enabled && !cfg.hull?.enabled && !cfg.hamAo?.enabled && !cfg.gold?.enabled && !cfg.gold2?.enabled && !cfg.divScan?.enabled && !cfg.multiDip?.enabled && !cfg.bbDivLg?.enabled && !cfg.obFall?.enabled && !cfg.maSimple?.enabled && !cfg.kijunBb?.enabled && !cfg.pdo?.enabled && !cfg.cmo?.enabled && !cfg.pliDir?.enabled && !cfg.pliDmi?.enabled && !cfg.pine?.enabled) {
      setStatus("En az bir gösterge seçin");
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setRunning(true);
    setHits([]);
    setStatus("");
    const total = universe.symbols.length;
    setProgress(`0/${total}`);

    const extrasNeedTicker = (cfg.extraFilters ?? []).some(
      (f) => f.type === "volumeSpike" || f.type === "changePct"
    );

    try {
      let quotes: TickerQuote[] = universe.symbols.map((s) => ({
        symbol: s.symbol,
        exchange: s.exchange,
        last: 0,
        changePct: 0,
      }));
      if (extrasNeedTicker) {
        setProgress(`kotasyon 0/${total}`);
        try {
          const ticked = await fetchWatchlistQuotes(universe.symbols);
          if (ticked.length) quotes = ticked;
        } catch {
          /* kline taramasına devam */
        }
        if (ac.signal.aborted) throw new DOMException("Aborted", "AbortError");
      }

      const out: ResultRow[] = [];
      let done = 0;
      let lastProgressAt = 0;
      const isBist = universe.symbols[0]?.exchange === "bist";
      const concurrency = isBist ? 3 : total > 200 ? 6 : 8;
      const klineMs = isBist ? 6000 : 10000;
      await mapPool(
        quotes,
        concurrency,
        async (q) => {
          if (ac.signal.aborted) return null;
          try {
            const fetchSignal =
              typeof AbortSignal !== "undefined" &&
              typeof AbortSignal.any === "function" &&
              typeof AbortSignal.timeout === "function"
                ? AbortSignal.any([ac.signal, AbortSignal.timeout(klineMs)])
                : ac.signal;
            const useHull = !!cfg.hull?.enabled;
            const useGold = !!cfg.gold?.enabled;
            const useGold2 = !!cfg.gold2?.enabled;
            const useHamAo = !!cfg.hamAo?.enabled;
            const useDivScan = !!cfg.divScan?.enabled;
            const useMultiDip = !!cfg.multiDip?.enabled;
            const useBbDivLg = !!cfg.bbDivLg?.enabled;
            const useObFall = !!cfg.obFall?.enabled;
            const useMaSimple = !!cfg.maSimple?.enabled;
            const useKijunBb = !!cfg.kijunBb?.enabled;
            const usePdo = !!cfg.pdo?.enabled;
            const useCmo = !!cfg.cmo?.enabled;
            const usePliDir = !!cfg.pliDir?.enabled;
            const usePliDmi = !!cfg.pliDmi?.enabled;
            const scanTf = useHull && cfg.hull?.tf
              ? String(cfg.hull.tf)
              : useMultiDip && cfg.multiDip?.tf
                ? String(cfg.multiDip.tf)
                : tf;
            // Warmup via klineLimit/minBars; edge lookback stays UI maxBars (default 2)
            const klineLimit = useHull
              ? DOKTOR_HULL_FETCH_LIMIT
              : useGold2
                ? GOLD_KEKO_FETCH_LIMIT
                : useGold || useHamAo
                  ? 260
                  : useDivScan
                    ? DIV_SCAN_FETCH_LIMIT
                    : useMultiDip
                      ? MULTI_DIP_FETCH_LIMIT
                      : useBbDivLg
                        ? BB_DIV_LG_FETCH_LIMIT
                        : useObFall
                          ? OB_FALL_FETCH_LIMIT
                          : useMaSimple
                            ? MA_SIMPLE_FETCH_LIMIT
                            : useKijunBb
                              ? KIJUN_BB_FETCH_LIMIT
                              : usePdo
                                ? PDO_FETCH_LIMIT
                                : useCmo
                                  ? CMO_FETCH_LIMIT
                                  : usePliDir
                                    ? PLI_DIR_FETCH_LIMIT
                                    : usePliDmi
                                      ? PLI_DMI_FETCH_LIMIT
                                      : 220;
            const minBars = useHull
              ? DOKTOR_HULL_MIN_BARS
              : useGold2
                ? GOLD_KEKO_MIN_BARS
                : useGold
                  ? AOHAM_JRMA_MIN_BARS
                  : useHamAo
                    ? HAM_AO_JRMA_Z_MIN_BARS
                    : useDivScan
                      ? DIV_SCAN_MIN_BARS
                      : useMultiDip
                        ? MULTI_DIP_MIN_BARS
                        : useBbDivLg
                          ? BB_DIV_LG_MIN_BARS
                          : useObFall
                            ? OB_FALL_MIN_BARS
                            : useMaSimple
                              ? MA_SIMPLE_MIN_BARS
                              : useKijunBb
                                ? KIJUN_BB_MIN_BARS
                                : usePdo
                                  ? PDO_MIN_BARS
                                  : useCmo
                                    ? CMO_MIN_BARS
                                    : usePliDir
                                      ? PLI_DIR_MIN_BARS
                                      : usePliDmi
                                        ? PLI_DMI_MIN_BARS
                                        : 50;
            const kr = await fetch(
              `/api/klines?symbol=${encodeURIComponent(q.symbol)}&exchange=${q.exchange}&timeframe=${encodeURIComponent(scanTf)}&limit=${klineLimit}`,
              { signal: fetchSignal }
            );
            const kj = await kr.json();
            const candles: Candle[] = kj.candles ?? [];
            if (candles.length < minBars) return null;
            let found = scanSymbol(candles, cfg, maxBars);
            if (found.length && cfg.extraFilters?.length) {
              const m = matchFilters(q, candles, cfg.extraFilters);
              if (!m.ok) found = [];
              else {
                found = found.map((h) => ({
                  ...h,
                  note: m.note ? `${h.note} · ${m.note}` : h.note,
                }));
              }
            }
            for (const h of found) {
              out.push({ ...h, symbol: q.symbol, exchange: q.exchange });
            }
          } catch (e) {
            if (ac.signal.aborted) return null;
            /* skip timeout / 502 */
          } finally {
            done += 1;
            const now = performance.now();
            if (
              done === total ||
              done % 20 === 0 ||
              now - lastProgressAt >= 150
            ) {
              lastProgressAt = now;
              setProgress(`${done}/${total} ${q.symbol}`);
            }
            if (done % 30 === 0 || done === total) {
              setHits(
                [...out].sort(
                  (a, b) =>
                    a.barsAgo - b.barsAgo ||
                    a.symbol.localeCompare(b.symbol) ||
                    a.kind.localeCompare(b.kind)
                )
              );
            }
          }
          return null;
        },
        undefined,
        ac.signal
      );
      out.sort(
        (a, b) =>
          a.barsAgo - b.barsAgo ||
          a.symbol.localeCompare(b.symbol) ||
          a.kind.localeCompare(b.kind)
      );
      setHits(out);
      const cfgDone = buildConfig();
      const byKind: string[] = [];
      if (cfgDone.gold?.enabled) {
        const n = out.filter((h) => h.kind === "gold").length;
        byKind.push(`gold ${n}`);
      }
      if (cfgDone.gold2?.enabled) {
        const n = out.filter((h) => h.kind === "gold2").length;
        byKind.push(`gold2 ${n}`);
      }
      if (cfgDone.divScan?.enabled) {
        const n = out.filter((h) => h.kind === "divScan").length;
        byKind.push(`uyum ${n}`);
      }
      if (cfgDone.multiDip?.enabled) {
        const n = out.filter((h) => h.kind === "multiDip").length;
        byKind.push(`dip ${n}`);
      }
      if (cfgDone.bbDivLg?.enabled) {
        const n = out.filter((h) => h.kind === "bbDivLg").length;
        byKind.push(`bbLG ${n}`);
      }
      if (cfgDone.obFall?.enabled) {
        const n = out.filter((h) => h.kind === "obFall").length;
        byKind.push(`obFall ${n}`);
      }
      if (cfgDone.maSimple?.enabled) {
        const n = out.filter((h) => h.kind === "maSimple").length;
        byKind.push(`maSimple ${n}`);
      }
      if (cfgDone.kijunBb?.enabled) {
        const n = out.filter((h) => h.kind === "kijunBb").length;
        byKind.push(`kijunBb ${n}`);
      }
      if (cfgDone.pdo?.enabled) {
        const n = out.filter((h) => h.kind === "pdo").length;
        byKind.push(`pdo ${n}`);
      }
      if (cfgDone.cmo?.enabled) {
        const n = out.filter((h) => h.kind === "cmo").length;
        byKind.push(`cmo ${n}`);
      }
      if (cfgDone.pliDir?.enabled) {
        const n = out.filter((h) => h.kind === "pliDir").length;
        byKind.push(`pliDir ${n}`);
      }
      if (cfgDone.pliDmi?.enabled) {
        const n = out.filter((h) => h.kind === "pliDmi").length;
        byKind.push(`pliDmi ${n}`);
      }
      if (cfgDone.ham?.enabled) {
        const n = out.filter((h) => h.kind === "ham").length;
        byKind.push(`ham ${n}`);
      }
      const kindBit = byKind.length ? ` · ${byKind.join(" · ")}` : "";
      const enabledKindsCount = [
        cfgDone.ham?.enabled,
        cfgDone.diag?.enabled,
        cfgDone.macd?.enabled,
        cfgDone.stoch?.enabled,
        cfgDone.di?.enabled,
        cfgDone.hull?.enabled,
        cfgDone.hamAo?.enabled,
        cfgDone.gold?.enabled,
        cfgDone.gold2?.enabled,
        cfgDone.divScan?.enabled,
        cfgDone.multiDip?.enabled,
        cfgDone.bbDivLg?.enabled,
        cfgDone.obFall?.enabled,
        cfgDone.maSimple?.enabled,
        cfgDone.kijunBb?.enabled,
        cfgDone.pdo?.enabled,
        cfgDone.cmo?.enabled,
        cfgDone.pliDir?.enabled,
        cfgDone.pliDmi?.enabled,
        cfgDone.pine?.enabled,
      ].filter(Boolean).length;
      const hepsiWarn =
        matchMode === "all" && enabledKindsCount > 1
          ? " · Uyarı: Hepsi = aynı sembolde tüm göstergeler"
          : "";
      setStatus(
        ac.signal.aborted
          ? `Durdu · ${out.length} hit${kindBit} · ${done}/${total}${hepsiWarn}`
          : `${out.length} hit${kindBit} · ${universe.name} · ${total} · ${tf} · ≤${maxBars} bar · ${matchMode === "all" ? "Hepsi" : "Herhangi"}${hepsiWarn}`
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setStatus("Durduruldu");
      } else {
        setStatus(e instanceof Error ? e.message : "tarama hatası");
      }
    } finally {
      setRunning(false);
    }
  }, [universe, buildConfig, tf, maxBars, matchMode]);

  const upsertIndicators = useCallback(
    (cfg: ListScanConfig) => {
      // Always read fresh pane from store (avoid stale closure after symbol open)
      const st = useDeskStore.getState();
      const paneId = st.activePaneId || pane?.id;
      const live =
        st.panes.find((p) => p.id === paneId) ??
        st.panes[0] ??
        pane;
      if (!live) return;
      const kinds: Exclude<ListScanKind, "pine">[] = [];
      if (cfg.ham?.enabled) kinds.push("ham");
      if (cfg.diag?.enabled) kinds.push("diag");
      if (cfg.macd?.enabled) kinds.push("macd");
      if (cfg.stoch?.enabled) kinds.push("stoch");
      if (cfg.di?.enabled) kinds.push("di");
      if (cfg.hull?.enabled) kinds.push("hull");
      if (cfg.hamAo?.enabled) kinds.push("hamAo");
      if (cfg.gold?.enabled) kinds.push("gold");
      if (cfg.gold2?.enabled) kinds.push("gold2");
      if (cfg.divScan?.enabled) kinds.push("divScan");
      if (cfg.multiDip?.enabled) kinds.push("multiDip");
      if (cfg.bbDivLg?.enabled) kinds.push("bbDivLg");
      if (cfg.obFall?.enabled) kinds.push("obFall");
      if (cfg.maSimple?.enabled) kinds.push("maSimple");
      if (cfg.kijunBb?.enabled) kinds.push("kijunBb");
      if (cfg.pdo?.enabled) kinds.push("pdo");
      if (cfg.cmo?.enabled) kinds.push("cmo");
      if (cfg.pliDir?.enabled) kinds.push("pliDir");
      if (cfg.pliDmi?.enabled) kinds.push("pliDmi");
      for (const kind of kinds) {
        let type: BuiltinIndicatorId = KIND_TO_INDICATOR[kind];
        if (kind === "divScan" && cfg.divScan) {
          const oscs = cfg.divScan.oscillators.length
            ? cfg.divScan.oscillators
            : DEFAULT_DIV_OSC;
          const prefer =
            oscs.find((o) => o === "rsi") ?? oscs[0] ?? "rsi";
          type = (DIV_OSC_TO_INDICATOR[prefer] ??
            "rsiPuNu") as BuiltinIndicatorId;
        }
        const params = indicatorParamsFromConfig(kind, cfg);
        // Force S/R lines on for Multi-Dip chart
        if (type === "multiDipBb") {
          params.showSr = 1;
          params.showMarkers = params.showMarkers ?? 1;
        }
        const existing = live.indicators.find((i) => i.type === type);
        if (existing) {
          updateIndicatorParams(live.id, existing.id, params);
        } else {
          addIndicator(live.id, type);
          const fresh = useDeskStore
            .getState()
            .panes.find((p) => p.id === live.id);
          const added = fresh?.indicators
            .slice()
            .reverse()
            .find((i) => i.type === type);
          if (added) updateIndicatorParams(live.id, added.id, params);
        }
      }
      for (const sc of cfg.pine?.scripts ?? []) {
        const has = live.indicators.some((i) => i.scriptId === sc.id);
        if (!has) applyScriptToActive(sc.id);
      }
    },
    [pane, addIndicator, updateIndicatorParams, applyScriptToActive]
  );

  useEffect(() => {
    if (!hamOn && !diagOn && !macdOn && !stochOn && !diOn && !hullOn && !hamAoOn && !goldOn && !gold2On && !divScanOn && !multiDipOn && !bbDivLgOn && !obFallOn && !maSimpleOn && !kijunBbOn && !pdoOn && !cmoOn && !pliDirOn && !pliDmiOn && !pineIds.length) return;
    upsertIndicators(buildConfig());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn, pineIds.join("|"), pane?.id]);

  const onHitClick = useCallback(
    (row: ResultRow) => {
      const cfg = buildConfig();
      const openTf =
        row.kind === "hull" && cfg.hull?.tf
          ? (cfg.hull.tf as Timeframe)
          : row.kind === "multiDip" && cfg.multiDip?.tf
            ? (cfg.multiDip.tf as Timeframe)
            : tf;
      openSymbolInActive(row.symbol, row.exchange, openTf);
      // slight delay so pane symbol updates first
      setTimeout(() => {
        // Ensure Multi-Dip is enabled in cfg when this hit is multiDip
        if (row.kind === "multiDip" && cfg.multiDip) {
          cfg.multiDip = { ...cfg.multiDip, enabled: true };
        }
        upsertIndicators(cfg);
        if (row.kind === "multiDip") {
          const st = useDeskStore.getState();
          const live =
            st.panes.find((p) => p.id === st.activePaneId) ?? st.panes[0];
          if (live) {
            const type = "multiDipBb" as BuiltinIndicatorId;
            const params = {
              ...indicatorParamsFromConfig("multiDip", cfg),
              showSr: 1,
              showMarkers: 1,
            };
            const existing = live.indicators.find((i) => i.type === type);
            if (existing) {
              updateIndicatorParams(live.id, existing.id, params);
            } else {
              addIndicator(live.id, type);
              const fresh = useDeskStore
                .getState()
                .panes.find((p) => p.id === live.id);
              const added = fresh?.indicators
                .slice()
                .reverse()
                .find((i) => i.type === type);
              if (added) updateIndicatorParams(live.id, added.id, params);
            }
          }
        }
        if (row.kind === "divScan" && pane) {
          const oscId = row.cond.split("|")[0] as DivOscId;
          const type = (DIV_OSC_TO_INDICATOR[oscId] ??
            "rsiPuNu") as BuiltinIndicatorId;
          const existing = pane.indicators.find((i) => i.type === type);
          if (!existing) {
            addIndicator(pane.id, type);
          }
        }
      }, 0);
    },
    [
      buildConfig,
      openSymbolInActive,
      tf,
      upsertIndicators,
      pane,
      addIndicator,
      updateIndicatorParams,
    ]
  );

  const armListAlerts = useCallback(() => {
    if (!universe.symbols.length) {
      setStatus("Liste boş");
      return;
    }
    const cfg = buildConfig();
    if (!cfg.ham?.enabled && !cfg.diag?.enabled && !cfg.macd?.enabled && !cfg.stoch?.enabled && !cfg.di?.enabled && !cfg.hull?.enabled && !cfg.hamAo?.enabled && !cfg.gold?.enabled && !cfg.gold2?.enabled && !cfg.divScan?.enabled && !cfg.multiDip?.enabled && !cfg.bbDivLg?.enabled && !cfg.obFall?.enabled && !cfg.maSimple?.enabled && !cfg.kijunBb?.enabled && !cfg.pdo?.enabled && !cfg.cmo?.enabled && !cfg.pliDir?.enabled && !cfg.pliDmi?.enabled && !cfg.pine?.enabled) {
      setStatus("En az bir gösterge seçin");
      return;
    }
    const botReady = !!useDeskStore.getState().botSettings.enabled;
    const alertTf =
      cfg.hull?.enabled && cfg.hull.tf
        ? (cfg.hull.tf as Timeframe)
        : cfg.multiDip?.enabled && cfg.multiDip.tf
          ? (cfg.multiDip.tf as Timeframe)
          : tf;
    const items = universe.symbols.map((s) => ({
      symbol: s.symbol,
      exchange: s.exchange,
      condition: "cross_above" as const,
      price: 0,
      kind: "scan" as const,
      scanKey: "list_scan" as const,
      scanPayload: cfg as unknown as Record<string, unknown>,
      group: "Liste",
      note: `${universe.name} · liste koşulu`,
      timeframe: alertTf,
      repeat: "repeat" as const,
      cooldownMin: 60,
      intervalMin: 15,
      expiresAt: Date.now() + 24 * 3600_000,
      botReady,
      scanPrimed: false,
    }));
    const n = addAlertsBulk(items);
    setStatus(
      `${n} izleme · mevcut sinyal çalmaz · ${universe.name} · bot ${botReady ? "açık" : "kapalı"}`
    );
  }, [universe, buildConfig, addAlertsBulk, tf]);

  const bulkAlerts = useCallback(async () => {
    if (!hits.length) {
      setStatus("Önce Listeyi tara");
      return;
    }
    const cfg = buildConfig();
    const items: Parameters<typeof addAlertsBulk>[0] = [];
    const byEx = new Map<Exchange, string[]>();
    const scanCandidates: ResultRow[] = [];

    for (const h of hits) {
      let scanKey: AlertScanKey | null = null;
      if (h.kind === "ham") scanKey = hamCondToScanKey(h.cond);
      if (h.kind === "diag") scanKey = diagCondToScanKey(h.cond);
      if (h.kind === "di") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "DI",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            di: {
              enabled: true,
              conds: [h.cond],
              period: cfg.di?.period ?? 14,
              adxMin: cfg.di?.adxMin ?? 25,
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "hull") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "Hull",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            hull: {
              enabled: true,
              conds: [h.cond],
              mode: cfg.hull?.mode ?? "Hma",
              tf: cfg.hull?.tf ?? hullTf,
            },
          },
          timeframe: (cfg.hull?.tf as Timeframe) || hullTf || tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "hamAo") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "HAM+AO",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            hamAo: {
              enabled: true,
              conds: [h.cond as HamAoCond],
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "gold") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "Gold",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            gold: {
              enabled: true,
              conds: [h.cond as GoldCond],
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "gold2") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "Gold2",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            gold2: {
              enabled: true,
              conds: [h.cond as Gold2Cond],
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "multiDip") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "Dip+BB",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            multiDip: {
              enabled: true,
              conds: [h.cond as MultiDipCond],
              tf: cfg.multiDip?.tf ?? multiDipTf,
            },
          },
          timeframe: (cfg.multiDip?.tf as Timeframe) || multiDipTf || tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "bbDivLg") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "BB+LG",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            bbDivLg: {
              enabled: true,
              conds: [h.cond as BbDivLgCond],
              useTrend: cfg.bbDivLg?.useTrend ?? bbDivLgUseTrend,
              useADX: cfg.bbDivLg?.useADX ?? bbDivLgUseAdx,
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "obFall") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "OB+Düşen",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            obFall: {
              enabled: true,
              conds: [h.cond as ObFallCond],
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "maSimple") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "MA Basit",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            maSimple: {
              enabled: true,
              conds: [h.cond as MaSimpleCond],
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "pdo") {
        if (h.cond === "zone_low" || h.cond === "zone_high") continue;
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "PDO",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            pdo: {
              enabled: true,
              conds: [h.cond as PdoCond],
              crossMode: "kd",
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "pliDmi") {
        const c = cfg.pliDmi;
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "PLI-DMI",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            pliDmi: {
              enabled: true,
              conds: [h.cond as PliDmiCond],
              length: c?.length ?? PLI_DMI_DEFAULTS.length,
              x: c?.x ?? PLI_DMI_DEFAULTS.x,
              k: c?.k ?? PLI_DMI_DEFAULTS.k,
              earlySw: c?.earlySw ?? PLI_DMI_DEFAULTS.earlySw,
              combWin: c?.combWin ?? PLI_DMI_DEFAULTS.combWin,
              adxMin: c?.adxMin ?? PLI_DMI_DEFAULTS.adxMin,
              dmSrc: c?.dmSrc ?? "price",
              useWk: c?.useWk ?? true,
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "pliDir") {
        const c = cfg.pliDir;
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "PLI±",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            pliDir: {
              enabled: true,
              conds: [h.cond as PliDirCond],
              length: c?.length ?? PLI_DIR_DEFAULTS.length,
              x: c?.x ?? PLI_DIR_DEFAULTS.x,
              k: c?.k ?? PLI_DIR_DEFAULTS.k,
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "cmo") {
        const c = cfg.cmo;
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "CMO",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            cmo: {
              enabled: true,
              conds: [h.cond as CmoCond],
              length: c?.length ?? CMO_DEFAULTS.length,
              lower: c?.lower ?? CMO_DEFAULTS.lower,
              upper: c?.upper ?? CMO_DEFAULTS.upper,
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "kijunBb") {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "Kijun+BB",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            kijunBb: {
              enabled: true,
              conds: [h.cond as KijunBbCond],
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (h.kind === "divScan") {
        const [oscRaw, typeRaw] = h.cond.split("|");
        const osc = (oscRaw ?? "rsi") as DivOscId;
        const divType = (typeRaw ?? "reg_bull") as DivTypeId;
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: "Uyumsuzluk",
          scanKey: "list_scan",
          scanPayload: {
            matchMode: "any",
            divScan: {
              enabled: true,
              oscillators: [osc],
              types: [divType],
            },
          },
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
          scanPrimed: false,
        });
        continue;
      }
      if (scanKey) {
        items.push({
          symbol: h.symbol,
          exchange: h.exchange,
          condition: "cross_above",
          price: 0,
          note: h.note,
          kind: "scan",
          group: h.kind === "ham" ? "HAM" : "Diag",
          scanKey,
          timeframe: tf,
          repeat: "once",
          expiresAt: Date.now() + 24 * 3600_000,
          intervalMin: 15,
        });
      } else {
        scanCandidates.push(h);
        const arr = byEx.get(h.exchange) ?? [];
        if (!arr.includes(h.symbol)) arr.push(h.symbol);
        byEx.set(h.exchange, arr);
      }
    }

    for (const [ex, syms] of byEx) {
      try {
        const res = await fetch(
          `/api/ticker?exchange=${ex}&symbols=${syms.join(",")}`
        );
        const json = await res.json();
        const by = new Map<string, number>();
        for (const q of json.quotes ?? []) {
          if (q?.symbol && Number.isFinite(q.last))
            by.set(q.symbol, Number(q.last));
        }
        for (const sym of syms) {
          const last = by.get(sym);
          if (last == null) continue;
          const hit = scanCandidates.find((h) => h.symbol === sym);
          items.push({
            symbol: sym,
            exchange: ex,
            condition: "cross_above",
            price: Number((last * 1.03).toFixed(4)),
            note: hit?.note ? `${hit.note} +%3` : "liste tarama +%3",
            lastPrice: last,
            kind: "price",
            group: "Liste",
            repeat: "once",
            expiresAt: Date.now() + 24 * 3600_000,
          });
        }
      } catch {
        /* skip */
      }
    }

    const n = addAlertsBulk(items);
    setStatus(`${n} alarm eklendi`);
  }, [hits, buildConfig, addAlertsBulk, tf, hullTf, multiDipTf, bbDivLgUseTrend, bbDivLgUseAdx]);

  const enabledIndicatorSummary = useMemo(() => {
    const names: string[] = [];
    if (hamOn) names.push("HAM");
    if (diagOn) names.push("Diag");
    if (macdOn) names.push("MACD");
    if (stochOn) names.push("Stoch");
    if (diOn) names.push("DI");
    if (hullOn) names.push("Hull");
    if (hamAoOn) names.push("HamAo");
    if (goldOn) names.push("Gold");
    if (gold2On) names.push("Gold2");
    if (divScanOn) names.push("Uyumsuzluk");
    if (multiDipOn) names.push("Dip+BB");
    if (bbDivLgOn) names.push("BB+LG");
    if (obFallOn) names.push("OB+Düşen");
    if (maSimpleOn) names.push("MA Basit");
    if (kijunBbOn) names.push("Kijun+BB");
    if (pdoOn) names.push("PDO");
    if (cmoOn) names.push("CMO");
    if (pliDirOn) names.push("PLI±");
    if (pliDmiOn) names.push("PLI-DMI");
    if (extraIds.length) names.push("Özel");
    if (pineIds.length) names.push("Pine");
    return names.length ? names.join(" · ") : "—";
  }, [hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn, extraIds.length, pineIds.length]);

  return (
    <div className="flex flex-col h-full min-h-0 p-2 gap-2 text-xs overflow-x-hidden">
      <div className="flex flex-col gap-2 shrink-0 min-w-0 max-h-[70%] overflow-y-auto overflow-x-hidden">
        <div className="font-medium">Liste Tarama</div>
      <p className="text-2xs text-desk-muted">
        Evren: kripto listesi, BIST listesi veya sektör. Şartlar aynı.
      </p>

      <div className="flex flex-wrap gap-1">
        {([
          ["crypto", "Kripto"],
          ["bist", "BIST"],
          ["sector", "Sektör"],
          ["active", "Aktif"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={clsx("btn text-2xs px-1.5", uniSrc === id && "btn-accent")}
            onClick={() => {
              setUniSrc(id);
              if (id === "crypto") setUniId(PERP_ALL_ID);
              else if (id === "bist") setUniId("bist-all");
              else if (id === "sector") setUniId("bist-xbank");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {uniSrc !== "active" && (
        <label className="text-2xs text-desk-muted">
          {uniSrc === "sector" ? "Sektör" : "Liste"}
          <select
            className="input mt-0.5"
            value={uniOpts.some((o) => o.id === uniId) ? uniId : uniOpts[0]?.id ?? ""}
            onChange={(e) => setUniId(e.target.value)}
          >
            {uniOpts.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.symbols.length})
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="text-2xs text-desk-muted">
        {universe.name} · {universe.symbols.length} sembol
      </div>

      <div className="flex flex-wrap gap-1 items-end">
        <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
          TF
          <select
            className="input text-2xs py-0.5"
            value={tf}
            onChange={(e) => setTf(e.target.value as Timeframe)}
          >
            {TFS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <NumInput
          label="Max bar"
          value={maxBars}
          onChange={setMaxBars}
          hint={
            divScanOn
              ? "Uyumsuzluk: en az 50 mum geri bak (pivot rangeLower ayrı)"
              : undefined
          }
        />
        <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
          Eşleşme
          <select
            className="input text-2xs py-0.5"
            value={matchMode}
            onChange={(e) => setMatchMode(e.target.value as "any" | "all")}
          >
            <option value="any">Herhangi</option>
            <option value="all">Hepsi</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2 border border-desk-border/40 rounded px-2 py-1 bg-desk-elevated/30">
        <button
          type="button"
          className="text-left text-xs font-medium"
          aria-expanded={indicatorsOpen}
          onClick={() => setIndicatorsOpen((open) => !open)}
        >
          Göstergeler {indicatorsOpen ? "▾" : "▸"}
        </button>
        {!indicatorsOpen && (
          <span className="text-2xs text-desk-muted truncate">
            {enabledIndicatorSummary}
          </span>
        )}
      </div>

      {indicatorsOpen && (
        <div
          className="grid grid-flow-row-dense gap-1.5 min-w-0"
          style={{
            // 2 columns at normal sidebar width; falls back to 1 below ~250px
            gridTemplateColumns:
              "repeat(auto-fit, minmax(max(120px, calc(50% - 3px)), 1fr))",
          }}
        >
      <SectionCard
        title="HAM"
        enabled={hamOn}
        onToggle={() => {
          if (!hamOn) {
            bumpMatchModeOnSecondKind(false, [
              diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
            setHamOn(true);
          } else {
            setHamOn(false);
          }
        }}
        open={openCard === "ham"}
        onOpen={() => setOpenCard((c) => (c === "ham" ? null : "ham"))}
      >
        <div className="flex flex-wrap gap-1">
          {HAM_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={hamConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!hamOn) {
                  bumpMatchModeOnSecondKind(false, [
                    diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setHamOn(true);
                  setHamConds((a) => ensureCond(a, c.id));
                } else {
                  setHamConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          <NumInput label="Osc hızlı" value={hamLen} onChange={setHamLen} />
          <NumInput label="Osc yavaş" value={hamLenSlow} onChange={setHamLenSlow} />
          <NumInput label="Raw hızlı" value={rawLen} onChange={setRawLen} />
          <NumInput label="Raw yavaş" value={rawLenSlow} onChange={setRawLenSlow} />
          <NumInput label="momSpan" value={momSpan} onChange={setMomSpan} />
          <NumInput label="normLen" value={normLen} onChange={setNormLen} />
          <NumInput label="jLen" value={jLen} onChange={setJLen} />
          <NumInput label="jPhase" value={jPhase} onChange={setJPhase} />
          <NumInput label="postSm" value={postSmooth} onChange={setPostSmooth} />
        </div>
        <div className="grid grid-cols-4 gap-1">
          <ColorInput label="Osc H" value={colorOsc} onChange={setColorOsc} />
          <ColorInput label="Osc Y" value={colorSlow} onChange={setColorSlow} />
          <ColorInput label="Raw H" value={colorRaw} onChange={setColorRaw} />
          <ColorInput label="Raw Y" value={colorRawSlow} onChange={setColorRawSlow} />
          <ColorInput label="Hist+" value={colorHistUp} onChange={setColorHistUp} />
          <ColorInput label="Hist−" value={colorHistDn} onChange={setColorHistDn} />
        </div>
      </SectionCard>

      <SectionCard
        title="Diag"
        enabled={diagOn}
        onToggle={() => {
          if (!diagOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
            setDiagOn(true);
          } else {
            setDiagOn(false);
          }
        }}
        open={openCard === "diag"}
        onOpen={() => setOpenCard((c) => (c === "diag" ? null : "diag"))}
      >
        <div className="flex flex-wrap gap-1">
          {DIAG_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={diagConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!diagOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setDiagOn(true);
                  setDiagConds((a) => ensureCond(a, c.id));
                } else {
                  setDiagConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          <NumInput label="pivot" value={pivotWindow} onChange={setPivotWindow} />
          <NumInput label="history" value={historyBars} onChange={setHistoryBars} />
          <NumInput label="left" value={left} onChange={setLeft} />
          <NumInput label="right" value={right} onChange={setRight} />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <ColorInput label="Destek" value={colorSup} onChange={setColorSup} />
          <ColorInput label="Direnç" value={colorRes} onChange={setColorRes} />
        </div>
      </SectionCard>

      <SectionCard
        title="MACD"
        enabled={macdOn}
        onToggle={() => {
          if (!macdOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
            setMacdOn(true);
          } else {
            setMacdOn(false);
          }
        }}
        open={openCard === "macd"}
        onOpen={() => setOpenCard((c) => (c === "macd" ? null : "macd"))}
      >
        <div className="flex flex-wrap gap-1">
          {MACD_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={macdConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!macdOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setMacdOn(true);
                  setMacdConds((a) => ensureCond(a, c.id));
                } else {
                  setMacdConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          <NumInput label="fast" value={macdFast} onChange={setMacdFast} />
          <NumInput label="slow" value={macdSlow} onChange={setMacdSlow} />
          <NumInput label="signal" value={macdSignal} onChange={setMacdSignal} />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <ColorInput label="MACD" value={colorMacd} onChange={setColorMacd} />
          <ColorInput label="Signal" value={colorSignal} onChange={setColorSignal} />
          <ColorInput label="Hist" value={colorHist} onChange={setColorHist} />
        </div>
      </SectionCard>

      <SectionCard
        title="Stoch"
        enabled={stochOn}
        onToggle={() => {
          if (!stochOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
            setStochOn(true);
          } else {
            setStochOn(false);
          }
        }}
        open={openCard === "stoch"}
        onOpen={() => setOpenCard((c) => (c === "stoch" ? null : "stoch"))}
      >
        <div className="flex flex-wrap gap-1">
          {STOCH_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={stochConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!stochOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setStochOn(true);
                  setStochConds((a) => ensureCond(a, c.id));
                } else {
                  setStochConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1">
          <NumInput label="%K" value={kPeriod} onChange={setKPeriod} />
          <NumInput label="%D" value={dPeriod} onChange={setDPeriod} />
          <NumInput label="OS" value={stochOs} onChange={setStochOs} />
          <NumInput label="OB" value={stochOb} onChange={setStochOb} />
        </div>
        <div className="grid grid-cols-2 gap-1">
          <ColorInput label="%K" value={colorK} onChange={setColorK} />
          <ColorInput label="%D" value={colorD} onChange={setColorD} />
        </div>
      </SectionCard>

      <SectionCard
        title="DI"
        enabled={diOn}
        onToggle={() => {
          if (!diOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
            setDiOn(true);
          } else {
            setDiOn(false);
          }
        }}
        open={openCard === "di"}
        onOpen={() => setOpenCard((c) => (c === "di" ? null : "di"))}
      >
        <div className="flex flex-wrap gap-1">
          {DI_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={diConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!diOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setDiOn(true);
                  setDiConds((a) => ensureCond(a, c.id));
                } else {
                  setDiConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          <NumInput label="Period" value={diPeriod} onChange={setDiPeriod} />
          <NumInput label="ADX min" value={diAdxMin} onChange={setDiAdxMin} />
        </div>
      </SectionCard>

      <SectionCard
        title="Doktor Hull"
        enabled={hullOn}
        onToggle={() => {
          if (!hullOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, diOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
            setHullOn(true);
          } else {
            setHullOn(false);
          }
        }}
        open={openCard === "hull"}
        onOpen={() => setOpenCard((c) => (c === "hull" ? null : "hull"))}
      >
        <p className="text-2xs text-desk-muted">
          Pine Doktor Hull · ribbon 8/13/21/50/100/200 · tarama TF varsayılan 4h · ≥{DOKTOR_HULL_MIN_BARS} mum
        </p>
        <div className="flex flex-wrap gap-1">
          {HULL_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={hullConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!hullOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setHullOn(true);
                  setHullConds((a) => ensureCond(a, c.id));
                } else {
                  setHullConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1">
          <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
            Hull type
            <select
              className="input text-2xs py-0.5"
              value={hullMode}
              onChange={(e) =>
                setHullMode(e.target.value as "Hma" | "Ehma" | "Thma")
              }
            >
              <option value="Hma">Hma</option>
              <option value="Ehma">Ehma</option>
              <option value="Thma">Thma</option>
            </select>
          </label>
          <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
            Scanner TF
            <select
              className="input text-2xs py-0.5"
              value={hullTf}
              onChange={(e) => setHullTf(e.target.value as Timeframe)}
            >
              {TFS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <ColorInput label="H8" value={colorH8} onChange={setColorH8} />
          <ColorInput label="H13" value={colorH13} onChange={setColorH13} />
          <ColorInput label="H21" value={colorH21} onChange={setColorH21} />
          <ColorInput label="H50" value={colorH50} onChange={setColorH50} />
          <ColorInput label="H100" value={colorH100} onChange={setColorH100} />
          <ColorInput label="H200" value={colorH200} onChange={setColorH200} />
        </div>
      </SectionCard>

      <SectionCard
        title="HAM+AO JRMA Z"
        enabled={hamAoOn}
        onToggle={() => {
          if (!hamAoOn) {
            bumpMatchModeOnSecondKind(false, [
              hamOn, diagOn, macdOn, stochOn, diOn, hullOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
            setHamAoOn(true);
          } else {
            setHamAoOn(false);
          }
        }}
        open={openCard === "hamAo"}
        onOpen={() => setOpenCard((c) => (c === "hamAo" ? null : "hamAo"))}
      >
        <p className="text-2xs text-desk-muted">
          Pine HAM_AO_JRMA_Z · AO debug = aoSmooth×0↑ · RMA debug = rmaSignal×jurikCore↑
          (TV Long tersi olabilir) · PT/NT = posTrend vs negTrend · kenar-only · ≥{HAM_AO_JRMA_Z_MIN_BARS} mum
        </p>
        <div className="flex flex-wrap gap-1">
          {HAM_AO_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={hamAoConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!hamAoOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setHamAoOn(true);
                  setHamAoConds((a) => ensureCond(a, c.id));
                } else {
                  setHamAoConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Gold"
        enabled={goldOn}
        onToggle={() => (goldOn ? setGoldOn(false) : enableGold())}
        open={openCard === "gold"}
        onOpen={() => setOpenCard((c) => (c === "gold" ? null : "gold"))}
      >
        <p className="text-2xs text-desk-muted">
          Pine AOHAM_JRMA_ENGINE · gerçek Jurik · AO×Score / AO×RMA (0–100) AL/SAT ·
          PT↔NT · kenar-only · ≥{AOHAM_JRMA_MIN_BARS} mum
        </p>
        <div className="flex flex-wrap gap-1">
          {GOLD_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={goldConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!goldOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setGoldOn(true);
                  setGold2On(false);
                  setMatchMode("any");
                  setGoldConds((a) => ensureCond(a, c.id));
                } else {
                  setGoldConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Gold2"
        enabled={gold2On}
        onToggle={() => (gold2On ? setGold2On(false) : enableGold2())}
        open={openCard === "gold2"}
        onOpen={() => setOpenCard((c) => (c === "gold2" ? null : "gold2"))}
      >
        <p className="text-2xs text-desk-muted">
          Pine GOLD / KEKO · Raw/Core/Disp × RMA AL/SAT · kırılım · şarj · kutup ·
          kenar-only · ≥{GOLD_KEKO_MIN_BARS} mum
        </p>
        <div className="flex flex-wrap gap-1">
          {GOLD2_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={gold2Conds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!gold2On) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setGold2On(true);
                  setGoldOn(false);
                  setMatchMode("any");
                  setGold2Conds((a) => ensureCond(a, c.id));
                } else {
                  setGold2Conds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
      </SectionCard>


      <SectionCard
        title="Uyumsuzluk"
        enabled={divScanOn}
        onToggle={() => (divScanOn ? setDivScanOn(false) : enableDivScan())}
        open={openCard === "divScan"}
        onOpen={() => setOpenCard((c) => (c === "divScan" ? null : "divScan"))}
      >
        <p className="text-2xs text-desk-muted">
          RSI / MFI / CCI / ROC / … seç + regular/gizli · kenar ≤ max bar · ≥
          {DIV_SCAN_MIN_BARS} mum · çekim {DIV_SCAN_FETCH_LIMIT}
        </p>
        <div className="text-2xs text-desk-muted font-medium">Osilatör</div>
        <div className="flex flex-wrap gap-1">
          {DIV_OSC_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={divOscs.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!divScanOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setDivScanOn(true);
                  setMatchMode("any");
                  setDivOscs([c.id]);
                  setDivTypes([...DEFAULT_DIV_TYPES]);
                } else {
                  setDivOscs((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="text-2xs text-desk-muted font-medium">Tür</div>
        <div className="flex flex-wrap gap-1">
          {DIV_TYPE_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={divTypes.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!divScanOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setDivScanOn(true);
                  setMatchMode("any");
                  setDivOscs([...DEFAULT_DIV_OSC]);
                  setDivTypes([c.id]);
                } else {
                  setDivTypes((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Çoklu Dip + BB"
        enabled={multiDipOn}
        onToggle={() => (multiDipOn ? setMultiDipOn(false) : enableMultiDip())}
        open={openCard === "multiDip"}
        onOpen={() => setOpenCard((c) => (c === "multiDip" ? null : "multiDip"))}
      >
        <p className="text-2xs text-desk-muted">
          İkili/üçlü dip · BB alt yakalama · Dip+S/R · BB+S/R · majör düşen
          direnç kırılımı · Dip+BB+Kırılım kombo · momentum ≥1 · pivot onay ·
          üçlü &gt; ikili · chart&apos;ta S/R çizgileri · ≥{MULTI_DIP_MIN_BARS} mum
        </p>
        <div className="flex flex-wrap gap-1">
          {MULTI_DIP_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={multiDipConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!multiDipOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setMultiDipOn(true);
                  setMatchMode("any");
                  setMultiDipConds((a) => ensureCond(a, c.id));
                } else {
                  setMultiDipConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <label className="text-2xs text-desk-muted flex flex-col gap-0.5">
          Scanner TF
          <select
            className="input text-2xs py-0.5"
            value={multiDipTf}
            onChange={(e) => setMultiDipTf(e.target.value as Timeframe)}
          >
            {TFS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </SectionCard>

      <SectionCard
        title="BB+RSI Div + LG"
        enabled={bbDivLgOn}
        onToggle={() => (bbDivLgOn ? setBbDivLgOn(false) : enableBbDivLg())}
        open={openCard === "bbDivLg"}
        onOpen={() => setOpenCard((c) => (c === "bbDivLg" ? null : "bbDivLg"))}
      >
        <p className="text-2xs text-desk-muted">
          BB alt · RSI OS · bullish RSI div VEYA unconfirmed LG (fitil+hacim) ·
          opsiyonel EMA50+ADX · BUY = sinyal + mum onayı · Alt↑ dip / Üst↓ hedef · ≥{BB_DIV_LG_MIN_BARS} mum
        </p>
        <div className="flex flex-wrap gap-1">
          {BB_DIV_LG_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={bbDivLgConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!bbDivLgOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setBbDivLgOn(true);
                  setMatchMode("any");
                  setBbDivLgConds((a) => ensureCond(a, c.id));
                } else {
                  setBbDivLgConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-2xs text-desk-muted">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={bbDivLgUseTrend}
              onChange={(e) => setBbDivLgUseTrend(e.target.checked)}
            />
            Trend EMA50
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={bbDivLgUseAdx}
              onChange={(e) => setBbDivLgUseAdx(e.target.checked)}
            />
            ADX≥20
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Order Block + Düşen"
        enabled={obFallOn}
        onToggle={() => (obFallOn ? setObFallOn(false) : enableObFall())}
        open={openCard === "obFall"}
        onOpen={() => setOpenCard((c) => (c === "obFall" ? null : "obFall"))}
      >
        <p className="text-2xs text-desk-muted">
          Bull OB temas · düşen direnç kırılımı (2 pivot high) · combo yakın bar ·
          Bear OB opsiyonel · ≥{OB_FALL_MIN_BARS} mum · (TV EMA stack değil)
        </p>
        <div className="flex flex-wrap gap-1">
          {OB_FALL_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={obFallConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!obFallOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setObFallOn(true);
                  setMatchMode("any");
                  setObFallConds((a) => ensureCond(a, c.id));
                } else {
                  setObFallConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
      </SectionCard>


      <SectionCard
        title="MA Basit"
        enabled={maSimpleOn}
        onToggle={() => (maSimpleOn ? setMaSimpleOn(false) : enableMaSimple())}
        open={openCard === "maSimple"}
        onOpen={() => setOpenCard((c) => (c === "maSimple" ? null : "maSimple"))}
      >
        <p className="text-2xs text-desk-muted">
          SMA 20/50/100/200 · boğa/ayı yığını · SMA×SMA↑ · fiyat×SMA↑ ·
          EMA10×SMA20 (hızlı) · ≥{MA_SIMPLE_MIN_BARS} mum · grafik: 4 SMA
          (+EMA10 seçiliyse)
        </p>
        <div className="flex flex-wrap gap-1">
          {MA_SIMPLE_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={maSimpleConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!maSimpleOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, kijunBbOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setMaSimpleOn(true);
                  setMatchMode("any");
                  setMaSimpleConds((a) => ensureCond(a, c.id));
                } else {
                  setMaSimpleConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Kijun + BB"
        enabled={kijunBbOn}
        onToggle={() => (kijunBbOn ? setKijunBbOn(false) : enableKijunBb())}
        open={openCard === "kijunBb"}
        onOpen={() => setOpenCard((c) => (c === "kijunBb" ? null : "kijunBb"))}
      >
        <p className="text-2xs text-desk-muted">
          Kijun 26 (Donchian orta) · BB 24 / 2σ Kijun üzerinde · tarama TF ·
          ≥{KIJUN_BB_MIN_BARS} mum · grafik: Kijun + BB
        </p>
        <p className="text-2xs text-desk-muted">
          İpucu: fiyat×band = erken sinyal · Kijun×orta = trend onayı
        </p>
        <div className="flex flex-wrap gap-1">
          {KIJUN_BB_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={kijunBbConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!kijunBbOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, pdoOn, cmoOn, pliDirOn, pliDmiOn]);
                  setKijunBbOn(true);
                  setMatchMode("any");
                  setKijunBbConds((a) => ensureCond(a, c.id));
                } else {
                  setKijunBbConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="PDO (T10/T11)"
        enabled={pdoOn}
        onToggle={() => (pdoOn ? setPdoOn(false) : enablePdo())}
        open={openCard === "pdo"}
        onOpen={() => setOpenCard((c) => (c === "pdo" ? null : "pdo"))}
      >
        <p className="text-2xs text-desk-muted">
          Trend = yeşil P (PUMP) × kırmızı D (DUMP) kesişimi · Yeni AL/SAT =
          mavi PDO × turuncu sinyal, AL ≤30 / SAT ≥70 bölgeden · Eski = EMA5
          zinciri, her kesişim · tarama TF · ≥{PDO_MIN_BARS} mum · grafik: PDO
          alt panel
        </p>
        <p className="text-2xs text-desk-muted">
          T10 = kesişim (≤8 mum) + ayrı mumda alt BB · T11 = son 4 mum UA/US ·
          T10/T11 kendi pencereleriyle (Max bar’dan bağımsız)
        </p>
        <div className="flex flex-wrap gap-1">
          {PDO_CHIPS.map((c) => (
            <Chip
              key={c.id}
              title={c.title}
              active={pdoConds.includes(c.id)}
              label={c.label}
              onClick={() => {
                if (!pdoOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, cmoOn, pliDirOn, pliDmiOn]);
                  setPdoOn(true);
                  setMatchMode("any");
                  setPdoConds((a) => ensureCond(a, c.id));
                } else {
                  setPdoConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="CMO (Chande)"
        enabled={cmoOn}
        onToggle={() => (cmoOn ? setCmoOn(false) : enableCmo())}
        open={openCard === "cmo"}
        onOpen={() => setOpenCard((c) => (c === "cmo" ? null : "cmo"))}
      >
        <p className="text-2xs text-desk-muted">
          CMO = 100·(ΣYükseliş − ΣDüşüş)/(ΣYükseliş + ΣDüşüş), kapanış
          değişimi (TV ta.cmo) · kesişim son Max bar içinde · tarama TF ·
          ≥{CMO_MIN_BARS} mum · grafik: CMO alt panel
        </p>
        <div className="grid grid-cols-3 gap-1">
          <NumInput label="Uzunluk" value={cmoLen} onChange={setCmoLen} hint="CMO periyodu (TV varsayılan 9)" />
          <NumInput label="Alt seviye" value={cmoLo} onChange={setCmoLo} hint="Yukarı kesişim seviyesi (varsayılan −50)" />
          <NumInput label="Üst seviye" value={cmoHi} onChange={setCmoHi} hint="Aşağı kesişim seviyesi (varsayılan 75)" />
        </div>
        <div className="flex flex-wrap gap-1">
          {CMO_CHIPS.map((c) => (
            <Chip
              key={c.id}
              title={c.title}
              active={cmoConds.includes(c.id)}
              label={cmoCondLabel(c.id, cmoLo, cmoHi)}
              onClick={() => {
                if (!cmoOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, pliDirOn, pliDmiOn]);
                  setCmoOn(true);
                  setMatchMode("any");
                  setCmoConds((a) => ensureCond(a, c.id));
                } else {
                  setCmoConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="PLI± Yönlü Oran"
        enabled={pliDirOn}
        onToggle={() => (pliDirOn ? setPliDirOn(false) : enablePliDir())}
        open={openCard === "pliDir"}
        onOpen={() => setOpenCard((c) => (c === "pliDir" ? null : "pliDir"))}
      >
        <p className="text-2xs text-desk-muted">
          yönlü = oran·yön · oran = PLI üst/alt − 1 · yön = üst/üst[k] − 1 −
          (alt[k]/alt − 1) işareti (0 ise kapanış ≥ medyan) · kesişim son Max
          bar içinde · tarama TF · ≥{PLI_DIR_MIN_BARS} mum · grafik: kanal +
          yönlü histogram
        </p>
        <div className="grid grid-cols-3 gap-1">
          <NumInput label="Uzunluk" value={pliLen} onChange={setPliLen} hint="PLI penceresi (varsayılan 50)" />
          <NumInput label="Percentil X" value={pliX} onChange={setPliX} step={0.5} hint="Üst = 100−X, alt = X (varsayılan 5)" />
          <NumInput label="Yön k" value={pliK} onChange={setPliK} hint="Yön için geriye bakış (varsayılan 5)" />
        </div>
        <div className="flex flex-wrap gap-1">
          {PLI_DIR_CHIPS.map((c) => (
            <Chip
              key={c.id}
              title={c.title}
              active={pliDirConds.includes(c.id)}
              label={PLI_DIR_COND_LABEL[c.id]}
              onClick={() => {
                if (!pliDirOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDmiOn]);
                  setPliDirOn(true);
                  setMatchMode("any");
                  setPliDirConds((a) => ensureCond(a, c.id));
                } else {
                  setPliDirConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="PLI± DMI Hibrit"
        enabled={pliDmiOn}
        onToggle={() => (pliDmiOn ? setPliDmiOn(false) : enablePliDmi())}
        open={openCard === "pliDmi"}
        onOpen={() => setOpenCard((c) => (c === "pliDmi" ? null : "pliDmi"))}
      >
        <p className="text-2xs text-desk-muted">
          T?/D? = PLI± yön dönüşü + izlenen uçtan salınım (erken) · T/D = ADX
          zirvesi + baskın DI + uç bölge · T!!/D!! = ikisi kombine pencere
          içinde · sinyal onay mumunda (pivot geride) · ≥{PLI_DMI_MIN_BARS} mum ·
          grafik: bantlar + DI/ADX/yonlu alt panel
        </p>
        <div className="grid grid-cols-3 gap-1">
          <NumInput label="PLI uzunluk" value={pdLen} onChange={setPdLen} hint="Percentil penceresi (50)" />
          <NumInput label="Percentil X" value={pdX} onChange={setPdX} step={0.5} hint="Üst = 100−X, alt = X (5)" />
          <NumInput label="Yön k" value={pdK} onChange={setPdK} hint="PLI± yön geriye bakış (5)" />
          <NumInput label="Erken salınım %" value={pdSw} onChange={setPdSw} step={0.1} hint="Erken uyarı için izlenen uçtan min salınım (1.5)" />
          <NumInput label="Kombine pencere" value={pdWin} onChange={setPdWin} hint="Erken + ADX arası max mum (5)" />
          <NumInput label="ADX min" value={pdAdxMin} onChange={setPdAdxMin} hint="ADX zirvesi sayılması için (20)" />
        </div>
        <div className="flex flex-wrap gap-1">
          <Chip active={pdBand} label="DM: PLI bant" title="DM/TR bantlardan (kapalı = fiyat)" onClick={() => setPdBand((v) => !v)} />
          <Chip active={pdWk} label="Yedek DI t/d" title="DI kesişimi yedek pivot onayı (pivot sırasını etkiler, alarm yok)" onClick={() => setPdWk((v) => !v)} />
        </div>
        <div className="flex flex-wrap gap-1">
          {PLI_DMI_CHIPS.map((c) => (
            <Chip
              key={c.id}
              title={c.title}
              active={pliDmiConds.includes(c.id)}
              label={PLI_DMI_COND_LABEL[c.id]}
              onClick={() => {
                if (!pliDmiOn) {
                  bumpMatchModeOnSecondKind(false, [
                    hamOn, diagOn, macdOn, stochOn, diOn, hullOn, hamAoOn, goldOn, gold2On, divScanOn, multiDipOn, bbDivLgOn, obFallOn, maSimpleOn, kijunBbOn, pdoOn, cmoOn, pliDirOn]);
                  setPliDmiOn(true);
                  setMatchMode("any");
                  setPliDmiConds((a) => ensureCond(a, c.id));
                } else {
                  setPliDmiConds((a) => toggleCondKeepOne(a, c.id));
                }
              }}
            />
          ))}
        </div>
      </SectionCard>

      <div className="border border-desk-border/40 rounded col-span-full min-w-0">
        <button
          type="button"
          className="w-full text-left px-2 py-1 text-xs bg-desk-elevated/50"
          onClick={() => setExtraOpen((v) => !v)}
        >
          Özel şart {extraOpen ? "▾" : "▸"}
        </button>
        {extraOpen && (
          <div className="p-2 space-y-2">
            <div className="flex flex-wrap gap-1">
              {EXTRA_CHIPS.map((c) => (
                <Chip
                  key={c.id}
                  active={extraIds.includes(c.id)}
                  label={c.label}
                  onClick={() => setExtraIds((a) => toggleIn(a, c.id))}
                />
              ))}
            </div>
            <div className="text-2xs font-medium">Pine v6 ekle</div>
            <input
              className="input text-2xs"
              value={pineName}
              onChange={(e) => setPineName(e.target.value)}
              placeholder="script adı"
            />
            <textarea
              className="input text-2xs font-mono min-h-[120px] w-full"
              value={pineDraft}
              onChange={(e) => setPineDraft(e.target.value)}
              placeholder={'//@version=6\nindicator("...")\nplot(close)'}
              spellCheck={false}
            />
            <div className="flex flex-wrap gap-1">
              {(
                [
                  ["zero_up", "0↑"],
                  ["zero_dn", "0↓"],
                  ["cross_up", "H×Y↑"],
                  ["cross_dn", "H×Y↓"],
                  ["up", "↑"],
                  ["dn", "↓"],
                ] as [PineCond, string][]
              ).map(([id, label]) => (
                <Chip
                  key={id}
                  active={pineConds.includes(id)}
                  label={label}
                  onClick={() => setPineConds((a) => toggleIn(a, id))}
                />
              ))}
            </div>
            <button
              type="button"
              className="btn btn-accent text-2xs"
              onClick={() => {
                const raw = pineDraft.trim();
                if (!raw) {
                  setPineStatus("Pine yapıştır");
                  return;
                }
                const conv = convertAny(raw, "td");
                const sc: CustomScript = {
                  id: `pine_${Math.random().toString(36).slice(2, 9)}`,
                  name: pineName.trim() || "Liste Pine",
                  code: conv.code,
                  language: "td",
                  originalCode: raw,
                  originalLanguage: "pine",
                  warnings: conv.warnings,
                  updatedAt: Date.now(),
                };
                upsertScript(sc);
                setPineIds((a) => (a.includes(sc.id) ? a : [...a, sc.id]));
                applyScriptToActive(sc.id);
                void fetch("/api/store", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    scripts: useDeskStore.getState().scripts,
                  }),
                }).catch(() => {});
                setPineStatus(
                  conv.warnings.length
                    ? `eklendi · ${conv.warnings[0]}`
                    : "eklendi · TD’ye çevrildi · grafikte"
                );
              }}
            >
              Ekle ve tara
            </button>
            {scripts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {scripts.map((s) => (
                  <Chip
                    key={s.id}
                    active={pineIds.includes(s.id)}
                    label={s.name}
                    onClick={() => {
                      setPineIds((a) => toggleIn(a, s.id));
                      if (!pineIds.includes(s.id)) applyScriptToActive(s.id);
                    }}
                  />
                ))}
              </div>
            )}
            {pineStatus && (
              <div className="text-2xs text-desk-muted">{pineStatus}</div>
            )}
          </div>
        )}
      </div>
        </div>
      )}
      </div>

      {/* Actions + status stay visible even when the settings above scroll */}
      <div className="flex flex-col gap-2 shrink-0 min-w-0">
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="btn-accent text-2xs"
          disabled={running}
          onClick={() => void runScan()}
        >
          {running ? "Taranıyor…" : "Listeyi tara"}
        </button>
        {running && (
          <button type="button" className="btn text-2xs" onClick={stopScan}>
            Durdur
          </button>
        )}
        <button
          type="button"
          className="btn text-2xs"
          disabled={running || !universe.symbols.length}
          onClick={armListAlerts}
        >
          Listeye alarm
        </button>
        <button
          type="button"
          className="btn text-2xs"
          disabled={!hits.length || running}
          onClick={() => void bulkAlerts()}
        >
          Hitlere alarm
        </button>
      </div>

      {(progress || status) && (
        <div className="text-2xs text-desk-muted">
          {progress && <span className="mr-2">{progress}</span>}
          {status}
        </div>
      )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto border border-desk-border/40 rounded">
        {hits.length ? hits.map((h, i) => (
            <button
              key={`${h.symbol}_${h.kind}_${h.cond}_${h.barsAgo}_${i}`}
              type="button"
              className="w-full text-left px-2 py-1 text-2xs border-b border-desk-border/30 hover:bg-desk-elevated flex gap-1.5 items-center"
              onClick={() => onHitClick(h)}
            >
              <span className="font-medium shrink-0">{h.symbol}</span>
              <span
                className={clsx(
                  "shrink-0",
                  h.bias === "bull"
                    ? "text-desk-up"
                    : h.bias === "bear"
                      ? "text-desk-down"
                      : "text-desk-muted"
                )}
              >
                {h.kind.toUpperCase()}
              </span>
              <span className="text-desk-muted flex-1 truncate">{h.note}</span>
              <span className="font-mono shrink-0">−{h.barsAgo}</span>
            </button>
          )) : (
            <div className="p-2 text-2xs text-desk-muted">Henüz hit yok</div>
          )}
      </div>
    </div>
  );
}
