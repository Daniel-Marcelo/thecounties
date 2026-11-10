import { brazilPack } from "../pack/brazil";
import type { FlagQuizConfig } from "./config";

// Asset join keyed by state id (sigla → fNN file name). The mapping is
// id-keyed: brazilPack.places order is never relied on.
const FLAG_ASSETS: Record<string, string> = {
  AC: "f01",
  AL: "f02",
  AP: "f03",
  AM: "f04",
  BA: "f05",
  CE: "f06",
  DF: "f07",
  ES: "f08",
  GO: "f09",
  MA: "f10",
  MT: "f11",
  MS: "f12",
  MG: "f13",
  PA: "f14",
  PB: "f15",
  PR: "f16",
  PE: "f17",
  PI: "f18",
  RJ: "f19",
  RN: "f20",
  RS: "f21",
  RO: "f22",
  RR: "f23",
  SC: "f24",
  SP: "f25",
  SE: "f26",
  TO: "f27",
};

export const brazilQuiz: FlagQuizConfig = {
  slug: "brazil-flags",
  storagePrefix: "thecounties.flags.brazil.run.",
  quickCount: 10,
  bank: brazilPack.places.map((place) => ({
    id: place.id,
    name: place.name,
    group: place.group,
  })),
  flagIds: FLAG_ASSETS,
  copy: {
    modeEyebrow: "Brazil · New · The State Flags",
    modeHeadline: "Four answers. One clock. No going back.",
    modeExplainer:
      "Each correct answer is worth up to 1,000 points, draining with the timer.",
    flagAlt: "Flag of a Brazilian state",
    shareTitle: "Brazil · The State Flags",
    shareCaption: "BRAZIL · THE STATE FLAGS",
    shareFooter: "thecounties.vercel.app/brazil-flags",
  },
};
