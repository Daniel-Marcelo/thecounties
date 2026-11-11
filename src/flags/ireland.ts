import { irelandPack } from "../pack/ireland";
import type { FlagQuizConfig } from "./config";
import { createFlagsApp } from "./app";

// Asset join keyed by county id (COUNTIES id → cNN file name). The mapping is
// id-keyed: irelandPack.places order is never relied on. The cNN numbers were
// assigned in the counties.ts list order by scripts/fetch-ireland-flags.py and
// are immutable once published — a fresh quiz takes a fresh prefix.
//
// Shared assets are intentional and go further than the Commons combined
// files: an Irish county's de facto flag is its GAA colours, an UNORDERED
// pair, and Commons holds several arrangements and shades of the same pair
// (e.g. Limerick green-on-white vs Fermanagh white-on-green; Tipperary's
// yellow-on-blue vs Roscommon's mirror). At recall level those are the same
// flag, so every county whose colour pair is the same shares ONE asset —
// chosen from the Commons file naming the most group members — and the
// engine never offers same-asset entities as competing options
// (src/flags/engine.ts). Colour pairs were verified against each county's
// own Commons file, and every candidate rendered and pixel-hashed, before
// this mapping was committed (see fetch script header).
const FLAG_ASSETS: Record<string, string> = {
  CARLOW: "c01",
  CAVAN: "c02",
  CLARE: "c03",
  CORK: "c04",
  DONEGAL: "c05",
  DUBLIN: "c06",
  GALWAY: "c07",
  KERRY: "c05",
  KILDARE: "c08",
  KILKENNY: "c09",
  LAOIS: "c02",
  LEITRIM: "c05",
  LIMERICK: "c10",
  LONGFORD: "c03",
  LOUTH: "c04",
  MAYO: "c11",
  MEATH: "c05",
  MONAGHAN: "c02",
  OFFALY: "c12",
  ROSCOMMON: "c03",
  SLIGO: "c13",
  TIPPERARY: "c03",
  WATERFORD: "c02",
  WESTMEATH: "c07",
  WEXFORD: "c14",
  WICKLOW: "c03",
  ANTRIM: "c15",
  ARMAGH: "c16",
  DOWN: "c17",
  FERMANAGH: "c10",
  LONDONDERRY: "c04",
  TYRONE: "c04",
};

export const irelandQuiz: FlagQuizConfig = {
  slug: "ireland-flags",
  storagePrefix: "thecounties.flags.ireland.run.",
  quickCount: 10,
  // Derived from the pack — the quiz never keeps its own name data.
  bank: irelandPack.places.map((place) => ({
    id: place.id,
    name: place.name,
    group: place.group,
  })),
  flagIds: FLAG_ASSETS,
  copy: {
    modeEyebrow: "Ireland · The County Flags",
    modeHeadline: "Four answers. One clock. No going back.",
    modeExplainer:
      "Each correct answer is worth up to 1,000 points, draining with the timer.",
    flagAlt: "Flag of an Irish county",
    shareTitle: "Ireland · The County Flags",
    shareCaption: "IRELAND · THE COUNTY FLAGS",
    shareFooter: "thecounties.vercel.app/ireland-flags",
  },
};

// Mount the app when this module is loaded as the page entry.
createFlagsApp(irelandQuiz);
