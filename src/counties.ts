export type Province = "Leinster" | "Munster" | "Connacht" | "Ulster";

export type County = {
  id: string;
  name: string;
  province: Province;
  aliases: string[];
};

export const COUNTIES: County[] = [
  {
    id: "CARLOW",
    name: "Carlow",
    province: "Leinster",
    aliases: ["ceatharlach"],
  },
  {
    id: "CAVAN",
    name: "Cavan",
    province: "Ulster",
    aliases: ["an cabhan", "an cabhán"],
  },
  {
    id: "CLARE",
    name: "Clare",
    province: "Munster",
    aliases: ["an clar", "an clár"],
  },
  {
    id: "CORK",
    name: "Cork",
    province: "Munster",
    aliases: ["corcaigh"],
  },
  {
    id: "DONEGAL",
    name: "Donegal",
    province: "Ulster",
    aliases: ["dun na ngall", "dún na ngall"],
  },
  {
    id: "DUBLIN",
    name: "Dublin",
    province: "Leinster",
    aliases: ["dub", "baile atha cliath", "baile átha cliath", "ath cliath"],
  },
  {
    id: "GALWAY",
    name: "Galway",
    province: "Connacht",
    aliases: ["gaillimh"],
  },
  {
    id: "KERRY",
    name: "Kerry",
    province: "Munster",
    aliases: ["ciarrai", "ciarraí"],
  },
  {
    id: "KILDARE",
    name: "Kildare",
    province: "Leinster",
    aliases: ["cill dara"],
  },
  {
    id: "KILKENNY",
    name: "Kilkenny",
    province: "Leinster",
    aliases: ["cill chainnigh"],
  },
  {
    id: "LAOIS",
    name: "Laois",
    province: "Leinster",
    aliases: ["leix", "laoighis", "laoise", "queens county", "queen county"],
  },
  {
    id: "LEITRIM",
    name: "Leitrim",
    province: "Connacht",
    aliases: ["liatroim"],
  },
  {
    id: "LIMERICK",
    name: "Limerick",
    province: "Munster",
    aliases: ["luimneach"],
  },
  {
    id: "LONGFORD",
    name: "Longford",
    province: "Leinster",
    aliases: ["an longfort"],
  },
  {
    id: "LOUTH",
    name: "Louth",
    province: "Leinster",
    aliases: ["lu", "lú"],
  },
  {
    id: "MAYO",
    name: "Mayo",
    province: "Connacht",
    aliases: ["maigh eo"],
  },
  {
    id: "MEATH",
    name: "Meath",
    province: "Leinster",
    aliases: ["an mhi", "an mhí"],
  },
  {
    id: "MONAGHAN",
    name: "Monaghan",
    province: "Ulster",
    aliases: ["muineachan", "muineachán"],
  },
  {
    id: "OFFALY",
    name: "Offaly",
    province: "Leinster",
    aliases: ["uibh fhaili", "uíbh fhailí", "kings county", "king county"],
  },
  {
    id: "ROSCOMMON",
    name: "Roscommon",
    province: "Connacht",
    aliases: ["ros comain", "ros comáin"],
  },
  {
    id: "SLIGO",
    name: "Sligo",
    province: "Connacht",
    aliases: ["sligeach"],
  },
  {
    id: "TIPPERARY",
    name: "Tipperary",
    province: "Munster",
    aliases: ["tipp", "tiobraid arann", "tiobraid árann"],
  },
  {
    id: "WATERFORD",
    name: "Waterford",
    province: "Munster",
    aliases: ["port lairge", "port láirge"],
  },
  {
    id: "WESTMEATH",
    name: "Westmeath",
    province: "Leinster",
    aliases: ["an iarmhi", "an iarmhí", "iarmhi"],
  },
  {
    id: "WEXFORD",
    name: "Wexford",
    province: "Leinster",
    aliases: ["loch garman"],
  },
  {
    id: "WICKLOW",
    name: "Wicklow",
    province: "Leinster",
    aliases: ["cill mhantain", "cill mhantáin"],
  },
  {
    id: "ANTRIM",
    name: "Antrim",
    province: "Ulster",
    aliases: ["aontroim"],
  },
  {
    id: "ARMAGH",
    name: "Armagh",
    province: "Ulster",
    aliases: ["ard mhacha"],
  },
  {
    id: "DOWN",
    name: "Down",
    province: "Ulster",
    aliases: ["an dun", "an dún"],
  },
  {
    id: "FERMANAGH",
    name: "Fermanagh",
    province: "Ulster",
    aliases: ["fear manach"],
  },
  {
    id: "LONDONDERRY",
    name: "Derry",
    province: "Ulster",
    aliases: ["derry", "londonderry", "doire", "derry londonderry"],
  },
  {
    id: "TYRONE",
    name: "Tyrone",
    province: "Ulster",
    aliases: ["tir eoghain", "tír eoghain"],
  },
];

export const COUNTY_BY_ID = new Map(COUNTIES.map((county) => [county.id, county]));

export const PROVINCE_COLORS: Record<Province, string> = {
  Leinster: "#2f6b4f",
  Munster: "#c56a1a",
  Connacht: "#1d5a8a",
  Ulster: "#b42318",
};

const STRIP_PREFIX = /^(county|contae|co)\s+/i;

export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[./-]/g, " ")
    .replace(STRIP_PREFIX, "")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIAS_INDEX = new Map<string, County>();

for (const county of COUNTIES) {
  ALIAS_INDEX.set(normalizeName(county.name), county);
  ALIAS_INDEX.set(normalizeName(county.id), county);
  for (const alias of county.aliases) {
    ALIAS_INDEX.set(normalizeName(alias), county);
  }
}

export function matchCounty(guess: string): County | null {
  const normalized = normalizeName(guess);
  if (!normalized) return null;
  return ALIAS_INDEX.get(normalized) ?? null;
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
