import { europePack } from "../pack/europe";
import type { FlagQuizConfig } from "./config";
import { createFlagsApp } from "./app";

// Asset join keyed by country id (ISO3 → eNN file name). The mapping is
// id-keyed: europePack.places order is never relied on. The eNN numbers were
// assigned in pack-list order by scripts/fetch-europe-flags.py and are
// immutable once published — a fresh quiz takes a fresh prefix.
const FLAG_ASSETS: Record<string, string> = {
  ALB: "e01",
  AND: "e02",
  AUT: "e03",
  BLR: "e04",
  BEL: "e05",
  BIH: "e06",
  BGR: "e07",
  HRV: "e08",
  CYP: "e09",
  CZE: "e10",
  DNK: "e11",
  EST: "e12",
  FIN: "e13",
  FRA: "e14",
  DEU: "e15",
  GRC: "e16",
  HUN: "e17",
  ISL: "e18",
  IRL: "e19",
  ITA: "e20",
  KOS: "e21",
  LVA: "e22",
  LIE: "e23",
  LTU: "e24",
  LUX: "e25",
  MLT: "e26",
  MDA: "e27",
  MCO: "e28",
  MNE: "e29",
  NLD: "e30",
  MKD: "e31",
  NOR: "e32",
  POL: "e33",
  PRT: "e34",
  ROU: "e35",
  RUS: "e36",
  SMR: "e37",
  SRB: "e38",
  SVK: "e39",
  SVN: "e40",
  ESP: "e41",
  SWE: "e42",
  CHE: "e43",
  UKR: "e44",
  GBR: "e45",
  VAT: "e46",
};

export const europeQuiz: FlagQuizConfig = {
  slug: "europe-flags",
  storagePrefix: "thecounties.flags.europe.run.",
  quickCount: 10,
  // Derived from the pack — the quiz never keeps its own name data.
  bank: europePack.places.map((place) => ({
    id: place.id,
    name: place.name,
    group: place.group,
  })),
  flagIds: FLAG_ASSETS,
  copy: {
    modeEyebrow: "Europe · The Country Flags",
    modeHeadline: "Four answers. One clock. No going back.",
    modeExplainer:
      "Each correct answer is worth up to 1,000 points, draining with the timer.",
    flagAlt: "Flag of a European country",
    shareTitle: "Europe · The Country Flags",
    shareCaption: "EUROPE · THE COUNTRY FLAGS",
    shareFooter: "thecounties.vercel.app/europe-flags",
  },
};

// Mount the app when this module is loaded as the page entry.
createFlagsApp(europeQuiz);
