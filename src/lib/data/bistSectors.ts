/**
 * Client-safe BIST sector index constituents.
 * Best-effort curated from public endeks lists (uzmanpara / KAP / BIST mappings).
 * Updateable — not an official live feed.
 */

import { BIST_EXTRA } from "@/lib/data/bistUniverse";
import { BIST30, BIST_LIQUID_EXTRA } from "@/lib/data/bistLists";

export type BistSector = { code: string; name: string; symbols: string[] };

function uniq(syms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of syms) {
    const u = s.toUpperCase().replace(/\.IS$/i, "");
    if (!u || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

const SECTOR_DEFS: BistSector[] = [
  {
    code: "XBANK",
    name: "Banka",
    symbols: [
      "AKBNK", "ALBRK", "GARAN", "HALKB", "ICBCT", "ISATR", "ISBTR", "ISCTR", "QNBFB", "SKBNK",
      "TSKB", "VAKBN", "YKBNK",
    ],
  },
  {
    code: "XGIDA",
    name: "Gıda İçecek",
    symbols: [
      "AEFES", "ALKLC", "ARMGD", "ATAKP", "AVOD", "BALSU", "BANVT", "BORSK", "CCOLA", "CEMZY",
      "DARDL", "DMRGD", "DURKN", "EKSUN", "ELITE", "ERSU", "FADE", "FRIGO", "GOKNR", "GUNDG",
      "KAYSE", "KRSTL", "KRVGD", "KTSKR", "MERKO", "OBAMS", "OFSYM", "ORCAY", "OYLUM", "PENGD",
      "PETUN", "PINSU", "PNSUT", "SEGMN", "SELVA", "SOKE", "TATGD", "TBORG", "TUKAS", "ULKER",
      "ULUUN", "VANGD", "YYLGD",
    ],
  },
  {
    code: "XULAS",
    name: "Ulaştırma",
    symbols: [
      "BEYAZ", "CLEBI", "GRSEL", "GSDDE", "HOROZ", "HRKET", "PASEU", "PGSUS", "RYSAS", "THYAO",
      "TLMAN", "TUREX",
    ],
  },
  {
    code: "XHOLD",
    name: "Holding",
    symbols: [
      "AGHOL", "AKYHO", "ALARK", "AVHOL", "BERA", "BINHO", "BRYAT", "BULGS", "COSMO", "DENGE",
      "DERHL", "DOHOL", "ECILC", "ECZYT", "GLRYH", "GLYHO", "GOZDE", "GRTHO", "GSDHO", "HDFGS",
      "HEDEF", "HUBVC", "ICUGS", "IEYHO", "IHLAS", "IHYAY", "INVEO", "INVES", "ISGSY", "KCHOL",
      "KLRHO", "LRSHO", "LYDHO", "MARKA", "METRO", "MZHLD", "NTHOL", "OSTIM", "OTTO", "POLHO",
      "PRDGS", "RALYH", "SAHOL", "SISE", "TAVHL", "TKFEN", "TRCAS", "UFUK", "UNLU", "VERTU",
    ],
  },
  {
    code: "XELKT",
    name: "Elektrik",
    symbols: [
      "A1YEN", "AHGAZ", "AKENR", "AKFYE", "AKSEN", "AKSUE", "ALFAS", "ARASE", "AYDEM", "AYEN",
      "BIGEN", "BIOEN", "CANTE", "CATES", "CONSE", "CWENE", "ENDAE", "ENERY", "ENJSA", "ENTRA",
      "ESEN", "GWIND", "HUNER", "IZENR", "KLYPV", "LYDYE", "MAGEN", "MOGAN", "NATEN", "NTGAZ",
      "ODAS", "PAMEL", "SMRTG", "TATEN", "ZEDUR", "ZOREN",
    ],
  },
  {
    code: "XGMYO",
    name: "GYO",
    symbols: [
      "ADGYO", "AGYO", "AHSGY", "AKFGY", "AKMGY", "AKSGY", "ALGYO", "ASGYO", "ATAGY", "AVGYO",
      "AVPGY", "BASGZ", "BEGYO", "DGGYO", "DZGYO", "EGEGY", "EKGYO", "EYGYO", "FZLGY", "HLGYO",
      "IDGYO", "ISGYO", "KGYO", "KLGYO", "KRGYO", "KZBGY", "KZGYO", "MHRGY", "MRGYO", "MSGYO",
      "NUGYO", "OZGYO", "OZKGY", "PAGYO", "PEKGY", "PSGYO", "RYGYO", "SEGYO", "SNGYO", "SRVGY",
      "SURGY", "TDGYO", "TRGYO", "TSGYO", "VKGYO", "VRGYO", "YGGYO", "ZRGYO",
    ],
  },
  {
    code: "XUTEK",
    name: "Bilişim",
    symbols: [
      "ALCTL", "ALTNY", "ARDYZ", "ARENA", "ASELS", "ATATP", "AZTEK", "BINBN", "DESPC", "DGATE",
      "EDATA", "ESCOM", "FONET", "FORTE", "HTTBT", "INDES", "INGRM", "KAREL", "KFEIN", "KRONT",
      "LINK", "LOGO", "MANAS", "MIATK", "MOBTL", "MTRKS", "NETAS", "OBASE", "ODINE", "ONRYT",
      "PAPIL", "PATEK", "PENTA", "PKART", "REEDR", "SDTTR", "SMART", "VBTYZ",
    ],
  },
  {
    code: "XKMYA",
    name: "Kimya Petrol",
    symbols: [
      "ACSEL", "AKSA", "ALKIM", "ANGEN", "AYGAZ", "BAGFS", "BAHKM", "BAYRK", "BRISA", "BRKSN",
      "DEVA", "DNISI", "DYOBY", "EGGUB", "EGPRO", "EPLAS", "EUREN", "GEDZA", "GOODY", "GUBRF",
      "HEKTS", "ISKPL", "IZFAS", "KBORU", "KMPUR", "KOPOL", "KRPLS", "MEDTR", "MERCN", "MRSHL",
      "ONCSM", "OZRDN", "PETKM", "POLTK", "RNPOL", "RTALB", "SANFM", "SASA", "SEKUR", "SEYKM",
      "TARKM", "TMPOL", "TRILC", "TUPRS",
    ],
  },
  {
    code: "XMANA",
    name: "Metal Ana",
    symbols: [
      "BMSCH", "BMSTL", "BRSAN", "BURCE", "BURVA", "CELHA", "CEMAS", "CEMTS", "CUSAN", "DMSAS",
      "DOFER", "DOKTA", "ERBOS", "ERCB", "EREGL", "ISDMR", "IZMDC", "KCAER", "KOCMT", "KRDMA",
      "KRDMB", "KRDMD", "MEGMT", "OZYSR", "PNLSN", "SARKY", "TCKRC", "TUCLK", "YKSLN",
    ],
  },
  {
    code: "XINSA",
    name: "İnşaat",
    symbols: [
      "AKFIS", "ANELE", "BRLSM", "DAPGM", "EDIP", "ENKAI", "GESAN", "GLRMK", "KUYAS", "ORGE",
      "SANEL", "TURGG", "YAYLA", "YYAPI",
    ],
  },
  {
    code: "XTCRT",
    name: "Ticaret",
    symbols: [
      "ARZUM", "BIMAS", "BIZIM", "CRFSA", "DCTTR", "DOAS", "EBEBK", "GENIL", "GMTAS", "INTEM",
      "KIMMR", "KOTON", "MAVI", "MEPET", "MGROS", "MOPAS", "PSDTC", "SANKO", "SELEC", "SOKM",
      "SUWEN", "TGSAS", "TKNSA", "VAKKO",
    ],
  },
  {
    code: "XTEKS",
    name: "Tekstil",
    symbols: [
      "ARSAN", "ARTMS", "BLCYT", "BOSSA", "DAGI", "DERIM", "DESA", "ENSRI", "HATEK", "ISSEN",
      "KORDS", "KRTEK", "LUKSK", "MNDRS", "RODRG", "RUBNS", "SKTAS", "SUNTK", "YATAS", "YUNSA",
    ],
  },
  {
    code: "XSGRT",
    name: "Sigorta",
    symbols: [
      "AGESA", "AKGRT", "ANHYT", "ANSGR", "RAYSG", "TURSG",
    ],
  },
  {
    code: "XTRZM",
    name: "Turizm",
    symbols: [
      "AVTUR", "AYCES", "BIGCH", "BYDNR", "DOCO", "ETILR", "MAALT", "MARTI", "MERIT", "PKENT",
      "TABGD", "TEKTU", "ULAS",
    ],
  },
  {
    code: "XSPOR",
    name: "Spor",
    symbols: [
      "BJKAS", "FENER", "GSRAY", "TSPOR",
    ],
  },
  {
    code: "XILTM",
    name: "İletişim",
    symbols: [
      "TCELL", "TTKOM",
    ],
  },
];

function buildAll(): string[] {
  const preferred = [...BIST30, ...BIST_LIQUID_EXTRA];
  const rest = BIST_EXTRA.map((t) => t.symbol);
  return uniq([...preferred, ...rest]);
}

const ALL = buildAll();

export const BIST_SECTORS: Record<string, BistSector> = {
  BIST_ALL: { code: "BIST_ALL", name: "BIST Tümü", symbols: ALL },
};

for (const s of SECTOR_DEFS) {
  BIST_SECTORS[s.code] = { code: s.code, name: s.name, symbols: uniq(s.symbols) };
}

export function allBistSymbols(): string[] {
  return BIST_SECTORS.BIST_ALL.symbols.slice();
}

export function sectorCodes(): string[] {
  return Object.keys(BIST_SECTORS).filter((c) => c !== "BIST_ALL");
}

export function symbolsForSector(code: string): string[] {
  const s = BIST_SECTORS[code.toUpperCase()];
  return s ? s.symbols.slice() : [];
}

/** Watchlist seed meta: stable id + display name */
export function sectorWatchlistMeta(): { id: string; name: string; code: string; symbols: string[] }[] {
  const rows = [
    { id: "bist-all", name: "BIST Tümü", code: "BIST_ALL", symbols: allBistSymbols() },
  ];
  for (const code of sectorCodes()) {
    const s = BIST_SECTORS[code];
    rows.push({
      id: `bist-${code.toLowerCase()}`,
      name: `${code} · ${s.name}`,
      code,
      symbols: s.symbols.slice(),
    });
  }
  return rows;
}

