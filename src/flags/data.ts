import { brazilPack } from "../pack/brazil";

export type StateFlag = { id: string; name: string; group: string };

export const FLAG_QUESTION_MS = 10000;
export const FLAG_MAX_POINTS = 1000;

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

export function stateFlags(): StateFlag[] {
  return brazilPack.places.map((place) => ({
    id: place.id,
    name: place.name,
    group: place.group,
  }));
}

export function flagPathFor(id: string): string | null {
  if (!Object.hasOwn(FLAG_ASSETS, id)) return null;
  return `/flags/${FLAG_ASSETS[id]}.svg`;
}
