import type { Candle } from "@/lib/types";
import {
  adx,
  aroon,
  atr,
  bollinger,
  donchian,
  ema,
  macd,
  rsi,
  sma,
  tsi,
  stochastic,
  connorsRsi,
  wavetrend,
  fisher,
  stdev,
  supertrend,
  vwap,
  linreg,
  zlsma,
  chandelierExit,
  bayesianTrend,
  multiKernelRegression,
  vortex,
  forceIndex,
  cmf,
  vidya,
  frama,
  sslChannel,
  vfi,
  cmo,
  massIndex,
  bop,
  hull,
  qTrend,
  klinger,
  smi,
  cumDelta,
  squeezeMomentum,
  waddahAttar,
  coppock,
  stochRsi,
  halfTrend,
  alligator,
  kst,
  trix,
  dpo,
  rvi,
  awesomeOsc,
  ppo,
  ultimateOsc,
  fireflyOscillator,
  supertrendDivWeighted,
} from "@/lib/indicators/math";
import { adxPumpRadar } from "@/lib/indicators/adxPump";
import { eliziEdge } from "@/lib/indicators/eliziEdge";
import {
  madBands,
  medianChannel,
  pliChannel,
  pliDeltaHybrid,
  rollingMedian,
} from "@/lib/indicators/median";
import { computeIfvgSeries, computeIfvgRsi, computeIfvgSmi, computeIfvgJurikStoch } from "@/lib/indicators/ifvg";
import { orderBlocks, fairValueGaps, bosChoch } from "@/lib/indicators/beluga";
import { diagonalSr } from "@/lib/indicators/diagonalSr";
import { initialBalance, laguerreRsi, schaffTrendCycle, elderImpulse, coralTrend } from "@/lib/indicators/proreal";
import { jurikKaseStoch, jurikBollinger, jma, jurikQqe } from "@/lib/indicators/jurik";
import type { BacktestParams, SignalFn } from "./types";
import { runStrategyCode } from "./strategySandbox";


function argMax(arr: number[], from: number, to: number): number {
  let idx = from;
  let best = -Infinity;
  for (let i = from; i <= to; i++) {
    if (arr[i] > best) {
      best = arr[i];
      idx = i;
    }
  }
  return idx;
}

/** Regular bearish divergence: later price high > earlier, oscillator high lower. */
function bearDiv(
  priceHi: number[],
  osc: (number | null)[],
  i: number,
  win = 16
): boolean {
  if (i < win * 2 + 2) return false;
  const later = argMax(priceHi, i - win + 1, i);
  const earlier = argMax(priceHi, i - win * 2 + 1, i - win);
  if (later <= earlier) return false;
  const oL = osc[later];
  const oE = osc[earlier];
  if (oL == null || oE == null) return false;
  return priceHi[later] > priceHi[earlier] && oL < oE;
}

function crossedAbove(
  a: (number | null)[],
  b: (number | null)[],
  i: number
): boolean {
  if (i < 1) return false;
  if (a[i] == null || b[i] == null || a[i - 1] == null || b[i - 1] == null)
    return false;
  return (
    (a[i - 1] as number) <= (b[i - 1] as number) &&
    (a[i] as number) > (b[i] as number)
  );
}

function crossedBelow(
  a: (number | null)[],
  b: (number | null)[],
  i: number
): boolean {
  if (i < 1) return false;
  if (a[i] == null || b[i] == null || a[i - 1] == null || b[i - 1] == null)
    return false;
  return (
    (a[i - 1] as number) >= (b[i - 1] as number) &&
    (a[i] as number) < (b[i] as number)
  );
}

/** Prior-bar Donchian (excludes bar i) — classic Turtle breakout definition. */
function priorDonchian(
  candles: Candle[],
  period: number
): { upper: (number | null)[]; lower: (number | null)[] } {
  const n = candles.length;
  const upper: (number | null)[] = new Array(n).fill(null);
  const lower: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    if (i < period) continue;
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period; j < i; j++) {
      hi = Math.max(hi, candles[j].high);
      lo = Math.min(lo, candles[j].low);
    }
    upper[i] = hi;
    lower[i] = lo;
  }
  return { upper, lower };
}

export const PRESET_LABELS: Record<BacktestParams["preset"], string> = {
  emaCross: "EMA Cross",
  rsiOsOb: "RSI OS/OB",
  macdCross: "MACD Cross",
  macdEma200: "MACD + EMA200 filter",
  macdEmaStack: "MACD + EMA 50/100/200",
  supertrendFlip: "Supertrend Flip",
  jurikKasePermission: "JurikKase Stoch Permission",
  bbBreak: "Bollinger Break",
  emaRsiConfirm: "EMA + RSI Dual Confirm",
  zScorePullback: "Z-Score Pullback (Trend+Z)",
  diAdxTrend: "ADX + DI± Cross",
  aroonLongTrend: "Aroon Long/Short",
  jurikOsBounce: "Jurik Kase OS Bounce 15–20",
  orbVwapFiltered: "ORB + VWAP + EMA Filter",
  vwapBounce: "VWAP Bounce / Rejection",
  rsi2MeanRev: "RSI(2) Mean Reversion",
  donchianTurtle: "Donchian / Turtle Breakout",
  supertrendAdx: "Supertrend + ADX Filter",
  adxPumpStages: "ADX Pump Radar (Saf/CCI/Medyan/Mom)",
  pumpFadeShort: "Pump Fade Short (bull climax)",
  dumpStages: "Dump Stages (bear escalate short-only)",
  pumpFadeDelta: "Pump Fade + Delta short",
  eliziEdgeFire: "Elizi Edge Fire (phase/temp/coherence)",
  eliziEdgeExhaust: "Elizi Exhaust Fade · 4s short",
  exhaustDelta: "Exhaust + Delta · 4s short",
  exhaustFlow: "Exhaust + flowAgree≤0",
  exhaustSmiExit: "Exhaust entry + SMI exit",
  hybridMacdPump: "Hibrit MACD+Pump (seçici short)",
  hybridMacdPumpLong: "Hibrit MACD+Pump Long-only · 4s",
  shortRsiOb: "Short RSI 70 reject",
  shortTsiSignal: "Short TSI×signal (RSI>50)",
  shortRsiDiv: "Short RSI bear-div + kırılım",
  shortTsiDiv: "Short TSI bear-div + kırılım",
  shortEnergyFade: "Short Energy Fade (RSI+TSI+Exhaust)",
  earlyFisher: "Early Fisher cross",
  earlyStoch: "Early Stoch extreme cross",
  earlyWaveTrend: "Early WaveTrend extreme",
  earlyConnors: "Early Connors RSI",
  earlyFisherTrend: "Early Fisher + EMA200",
  qTrendOnly: "Q-Trend (Tarasenko)",
  qTrendKlinger: "Q-Trend + Klinger (video)",
  jurikBbTurtle: "Jurik BB Turtle (breakout)",
  jurikDonchHybrid: "Jurik BB + Donchian Turtle",
  jurikMaDonch: "Jurik MA fast/slow + Donchian",
  jurikMaCross: "Jurik MA fast/slow cross",
  donchianBlaster: "Donchian Blaster (LSMA)",
  donchianBlasterHma: "Donchian Blaster (HMA)",
  oscCoppock: "Coppock Curve",
  eliziPulse: "Elizi Pulse (SMI|Squeeze + Exhaust)",
  eliziPulseAnd: "Elizi Pulse AND (SMI×Squeeze)",
  smiLongOnly: "SMI Long-only · 4s",
  eliziStack: "Elizi Stack (SMI long + Exhaust short)",
  hybridSmiLong: "Hybrid×SMI long (OR)",
  hybridSmiAnd: "Hybrid×SMI long (AND)",
  oscTsi: "TSI / Ergodic (Blau)",
  tsiLongOnly: "TSI Long-only · 4s",
  oscTsiOb: "TSI leave OB/OS",
  twinNeck: "İkili dip/tepe (boyun kırılım)",
  tripleNeck: "Üçlü dip/tepe (boyun kırılım)",
  diagonalBounce: "Diagonal S/R bounce",
  diagonalBreak: "Diagonal S/R break",
  srCombo: "İkili+Diagonal bounce combo",
  twinLongOnly: "İkili dip long-only",
  diagonalBreakLong: "Diagonal break long-only",
  diagonalBreakShort: "Diagonal break short-only",
  shortHybridOr: "Short Hybrid OR (ExhaustΔ|Diag)",
  shortHybridAnd: "Short Hybrid AND (ExhaustΔ×Diag)",
  shortHybridSmart: "Short Hybrid Smart (priority+Δ)",
  shortHybridElite: "Short Hybrid Elite (ExhaustΔ + diag AND-window)",
  ema13HighLow: "EMA13 High/Low break",
  ema13HighLowChannel: "EMA13 High/Low channel flip",
  ema13HighLowLong: "EMA13 High break long-only",
  zlsmaChandelier: "ZLSMA200 + CE(1,2) · 1s",
  zlsmaChandelierLong: "ZLSMA200 + CE(1,2) Long-only · 1s",
  bayesianTrend: "Bayesian Trend · 1s",
  bayesianTrendLong: "Bayesian Trend Long-only · 1s",
  multiKernel: "Multi Kernel Gauss bi",
  multiKernelLong: "Multi Kernel Gauss Long · 1s",
  multiKernelRq: "Multi Kernel RQ bi",
  multiKernelRqLong: "Multi Kernel RQ Long · 1s",
  bayesKernelOr: "Bayes×RQ OR Long · 1s",
  bayesKernelAnd: "Bayes×RQ AND Long · 1s",
  bayesKernelHybrid: "Bayes×RQ Hybrid Long · 1s",
  gainzAlgoV2: "GainzAlgo V2 Alpha · 1s",
  gainzAlgoV2Long: "GainzAlgo V2 Alpha Long · 1s",
  eliziNexus: "Elizi Nexus Long (Bayes×SMI×RQ)",
  eliziNexus1h: "Elizi Nexus · 1s (Bayes×RQ)",
  eliziNexus4h: "Elizi Nexus · 4s (SMI×Bayes)",
  eliziNexusSoft1h: "Elizi Nexus Soft · 1s (Bayes+SMI level)",
  eliziNexusSoft4h: "Elizi Nexus Soft · 4s (SMI+Bayes level)",
  smcFvg: "SMC FVG · az bilinen",
  smcFvgLong: "SMC FVG Long · az bilinen",
  ictOb: "ICT Order Block · az bilinen",
  ictObLong: "ICT Order Block Long · az bilinen",
  ictBosLong: "ICT BOS Long · az bilinen",
  vortexCross: "Vortex Cross · az bilinen",
  vortexLong: "Vortex Long · az bilinen",
  forceIndex: "Force Index · az bilinen",
  forceLong: "Force Index Long · az bilinen",
  cmfZero: "CMF Zero · az bilinen",
  cmfLong: "CMF Long · az bilinen",
  vidyaCross: "VIDYA Cross · az bilinen",
  vidyaLong: "VIDYA Long · az bilinen",
  framaCross: "FRAMA Cross · az bilinen",
  framaLong: "FRAMA Long · az bilinen",
  sslChannel: "SSL Channel · az bilinen",
  sslLong: "SSL Long · az bilinen",
  vfiCross: "VFI Cross · az bilinen",
  vfiLong: "VFI Long · 1s/4s",
  elderImpulse: "Elder Impulse · az bilinen",
  elderLong: "Elder Impulse Long · az bilinen",
  cmoZero: "CMO Zero · az bilinen",
  cmoLong: "CMO Long · az bilinen",
  massBulge: "Mass Index Bulge · az bilinen",
  bopZero: "BOP Zero · az bilinen",
  bopLong: "BOP Long · az bilinen",
  klingerLong: "Klinger Long · niş",
  squeezeLong: "Squeeze Long · 1s/4s",
  halfTrendLong: "HalfTrend Long · 1s",
  coralLong: "Coral Trend Long · niş",
  alligatorLong: "Alligator Long · niş",
  kstLong: "KST Long · 4s",
  trixLong: "TRIX Long · niş",
  rviLong: "RVI Long · niş",
  aoLong: "AO Long · 1s",
  uoLong: "Ultimate Osc Long · niş",
  dpoLong: "DPO Long · niş",
  ppoLong: "PPO Long · niş",
  fireflyLong: "Firefly LB Long · setup",
  stDivWeighted: "ST Div-Weighted · setup",
  stDivFirefly: "ST×Firefly bi · setup",
  stDivFireflyLong: "ST×Firefly Long · 1s",
  oscSqueezeLong: "Squeeze Fire Long · 1s/4s",
  pliBreakLong: "PLI Break Long · medyan/PLI",
  pliDeltaHybridLong: "PLI×Delta Hibrit Long",
  madBandsLong: "MAD Bant Long",
  medianCrossLong: "Medyan Cross Long",
  ifvgLong: "IFVG Long (retest)",
  ifvgRsiLong: "IFVG×RSI Long",
  ifvgRsiBi: "IFVG×RSI Bi",
  ifvgSmiLong: "IFVG×SMI Long",
  ifvgSmiBi: "IFVG×SMI Bi",
  ifvgJurikStochLong: "IFVG×Jurik Kase Long",
  ifvgJurikStochBi: "IFVG×Jurik Kase Bi",
  oscWaddah: "Waddah Attar",
  oscSmi: "SMI (Blau) · 4s",
  oscStochRsi: "Stoch RSI",
  oscSqueeze: "TTM Squeeze Mom · 4s",
  oscLaguerre: "Laguerre RSI",
  oscSchaff: "Schaff Trend Cycle",
  oscQqe: "QQE (TV JustUncleL)",
  codeStrategy: "Kod stratejisi (yapıştır)",
  custom: "Custom Rules",
};

export function recommendedWarmup(
  preset: BacktestParams["preset"],
  params: BacktestParams
): number {
  if (preset === "fireflyLong" || preset === "stDivWeighted" || preset === "stDivFirefly" || preset === "stDivFireflyLong") return 60;
  if (preset === "zScorePullback") return Math.max(params.regimeSMA ?? 200, 220);
  if (preset === "rsi2MeanRev") {
    return params.requireRegimeAbove
      ? Math.max(params.regimeSMA ?? 200, 220)
      : 40;
  }
  if (preset === "diAdxTrend" || preset === "supertrendAdx" || preset === "adxPumpStages" || preset === "pumpFadeShort" || preset === "dumpStages" || preset === "pumpFadeDelta" || preset === "eliziEdgeFire" || preset === "eliziEdgeExhaust" || preset === "exhaustDelta" || preset === "exhaustFlow" || preset === "exhaustSmiExit" || preset === "hybridMacdPump" || preset === "hybridMacdPumpLong" || preset === "shortRsiOb" || preset === "shortTsiSignal" || preset === "shortRsiDiv" || preset === "shortTsiDiv" || preset === "shortEnergyFade" || preset === "earlyFisher" || preset === "earlyFisherTrend" || preset === "earlyStoch" || preset === "earlyWaveTrend" || preset === "earlyConnors" || preset === "qTrendOnly" || preset === "qTrendKlinger" || preset === "jurikBbTurtle" || preset === "jurikDonchHybrid" || preset === "jurikMaDonch" || preset === "jurikMaCross" || preset === "donchianBlaster" || preset === "donchianBlasterHma" || preset === "oscQqe" || preset === "oscSchaff" || preset === "oscLaguerre" || preset === "oscSqueeze" || preset === "oscStochRsi" || preset === "oscSmi" || preset === "oscWaddah" || preset === "oscCoppock" || preset === "eliziPulse" || preset === "eliziPulseAnd" || preset === "smiLongOnly" || preset === "eliziStack" || preset === "hybridSmiLong" || preset === "hybridSmiAnd" || preset === "oscTsi" || preset === "tsiLongOnly" || preset === "oscTsiOb" || preset === "twinNeck" || preset === "tripleNeck" || preset === "diagonalBounce" || preset === "diagonalBreak" || preset === "srCombo" || preset === "twinLongOnly" || preset === "diagonalBreakLong" || preset === "diagonalBreakShort" || preset === "shortHybridOr" || preset === "shortHybridAnd" || preset === "shortHybridSmart" || preset === "shortHybridElite" || preset === "ema13HighLow" || preset === "ema13HighLowChannel" || preset === "ema13HighLowLong" || preset === "zlsmaChandelier" || preset === "zlsmaChandelierLong") return 420;
  if (preset === "bayesianTrend" || preset === "bayesianTrendLong") return 80;
  if (preset === "multiKernel" || preset === "multiKernelLong" || preset === "multiKernelRq" || preset === "multiKernelRqLong") return 40;
  if (preset === "bayesKernelOr" || preset === "bayesKernelAnd" || preset === "bayesKernelHybrid") return 80;
  if (preset === "gainzAlgoV2" || preset === "gainzAlgoV2Long") return 30;
  if (preset === "eliziNexus" || preset === "eliziNexus1h" || preset === "eliziNexus4h" || preset === "eliziNexusSoft1h" || preset === "eliziNexusSoft4h") return 80;
  if (preset === "pliBreakLong" || preset === "pliDeltaHybridLong" || preset === "madBandsLong" || preset === "medianCrossLong") return 80;
  if (preset === "ifvgJurikStochLong" || preset === "ifvgJurikStochBi") return 150;
  if (preset === "ifvgLong" || preset === "ifvgRsiLong" || preset === "ifvgRsiBi" || preset === "ifvgSmiLong" || preset === "ifvgSmiBi") return 120;
  if (preset === "klingerLong" || preset === "squeezeLong" || preset === "halfTrendLong" || preset === "coralLong" || preset === "alligatorLong" || preset === "kstLong" || preset === "trixLong" || preset === "rviLong" || preset === "aoLong" || preset === "uoLong" || preset === "dpoLong" || preset === "ppoLong" || preset === "oscSqueezeLong") return 60;
  if (preset === "smcFvg" || preset === "smcFvgLong" || preset === "ictOb" || preset === "ictObLong" || preset === "ictBosLong" || preset === "vortexCross" || preset === "vortexLong" || preset === "forceIndex" || preset === "forceLong" || preset === "cmfZero" || preset === "cmfLong" || preset === "vidyaCross" || preset === "vidyaLong" || preset === "framaCross" || preset === "framaLong" || preset === "sslChannel" || preset === "sslLong" || preset === "vfiCross" || preset === "vfiLong" || preset === "elderImpulse" || preset === "elderLong" || preset === "cmoZero" || preset === "cmoLong" || preset === "massBulge" || preset === "bopZero" || preset === "bopLong") return 40;
  if (preset === "aroonLongTrend") return 40;
  if (preset === "jurikOsBounce") return 80;
  if (preset === "donchianTurtle")
    return Math.max(params.donchianPeriod ?? 20, params.donchianExitPeriod ?? 10) + 5;
  if (preset === "orbVwapFiltered") return Math.max(params.orbBars ?? 3, 30);
  if (preset === "vwapBounce") return 40;
  return params.warmup ?? 60;
}

export function buildSignalContext(
  candles: Candle[],
  params: BacktestParams
): Record<string, unknown> {
  const closes = candles.map((c) => c.close);
  const fast = params.fast ?? 9;
  const slow = params.slow ?? 21;
  const zLen = params.zLength ?? 20;
  const regimeN = params.regimeSMA ?? 200;
  const fastMa = params.fast ?? 5;
  const sma20 = sma(closes, zLen);
  const sd20 = stdev(closes, zLen);
  const zScore = closes.map((c, i) =>
    sma20[i] == null || sd20[i] == null || (sd20[i] as number) === 0
      ? null
      : (c - (sma20[i] as number)) / (sd20[i] as number)
  );

  const orbBars = params.orbBars ?? 3;
  const dcEntry = params.donchianPeriod ?? 20;
  const dcExit = params.donchianExitPeriod ?? 10;

  const ctx: Record<string, unknown> = {
    emaFast: ema(closes, fast),
    emaSlow: ema(closes, slow),
    ema50: ema(closes, 50),
    ema100: ema(closes, 100),
    ema200: ema(closes, 200),
    rsi: rsi(closes, params.rsiPeriod ?? 14),
    macd: macd(
      closes,
      params.macdFast ?? 12,
      params.macdSlow ?? 26,
      params.macdSignal ?? 9
    ),
    emaHigh13: ema(candles.map((x) => x.high), 13),
    emaLow13: ema(candles.map((x) => x.low), 13),
    zlsmaLine: zlsma(closes, params.zlsmaLen ?? 200),
    ceExit: chandelierExit(candles, params.cePeriod ?? 1, params.ceMult ?? 2, true),
    bayesian: bayesianTrend(
      candles,
      params.bayesianLen ?? 60,
      params.bayesianGap ?? 20,
      params.bayesianSigGap ?? 10
    ),
    kernelGauss: multiKernelRegression(closes, {
      kind: "gaussian",
      lookback: params.kernelLookback ?? 25,
      bandwidth: params.kernelBandwidth ?? 8,
    }),
    kernelRq: multiKernelRegression(closes, {
      kind: "rationalQuadratic",
      lookback: params.kernelLookback ?? 25,
      bandwidth: params.kernelBandwidth ?? 8,
      alpha: params.kernelAlpha ?? 1,
    }),

    smcOb: orderBlocks(candles, 3, 1.2),
    smcFvg: fairValueGaps(candles, 25),
    smcBos: bosChoch(candles, 3),
    vortexOsc: vortex(candles, 14),
    forceOsc: forceIndex(candles, 13),
    cmfOsc: cmf(candles, 20),
    vidyaLine: vidya(closes, 14),
    framaLine: frama(closes, 16),
    sslOsc: sslChannel(candles, 10),
    vfiOsc: vfi(candles, 130),
    elderImp: elderImpulse(closes, 13, 12, 26, 9),
    cmoOsc: cmo(closes, 14),
    massOsc: massIndex(candles, 25),
    bopOsc: bop(candles, 14),

    halfTrendOsc: halfTrend(candles, 2, 2, 100),
    coralOsc: coralTrend(closes, 34, 0.4),
    alligatorOsc: alligator(candles),
    kstOsc: kst(closes),
    trixLine: trix(closes, 18),
    dpoLine: dpo(closes, 21),
    rviOsc: rvi(candles, 10),
    aoOsc: awesomeOsc(candles),
    uoOsc: ultimateOsc(candles),
    ppoOsc: ppo(closes, 12, 26, 9),
    fireflyOsc: fireflyOscillator(candles, 10, 3, false),
    rollingMed: rollingMedian(closes, 20),
    madBand: madBands(closes, 20, 2, 3),
    medChannel: medianChannel(candles, 20),
    pliCh: pliChannel(closes, 50, 5),
    stDiv: supertrendDivWeighted(candles, 10, 3, 5, 0.35, 50, 14),
    st: supertrend(candles, params.atrPeriod ?? 10, params.stMult ?? 3),
    bb: bollinger(closes, params.bbPeriod ?? 20, params.bbMult ?? 2),
    jks: jurikKaseStoch(candles, {
      cycle: 5,
      kLen: 8,
      dLen: 3,
      jmaLen: 5,
      phase: 50,
      power: 2,
      levelLo: 10,
      levelLo2: 20,
      levelHi2: 80,
      levelHi: 90,
      smoothMode: "jma",
    }),
    zScore,
    smaRegime: sma(closes, regimeN),
    fastSMA: sma(closes, fastMa),
    dmi: adx(candles, params.adxPeriod ?? 14),
    pumpRadar: adxPumpRadar(candles, {
      adxPeriod: params.adxPeriod ?? 14,
      fastSmooth: params.fastSmooth ?? 3,
      medianLen: params.medianLen ?? 5,
      momPeriod: params.momPeriod ?? 7,
      cciPeriod: params.cciPeriod ?? 10,
      bbPeriod: params.bbPeriod ?? 20,
      bbMult: params.bbMult ?? 2,
      smoothLen: params.smoothLen ?? 3,
      adxConfirm: params.adxConfirm ?? params.adxMin ?? 25,
      adxWake: params.adxWake ?? 15,
    }),

    aroon: aroon(candles, params.aroonPeriod ?? 14),
    vwap: vwap(candles),
    ib: initialBalance(candles, orbBars),
    atr: atr(candles, params.atrPeriod ?? 14),
    donchianEntry: priorDonchian(candles, dcEntry),
    donchianExit: priorDonchian(candles, dcExit),
    donchianLive: donchian(candles, dcEntry),
    jurikBb: jurikBollinger(
      closes,
      params.bbPeriod ?? 20,
      params.bbMult ?? 2,
      50,
      2
    ),
    jurikBbFast: jurikBollinger(
      closes,
      Math.max(8, Math.floor((params.bbPeriod ?? 20) / 2)),
      params.bbMult ?? 2,
      50,
      2
    ),
    jmaFast: jma(closes, params.fast ?? 10, 50, 2),
    jmaSlow: jma(closes, params.slow ?? 34, 50, 2),
    lsma: linreg(closes, params.fast ?? 25),
    hmaTrend: hull(closes, params.slow ?? 55),
    qqeOsc: jurikQqe(closes, 14, 8, 5, 4.236, 50, 2),
    schaffOsc: schaffTrendCycle(closes, 10, 23, 50),
    lagRsi: laguerreRsi(closes, 0.5),
    squeezeOsc: squeezeMomentum(candles, 20, 2, 1.5),
    stochRsiOsc: stochRsi(closes, 14, 14, 3, 3),
    smiOsc: smi(candles, 14, 20, 5),
    cumDelta: cumDelta(candles),
    waddahOsc: waddahAttar(closes, candles, 20, 40, 20, 2, 150),
    coppockOsc: coppock(closes, 14, 11, 10),
    closes,
    tsiLine: tsi(closes, 25, 13, 7),
    tsiErgodic: tsi(closes, 5, 20, 5),
    fisherOsc: fisher(closes, 10),
    stochOsc: stochastic(candles, 14, 3),
    wtOsc: wavetrend(candles, 10, 21),
    connors: connorsRsi(closes, 3, 2, 100),
    qTrendOsc: qTrend(candles, {
      trendPeriod: params.donchianPeriod ?? 200,
      atrPeriod: params.atrPeriod ?? 40,
      atrMult: params.stMult ?? 1,
      smoothPeriod: params.fast ?? 10,
    }),
    klingerOsc: klinger(
      candles,
      params.macdFast ?? 29,
      params.macdSlow ?? 55,
      params.macdSignal ?? 16
    ),
  };

  // Only compute Elizi when the preset actually uses it (avoid scanner/backtest hang tax).
  if (
    params.preset === "pliDeltaHybridLong" ||
    params.preset === "pliBreakLong"
  ) {
    ctx.pliHybrid = pliDeltaHybrid(candles, {
      length: 50,
      x: 5,
      deltaSmooth: 5,
      narrowLookback: 50,
      narrowPct: 25,
      narrowMemory: 5,
    });
  }

  if (
    params.preset === "eliziEdgeFire" ||
    params.preset === "eliziEdgeExhaust" ||
    params.preset === "exhaustDelta" ||
    params.preset === "exhaustFlow" ||
    params.preset === "exhaustSmiExit" ||
    params.preset === "shortHybridOr" ||
    params.preset === "shortHybridAnd" ||
    params.preset === "shortHybridSmart" ||
    params.preset === "shortHybridElite" ||
    params.preset === "hybridMacdPump" ||
    params.preset === "hybridMacdPumpLong" ||
    params.preset === "shortEnergyFade" || params.preset === "eliziPulse" || params.preset === "eliziPulseAnd" || params.preset === "eliziStack"
  ) {
    ctx.elizi = eliziEdge(candles, {
      erLen: params.erLen ?? 10,
      atrLen: params.atrLen ?? params.atrPeriod ?? 14,
      adxPeriod: params.adxPeriod ?? 14,
      bbPeriod: params.bbPeriod ?? 20,
      bbMult: params.bbMult ?? 2,
      volLen: params.volLen ?? 5,
      volLong: params.volLong ?? 10,
      flowSmooth: params.flowSmooth ?? 3,
      tempSmooth: params.tempSmooth ?? 4,
      effHigh: params.effHigh ?? 0.45,
      surpriseHigh: params.surpriseHigh ?? 0.85,
      coherenceArmed: params.coherenceArmed ?? 0.6,
      fireTemp: params.fireTemp ?? 62,
      armedTemp: params.armedTemp ?? 48,
      probeTemp: params.probeTemp ?? 32,
    });
  }


  if (
    params.preset === "twinNeck" ||
    params.preset === "tripleNeck" ||
    params.preset === "diagonalBounce" ||
    params.preset === "diagonalBreak" ||
    params.preset === "srCombo" ||
    params.preset === "twinLongOnly" ||
    params.preset === "diagonalBreakLong" ||
    params.preset === "diagonalBreakShort" ||
    params.preset === "shortHybridOr" ||
    params.preset === "shortHybridAnd" ||
    params.preset === "shortHybridSmart" ||
    params.preset === "shortHybridElite"
  ) {
    ctx.diagSr = diagonalSr(candles, {
      left: params.fast ?? 5,
      right: params.slow ? Math.min(8, Math.max(3, Math.floor((params.slow as number) / 4))) : 5,
      twinTol: 0.015,
    });
  }


  if (params.preset === "gainzAlgoV2" || params.preset === "gainzAlgoV2Long") {
    const n = candles.length;
    const buy: boolean[] = new Array(n).fill(false);
    const sell: boolean[] = new Array(n).fill(false);
    const r = rsi(closes, 14);
    const a = atr(candles, 14);
    const deltaLen = 10;
    const rsiIdx = 80;
    const stabIdx = 0.7;
    let last: "" | "buy" | "sell" = "";
    for (let i = 1; i < n; i++) {
      const c = candles[i];
      const p = candles[i - 1];
      const tr = Math.max(
        c.high - c.low,
        Math.abs(c.high - p.close),
        Math.abs(c.low - p.close)
      );
      if (tr <= 0 || r[i] == null || a[i] == null || i < deltaLen) continue;
      const stable = Math.abs(c.close - c.open) / tr > stabIdx;
      const bullEng =
        p.close < p.open && c.close > c.open && c.close > p.open;
      const bearEng =
        p.close > p.open && c.close < c.open && c.close < p.open;
      const rsiBelow = (r[i] as number) < rsiIdx;
      const rsiAbove = (r[i] as number) > 100 - rsiIdx;
      const decreaseOver = c.close < candles[i - deltaLen].close;
      const increaseOver = c.close > candles[i - deltaLen].close;
      const bullState = bullEng && stable && rsiBelow && decreaseOver;
      const bearState = bearEng && stable && rsiAbove && increaseOver;
      const bull = bullState && last !== "buy";
      const bear = bearState && last !== "sell";
      if (bull) {
        buy[i] = true;
        last = "buy";
      } else if (bear) {
        sell[i] = true;
        last = "sell";
      }
    }
    ctx.gainzAlgo = { buy, sell };
  }

  if (
    params.preset === "ifvgLong" ||
    params.preset === "ifvgRsiLong" ||
    params.preset === "ifvgRsiBi" ||
    params.preset === "ifvgSmiLong" ||
    params.preset === "ifvgSmiBi" ||
    params.preset === "ifvgJurikStochLong" ||
    params.preset === "ifvgJurikStochBi"
  ) {
    ctx.ifvg = computeIfvgSeries(candles, {
      lookbackFvgs: 0,
      maxHits: 0,
      requireEntry: false,
    });
    if (params.preset === "ifvgRsiLong" || params.preset === "ifvgRsiBi") {
      ctx.ifvgRsi = computeIfvgRsi(candles, {
        rsiPeriod: params.rsiPeriod ?? 14,
        os: params.rsiOs ?? 35,
        ob: params.rsiOb ?? 65,
        lookbackFvgs: 0,
        maxHits: 0,
      });
    }
    if (params.preset === "ifvgSmiLong" || params.preset === "ifvgSmiBi") {
      ctx.ifvgSmi = computeIfvgSmi(candles, {
        k: 14,
        d: 20,
        ema: 5,
        os: -40,
        ob: 40,
        lookbackFvgs: 0,
        maxHits: 0,
      });
    }
    if (params.preset === "ifvgJurikStochLong" || params.preset === "ifvgJurikStochBi") {
      ctx.ifvgJurikStoch = computeIfvgJurikStoch(candles, {
        cycle: 10,
        kLen: 18,
        dLen: 6,
        jmaLen: 20,
        phase: 0,
        power: 2,
        os: 20,
        ob: 80,
        softMid: true,
        lookbackFvgs: 0,
        maxHits: 0,
      });
    }
  }

  if (params.preset === "codeStrategy" && params.strategyCode?.trim()) {
    try {
      const bars = runStrategyCode(params.strategyCode, candles);
      ctx.codeBars = bars;
      ctx.codeWarnings = bars.warnings;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      ctx.codeBars = null;
      ctx.codeWarnings = [
        ...(((e as { strategyWarnings?: string[] }).strategyWarnings) ?? []),
        msg,
      ];
      throw e;
    }
  }

  return ctx;
}

export function getSignalFn(
  preset: BacktestParams["preset"],
  params: BacktestParams
): SignalFn {
  const rsiOs = params.rsiOs ?? 30;
  const rsiOb = params.rsiOb ?? 70;
  const entryZ = params.entryZ ?? -1.5;
  const exitZ = params.exitZ ?? 0;
  const adxMin = params.adxMin ?? 25;
  const vwapTouchAtr = params.vwapTouchAtr ?? 0.35;

  switch (preset) {
    case "emaCross":
      return (_c, i, ctx) => {
        const f = ctx.emaFast as (number | null)[];
        const s = ctx.emaSlow as (number | null)[];
        return {
          long: crossedAbove(f, s, i),
          short: crossedBelow(f, s, i),
          reason: "EMA cross",
        };
      };
    case "rsiOsOb":
      return (_c, i, ctx) => {
        const r = ctx.rsi as (number | null)[];
        if (r[i] == null || r[i - 1] == null) return {};
        const long = (r[i - 1] as number) < rsiOs && (r[i] as number) >= rsiOs;
        const short = (r[i - 1] as number) > rsiOb && (r[i] as number) <= rsiOb;
        return { long, short, reason: "RSI OS/OB" };
      };

    case "macdEma200":
      return (candles, i, ctx) => {
        const m = ctx.macd as {
          macd: (number | null)[];
          signal: (number | null)[];
        };
        const e200 = ctx.ema200 as (number | null)[];
        if (e200[i] == null) return {};
        const above = candles[i].close > (e200[i] as number);
        const below = candles[i].close < (e200[i] as number);
        return {
          long: above && crossedAbove(m.macd, m.signal, i),
          short: below && crossedBelow(m.macd, m.signal, i),
          reason: "MACD×EMA200",
        };
      };
    case "macdEmaStack":
      return (_c, i, ctx) => {
        const m = ctx.macd as {
          macd: (number | null)[];
          signal: (number | null)[];
        };
        const a = ctx.ema50 as (number | null)[];
        const b = ctx.ema100 as (number | null)[];
        const c = ctx.ema200 as (number | null)[];
        if (a[i] == null || b[i] == null || c[i] == null) return {};
        const bull = (a[i] as number) > (b[i] as number) && (b[i] as number) > (c[i] as number);
        const bear = (a[i] as number) < (b[i] as number) && (b[i] as number) < (c[i] as number);
        return {
          long: bull && crossedAbove(m.macd, m.signal, i),
          short: bear && crossedBelow(m.macd, m.signal, i),
          reason: "MACD×50/100/200",
        };
      };
    case "macdCross":
      return (_c, i, ctx) => {
        const m = ctx.macd as {
          macd: (number | null)[];
          signal: (number | null)[];
        };
        return {
          long: crossedAbove(m.macd, m.signal, i),
          short: crossedBelow(m.macd, m.signal, i),
          reason: "MACD cross",
        };
      };
    case "supertrendFlip":
      return (_c, i, ctx) => {
        const st = ctx.st as { direction: (-1 | 1 | null)[] };
        const dir = st.direction;
        if (!dir || dir[i] == null || dir[i - 1] == null) return {};
        return {
          long: (dir[i - 1] as number) < 0 && (dir[i] as number) > 0,
          short: (dir[i - 1] as number) > 0 && (dir[i] as number) < 0,
          reason: "ST flip",
        };
      };
    case "jurikKasePermission":
      return (_c, i, ctx) => {
        const j = ctx.jks as {
          k: (number | null)[];
          d: (number | null)[];
          state: (number | null)[];
        };
        if (j.k[i] == null || j.d[i] == null) return {};
        const permBull = j.state[i] == null || (j.state[i] as number) >= 0;
        const permBear = j.state[i] == null || (j.state[i] as number) <= 0;
        const long =
          crossedAbove(j.k, j.d, i) && (j.k[i] as number) < 45 && permBull;
        const short =
          crossedBelow(j.k, j.d, i) && (j.k[i] as number) > 55 && permBear;
        return { long, short, reason: "JKS permission" };
      };
    case "bbBreak":
      return (candles, i, ctx) => {
        const bb = ctx.bb as {
          upper: (number | null)[];
          lower: (number | null)[];
          mid: (number | null)[];
        };
        if (bb.upper[i] == null || bb.lower[i] == null) return {};
        const c = candles[i].close;
        const prev = candles[i - 1]?.close;
        const long =
          prev != null &&
          prev <= (bb.upper[i - 1] as number) &&
          c > (bb.upper[i] as number);
        const short =
          prev != null &&
          prev >= (bb.lower[i - 1] as number) &&
          c < (bb.lower[i] as number);
        return { long, short, reason: "BB break" };
      };
    case "emaRsiConfirm":
      return (_c, i, ctx) => {
        const f = ctx.emaFast as (number | null)[];
        const s = ctx.emaSlow as (number | null)[];
        const r = ctx.rsi as (number | null)[];
        if (r[i] == null) return {};
        const long = crossedAbove(f, s, i) && (r[i] as number) > 50;
        const short = crossedBelow(f, s, i) && (r[i] as number) < 50;
        return { long, short, reason: "EMA+RSI" };
      };
    case "zScorePullback":
      return (candles, i, ctx) => {
        const z = ctx.zScore as (number | null)[];
        const regime = ctx.smaRegime as (number | null)[];
        const fastS = ctx.fastSMA as (number | null)[];
        if (z[i] == null || regime[i] == null || fastS[i] == null) return {};
        const closes = candles.map((c) => c.close);
        const bull = closes[i] > (regime[i] as number);
        const long =
          bull &&
          (z[i] as number) < entryZ &&
          crossedAbove(closes, fastS, i);
        const exitLong = (z[i] as number) > exitZ;
        return { long, exitLong, reason: "Z-Score PB" };
      };
    case "diAdxTrend":
      return (_c, i, ctx) => {
        const d = ctx.dmi as {
          adx: (number | null)[];
          plusDI: (number | null)[];
          minusDI: (number | null)[];
        };
        if (d.adx[i] == null) return {};
        const strong = (d.adx[i] as number) > adxMin;
        const long = strong && crossedAbove(d.plusDI, d.minusDI, i);
        const short = strong && crossedAbove(d.minusDI, d.plusDI, i);
        const exitLong =
          crossedBelow(d.plusDI, d.minusDI, i) || (d.adx[i] as number) < 20;
        const exitShort =
          crossedBelow(d.minusDI, d.plusDI, i) || (d.adx[i] as number) < 20;
        return { long, short, exitLong, exitShort, reason: "ADX/DI" };
      };
    case "aroonLongTrend":
      return (_c, i, ctx) => {
        const a = ctx.aroon as {
          up: (number | null)[];
          down: (number | null)[];
        };
        if (a.up[i] == null || a.down[i] == null) return {};
        const zoneLong =
          (a.up[i] as number) > 70 && (a.down[i] as number) < 30;
        const zoneShort =
          (a.down[i] as number) > 70 && (a.up[i] as number) < 30;
        const long = crossedAbove(a.up, a.down, i) || zoneLong;
        const short = crossedAbove(a.down, a.up, i) || zoneShort;
        const exitLong =
          crossedBelow(a.up, a.down, i) || (a.up[i] as number) < 50;
        const exitShort =
          crossedBelow(a.down, a.up, i) || (a.down[i] as number) < 50;
        return { long, short, exitLong, exitShort, reason: "Aroon" };
      };
    case "jurikOsBounce":
      return (_c, i, ctx) => {
        const j = ctx.jks as {
          k: (number | null)[];
          d: (number | null)[];
        };
        if (j.k[i] == null || j.d[i] == null) return {};
        const k = j.k[i] as number;
        const long = crossedAbove(j.k, j.d, i) && k >= 15 && k <= 20;
        const short = crossedBelow(j.k, j.d, i) && k >= 80 && k <= 85;
        const exitLong = k > 50 || crossedBelow(j.k, j.d, i);
        const exitShort = k < 50 || crossedAbove(j.k, j.d, i);
        return { long, short, exitLong, exitShort, reason: "JKS OS" };
      };

    case "orbVwapFiltered":
      return (candles, i, ctx) => {
        const ib = ctx.ib as {
          ibHigh: (number | null)[];
          ibLow: (number | null)[];
        };
        const vw = ctx.vwap as (number | null)[];
        const e21 = ctx.emaSlow as (number | null)[];
        if (
          ib.ibHigh[i] == null ||
          ib.ibLow[i] == null ||
          vw[i] == null ||
          e21[i] == null ||
          i < 1
        )
          return {};
        const c = candles[i].close;
        const prev = candles[i - 1].close;
        const ibH = ib.ibHigh[i] as number;
        const ibL = ib.ibLow[i] as number;
        const v = vw[i] as number;
        const ema = e21[i] as number;
        // Skip while IB still forming (high==low until enough bars — still valid after lock)
        const long =
          prev <= ibH && c > ibH && c > v && c > ema;
        const short =
          prev >= ibL && c < ibL && c < v && c < ema;
        const exitLong = c < v || c < ema;
        const exitShort = c > v || c > ema;
        return { long, short, exitLong, exitShort, reason: "ORB+VWAP" };
      };

    case "vwapBounce":
      return (candles, i, ctx) => {
        const vw = ctx.vwap as (number | null)[];
        const eFast = ctx.emaFast as (number | null)[];
        const eSlow = ctx.emaSlow as (number | null)[];
        const a = ctx.atr as (number | null)[];
        if (
          vw[i] == null ||
          eFast[i] == null ||
          eSlow[i] == null ||
          a[i] == null ||
          i < 1
        )
          return {};
        const c = candles[i];
        const v = vw[i] as number;
        const atrV = a[i] as number;
        const touchDist = vwapTouchAtr * atrV;
        const touchedVwap =
          c.low <= v + touchDist && c.high >= v - touchDist;
        const bullTrend = (eFast[i] as number) > (eSlow[i] as number);
        const bearTrend = (eFast[i] as number) < (eSlow[i] as number);
        // Rejection: touched VWAP, closed back in trend direction
        const long =
          bullTrend &&
          touchedVwap &&
          c.close > v &&
          candles[i - 1].close <= v + touchDist;
        const short =
          bearTrend &&
          touchedVwap &&
          c.close < v &&
          candles[i - 1].close >= v - touchDist;
        const exitLong = c.close < v || crossedBelow(eFast, eSlow, i);
        const exitShort = c.close > v || crossedAbove(eFast, eSlow, i);
        return { long, short, exitLong, exitShort, reason: "VWAP bounce" };
      };

    case "rsi2MeanRev":
      return (candles, i, ctx) => {
        const r = ctx.rsi as (number | null)[];
        const regime = ctx.smaRegime as (number | null)[];
        if (r[i] == null || r[i - 1] == null) return {};
        const needRegime = params.requireRegimeAbove === true;
        if (needRegime && (regime[i] == null || candles[i].close <= (regime[i] as number))) {
          return {
            exitLong: (r[i] as number) > rsiOb,
            reason: "RSI2",
          };
        }
        const long =
          (r[i - 1] as number) < rsiOs && (r[i] as number) >= rsiOs;
        const short =
          !needRegime &&
          (r[i - 1] as number) > rsiOb &&
          (r[i] as number) <= rsiOb;
        const exitLong = (r[i] as number) > rsiOb;
        const exitShort = (r[i] as number) < rsiOs;
        return { long, short, exitLong, exitShort, reason: "RSI2 MR" };
      };

    case "donchianTurtle":
      return (candles, i, ctx) => {
        const ent = ctx.donchianEntry as {
          upper: (number | null)[];
          lower: (number | null)[];
        };
        const ex = ctx.donchianExit as {
          upper: (number | null)[];
          lower: (number | null)[];
        };
        if (ent.upper[i] == null || ent.lower[i] == null) return {};
        const c = candles[i].close;
        const long = c > (ent.upper[i] as number);
        const short = c < (ent.lower[i] as number);
        const exitLong =
          ex.lower[i] != null && c < (ex.lower[i] as number);
        const exitShort =
          ex.upper[i] != null && c > (ex.upper[i] as number);
        return { long, short, exitLong, exitShort, reason: "Turtle DC" };
      };

    case "supertrendAdx":
      return (_c, i, ctx) => {
        const st = ctx.st as { direction: (-1 | 1 | null)[] };
        const d = ctx.dmi as {
          adx: (number | null)[];
          plusDI: (number | null)[];
          minusDI: (number | null)[];
        };
        const dir = st.direction;
        if (
          !dir ||
          dir[i] == null ||
          dir[i - 1] == null ||
          d.adx[i] == null
        )
          return {};
        const strong = (d.adx[i] as number) >= adxMin;
        const flipBull =
          (dir[i - 1] as number) < 0 && (dir[i] as number) > 0;
        const flipBear =
          (dir[i - 1] as number) > 0 && (dir[i] as number) < 0;
        const diBull =
          d.plusDI[i] != null &&
          d.minusDI[i] != null &&
          (d.plusDI[i] as number) > (d.minusDI[i] as number);
        const diBear =
          d.plusDI[i] != null &&
          d.minusDI[i] != null &&
          (d.minusDI[i] as number) > (d.plusDI[i] as number);
        const long = strong && flipBull && diBull;
        const short = strong && flipBear && diBear;
        const exitLong =
          (dir[i] as number) < 0 || (d.adx[i] as number) < 20;
        const exitShort =
          (dir[i] as number) > 0 || (d.adx[i] as number) < 20;
        return { long, short, exitLong, exitShort, reason: "ST+ADX" };
      };


    case "dumpStages":
      // Literal invert: ride bearish pump escalation only (expect weak — control)
      return (_c, i, ctx) => {
        const r = ctx.pumpRadar as {
          stage: (number | null)[];
          bias: (number | null)[];
          osc: (number | null)[];
          mid: (number | null)[];
        };
        if (r.stage[i] == null || r.bias[i] == null || r.osc[i] == null || i < 1)
          return {};
        const st = r.stage[i] as number;
        const stPrev = (r.stage[i - 1] as number) ?? 0;
        const bias = r.bias[i] as number;
        const osc = r.osc[i] as number;
        const oscPrev = (r.osc[i - 1] as number) ?? osc;
        const absSt = Math.abs(st);
        const absPrev = Math.abs(stPrev);
        const escalated = absSt >= 2 && absSt > absPrev;
        const midFalling =
          absSt >= 2 &&
          bias < 0 &&
          osc < oscPrev &&
          ((r.mid[i] as number) ?? 0) < 0;
        const short = bias < 0 && (escalated || midFalling || absSt === 3);
        const midNow = (r.mid[i] as number) ?? 0;
        const midPrev = (r.mid[i - 1] as number) ?? midNow;
        const exitShort =
          bias > 0 ||
          absSt <= 1 ||
          (osc > 0 && oscPrev <= 0) ||
          (osc > midNow && oscPrev <= midPrev && absSt < 3);
        return { short, exitShort, reason: "Dump Stages" };
      };
    case "pumpFadeShort":
    case "pumpFadeDelta":
      // Strict reverse: short only when leaving BULL confirm (stage +3 → lower)
      return (_c, i, ctx) => {
        const r = ctx.pumpRadar as {
          stage: (number | null)[];
          bias: (number | null)[];
          osc: (number | null)[];
          mid: (number | null)[];
          confirm: (number | null)[];
          plusDI: (number | null)[];
          minusDI: (number | null)[];
        };
        const cd = ctx.cumDelta as (number | null)[] | undefined;
        if (r.stage[i] == null || r.osc[i] == null || i < 3) return {};
        const st = r.stage[i] as number;
        const stPrev = (r.stage[i - 1] as number) ?? 0;
        const osc = r.osc[i] as number;
        const oscPrev = (r.osc[i - 1] as number) ?? osc;
        const absSt = Math.abs(st);
        const absPrev = Math.abs(stPrev);
        // Newly leave bull confirm (mirror of enter-at-confirm)
        const leaveBullConfirm =
          stPrev > 0 && absPrev === 3 && absSt < 3;
        // Optional: leave bull mid with osc rollover (rarer)
        const leaveBullMid =
          stPrev > 0 &&
          absPrev === 2 &&
          absSt < 2 &&
          osc < oscPrev &&
          oscPrev > 15;
        let short = leaveBullConfirm || leaveBullMid;
        if (preset === "pumpFadeDelta" && short) {
          if (!cd || cd[i] == null || cd[i - 3] == null) return {};
          short = (cd[i] as number) < (cd[i - 3] as number);
        }
        // DI confirm: −DI catching +DI helps (optional soft — require for fade)
        const p = r.plusDI?.[i];
        const m = r.minusDI?.[i];
        const pPrev = r.plusDI?.[i - 1];
        const mPrev = r.minusDI?.[i - 1];
        if (short && p != null && m != null && pPrev != null && mPrev != null) {
          const spread = (m as number) - (p as number);
          const spreadPrev = (mPrev as number) - (pPrev as number);
          // require −DI relative strength improving OR already −DI > +DI
          if (!(spread > spreadPrev || (m as number) > (p as number))) {
            short = false;
          }
        }
        const exitShort =
          (st > 0 && absSt >= 2 && absSt > absPrev) || // bull re-escalates
          (osc > oscPrev && osc > 10 && st > 0) ||
          absSt === 0;
        return {
          short,
          exitShort,
          reason: preset === "pumpFadeDelta" ? "PumpFade+Δ" : "Pump Fade Short",
        };
      };

    case "adxPumpStages":
      return (_c, i, ctx) => {
        const r = ctx.pumpRadar as {
          stage: (number | null)[];
          bias: (number | null)[];
          osc: (number | null)[];
          mid: (number | null)[];
          early: (number | null)[];
          confirm: (number | null)[];
          adx: (number | null)[];
          adxEarly: (number | null)[];
          adxMid: (number | null)[];
          adxConfirmSmooth: (number | null)[];
        };
        if (
          r.stage[i] == null ||
          r.bias[i] == null ||
          r.osc[i] == null ||
          i < 1
        )
          return {};
        const st = r.stage[i] as number;
        const stPrev = (r.stage[i - 1] as number) ?? 0;
        const bias = r.bias[i] as number;
        const osc = r.osc[i] as number;
        const oscPrev = (r.osc[i - 1] as number) ?? osc;
        const absSt = Math.abs(st);
        const absPrev = Math.abs(stPrev);
        // Enter on mid→confirm escalation (stage ≥2) with matching bias; prefer rising osc
        const escalated = absSt >= 2 && absSt > absPrev;
        const midRising =
          absSt >= 2 &&
          bias > 0 &&
          osc > oscPrev &&
          (r.mid[i] as number) > 0;
        const midRisingShort =
          absSt >= 2 &&
          bias < 0 &&
          osc < oscPrev &&
          (r.mid[i] as number) < 0;
        const long =
          bias > 0 && (escalated || midRising || absSt === 3);
        const short =
          bias < 0 && (escalated || midRisingShort || absSt === 3);
        // Faster exits: bias flip, stage drop to 0/1, osc zero-cross — don't wait ADX<20
        const midNow = (r.mid[i] as number) ?? 0;
        const midPrev = (r.mid[i - 1] as number) ?? midNow;
        const exitLong =
          bias < 0 ||
          absSt <= 1 ||
          (osc < 0 && oscPrev >= 0) ||
          (osc < midNow && oscPrev >= midPrev && absSt < 3);
        const exitShort =
          bias > 0 ||
          absSt <= 1 ||
          (osc > 0 && oscPrev <= 0) ||
          (osc > midNow && oscPrev <= midPrev && absSt < 3);
        return {
          long,
          short,
          exitLong,
          exitShort,
          reason: "ADX Pump",
        };
      };


    case "eliziEdgeFire":
      return (_c, i, ctx) => {
        const r = ctx.elizi as {
          phase: (number | null)[];
          edgeTemp: (number | null)[];
          coherence: (number | null)[];
          bias: (number | null)[];
          pathEfficiency: (number | null)[];
          diAccel: (number | null)[];
          volSurprise: (number | null)[];
        } | undefined;
        if (!r || i < 1) return {};
        if (
          r.phase[i] == null ||
          r.edgeTemp[i] == null ||
          r.coherence[i] == null ||
          r.bias[i] == null
        )
          return {};
        const ph = r.phase[i] as number;
        const phPrev = (r.phase[i - 1] as number) ?? 0;
        const temp = r.edgeTemp[i] as number;
        const tempPrev = (r.edgeTemp[i - 1] as number) ?? temp;
        const coh = r.coherence[i] as number;
        const bias = r.bias[i] as number;
        const absPh = Math.abs(ph);
        const absPrev = Math.abs(phPrev);
        const cohArmed = params.coherenceArmed ?? 0.55;
        const fireT = params.fireTemp ?? 62;
        const armedT = params.armedTemp ?? 48;
        // Enter on escalate into armed/fire OR hold fire with real heat
        const escalated =
          absPh >= 2 &&
          absPh > absPrev &&
          coh >= cohArmed &&
          temp > tempPrev;
        const fireHold =
          absPh >= 3 && coh >= cohArmed && temp >= Math.min(55, fireT * 0.9);
        const long = bias > 0 && (escalated || fireHold);
        const short = bias < 0 && (escalated || fireHold);
        const exitLong =
          bias < 0 ||
          absPh === 4 ||
          absPh <= 1 ||
          (temp < tempPrev && temp < armedT * 0.85) ||
          (ph > 0 && absPh < absPrev && absPh <= 2 && temp < armedT);
        const exitShort =
          bias > 0 ||
          absPh === 4 ||
          absPh <= 1 ||
          (temp < tempPrev && temp < armedT * 0.85) ||
          (ph < 0 && absPh < absPrev && absPh <= 2 && temp < armedT);
        return {
          long,
          short,
          exitLong,
          exitShort,
          reason: "Elizi Fire",
        };
      };

    case "eliziEdgeExhaust":
      return (_c, i, ctx) => {
        const r = ctx.elizi as {
          phase: (number | null)[];
          edgeTemp: (number | null)[];
          coherence: (number | null)[];
          bias: (number | null)[];
          volSurprise: (number | null)[];
          pathEfficiency: (number | null)[];
          diAccel: (number | null)[];
        } | undefined;
        if (!r || i < 1) return {};
        if (r.phase[i] == null || r.bias[i] == null || r.edgeTemp[i] == null)
          return {};
        const ph = r.phase[i] as number;
        const phPrev = (r.phase[i - 1] as number) ?? 0;
        const bias = r.bias[i] as number;
        const temp = r.edgeTemp[i] as number;
        const tempPrev = (r.edgeTemp[i - 1] as number) ?? temp;
        const sur = r.volSurprise[i];
        const minSur = params.surpriseHigh ?? 0.7;
        const absPh = Math.abs(ph);
        const absPrev = Math.abs(phPrev);
        // Fade: enter opposite to exhaustion bias when phase newly hits exhaust
        const newlyExhaust = absPh === 4 && absPrev < 4;
        const surOk = sur == null || sur >= minSur * 0.85;
        // +4 exhaust (bull heat dying) → short fade; −4 → long fade
        const long = newlyExhaust && surOk && ph < 0;
        const short = newlyExhaust && surOk && ph > 0;
        // Exit fade when phase leaves exhaust or temp re-accelerates with old bias
        const exitLong =
          absPh !== 4 ||
          (ph > 0 && absPh >= 2) ||
          (temp > tempPrev && temp > (params.armedTemp ?? 48));
        const exitShort =
          absPh !== 4 ||
          (ph < 0 && absPh >= 2) ||
          (temp > tempPrev && temp > (params.armedTemp ?? 48));
        return {
          long,
          short,
          exitLong,
          exitShort,
          reason: "Elizi Exhaust Fade",
        };
      };



    case "exhaustDelta":
      return (_c, i, ctx) => {
        const r = ctx.elizi as {
          phase: (number | null)[];
          edgeTemp: (number | null)[];
          volSurprise: (number | null)[];
        } | undefined;
        const cd = ctx.cumDelta as (number | null)[];
        if (!r || i < 3) return {};
        if (r.phase[i] == null || r.edgeTemp[i] == null) return {};
        const ph = r.phase[i] as number;
        const phPrev = (r.phase[i - 1] as number) ?? 0;
        const temp = r.edgeTemp[i] as number;
        const tempPrev = (r.edgeTemp[i - 1] as number) ?? temp;
        const sur = r.volSurprise[i];
        const minSur = params.surpriseHigh ?? 0.7;
        const newlyExhaust = Math.abs(ph) === 4 && Math.abs(phPrev) < 4;
        const surOk = sur == null || sur >= minSur * 0.85;
        const c0 = cd[i];
        const c3 = cd[i - 3];
        if (c0 == null || c3 == null) return {};
        const deltaDn = (c0 as number) < (c3 as number);
        const deltaUp = (c0 as number) > (c3 as number);
        const long = newlyExhaust && surOk && ph < 0 && deltaUp;
        const short = newlyExhaust && surOk && ph > 0 && deltaDn;
        const absPh = Math.abs(ph);
        const exitLong =
          absPh !== 4 ||
          (ph > 0 && absPh >= 2) ||
          (temp > tempPrev && temp > (params.armedTemp ?? 48));
        const exitShort =
          absPh !== 4 ||
          (ph < 0 && absPh >= 2) ||
          (temp > tempPrev && temp > (params.armedTemp ?? 48));
        return { long, short, exitLong, exitShort, reason: "Exhaust+Delta" };
      };
    case "exhaustFlow":
      return (_c, i, ctx) => {
        const r = ctx.elizi as {
          phase: (number | null)[];
          edgeTemp: (number | null)[];
          volSurprise: (number | null)[];
          flowAgree: (number | null)[];
        } | undefined;
        if (!r || i < 1) return {};
        if (r.phase[i] == null || r.edgeTemp[i] == null) return {};
        const ph = r.phase[i] as number;
        const phPrev = (r.phase[i - 1] as number) ?? 0;
        const temp = r.edgeTemp[i] as number;
        const tempPrev = (r.edgeTemp[i - 1] as number) ?? temp;
        const sur = r.volSurprise[i];
        const flow = r.flowAgree[i];
        const minSur = params.surpriseHigh ?? 0.7;
        const newlyExhaust = Math.abs(ph) === 4 && Math.abs(phPrev) < 4;
        const surOk = sur == null || sur >= minSur * 0.85;
        const flowOkShort = flow == null || (flow as number) <= 0;
        const flowOkLong = flow == null || (flow as number) >= 0;
        const long = newlyExhaust && surOk && ph < 0 && flowOkLong;
        const short = newlyExhaust && surOk && ph > 0 && flowOkShort;
        const absPh = Math.abs(ph);
        const exitLong =
          absPh !== 4 ||
          (ph > 0 && absPh >= 2) ||
          (temp > tempPrev && temp > (params.armedTemp ?? 48));
        const exitShort =
          absPh !== 4 ||
          (ph < 0 && absPh >= 2) ||
          (temp > tempPrev && temp > (params.armedTemp ?? 48));
        return { long, short, exitLong, exitShort, reason: "Exhaust+Flow" };
      };
    case "exhaustSmiExit":
      return (_c, i, ctx) => {
        const r = ctx.elizi as {
          phase: (number | null)[];
          edgeTemp: (number | null)[];
          volSurprise: (number | null)[];
        } | undefined;
        const s = ctx.smiOsc as { smi: (number | null)[]; signal: (number | null)[] };
        if (!r || i < 1) return {};
        if (r.phase[i] == null || r.edgeTemp[i] == null) return {};
        const ph = r.phase[i] as number;
        const phPrev = (r.phase[i - 1] as number) ?? 0;
        const sur = r.volSurprise[i];
        const minSur = params.surpriseHigh ?? 0.7;
        const newlyExhaust = Math.abs(ph) === 4 && Math.abs(phPrev) < 4;
        const surOk = sur == null || sur >= minSur * 0.85;
        const long = newlyExhaust && surOk && ph < 0;
        const short = newlyExhaust && surOk && ph > 0;
        // Exit on SMI flip against fade; also leave when phase exits exhaust
        const absPh = Math.abs(ph);
        const exitLong = crossedBelow(s.smi, s.signal, i) || absPh !== 4;
        const exitShort = crossedAbove(s.smi, s.signal, i) || absPh !== 4;
        return { long, short, exitLong, exitShort, reason: "Exhaust+SMI exit" };
      };

    case "hybridMacdPump":
    case "hybridMacdPumpLong":
      return (_c, i, ctx) => {
        const m = ctx.macd as {
          macd: (number | null)[];
          signal: (number | null)[];
          hist: (number | null)[];
        };
        const r = ctx.pumpRadar as {
          stage: (number | null)[];
          bias: (number | null)[];
        };
        const d = ctx.dmi as {
          plusDI: (number | null)[];
          minusDI: (number | null)[];
        };
        const j = ctx.jks as {
          k: (number | null)[];
          d: (number | null)[];
          state: (number | null)[];
        };
        const el = ctx.elizi as
          | {
              phase: (number | null)[];
              volSurprise: (number | null)[];
            }
          | undefined;
        if (
          i < 1 ||
          m.macd[i] == null ||
          m.signal[i] == null ||
          r.stage[i] == null ||
          r.bias[i] == null
        )
          return {};
        const macdBull = crossedAbove(m.macd, m.signal, i);
        const macdBear = crossedBelow(m.macd, m.signal, i);
        const macdUp = (m.macd[i] as number) > (m.signal[i] as number);
        const bias = r.bias[i] as number;
        const absSt = Math.abs(r.stage[i] as number);
        const absPrev = Math.abs((r.stage[i - 1] as number) ?? 0);
        const pumpEsc =
          absSt >= 2 && absSt > absPrev && bias > 0;
        const diBull =
          d.plusDI[i] != null &&
          d.minusDI[i] != null &&
          (d.plusDI[i] as number) > (d.minusDI[i] as number);
        // Bakeoff: MACD long was strong; Pump long strong; don't over-filter MACD longs.
        const long =
          macdBull || (pumpEsc && macdUp && diBull);
        // Bakeoff: Jurik/MACD shorts overshot when stacked; only Elizi Exhaust fade shorts.
        let exhaustShort = false;
        if (el && el.phase[i] != null) {
          const ph = el.phase[i] as number;
          const phPrev = (el.phase[i - 1] as number) ?? 0;
          const newly = Math.abs(ph) === 4 && Math.abs(phPrev) < 4;
          exhaustShort = newly && ph > 0; // bull exhaust → short fade
        }
        const short =
          params.preset !== "hybridMacdPumpLong" && exhaustShort;
        // Keep MACD-style exits — bakeoff: bias exits cut MACD long runners.
        const exitLong = macdBear;
        const exitShort = macdBull;
        return {
          long,
          short,
          exitLong,
          exitShort,
          reason:
            params.preset === "hybridMacdPumpLong"
              ? "Hybrid L (MACD/Pump)"
              : "Hybrid MACD/Pump/JKS",
        };
      };


    case "shortRsiOb":
      return (_c, i, ctx) => {
        const r = ctx.rsi as (number | null)[];
        if (r[i] == null || r[i - 1] == null) return {};
        const short =
          (r[i - 1] as number) >= 70 && (r[i] as number) < 70;
        const exitShort = (r[i] as number) < 50;
        return { short, exitShort, reason: "RSI70 reject" };
      };
    case "shortTsiSignal":
      return (_c, i, ctx) => {
        const t = ctx.tsiLine as {
          tsi: (number | null)[];
          signal: (number | null)[];
        };
        const r = ctx.rsi as (number | null)[];
        if (t.tsi[i] == null || t.signal[i] == null) return {};
        const rsiOk = r[i] == null || (r[i] as number) >= 50;
        const tsiHigh = (t.tsi[i] as number) > 0;
        const short =
          crossedBelow(t.tsi, t.signal, i) && rsiOk && tsiHigh;
        const exitShort =
          crossedAbove(t.tsi, t.signal, i) ||
          (t.tsi[i] as number) < 0;
        return { short, exitShort, reason: "TSI×sig short" };
      };
    case "shortRsiDiv":
      return (candles, i, ctx) => {
        const r = ctx.rsi as (number | null)[];
        const highs = candles.map((c) => c.high);
        if (!bearDiv(highs, r, i, 16)) return {};
        // Structure trigger: close below prior 3-bar low (not div-alone)
        const floor = Math.min(
          candles[i - 1].low,
          candles[i - 2].low,
          candles[i - 3].low
        );
        const short = candles[i].close < floor;
        const exitShort =
          r[i] != null && (r[i] as number) < 45;
        return { short, exitShort, reason: "RSI div+break" };
      };
    case "shortTsiDiv":
      return (candles, i, ctx) => {
        const t = ctx.tsiLine as {
          tsi: (number | null)[];
          signal: (number | null)[];
        };
        const highs = candles.map((c) => c.high);
        if (!bearDiv(highs, t.tsi, i, 20)) return {};
        const floor = Math.min(
          candles[i - 1].low,
          candles[i - 2].low,
          candles[i - 3].low
        );
        const short = candles[i].close < floor;
        const exitShort =
          t.tsi[i] != null &&
          t.signal[i] != null &&
          crossedAbove(t.tsi, t.signal, i);
        return { short, exitShort, reason: "TSI div+break" };
      };
    case "shortEnergyFade":
      return (candles, i, ctx) => {
        const r = ctx.rsi as (number | null)[];
        const t = ctx.tsiLine as {
          tsi: (number | null)[];
          signal: (number | null)[];
        };
        const el = ctx.elizi as
          | {
              phase: (number | null)[];
              volSurprise: (number | null)[];
              pathEfficiency: (number | null)[];
            }
          | undefined;
        if (r[i] == null || t.tsi[i] == null) return {};
        let exhaust = false;
        if (el && el.phase[i] != null) {
          const ph = el.phase[i] as number;
          const phPrev = (el.phase[i - 1] as number) ?? 0;
          exhaust = Math.abs(ph) === 4 && ph > 0 && Math.abs(phPrev) < 4;
        }
        const rsiHot = (r[i] as number) >= 60;
        const tsiFade = crossedBelow(t.tsi, t.signal, i);
        const short = (exhaust && rsiHot) || (tsiFade && rsiHot);
        const exitShort =
          (r[i] as number) < 50 ||
          crossedAbove(t.tsi, t.signal, i);
        return { short, exitShort, reason: "Energy fade" };
      };


    case "earlyFisher":
      return (_c, i, ctx) => {
        const f = ctx.fisherOsc as {
          fisher: (number | null)[];
          trigger: (number | null)[];
        };
        const long = crossedAbove(f.fisher, f.trigger, i);
        const short = crossedBelow(f.fisher, f.trigger, i);
        return {
          long,
          short,
          exitLong: short,
          exitShort: long,
          reason: "Fisher early",
        };
      };
    case "earlyFisherTrend":
      return (candles, i, ctx) => {
        const f = ctx.fisherOsc as {
          fisher: (number | null)[];
          trigger: (number | null)[];
        };
        const e200 = ctx.ema200 as (number | null)[];
        if (!e200 || e200[i] == null) return {};
        const above = candles[i].close > (e200[i] as number);
        const below = candles[i].close < (e200[i] as number);
        const long = above && crossedAbove(f.fisher, f.trigger, i);
        const short = below && crossedBelow(f.fisher, f.trigger, i);
        return {
          long,
          short,
          exitLong: crossedBelow(f.fisher, f.trigger, i),
          exitShort: crossedAbove(f.fisher, f.trigger, i),
          reason: "Fisher×EMA200",
        };
      };
    case "earlyStoch":
      return (_c, i, ctx) => {
        const s = ctx.stochOsc as { k: (number | null)[]; d: (number | null)[] };
        if (s.k[i] == null || s.d[i] == null) return {};
        const long =
          crossedAbove(s.k, s.d, i) && (s.k[i] as number) < 25;
        const short =
          crossedBelow(s.k, s.d, i) && (s.k[i] as number) > 75;
        return {
          long,
          short,
          exitLong: crossedBelow(s.k, s.d, i) || (s.k[i] as number) > 80,
          exitShort: crossedAbove(s.k, s.d, i) || (s.k[i] as number) < 20,
          reason: "Stoch early",
        };
      };
    case "earlyWaveTrend":
      return (_c, i, ctx) => {
        const w = ctx.wtOsc as {
          wt1: (number | null)[];
          wt2: (number | null)[];
        };
        if (w.wt1[i] == null || w.wt2[i] == null) return {};
        const long =
          crossedAbove(w.wt1, w.wt2, i) && (w.wt1[i] as number) < -50;
        const short =
          crossedBelow(w.wt1, w.wt2, i) && (w.wt1[i] as number) > 50;
        return {
          long,
          short,
          exitLong: crossedBelow(w.wt1, w.wt2, i) || (w.wt1[i] as number) > 45,
          exitShort: crossedAbove(w.wt1, w.wt2, i) || (w.wt1[i] as number) < -45,
          reason: "WT early",
        };
      };
    case "earlyConnors":
      return (_c, i, ctx) => {
        const c = ctx.connors as (number | null)[];
        if (c[i] == null || c[i - 1] == null) return {};
        const long =
          (c[i - 1] as number) < 10 && (c[i] as number) >= 10;
        const short =
          (c[i - 1] as number) > 90 && (c[i] as number) <= 90;
        return {
          long,
          short,
          exitLong: (c[i] as number) > 70 || ((c[i - 1] as number) < 50 && (c[i] as number) >= 50),
          exitShort: (c[i] as number) < 30 || ((c[i - 1] as number) > 50 && (c[i] as number) <= 50),
          reason: "CRSI early",
        };
      };


    case "qTrendOnly":
      return (candles, i, ctx) => {
        const q = ctx.qTrendOsc as {
          buy: boolean[];
          sell: boolean[];
          strongBuy: boolean[];
          strongSell: boolean[];
        };
        if (!q) return {};
        return {
          long: q.buy[i],
          short: q.sell[i],
          exitLong: q.sell[i],
          exitShort: q.buy[i],
          reason: "Q-Trend",
        };
      };
    case "qTrendKlinger":
      return (candles, i, ctx) => {
        const q = ctx.qTrendOsc as {
          buy: boolean[];
          sell: boolean[];
          strongBuy: boolean[];
          strongSell: boolean[];
        };
        const k = ctx.klingerOsc as {
          kvo: (number | null)[];
          signal: (number | null)[];
        };
        if (!q || !k || k.kvo[i] == null) return {};
        const green = (k.kvo[i] as number) > 0;
        const red = (k.kvo[i] as number) < 0;
        const bull = candles[i].close > candles[i].open;
        const bear = candles[i].close < candles[i].open;
        const long = q.buy[i] && green && bull;
        const short = q.strongSell[i] && red && bear;
        return {
          long,
          short,
          exitLong: q.sell[i] || red,
          exitShort: q.buy[i] || green,
          reason: "Q-Trend×Klinger",
        };
      };


    case "jurikBbTurtle":
      return (candles, i, ctx) => {
        const bb = ctx.jurikBb as {
          mid: (number | null)[];
          upper: (number | null)[];
          lower: (number | null)[];
        };
        const fast = ctx.jurikBbFast as {
          mid: (number | null)[];
          upper: (number | null)[];
          lower: (number | null)[];
        };
        if (
          !bb ||
          bb.upper[i] == null ||
          bb.upper[i - 1] == null ||
          bb.mid[i] == null ||
          bb.lower[i] == null
        )
          return {};
        const c = candles[i].close;
        const prev = candles[i - 1].close;
        // Turtle-style: break prior band extreme (use previous bar's upper/lower)
        const long =
          prev <= (bb.upper[i - 1] as number) && c > (bb.upper[i] as number);
        const short =
          prev >= (bb.lower[i - 1] as number) && c < (bb.lower[i] as number);
        const exitLong =
          c < (bb.mid[i] as number) ||
          (fast?.lower[i] != null && c < (fast.lower[i] as number));
        const exitShort =
          c > (bb.mid[i] as number) ||
          (fast?.upper[i] != null && c > (fast.upper[i] as number));
        return { long, short, exitLong, exitShort, reason: "Jurik BB Turtle" };
      };
    case "jurikDonchHybrid":
      return (candles, i, ctx) => {
        const ent = ctx.donchianEntry as {
          upper: (number | null)[];
          lower: (number | null)[];
        };
        const ex = ctx.donchianExit as {
          upper: (number | null)[];
          lower: (number | null)[];
        };
        const bb = ctx.jurikBb as {
          mid: (number | null)[];
          upper: (number | null)[];
          lower: (number | null)[];
        };
        if (
          !ent ||
          !bb ||
          ent.upper[i] == null ||
          ent.lower[i] == null ||
          bb.mid[i] == null ||
          bb.mid[i - 1] == null
        )
          return {};
        const c = candles[i].close;
        const mid = bb.mid[i] as number;
        const midPrev = bb.mid[i - 1] as number;
        const midUp = mid > midPrev;
        const midDn = mid < midPrev;
        // Donchian breakout + Jurik BB mid trend + price on right side of mid
        const long = c > (ent.upper[i] as number) && c > mid && midUp;
        const short = c < (ent.lower[i] as number) && c < mid && midDn;
        const exitLong =
          (ex.lower[i] != null && c < (ex.lower[i] as number)) || c < mid;
        const exitShort =
          (ex.upper[i] != null && c > (ex.upper[i] as number)) || c > mid;
        return { long, short, exitLong, exitShort, reason: "Jurik×Donch" };
      };


    case "jurikMaCross":
      return (_c, i, ctx) => {
        const f = ctx.jmaFast as (number | null)[];
        const s = ctx.jmaSlow as (number | null)[];
        if (!f || !s || f[i] == null || s[i] == null || f[i - 1] == null || s[i - 1] == null)
          return {};
        const long = crossedAbove(f, s, i);
        const short = crossedBelow(f, s, i);
        return {
          long,
          short,
          exitLong: short || (f[i] as number) < (s[i] as number),
          exitShort: long || (f[i] as number) > (s[i] as number),
          reason: "Jurik MA cross",
        };
      };
    case "jurikMaDonch":
      return (candles, i, ctx) => {
        const ent = ctx.donchianEntry as {
          upper: (number | null)[];
          lower: (number | null)[];
        };
        const ex = ctx.donchianExit as {
          upper: (number | null)[];
          lower: (number | null)[];
        };
        const f = ctx.jmaFast as (number | null)[];
        const s = ctx.jmaSlow as (number | null)[];
        if (
          !ent ||
          !f ||
          !s ||
          ent.upper[i] == null ||
          ent.lower[i] == null ||
          f[i] == null ||
          s[i] == null ||
          f[i - 1] == null ||
          s[i - 1] == null
        )
          return {};
        const c = candles[i].close;
        const bull = (f[i] as number) > (s[i] as number);
        const bear = (f[i] as number) < (s[i] as number);
        const bullRising =
          bull && (f[i] as number) - (s[i] as number) >= (f[i - 1] as number) - (s[i - 1] as number);
        const bearFalling =
          bear && (s[i] as number) - (f[i] as number) >= (s[i - 1] as number) - (f[i - 1] as number);
        // Turtle breakout only with Jurik MA trend alignment
        const long = c > (ent.upper[i] as number) && bullRising;
        const short = c < (ent.lower[i] as number) && bearFalling;
        const exitLong =
          (ex.lower[i] != null && c < (ex.lower[i] as number)) ||
          crossedBelow(f, s, i) ||
          !bull;
        const exitShort =
          (ex.upper[i] != null && c > (ex.upper[i] as number)) ||
          crossedAbove(f, s, i) ||
          !bear;
        return { long, short, exitLong, exitShort, reason: "JurikMA×Donch" };
      };


    case "donchianBlaster":
    case "donchianBlasterHma":
      return (candles, i, ctx) => {
        const ent = ctx.donchianEntry as {
          upper: (number | null)[];
          lower: (number | null)[];
        };
        const ex = ctx.donchianExit as {
          upper: (number | null)[];
          lower: (number | null)[];
        };
        const useHma = params.preset === "donchianBlasterHma";
        const trend = (useHma ? ctx.hmaTrend : ctx.lsma) as (number | null)[];
        if (
          !ent ||
          !trend ||
          ent.upper[i] == null ||
          ent.lower[i] == null ||
          trend[i] == null ||
          trend[i - 1] == null
        )
          return {};
        const c = candles[i].close;
        const t = trend[i] as number;
        const tPrev = trend[i - 1] as number;
        const rising = t > tPrev;
        const falling = t < tPrev;
        // pckalai: LR/HMA = trend + setup + stop; DC = ride
        const long = c > (ent.upper[i] as number) && c > t && rising;
        const short = c < (ent.lower[i] as number) && c < t && falling;
        const exitLong =
          c < t ||
          (ex.lower[i] != null && c < (ex.lower[i] as number));
        const exitShort =
          c > t ||
          (ex.upper[i] != null && c > (ex.upper[i] as number));
        return {
          long,
          short,
          exitLong,
          exitShort,
          reason: useHma ? "DC Blaster HMA" : "DC Blaster LSMA",
        };
      };


    case "oscQqe":
      return (_c, i, ctx) => {
        const q = ctx.qqeOsc as {
          rsi: (number | null)[];
          trail: (number | null)[];
        };
        if (!q || q.rsi[i] == null || q.trail[i] == null) return {};
        const long = crossedAbove(q.rsi, q.trail, i);
        const short = crossedBelow(q.rsi, q.trail, i);
        return { long, short, exitLong: short, exitShort: long, reason: "QQE" };
      };
    case "oscSchaff":
      return (_c, i, ctx) => {
        const s = ctx.schaffOsc as { stc: (number | null)[] };
        if (!s || s.stc[i] == null || s.stc[i - 1] == null) return {};
        const a = s.stc[i - 1] as number;
        const b = s.stc[i] as number;
        const long = a < 25 && b >= 25;
        const short = a > 75 && b <= 75;
        return {
          long,
          short,
          exitLong: b > 75 || (a < 50 && b >= 50 && a > 25),
          exitShort: b < 25 || (a > 50 && b <= 50 && a < 75),
          reason: "STC",
        };
      };
    case "oscLaguerre":
      return (_c, i, ctx) => {
        const l = ctx.lagRsi as { lrsi: (number | null)[] };
        if (!l || l.lrsi[i] == null || l.lrsi[i - 1] == null) return {};
        const a = l.lrsi[i - 1] as number;
        const b = l.lrsi[i] as number;
        const long = a < 20 && b >= 20;
        const short = a > 80 && b <= 80;
        return { long, short, exitLong: b > 80, exitShort: b < 20, reason: "Laguerre" };
      };
    case "oscSqueeze":
      return (_c, i, ctx) => {
        const s = ctx.squeezeOsc as {
          mom: (number | null)[];
          squeeze: (number | null)[];
        };
        if (!s || s.mom[i] == null || s.mom[i - 1] == null || s.squeeze[i] == null)
          return {};
        const fired =
          (s.squeeze[i - 1] as number) === 1 && (s.squeeze[i] as number) === 0;
        const long = fired && (s.mom[i] as number) > 0;
        const short = fired && (s.mom[i] as number) < 0;
        return {
          long,
          short,
          exitLong: (s.mom[i] as number) < 0,
          exitShort: (s.mom[i] as number) > 0,
          reason: "Squeeze",
        };
      };
    case "oscStochRsi":
      return (_c, i, ctx) => {
        const s = ctx.stochRsiOsc as { k: (number | null)[]; d: (number | null)[] };
        if (!s || s.k[i] == null || s.d[i] == null) return {};
        const long = crossedAbove(s.k, s.d, i) && (s.k[i] as number) < 20;
        const short = crossedBelow(s.k, s.d, i) && (s.k[i] as number) > 80;
        return {
          long,
          short,
          exitLong: (s.k[i] as number) > 80 || crossedBelow(s.k, s.d, i),
          exitShort: (s.k[i] as number) < 20 || crossedAbove(s.k, s.d, i),
          reason: "StochRSI",
        };
      };
    case "oscSmi":
      return (_c, i, ctx) => {
        const s = ctx.smiOsc as { smi: (number | null)[]; signal: (number | null)[] };
        if (!s || s.smi[i] == null || s.signal[i] == null) return {};
        const long = crossedAbove(s.smi, s.signal, i);
        const short = crossedBelow(s.smi, s.signal, i);
        return { long, short, exitLong: short, exitShort: long, reason: "SMI" };
      };
    case "oscWaddah":
      return (_c, i, ctx) => {
        const w = ctx.waddahOsc as {
          up: (number | null)[];
          down: (number | null)[];
          explosion: (number | null)[];
        };
        if (!w || w.up[i] == null || w.down[i] == null || w.explosion[i] == null)
          return {};
        const exp = w.explosion[i] as number;
        const long =
          (w.up[i] as number) > exp &&
          (w.up[i] as number) > (w.down[i] as number) &&
          (w.up[i - 1] == null || (w.up[i - 1] as number) <= exp);
        const short =
          (w.down[i] as number) > exp &&
          (w.down[i] as number) > (w.up[i] as number) &&
          (w.down[i - 1] == null || (w.down[i - 1] as number) <= exp);
        return {
          long,
          short,
          exitLong: (w.up[i] as number) < exp,
          exitShort: (w.down[i] as number) < exp,
          reason: "Waddah",
        };
      };
    case "oscCoppock":
      return (_c, i, ctx) => {
        const c = ctx.coppockOsc as (number | null)[];
        if (!c || c[i] == null || c[i - 1] == null) return {};
        const long = (c[i - 1] as number) <= 0 && (c[i] as number) > 0;
        const short = (c[i - 1] as number) >= 0 && (c[i] as number) < 0;
        return { long, short, exitLong: short, exitShort: long, reason: "Coppock" };
      };


    case "smiLongOnly":
      return (_c, i, ctx) => {
        const s = ctx.smiOsc as { smi: (number | null)[]; signal: (number | null)[] };
        if (!s || s.smi[i] == null || s.signal[i] == null) return {};
        const long = crossedAbove(s.smi, s.signal, i);
        return {
          long,
          short: false,
          exitLong: crossedBelow(s.smi, s.signal, i),
          reason: "SMI long",
        };
      };
    case "eliziPulse":
      return (_c, i, ctx) => {
        const s = ctx.smiOsc as { smi: (number | null)[]; signal: (number | null)[] };
        const sq = ctx.squeezeOsc as {
          mom: (number | null)[];
          squeeze: (number | null)[];
        };
        const el = ctx.elizi as
          | {
              phase: (number | null)[];
              edgeTemp: (number | null)[];
              volSurprise: (number | null)[];
            }
          | undefined;
        if (!s || !sq || s.smi[i] == null || s.signal[i] == null || sq.mom[i] == null)
          return {};
        const smiUp = crossedAbove(s.smi, s.signal, i);
        const smiDn = crossedBelow(s.smi, s.signal, i);
        const fired =
          sq.squeeze[i] != null &&
          sq.squeeze[i - 1] != null &&
          (sq.squeeze[i - 1] as number) === 1 &&
          (sq.squeeze[i] as number) === 0;
        const momUp = (sq.mom[i] as number) > 0;
        const momDn = (sq.mom[i] as number) < 0;
        let ph = 0;
        let phPrev = 0;
        let surOk = true;
        if (el && el.phase[i] != null) {
          ph = el.phase[i] as number;
          phPrev = (el.phase[i - 1] as number) ?? 0;
          const sur = el.volSurprise?.[i];
          surOk = sur == null || sur >= 0.55;
        }
        const newlyExhaust = Math.abs(ph) === 4 && Math.abs(phPrev) < 4;
        const dyingHeat = ph === 4;
        const long =
          !dyingHeat && (smiUp || (fired && momUp));
        const short = newlyExhaust && surOk && ph > 0;
        const exitLong = smiDn || momDn || newlyExhaust;
        const exitShort =
          !newlyExhaust &&
          (Math.abs(ph) !== 4 ||
            (el?.edgeTemp &&
              el.edgeTemp[i] != null &&
              el.edgeTemp[i - 1] != null &&
              (el.edgeTemp[i] as number) > (el.edgeTemp[i - 1] as number)));
        return { long, short, exitLong, exitShort, reason: "Elizi Pulse" };
      };
    case "eliziPulseAnd":
      return (_c, i, ctx) => {
        const s = ctx.smiOsc as { smi: (number | null)[]; signal: (number | null)[] };
        const sq = ctx.squeezeOsc as {
          mom: (number | null)[];
          squeeze: (number | null)[];
        };
        const el = ctx.elizi as { phase: (number | null)[] } | undefined;
        if (!s || !sq || s.smi[i] == null || sq.mom[i] == null) return {};
        const smiUp = crossedAbove(s.smi, s.signal, i);
        const smiDn = crossedBelow(s.smi, s.signal, i);
        const momUp = (sq.mom[i] as number) > 0;
        const ph = el?.phase[i] ?? 0;
        const long = smiUp && momUp && ph !== 4;
        return {
          long,
          short: false,
          exitLong: smiDn || (sq.mom[i] as number) < 0,
          reason: "Pulse AND",
        };
      };


    case "eliziStack":
      return (_c, i, ctx) => {
        const s = ctx.smiOsc as { smi: (number | null)[]; signal: (number | null)[] };
        const el = ctx.elizi as
          | {
              phase: (number | null)[];
              edgeTemp: (number | null)[];
              volSurprise: (number | null)[];
            }
          | undefined;
        if (!s || s.smi[i] == null || s.signal[i] == null) return {};
        const smiUp = crossedAbove(s.smi, s.signal, i);
        const smiDn = crossedBelow(s.smi, s.signal, i);
        let short = false;
        let exitShort = false;
        if (el && el.phase[i] != null) {
          const ph = el.phase[i] as number;
          const phPrev = (el.phase[i - 1] as number) ?? 0;
          const newlyExhaust = Math.abs(ph) === 4 && Math.abs(phPrev) < 4;
          const sur = el.volSurprise?.[i];
          const surOk = sur == null || sur >= 0.55;
          short = newlyExhaust && surOk && ph > 0;
          const temp = el.edgeTemp?.[i];
          const tempPrev = el.edgeTemp?.[i - 1];
          exitShort =
            Math.abs(ph) !== 4 ||
            (temp != null &&
              tempPrev != null &&
              (temp as number) > (tempPrev as number));
        }
        return {
          long: smiUp,
          short,
          exitLong: smiDn,
          exitShort,
          reason: "Elizi Stack",
        };
      };


    case "hybridSmiLong":
    case "hybridSmiAnd":
      return (_c, i, ctx) => {
        const m = ctx.macd as {
          macd: (number | null)[];
          signal: (number | null)[];
        };
        const r = ctx.pumpRadar as {
          stage: (number | null)[];
          bias: (number | null)[];
        };
        const d = ctx.dmi as {
          plusDI: (number | null)[];
          minusDI: (number | null)[];
        };
        const s = ctx.smiOsc as {
          smi: (number | null)[];
          signal: (number | null)[];
        };
        if (
          !m ||
          !r ||
          !s ||
          m.macd[i] == null ||
          m.signal[i] == null ||
          r.stage[i] == null ||
          s.smi[i] == null ||
          s.signal[i] == null
        )
          return {};
        const macdBull = crossedAbove(m.macd, m.signal, i);
        const macdBear = crossedBelow(m.macd, m.signal, i);
        const macdUp = (m.macd[i] as number) > (m.signal[i] as number);
        const bias = r.bias[i] as number;
        const absSt = Math.abs(r.stage[i] as number);
        const absPrev = Math.abs((r.stage[i - 1] as number) ?? 0);
        const pumpEsc = absSt >= 2 && absSt > absPrev && bias > 0;
        const diBull =
          d.plusDI[i] != null &&
          d.minusDI[i] != null &&
          (d.plusDI[i] as number) > (d.minusDI[i] as number);
        const hybridLong = macdBull || (pumpEsc && macdUp && diBull);
        const smiUp = crossedAbove(s.smi, s.signal, i);
        const smiDn = crossedBelow(s.smi, s.signal, i);
        const andMode = params.preset === "hybridSmiAnd";
        const long = andMode ? hybridLong && smiUp : hybridLong || smiUp;
        // OR book: exit when either sleeve says exit (keeps book from overstaying)
        // AND book: exit when either fails
        const exitLong = andMode ? macdBear || smiDn : macdBear || smiDn;
        return {
          long,
          short: false,
          exitLong,
          reason: andMode ? "Hybrid∧SMI" : "Hybrid∨SMI",
        };
      };


    case "oscTsi":
      return (_c, i, ctx) => {
        const t = ctx.tsiLine as { tsi: (number | null)[]; signal: (number | null)[] };
        if (!t || t.tsi[i] == null || t.signal[i] == null) return {};
        const long = crossedAbove(t.tsi, t.signal, i);
        const short = crossedBelow(t.tsi, t.signal, i);
        return { long, short, exitLong: short, exitShort: long, reason: "TSI Ergodic" };
      };
    case "tsiLongOnly":
      return (_c, i, ctx) => {
        const t = ctx.tsiLine as { tsi: (number | null)[]; signal: (number | null)[] };
        if (!t || t.tsi[i] == null || t.signal[i] == null) return {};
        return {
          long: crossedAbove(t.tsi, t.signal, i),
          short: false,
          exitLong: crossedBelow(t.tsi, t.signal, i),
          reason: "TSI long",
        };
      };
    case "oscTsiOb":
      return (_c, i, ctx) => {
        const t = ctx.tsiLine as { tsi: (number | null)[]; signal: (number | null)[] };
        if (!t || t.tsi[i] == null || t.tsi[i - 1] == null) return {};
        const a = t.tsi[i - 1] as number;
        const b = t.tsi[i] as number;
        const long = a <= -25 && b > -25;
        const short = a >= 25 && b < 25;
        return {
          long,
          short,
          exitLong: b >= 25 || crossedBelow(t.tsi, t.signal, i),
          exitShort: b <= -25 || crossedAbove(t.tsi, t.signal, i),
          reason: "TSI OB/OS",
        };
      };


    case "twinNeck":
      return (_c, i, ctx) => {
        const d = ctx.diagSr as {
          dbLong: boolean[];
          dtShort: boolean[];
        };
        if (!d) return {};
        return {
          long: d.dbLong[i],
          short: d.dtShort[i],
          exitLong: d.dtShort[i],
          exitShort: d.dbLong[i],
          reason: "Twin neck",
        };
      };
    case "tripleNeck":
      return (_c, i, ctx) => {
        const d = ctx.diagSr as {
          tbLong: boolean[];
          ttShort: boolean[];
          dbLong: boolean[];
          dtShort: boolean[];
        };
        if (!d) return {};
        const long = d.tbLong[i] || d.dbLong[i];
        const short = d.ttShort[i] || d.dtShort[i];
        return {
          long,
          short,
          exitLong: short,
          exitShort: long,
          reason: "Triple/twin neck",
        };
      };
    case "diagonalBounce":
      return (_c, i, ctx) => {
        const d = ctx.diagSr as {
          bounceLong: boolean[];
          bounceShort: boolean[];
          breakLong: boolean[];
          breakShort: boolean[];
        };
        if (!d) return {};
        return {
          long: d.bounceLong[i],
          short: d.bounceShort[i],
          exitLong: d.bounceShort[i] || d.breakShort[i],
          exitShort: d.bounceLong[i] || d.breakLong[i],
          reason: "Diagonal bounce",
        };
      };
    case "diagonalBreak":
      return (_c, i, ctx) => {
        const d = ctx.diagSr as {
          breakLong: boolean[];
          breakShort: boolean[];
          bounceLong: boolean[];
          bounceShort: boolean[];
        };
        if (!d) return {};
        return {
          long: d.breakLong[i],
          short: d.breakShort[i],
          exitLong: d.breakShort[i] || d.bounceShort[i],
          exitShort: d.breakLong[i] || d.bounceLong[i],
          reason: "Diagonal break",
        };
      };
    case "srCombo":
      return (_c, i, ctx) => {
        const d = ctx.diagSr as {
          dbLong: boolean[];
          dtShort: boolean[];
          bounceLong: boolean[];
          bounceShort: boolean[];
        };
        if (!d) return {};
        const long = d.dbLong[i] || d.bounceLong[i];
        const short = d.dtShort[i] || d.bounceShort[i];
        return {
          long,
          short,
          exitLong: short,
          exitShort: long,
          reason: "SR combo",
        };
      };


    case "twinLongOnly":
      return (_c, i, ctx) => {
        const d = ctx.diagSr as { dbLong: boolean[]; dtShort: boolean[] };
        if (!d) return {};
        return {
          long: d.dbLong[i],
          short: false,
          exitLong: d.dtShort[i],
          reason: "Twin long",
        };
      };
    case "diagonalBreakLong":
      return (_c, i, ctx) => {
        const d = ctx.diagSr as {
          breakLong: boolean[];
          breakShort: boolean[];
          bounceShort: boolean[];
        };
        if (!d) return {};
        return {
          long: d.breakLong[i],
          short: false,
          exitLong: d.breakShort[i] || d.bounceShort[i],
          reason: "Diag break L",
        };
      };
    case "diagonalBreakShort":
      return (_c, i, ctx) => {
        const d = ctx.diagSr as {
          breakShort: boolean[];
          breakLong: boolean[];
          bounceLong: boolean[];
        };
        if (!d) return {};
        return {
          long: false,
          short: d.breakShort[i],
          exitShort: d.breakLong[i] || d.bounceLong[i],
          reason: "Diag break S",
        };
      };


    case "shortHybridOr":
    case "shortHybridAnd":
    case "shortHybridSmart":
    case "shortHybridElite":
      return (_c, i, ctx) => {
        const r = ctx.elizi as {
          phase: (number | null)[];
          edgeTemp: (number | null)[];
          volSurprise: (number | null)[];
        } | undefined;
        const d = ctx.diagSr as {
          breakShort: boolean[];
          breakLong: boolean[];
          bounceLong: boolean[];
        } | undefined;
        const cd = ctx.cumDelta as (number | null)[] | undefined;
        if (!r || i < 3) return {};
        if (r.phase[i] == null || r.edgeTemp[i] == null) return {};
        // Diag required for OR/AND/Smart; Elite can run Exhaust+Δ alone
        if (!d && preset !== "shortHybridElite") return {};
        const ph = r.phase[i] as number;
        const phPrev = (r.phase[i - 1] as number) ?? 0;
        const temp = r.edgeTemp[i] as number;
        const tempPrev = (r.edgeTemp[i - 1] as number) ?? temp;
        const sur = r.volSurprise[i];
        const minSur = params.surpriseHigh ?? 0.7;
        const newlyExhaust = Math.abs(ph) === 4 && Math.abs(phPrev) < 4;
        const surOk = sur == null || sur >= minSur * 0.85;
        const deltaDn =
          cd != null &&
          cd[i] != null &&
          cd[i - 3] != null &&
          (cd[i] as number) < (cd[i - 3] as number);
        const exhaustShort = newlyExhaust && surOk && ph > 0 && deltaDn;
        const diagShort = !!(d && d.breakShort[i] && deltaDn);
        // recent diag break within 3 bars (for AND soft window)
        let diagRecent = diagShort;
        if (!diagRecent && d) {
          for (let k = 1; k <= 3 && i - k >= 0; k++) {
            if (d.breakShort[i - k]) {
              diagRecent = true;
              break;
            }
          }
        }
        let exhaustRecent = exhaustShort;
        if (!exhaustRecent) {
          for (let k = 1; k <= 3 && i - k >= 1; k++) {
            const phk = r.phase[i - k] as number | null;
            const phk1 = r.phase[i - k - 1] as number | null;
            if (
              phk != null &&
              phk1 != null &&
              Math.abs(phk) === 4 &&
              Math.abs(phk1) < 4 &&
              phk > 0
            ) {
              exhaustRecent = true;
              break;
            }
          }
        }

        let short = false;
        if (preset === "shortHybridOr") {
          short = exhaustShort || diagShort;
        } else if (preset === "shortHybridAnd") {
          // same bar OR 3-bar concurrence window
          short = (exhaustShort && diagRecent) || (diagShort && exhaustRecent);
        } else if (preset === "shortHybridElite") {
          // Exhaust+Δ always; diag only if Exhaust also recent (no naked diag OR)
          short = exhaustShort || (diagShort && exhaustRecent);
        } else {
          // Smart: Exhaust+Δ primary; else Diag break only if Δ down AND not already in bull re-accel
          const bullReaccel =
            ph > 0 &&
            Math.abs(ph) >= 2 &&
            Math.abs(ph) < 4 &&
            temp > tempPrev;
          if (exhaustShort) short = true;
          else if (diagShort && !bullReaccel) short = true;
        }

        const absPh = Math.abs(ph);
        const exitExhaust =
          absPh !== 4 ||
          (ph < 0 && absPh >= 2) ||
          (temp > tempPrev && temp > (params.armedTemp ?? 48));
        const exitDiag = !!(d && (d.breakLong[i] || d.bounceLong[i]));
        const exitShort = exitExhaust || exitDiag;
        return {
          short,
          exitShort,
          reason:
            preset === "shortHybridOr"
              ? "Short OR"
              : preset === "shortHybridAnd"
                ? "Short AND"
                : preset === "shortHybridElite"
                  ? "Short Elite"
                  : "Short Smart",
        };
      };



    case "ema13HighLowLong":
      return (candles, i, ctx) => {
        const eh = ctx.emaHigh13 as (number | null)[];
        const el = ctx.emaLow13 as (number | null)[];
        if (i < 1 || eh[i] == null || el[i] == null || eh[i - 1] == null || el[i - 1] == null)
          return {};
        const c = candles[i].close;
        const cPrev = candles[i - 1].close;
        const long = cPrev <= (eh[i - 1] as number) && c > (eh[i] as number);
        const exitLong = cPrev >= (el[i - 1] as number) && c < (el[i] as number);
        return { long, short: false, exitLong, reason: "EMA13 H break L" };
      };

    case "ema13HighLow":
      // Long: close crosses above EMA(high,13); Short: close crosses below EMA(low,13)
      return (candles, i, ctx) => {
        const eh = ctx.emaHigh13 as (number | null)[];
        const el = ctx.emaLow13 as (number | null)[];
        if (i < 1 || eh[i] == null || el[i] == null || eh[i - 1] == null || el[i - 1] == null)
          return {};
        const c = candles[i].close;
        const cPrev = candles[i - 1].close;
        const long = cPrev <= (eh[i - 1] as number) && c > (eh[i] as number);
        const short = cPrev >= (el[i - 1] as number) && c < (el[i] as number);
        return {
          long,
          short,
          exitLong: short || c < (el[i] as number),
          exitShort: long || c > (eh[i] as number),
          reason: "EMA13 H/L break",
        };
      };
    case "ema13HighLowChannel":
      // Long: close crosses above EMA(low,13); Short: close crosses below EMA(high,13)
      return (candles, i, ctx) => {
        const eh = ctx.emaHigh13 as (number | null)[];
        const el = ctx.emaLow13 as (number | null)[];
        if (i < 1 || eh[i] == null || el[i] == null || eh[i - 1] == null || el[i - 1] == null)
          return {};
        const c = candles[i].close;
        const cPrev = candles[i - 1].close;
        const long = cPrev <= (el[i - 1] as number) && c > (el[i] as number);
        const short = cPrev >= (eh[i - 1] as number) && c < (eh[i] as number);
        return {
          long,
          short,
          exitLong: short,
          exitShort: long,
          reason: "EMA13 channel",
        };
      };


    case "zlsmaChandelier":
    case "zlsmaChandelierLong":
      // CE flips decide long/short intent; ZLSMA(200) gate: only honor long above / short below.
      // Hard exits: CE trail stop hit, CE reverse flip, or ZLSMA side flip.
      return (candles, i, ctx) => {
        const z = ctx.zlsmaLine as (number | null)[];
        const ce = ctx.ceExit as {
          buy: boolean[];
          sell: boolean[];
          dir: (number | null)[];
          longStop: (number | null)[];
          shortStop: (number | null)[];
        };
        if (!z || !ce || z[i] == null) return {};
        const c = candles[i].close;
        const lo = candles[i].low;
        const hi = candles[i].high;
        const zlsma = z[i] as number;
        const above = c > zlsma;
        const below = c < zlsma;
        // Intent from CE — but we only take it on the matching ZLSMA side
        const long = ce.buy[i] && above;
        const short =
          preset === "zlsmaChandelierLong" ? false : ce.sell[i] && below;
        const ls = ce.longStop[i];
        const ss = ce.shortStop[i];
        // CE trail used as soft context; hard exit = ZLSMA side flip or CE reverse signal
        // (ATR SL handled by engine when useAtrStops)
        const exitLong =
          below ||
          ce.sell[i] ||
          ce.dir[i] === -1;
        const exitShort =
          above ||
          ce.buy[i] ||
          ce.dir[i] === 1;
        void ls; void ss; void lo; void hi;
        return {
          long,
          short,
          exitLong,
          exitShort: preset === "zlsmaChandelierLong" ? false : exitShort,
          reason: long
            ? "CE↑|Z↑"
            : short
              ? "CE↓|Z↓"
              : "ZLSMA+CE",
        };
      };



    case "bayesianTrend":
    case "bayesianTrendLong":
      return (_c, i, ctx) => {
        const b = ctx.bayesian as {
          posterior: (number | null)[];
          crossUp: boolean[];
          crossDown: boolean[];
        };
        if (!b || b.posterior[i] == null) return {};
        const long = b.crossUp[i];
        const short = preset === "bayesianTrendLong" ? false : b.crossDown[i];
        const exitLong = b.crossDown[i] || (b.posterior[i] as number) < 0.5;
        const exitShort = b.crossUp[i] || (b.posterior[i] as number) > 0.5;
        return {
          long,
          short,
          exitLong,
          exitShort: preset === "bayesianTrendLong" ? false : exitShort,
          reason: "Bayesian",
        };
      };


    case "multiKernel":
    case "multiKernelLong":
    case "multiKernelRq":
    case "multiKernelRqLong":
      return (candles, i, ctx) => {
        const useRq = preset === "multiKernelRq" || preset === "multiKernelRqLong";
        const k = (useRq ? ctx.kernelRq : ctx.kernelGauss) as {
          yhat: (number | null)[];
          rising: boolean[];
          falling: boolean[];
        };
        if (!k || k.yhat[i] == null || k.yhat[i - 1] == null || i < 1) return {};
        const c = candles[i].close;
        const cPrev = candles[i - 1].close;
        const y = k.yhat[i] as number;
        const yPrev = k.yhat[i - 1] as number;
        // Long: close crosses above kernel OR kernel turns up while price above
        const crossUp = cPrev <= yPrev && c > y;
        const crossDn = cPrev >= yPrev && c < y;
        const turnUp = k.rising[i] && !k.rising[i - 1];
        const turnDn = k.falling[i] && !k.falling[i - 1];
        const longOnly =
          preset === "multiKernelLong" || preset === "multiKernelRqLong";
        const long = crossUp || (turnUp && c > y);
        const short = longOnly ? false : crossDn || (turnDn && c < y);
        return {
          long,
          short,
          exitLong: crossDn || (k.falling[i] && c < y),
          exitShort: longOnly ? false : crossUp || (k.rising[i] && c > y),
          reason: useRq ? "Kernel RQ" : "Kernel Gauss",
        };
      };


    case "bayesKernelOr":
    case "bayesKernelAnd":
    case "bayesKernelHybrid":
      // Long-only 1h hybrid: Bayesian 0.5 cross + RQ kernel cross/turn
      return (candles, i, ctx) => {
        const b = ctx.bayesian as {
          posterior: (number | null)[];
          crossUp: boolean[];
          crossDown: boolean[];
        };
        const k = ctx.kernelRq as {
          yhat: (number | null)[];
          rising: boolean[];
          falling: boolean[];
        };
        if (!b || !k || b.posterior[i] == null || k.yhat[i] == null || i < 1)
          return {};
        const c = candles[i].close;
        const cPrev = candles[i - 1].close;
        const y = k.yhat[i] as number;
        const yPrev = (k.yhat[i - 1] as number) ?? y;
        const post = b.posterior[i] as number;
        const bayesLong = b.crossUp[i];
        const bayesExit = b.crossDown[i] || post < 0.5;
        const crossUp = cPrev <= yPrev && c > y;
        const crossDn = cPrev >= yPrev && c < y;
        const turnUp = k.rising[i] && i > 1 && !k.rising[i - 1];
        const kernLong = crossUp || (turnUp && c > y);
        const kernExit = crossDn || (k.falling[i] && c < y);
        const bayesBull = post > 0.5;
        const kernBull = c > y && k.rising[i];

        let long = false;
        if (preset === "bayesKernelOr") {
          long = bayesLong || kernLong;
        } else if (preset === "bayesKernelAnd") {
          // entry needs both sides agreeing within window
          let bayesRecent = bayesLong;
          let kernRecent = kernLong;
          for (let t = 1; t <= 3 && i - t >= 0; t++) {
            if (b.crossUp[i - t]) bayesRecent = true;
            const yt = k.yhat[i - t];
            const yt1 = k.yhat[i - t - 1];
            if (yt != null && yt1 != null) {
              const ct = candles[i - t].close;
              const ct1 = candles[i - t - 1].close;
              if (ct1 <= (yt1 as number) && ct > (yt as number)) kernRecent = true;
            }
          }
          long = (bayesLong && (kernBull || kernRecent)) || (kernLong && (bayesBull || bayesRecent));
        } else {
          // Hybrid smart: primary Bayesian entry only if RQ agrees (price above kernel);
          // RQ entry only if Bayesian bull posterior
          if (bayesLong && (c > y || kernBull)) long = true;
          else if (kernLong && bayesBull) long = true;
        }
        const exitLong = bayesExit || kernExit;
        return {
          long,
          short: false,
          exitLong,
          reason:
            preset === "bayesKernelOr"
              ? "Bayes|RQ"
              : preset === "bayesKernelAnd"
                ? "Bayes×RQ"
                : "Bayes·RQ",
        };
      };


    case "gainzAlgoV2":
    case "gainzAlgoV2Long":
      // GainzAlgo V2 Alpha: engulfing + stable body/TR + RSI + 10-bar delta; ATR TP/SL via engine
      return (_c, i, ctx) => {
        const g = ctx.gainzAlgo as { buy: boolean[]; sell: boolean[] } | undefined;
        if (!g) return {};
        const long = g.buy[i];
        const short = preset === "gainzAlgoV2Long" ? false : g.sell[i];
        return {
          long,
          short,
          exitLong: g.sell[i],
          exitShort: preset === "gainzAlgoV2Long" ? false : g.buy[i],
          reason: "GainzAlgo V2",
        };
      };


    case "eliziNexus":
    case "eliziNexus1h":
    case "eliziNexus4h":
      /**
       * Elizi Nexus — long-only hybrid (no short OR-merge).
       * - Nexus: Bayesian bull gate + (SMI cross OR RQ kernel cross) — selective OR under gate
       * - 1h: Bayesian cross primary; RQ must confirm (price > yhat & rising)
       * - 4h: SMI cross primary; Bayesian posterior must be bull (>0.52)
       */
      return (candles, i, ctx) => {
        const b = ctx.bayesian as {
          posterior: (number | null)[];
          crossUp: boolean[];
          crossDown: boolean[];
        };
        const k = ctx.kernelRq as {
          yhat: (number | null)[];
          rising: boolean[];
          falling: boolean[];
        };
        const s = ctx.smiOsc as {
          smi: (number | null)[];
          signal: (number | null)[];
        };
        if (!b || !k || !s || i < 1) return {};
        if (b.posterior[i] == null || k.yhat[i] == null || s.smi[i] == null || s.signal[i] == null)
          return {};

        const c = candles[i].close;
        const cPrev = candles[i - 1].close;
        const post = b.posterior[i] as number;
        const y = k.yhat[i] as number;
        const yPrev = (k.yhat[i - 1] as number) ?? y;
        const smiUp = crossedAbove(s.smi, s.signal, i);
        const smiDn = crossedBelow(s.smi, s.signal, i);
        const kernUp = cPrev <= yPrev && c > y;
        const kernDn = cPrev >= yPrev && c < y;
        const kernRising = k.rising[i];
        const bayesBull = post > 0.52;
        const bayesBear = post < 0.48;

        let long = false;
        if (preset === "eliziNexus1h") {
          // 1h: Bayesian flip up + RQ confirms trend structure
          long = b.crossUp[i] && c > y && kernRising;
          // secondary: RQ cross while Bayesian already bull
          if (!long && kernUp && bayesBull) long = true;
        } else if (preset === "eliziNexus4h") {
          // 4h: SMI cross + Bayesian bull gate
          long = smiUp && bayesBull;
        } else {
          // Nexus default: Bayesian bull + (SMI or RQ trigger)
          long = bayesBull && (smiUp || kernUp);
        }

        const exitLong =
          b.crossDown[i] ||
          bayesBear ||
          smiDn ||
          (kernDn && c < y) ||
          (k.falling[i] && c < y && post < 0.55);

        return {
          long,
          short: false,
          exitLong,
          reason:
            preset === "eliziNexus1h"
              ? "Nexus 1s"
              : preset === "eliziNexus4h"
                ? "Nexus 4s"
                : "Nexus",
        };
      };


    case "eliziNexusSoft1h":
    case "eliziNexusSoft4h":
      return (candles, i, ctx) => {
        const b = ctx.bayesian as {
          posterior: (number | null)[];
          crossUp: boolean[];
          crossDown: boolean[];
        };
        const s = ctx.smiOsc as {
          smi: (number | null)[];
          signal: (number | null)[];
        };
        const k = ctx.kernelRq as {
          yhat: (number | null)[];
          rising: boolean[];
          falling: boolean[];
        };
        if (!b || !s || b.posterior[i] == null || s.smi[i] == null || s.signal[i] == null)
          return {};
        const post = b.posterior[i] as number;
        const smi = s.smi[i] as number;
        const sig = s.signal[i] as number;
        const smiBull = smi > sig;
        const y = k?.yhat[i];
        let long = false;
        if (preset === "eliziNexusSoft1h") {
          // Bayesian cross, soft filters: SMI not bearish + optional above RQ
          long =
            b.crossUp[i] &&
            smiBull &&
            (y == null || candles[i].close > (y as number));
        } else {
          // SMI cross, soft Bayesian filter (not hard 0.52 — just >0.45)
          long = crossedAbove(s.smi, s.signal, i) && post > 0.45;
        }
        const exitLong =
          b.crossDown[i] ||
          post < 0.42 ||
          crossedBelow(s.smi, s.signal, i);
        return { long, short: false, exitLong, reason: "Nexus Soft" };
      };


    case "smcFvg":
    case "smcFvgLong":
      return (candles, i, ctx) => {
        const f = ctx.smcFvg as {
          bullTop: (number | null)[];
          bullBot: (number | null)[];
          bearTop: (number | null)[];
          bearBot: (number | null)[];
        };
        if (!f || i < 2) return {};
        const c = candles[i];
        const p = candles[i - 1];
        // Mitigation bounce: dip into bull FVG, close back above gap top
        const bt = f.bullTop[i];
        const bb = f.bullBot[i];
        const long =
          bt != null &&
          bb != null &&
          p.low <= (bt as number) &&
          p.low >= (bb as number) * 0.999 &&
          c.close > (bt as number) &&
          c.close > c.open;
        const et = f.bearTop[i];
        const eb = f.bearBot[i];
        const short =
          preset !== "smcFvgLong" &&
          et != null &&
          eb != null &&
          p.high >= (eb as number) &&
          p.high <= (et as number) * 1.001 &&
          c.close < (eb as number) &&
          c.close < c.open;
        return {
          long,
          short,
          exitLong: short || (bt != null && c.close < (bb as number)),
          exitShort: long || (et != null && c.close > (et as number)),
          reason: "SMC FVG",
        };
      };
    case "ictOb":
    case "ictObLong":
      return (candles, i, ctx) => {
        const o = ctx.smcOb as {
          bullTop: (number | null)[];
          bullBot: (number | null)[];
          bearTop: (number | null)[];
          bearBot: (number | null)[];
        };
        if (!o || i < 1) return {};
        const c = candles[i];
        const p = candles[i - 1];
        const bt = o.bullTop[i];
        const bb = o.bullBot[i];
        const long =
          bt != null &&
          bb != null &&
          c.low <= (bt as number) &&
          c.low >= (bb as number) &&
          c.close > c.open &&
          c.close >= (bt as number);
        const et = o.bearTop[i];
        const eb = o.bearBot[i];
        const short =
          preset !== "ictObLong" &&
          et != null &&
          eb != null &&
          c.high >= (eb as number) &&
          c.high <= (et as number) &&
          c.close < c.open &&
          c.close <= (eb as number);
        return {
          long,
          short,
          exitLong: short || (bb != null && c.close < (bb as number)),
          exitShort: long || (et != null && c.close > (et as number)),
          reason: "ICT OB",
        };
      };
    case "ictBosLong":
      return (candles, i, ctx) => {
        const b = ctx.smcBos as {
          bos: (number | null)[];
          choch: (number | null)[];
          bias: (number | null)[];
        };
        if (!b || i < 1) return {};
        const bias = b.bias[i];
        const biasPrev = b.bias[i - 1];
        const bos = b.bos[i];
        const long =
          bias === 1 &&
          (biasPrev !== 1 ||
            (bos != null &&
              candles[i - 1].close <= (bos as number) &&
              candles[i].close > (bos as number)));
        // simpler: newly bull bias or close breaks bos while bull
        const flipBull = bias === 1 && biasPrev !== 1;
        const breakBos =
          bias === 1 &&
          bos != null &&
          candles[i].close > (bos as number) &&
          candles[i - 1].close <= (bos as number);
        return {
          long: flipBull || breakBos,
          short: false,
          exitLong: bias === -1 || (b.choch[i] != null && bias !== 1),
          reason: "ICT BOS",
        };
      };
    case "vortexCross":
    case "vortexLong":
      return (_c, i, ctx) => {
        const v = ctx.vortexOsc as { vip: (number | null)[]; vim: (number | null)[] };
        if (!v || v.vip[i] == null || v.vim[i] == null) return {};
        const long = crossedAbove(v.vip, v.vim, i);
        const short = preset === "vortexLong" ? false : crossedBelow(v.vip, v.vim, i);
        return { long, short, exitLong: short || crossedBelow(v.vip, v.vim, i), exitShort: long, reason: "Vortex" };
      };
    case "forceIndex":
    case "forceLong":
      return (_c, i, ctx) => {
        const f = ctx.forceOsc as (number | null)[];
        if (!f || f[i] == null || f[i - 1] == null) return {};
        const long = (f[i - 1] as number) <= 0 && (f[i] as number) > 0;
        const short = preset === "forceLong" ? false : (f[i - 1] as number) >= 0 && (f[i] as number) < 0;
        return { long, short, exitLong: short || (f[i] as number) < 0, exitShort: long, reason: "Force" };
      };
    case "cmfZero":
    case "cmfLong":
      return (_c, i, ctx) => {
        const f = ctx.cmfOsc as (number | null)[];
        if (!f || f[i] == null || f[i - 1] == null) return {};
        const long = (f[i - 1] as number) <= 0 && (f[i] as number) > 0;
        const short = preset === "cmfLong" ? false : (f[i - 1] as number) >= 0 && (f[i] as number) < 0;
        return { long, short, exitLong: short || (f[i] as number) < 0, exitShort: long, reason: "CMF" };
      };
    case "vidyaCross":
    case "vidyaLong":
      return (candles, i, ctx) => {
        const v = ctx.vidyaLine as (number | null)[];
        if (!v || v[i] == null || v[i - 1] == null) return {};
        const c = candles[i].close;
        const cPrev = candles[i - 1].close;
        const long = cPrev <= (v[i - 1] as number) && c > (v[i] as number);
        const short = preset === "vidyaLong" ? false : cPrev >= (v[i - 1] as number) && c < (v[i] as number);
        return { long, short, exitLong: short || c < (v[i] as number), exitShort: long, reason: "VIDYA" };
      };
    case "framaCross":
    case "framaLong":
      return (candles, i, ctx) => {
        const v = ctx.framaLine as (number | null)[];
        if (!v || v[i] == null || v[i - 1] == null) return {};
        const c = candles[i].close;
        const cPrev = candles[i - 1].close;
        const long = cPrev <= (v[i - 1] as number) && c > (v[i] as number);
        const short = preset === "framaLong" ? false : cPrev >= (v[i - 1] as number) && c < (v[i] as number);
        return { long, short, exitLong: short || c < (v[i] as number), exitShort: long, reason: "FRAMA" };
      };
    case "sslChannel":
    case "sslLong":
      return (_c, i, ctx) => {
        const s = ctx.sslOsc as { sslUp: (number | null)[]; sslDown: (number | null)[]; dir?: (number | null)[] };
        // sslChannel return shape — check
        if (!s) return {};
        const up = (s as any).up ?? (s as any).sslUp ?? (s as any).baseline;
        const dn = (s as any).down ?? (s as any).sslDown;
        if (!up || !dn || up[i] == null || dn[i] == null) {
          // try dir flip
          const d = (s as any).dir as (number | null)[] | undefined;
          if (d && d[i] != null && d[i - 1] != null) {
            const long = (d[i - 1] as number) <= 0 && (d[i] as number) > 0;
            const short = preset === "sslLong" ? false : (d[i - 1] as number) >= 0 && (d[i] as number) < 0;
            return { long, short, exitLong: short || (d[i] as number) < 0, exitShort: long, reason: "SSL" };
          }
          return {};
        }
        const long = crossedAbove(up, dn, i);
        const short = preset === "sslLong" ? false : crossedBelow(up, dn, i);
        return { long, short, exitLong: short || crossedBelow(up, dn, i), exitShort: long, reason: "SSL" };
      };
    case "vfiCross":
    case "vfiLong":
      return (_c, i, ctx) => {
        const v = ctx.vfiOsc as { vfi: (number | null)[]; signal?: (number | null)[] } | (number | null)[];
        const line = Array.isArray(v) ? v : v?.vfi;
        if (!line || line[i] == null || line[i - 1] == null) return {};
        const long = (line[i - 1] as number) <= 0 && (line[i] as number) > 0;
        const short = (preset === "vfiLong" ? false : (line[i - 1] as number) >= 0 && (line[i] as number) < 0);
        return { long, short, exitLong: short || (line[i] as number) < 0, exitShort: long, reason: "VFI" };
      };
    case "elderImpulse":
    case "elderLong":
      return (_c, i, ctx) => {
        const e = ctx.elderImp as { impulse: (number | null)[] } | (number | null)[];
        const imp = Array.isArray(e) ? e : e?.impulse;
        if (!imp || imp[i] == null || imp[i - 1] == null) return {};
        const long = (imp[i - 1] as number) <= 0 && (imp[i] as number) > 0;
        const short = preset === "elderLong" ? false : (imp[i - 1] as number) >= 0 && (imp[i] as number) < 0;
        return { long, short, exitLong: short || (imp[i] as number) < 0, exitShort: long, reason: "Elder" };
      };
    case "cmoZero":
    case "cmoLong":
      return (_c, i, ctx) => {
        const c = ctx.cmoOsc as (number | null)[];
        if (!c || c[i] == null || c[i - 1] == null) return {};
        const long = (c[i - 1] as number) <= 0 && (c[i] as number) > 0;
        const short = preset === "cmoLong" ? false : (c[i - 1] as number) >= 0 && (c[i] as number) < 0;
        return { long, short, exitLong: short || (c[i] as number) < 0, exitShort: long, reason: "CMO" };
      };
    case "massBulge":
      return (_c, i, ctx) => {
        const m = ctx.massOsc as (number | null)[];
        if (!m || m[i] == null || m[i - 1] == null || i < 2) return {};
        // classic: bulge >27 then fall below 26.5 → reversal setup; use as long when falling after bulge
        const a = m[i - 1] as number;
        const b = m[i] as number;
        const long = a >= 27 && b < 26.5;
        return { long, short: false, exitLong: b > 27, reason: "Mass bulge" };
      };
    case "bopZero":
    case "bopLong":
      return (_c, i, ctx) => {
        const b = ctx.bopOsc as (number | null)[];
        if (!b || b[i] == null || b[i - 1] == null) return {};
        const long = (b[i - 1] as number) <= 0 && (b[i] as number) > 0;
        const short = preset === "bopLong" ? false : (b[i - 1] as number) >= 0 && (b[i] as number) < 0;
        return { long, short, exitLong: short || (b[i] as number) < 0, exitShort: long, reason: "BOP" };
      };


    case "klingerLong":
      return (_c, i, ctx) => {
        const k = ctx.klingerOsc as { kvo: (number | null)[]; signal: (number | null)[] };
        if (!k || k.kvo[i] == null || k.signal[i] == null) return {};
        return {
          long: crossedAbove(k.kvo, k.signal, i),
          short: false,
          exitLong: crossedBelow(k.kvo, k.signal, i),
          reason: "Klinger L",
        };
      };
    case "squeezeLong":
    case "oscSqueezeLong":
      return (_c, i, ctx) => {
        const s = ctx.squeezeOsc as { mom: (number | null)[]; squeeze: (number | null)[] };
        if (!s || s.mom[i] == null || s.mom[i - 1] == null || s.squeeze[i] == null) return {};
        const fired = (s.squeeze[i - 1] as number) === 1 && (s.squeeze[i] as number) === 0;
        const long = fired && (s.mom[i] as number) > 0;
        return {
          long,
          short: false,
          exitLong: (s.mom[i] as number) < 0,
          reason: "Squeeze L",
        };
      };
    case "halfTrendLong":
      return (_c, i, ctx) => {
        const h = ctx.halfTrendOsc as { dir: (number | null)[]; ht: (number | null)[] };
        if (!h || h.dir[i] == null || h.dir[i - 1] == null) return {};
        // dir: 0 bull, 1 bear (from halfTrend impl)
        const long = (h.dir[i - 1] as number) === 1 && (h.dir[i] as number) === 0;
        return {
          long,
          short: false,
          exitLong: (h.dir[i] as number) === 1,
          reason: "HalfTrend L",
        };
      };
    case "coralLong":
      return (candles, i, ctx) => {
        const c = ctx.coralOsc as { coral: (number | null)[]; dir: (number | null)[] };
        if (!c || c.dir[i] == null || c.dir[i - 1] == null) return {};
        const long = (c.dir[i - 1] as number) <= 0 && (c.dir[i] as number) > 0;
        return {
          long,
          short: false,
          exitLong: (c.dir[i] as number) < 0 || (c.coral[i] != null && candles[i].close < (c.coral[i] as number)),
          reason: "Coral L",
        };
      };
    case "alligatorLong":
      return (_c, i, ctx) => {
        const a = ctx.alligatorOsc as { jaw: (number | null)[]; teeth: (number | null)[]; lips: (number | null)[] };
        if (!a || a.lips[i] == null || a.teeth[i] == null || a.jaw[i] == null) return {};
        const long = crossedAbove(a.lips, a.teeth, i) && (a.lips[i] as number) > (a.jaw[i] as number);
        return {
          long,
          short: false,
          exitLong: crossedBelow(a.lips, a.teeth, i) || (a.lips[i] as number) < (a.jaw[i] as number),
          reason: "Alligator L",
        };
      };
    case "kstLong":
      return (_c, i, ctx) => {
        const k = ctx.kstOsc as { kst: (number | null)[]; signal: (number | null)[] };
        if (!k || k.kst[i] == null || k.signal[i] == null) return {};
        return {
          long: crossedAbove(k.kst, k.signal, i),
          short: false,
          exitLong: crossedBelow(k.kst, k.signal, i),
          reason: "KST L",
        };
      };
    case "trixLong":
      return (_c, i, ctx) => {
        const t = ctx.trixLine as (number | null)[];
        if (!t || t[i] == null || t[i - 1] == null) return {};
        const long = (t[i - 1] as number) <= 0 && (t[i] as number) > 0;
        return { long, short: false, exitLong: (t[i] as number) < 0, reason: "TRIX L" };
      };
    case "rviLong":
      return (_c, i, ctx) => {
        const r = ctx.rviOsc as { rvi: (number | null)[]; signal: (number | null)[] };
        if (!r || r.rvi[i] == null || r.signal[i] == null) return {};
        return {
          long: crossedAbove(r.rvi, r.signal, i),
          short: false,
          exitLong: crossedBelow(r.rvi, r.signal, i),
          reason: "RVI L",
        };
      };
    case "aoLong":
      return (_c, i, ctx) => {
        const a = ctx.aoOsc as (number | null)[];
        if (!a || a[i] == null || a[i - 1] == null) return {};
        const long = (a[i - 1] as number) <= 0 && (a[i] as number) > 0;
        return { long, short: false, exitLong: (a[i] as number) < 0, reason: "AO L" };
      };
    case "uoLong":
      return (_c, i, ctx) => {
        const u = ctx.uoOsc as (number | null)[];
        if (!u || u[i] == null || u[i - 1] == null) return {};
        const long = (u[i - 1] as number) <= 50 && (u[i] as number) > 50;
        return { long, short: false, exitLong: (u[i] as number) < 50, reason: "UO L" };
      };
    case "dpoLong":
      return (_c, i, ctx) => {
        const d = ctx.dpoLine as (number | null)[];
        if (!d || d[i] == null || d[i - 1] == null) return {};
        const long = (d[i - 1] as number) <= 0 && (d[i] as number) > 0;
        return { long, short: false, exitLong: (d[i] as number) < 0, reason: "DPO L" };
      };
    case "ppoLong":
      return (_c, i, ctx) => {
        const p = ctx.ppoOsc as { ppo: (number | null)[]; signal: (number | null)[]; hist: (number | null)[] };
        if (!p || p.ppo[i] == null || p.signal[i] == null) return {};
        return {
          long: crossedAbove(p.ppo, p.signal, i),
          short: false,
          exitLong: crossedBelow(p.ppo, p.signal, i),
          reason: "PPO L",
        };
      };


    case "fireflyLong":
      return (_c, i, ctx) => {
        const f = ctx.fireflyOsc as { color: (number | null)[]; histo: (number | null)[] };
        if (!f || f.color[i] == null || f.color[i - 1] == null) return {};
        const long = (f.color[i - 1] as number) <= 0 && (f.color[i] as number) === 1;
        return {
          long,
          short: false,
          exitLong: (f.color[i] as number) === -1 || (f.color[i] as number) === 0,
          reason: "Firefly L",
        };
      };
    case "stDivWeighted":
      return (_c, i, ctx) => {
        const s = ctx.stDiv as { buy: boolean[]; sell: boolean[]; direction: (-1 | 1 | null)[] };
        if (!s) return {};
        return {
          long: s.buy[i],
          short: s.sell[i],
          exitLong: s.sell[i] || s.direction[i] === -1,
          exitShort: s.buy[i] || s.direction[i] === 1,
          reason: "ST Div",
        };
      };
    case "stDivFirefly":
    case "stDivFireflyLong":
      return (_c, i, ctx) => {
        const s = ctx.stDiv as { buy: boolean[]; sell: boolean[]; direction: (-1 | 1 | null)[] };
        const f = ctx.fireflyOsc as { color: (number | null)[] };
        if (!s || !f || f.color[i] == null) return {};
        const ffBull = (f.color[i] as number) === 1;
        const ffBear = (f.color[i] as number) === -1;
        const ffFlat = (f.color[i] as number) === 0;
        // Patron setup: ST flip + Firefly color confirm; skip flat
        const long = s.buy[i] && ffBull && !ffFlat;
        const short =
          preset !== "stDivFireflyLong" && s.sell[i] && ffBear && !ffFlat;
        // also allow entry if already green cloud and firefly just flipped green
        const longAlt =
          s.direction[i] === 1 &&
          (f.color[i - 1] as number) !== 1 &&
          ffBull;
        const shortAlt =
          preset !== "stDivFireflyLong" &&
          s.direction[i] === -1 &&
          (f.color[i - 1] as number) !== -1 &&
          ffBear;
        return {
          long: long || longAlt,
          short: short || shortAlt,
          exitLong: s.sell[i] || ffBear || (s.direction[i] === -1),
          exitShort: s.buy[i] || ffBull || (s.direction[i] === 1),
          reason: "ST×Firefly",
        };
      };


    case "pliBreakLong":
      return (candles, i, ctx) => {
        const ch = (ctx.pliHybrid ?? ctx.pliCh) as {
          upper: (number | null)[];
          lower: (number | null)[];
        } | undefined;
        if (!ch || ch.upper[i] == null || ch.upper[i - 1] == null) return {};
        const c = candles[i].close;
        const cPrev = candles[i - 1].close;
        const long =
          cPrev <= (ch.upper[i - 1] as number) && c > (ch.upper[i] as number);
        const exitLong =
          ch.lower[i] != null &&
          cPrev >= (ch.lower[i - 1] as number) &&
          c < (ch.lower[i] as number);
        return { long, short: false, exitLong, reason: "PLI break L" };
      };
    case "pliDeltaHybridLong":
      return (_c, i, ctx) => {
        const h = ctx.pliHybrid as {
          longSignal: (number | null)[];
          shortSignal: (number | null)[];
          score: (number | null)[];
          narrow: (number | null)[];
          upper: (number | null)[];
          lower: (number | null)[];
          deltaEma: (number | null)[];
        };
        if (!h || h.longSignal[i] == null) return {};
        const long = h.longSignal[i] === 1;
        // exit on short hybrid or close under lower after non-narrow
        const exitLong =
          h.shortSignal[i] === 1 ||
          (h.lower[i] != null &&
            _c[i].close < (h.lower[i] as number) &&
            h.narrow[i] !== 1);
        return { long, short: false, exitLong, reason: "PLI×Δ L" };
      };
    case "madBandsLong":
      return (candles, i, ctx) => {
        const b = ctx.madBand as {
          mid: (number | null)[];
          upper: (number | null)[];
          lower: (number | null)[];
        };
        if (!b || b.lower[i] == null || b.mid[i] == null || b.lower[i - 1] == null)
          return {};
        const c = candles[i].close;
        const cPrev = candles[i - 1].close;
        // bounce: was at/under lower, closes back above lower toward mid
        if (b.mid[i - 1] == null) return {};
        const bounce =
          cPrev <= (b.lower[i - 1] as number) * 1.002 &&
          c > (b.lower[i] as number) &&
          c < (b.mid[i] as number) * 1.01;
        const crossMid =
          cPrev <= (b.mid[i - 1] as number) && c > (b.mid[i] as number);
        const long = bounce || crossMid;
        const exitLong =
          b.upper[i] != null &&
          ((cPrev >= (b.upper[i - 1] as number) && c < (b.upper[i] as number)) ||
            c < (b.mid[i] as number));
        return { long, short: false, exitLong, reason: "MAD L" };
      };
    case "medianCrossLong":
      return (candles, i, ctx) => {
        const m =
          (ctx.medChannel as { medClose: (number | null)[] })?.medClose ??
          (ctx.rollingMed as (number | null)[]);
        if (!m || m[i] == null || m[i - 1] == null) return {};
        const c = candles[i].close;
        const cPrev = candles[i - 1].close;
        const long = cPrev <= (m[i - 1] as number) && c > (m[i] as number);
        const exitLong = cPrev >= (m[i - 1] as number) && c < (m[i] as number);
        return { long, short: false, exitLong, reason: "Med cross L" };
      };

    case "ifvgLong": {
      let activeTp1: number | null = null;
      return (candles, i, ctx) => {
        const s = ctx.ifvg as {
          longSignal: (number | null)[];
          shortSignal: (number | null)[];
          tp1: (number | null)[];
          bias: (number | null)[];
        };
        if (!s) return {};
        if (s.longSignal[i] === 1) {
          activeTp1 = s.tp1[i] ?? null;
          return { long: true, short: false, reason: "IFVG L" };
        }
        const hitTp =
          activeTp1 != null && candles[i].high >= activeTp1;
        const exitLong =
          s.shortSignal[i] === 1 ||
          hitTp ||
          s.bias[i] === -1;
        if (exitLong) activeTp1 = null;
        return { long: false, short: false, exitLong, reason: "IFVG L" };
      };
    }
    case "ifvgRsiLong": {
      let activeTp1: number | null = null;
      return (candles, i, ctx) => {
        const s = ctx.ifvgRsi as {
          longSignal: (number | null)[];
          shortSignal: (number | null)[];
        };
        const z = ctx.ifvg as {
          tp1: (number | null)[];
          bias: (number | null)[];
          shortSignal: (number | null)[];
        };
        if (!s) return {};
        if (s.longSignal[i] === 1) {
          activeTp1 = z?.tp1?.[i] ?? null;
          return { long: true, short: false, reason: "IFVG×RSI L" };
        }
        const hitTp =
          activeTp1 != null && candles[i].high >= activeTp1;
        const exitLong =
          s.shortSignal[i] === 1 ||
          z?.shortSignal?.[i] === 1 ||
          hitTp ||
          z?.bias?.[i] === -1;
        if (exitLong) activeTp1 = null;
        return { long: false, short: false, exitLong, reason: "IFVG×RSI L" };
      };
    }
    case "ifvgRsiBi": {
      let activeTp1: number | null = null;
      let side: "long" | "short" | null = null;
      return (candles, i, ctx) => {
        const s = ctx.ifvgRsi as {
          longSignal: (number | null)[];
          shortSignal: (number | null)[];
        };
        const z = ctx.ifvg as {
          tp1: (number | null)[];
        };
        if (!s) return {};
        if (s.longSignal[i] === 1) {
          activeTp1 = z?.tp1?.[i] ?? null;
          side = "long";
          return {
            long: true,
            short: false,
            exitShort: true,
            reason: "IFVG×RSI",
          };
        }
        if (s.shortSignal[i] === 1) {
          activeTp1 = z?.tp1?.[i] ?? null;
          side = "short";
          return {
            long: false,
            short: true,
            exitLong: true,
            reason: "IFVG×RSI",
          };
        }
        const hitTpLong =
          side === "long" &&
          activeTp1 != null &&
          candles[i].high >= activeTp1;
        const hitTpShort =
          side === "short" &&
          activeTp1 != null &&
          candles[i].low <= activeTp1;
        const exitLong = hitTpLong || false;
        const exitShort = hitTpShort || false;
        if (exitLong || exitShort) {
          activeTp1 = null;
          side = null;
        }
        return { long: false, short: false, exitLong, exitShort, reason: "IFVG×RSI" };
      };
    }

    case "ifvgSmiLong": {
      let activeTp1: number | null = null;
      return (candles, i, ctx) => {
        const s = ctx.ifvgSmi as {
          longSignal: (number | null)[];
          shortSignal: (number | null)[];
          smi: (number | null)[];
          signal: (number | null)[];
        };
        const z = ctx.ifvg as {
          tp1: (number | null)[];
          bias: (number | null)[];
          shortSignal: (number | null)[];
        };
        if (!s) return {};
        if (s.longSignal[i] === 1) {
          activeTp1 = z?.tp1?.[i] ?? null;
          return { long: true, short: false, reason: "IFVG×SMI L" };
        }
        const hitTp =
          activeTp1 != null && candles[i].high >= activeTp1;
        const smiExit =
          s.smi[i] != null &&
          s.signal[i] != null &&
          s.smi[i - 1] != null &&
          s.signal[i - 1] != null &&
          (s.smi[i - 1] as number) >= (s.signal[i - 1] as number) &&
          (s.smi[i] as number) < (s.signal[i] as number);
        const exitLong =
          s.shortSignal[i] === 1 ||
          z?.shortSignal?.[i] === 1 ||
          smiExit ||
          hitTp ||
          z?.bias?.[i] === -1;
        if (exitLong) activeTp1 = null;
        return { long: false, short: false, exitLong, reason: "IFVG×SMI L" };
      };
    }
    case "ifvgSmiBi": {
      let activeTp1: number | null = null;
      let side: "long" | "short" | null = null;
      return (candles, i, ctx) => {
        const s = ctx.ifvgSmi as {
          longSignal: (number | null)[];
          shortSignal: (number | null)[];
          smi: (number | null)[];
          signal: (number | null)[];
        };
        const z = ctx.ifvg as {
          tp1: (number | null)[];
        };
        if (!s) return {};
        if (s.longSignal[i] === 1) {
          activeTp1 = z?.tp1?.[i] ?? null;
          side = "long";
          return {
            long: true,
            short: false,
            exitShort: true,
            reason: "IFVG×SMI",
          };
        }
        if (s.shortSignal[i] === 1) {
          activeTp1 = z?.tp1?.[i] ?? null;
          side = "short";
          return {
            long: false,
            short: true,
            exitLong: true,
            reason: "IFVG×SMI",
          };
        }
        const smiCrossDn =
          s.smi[i] != null &&
          s.signal[i] != null &&
          s.smi[i - 1] != null &&
          s.signal[i - 1] != null &&
          (s.smi[i - 1] as number) >= (s.signal[i - 1] as number) &&
          (s.smi[i] as number) < (s.signal[i] as number);
        const smiCrossUp =
          s.smi[i] != null &&
          s.signal[i] != null &&
          s.smi[i - 1] != null &&
          s.signal[i - 1] != null &&
          (s.smi[i - 1] as number) <= (s.signal[i - 1] as number) &&
          (s.smi[i] as number) > (s.signal[i] as number);
        const hitTpLong =
          side === "long" &&
          activeTp1 != null &&
          candles[i].high >= activeTp1;
        const hitTpShort =
          side === "short" &&
          activeTp1 != null &&
          candles[i].low <= activeTp1;
        const exitLong = hitTpLong || (side === "long" && smiCrossDn);
        const exitShort = hitTpShort || (side === "short" && smiCrossUp);
        if (exitLong || exitShort) {
          activeTp1 = null;
          side = null;
        }
        return { long: false, short: false, exitLong, exitShort, reason: "IFVG×SMI" };
      };
    }


    case "ifvgJurikStochLong": {
      let activeTp1: number | null = null;
      return (candles, i, ctx) => {
        const s = ctx.ifvgJurikStoch as {
          longSignal: (number | null)[];
          shortSignal: (number | null)[];
          k: (number | null)[];
          d: (number | null)[];
        };
        const z = ctx.ifvg as {
          tp1: (number | null)[];
          bias: (number | null)[];
          shortSignal: (number | null)[];
        };
        if (!s) return {};
        if (s.longSignal[i] === 1) {
          activeTp1 = z?.tp1?.[i] ?? null;
          return { long: true, short: false, reason: "IFVG×Jurik L" };
        }
        const hitTp =
          activeTp1 != null && candles[i].high >= activeTp1;
        const kdExit =
          s.k[i] != null &&
          s.d[i] != null &&
          s.k[i - 1] != null &&
          s.d[i - 1] != null &&
          (s.k[i - 1] as number) >= (s.d[i - 1] as number) &&
          (s.k[i] as number) < (s.d[i] as number);
        const exitLong =
          s.shortSignal[i] === 1 ||
          z?.shortSignal?.[i] === 1 ||
          kdExit ||
          hitTp ||
          z?.bias?.[i] === -1;
        if (exitLong) activeTp1 = null;
        return { long: false, short: false, exitLong, reason: "IFVG×Jurik L" };
      };
    }
    case "ifvgJurikStochBi": {
      let activeTp1: number | null = null;
      let side: "long" | "short" | null = null;
      return (candles, i, ctx) => {
        const s = ctx.ifvgJurikStoch as {
          longSignal: (number | null)[];
          shortSignal: (number | null)[];
          k: (number | null)[];
          d: (number | null)[];
        };
        const z = ctx.ifvg as {
          tp1: (number | null)[];
        };
        if (!s) return {};
        if (s.longSignal[i] === 1) {
          activeTp1 = z?.tp1?.[i] ?? null;
          side = "long";
          return {
            long: true,
            short: false,
            exitShort: true,
            reason: "IFVG×Jurik",
          };
        }
        if (s.shortSignal[i] === 1) {
          activeTp1 = z?.tp1?.[i] ?? null;
          side = "short";
          return {
            long: false,
            short: true,
            exitLong: true,
            reason: "IFVG×Jurik",
          };
        }
        const kdCrossDn =
          s.k[i] != null &&
          s.d[i] != null &&
          s.k[i - 1] != null &&
          s.d[i - 1] != null &&
          (s.k[i - 1] as number) >= (s.d[i - 1] as number) &&
          (s.k[i] as number) < (s.d[i] as number);
        const kdCrossUp =
          s.k[i] != null &&
          s.d[i] != null &&
          s.k[i - 1] != null &&
          s.d[i - 1] != null &&
          (s.k[i - 1] as number) <= (s.d[i - 1] as number) &&
          (s.k[i] as number) > (s.d[i] as number);
        const hitTpLong =
          side === "long" &&
          activeTp1 != null &&
          candles[i].high >= activeTp1;
        const hitTpShort =
          side === "short" &&
          activeTp1 != null &&
          candles[i].low <= activeTp1;
        const exitLong = hitTpLong || (side === "long" && kdCrossDn);
        const exitShort = hitTpShort || (side === "short" && kdCrossUp);
        if (exitLong || exitShort) {
          activeTp1 = null;
          side = null;
        }
        return { long: false, short: false, exitLong, exitShort, reason: "IFVG×Jurik" };
      };
    }

    case "codeStrategy":
      return (_c, i, ctx) => {
        const bars = ctx.codeBars as {
          enterLong: boolean[];
          exitLong: boolean[];
          enterShort: boolean[];
          exitShort: boolean[];
        } | null;
        if (!bars) return {};
        return {
          long: bars.enterLong[i],
          short: bars.enterShort[i],
          exitLong: bars.exitLong[i],
          exitShort: bars.exitShort[i],
          reason: "code",
        };
      };
    case "custom":
    default: {
      const rule = params.customRules?.entryLong ?? "emaCross";
      return getSignalFn(
        rule === "emaCross"
          ? "emaCross"
          : rule === "rsiOs"
            ? "rsiOsOb"
            : rule === "macdCross"
              ? "macdCross"
              : "supertrendFlip",
        params
      );
    }
  }
}
