import { COUNTIES, PROVINCE_COLORS } from "../counties";
import type { Pack } from "./types";

export const irelandPack: Pack = {
  id: "ireland",
  title: "The Counties",
  eyebrow: "Ireland · 32 counties",
  geojsonUrl: "/counties.geojson",
  featureIdProperty: "COUNTY",
  places: COUNTIES.map((county) => ({
    id: county.id,
    name: county.name,
    group: county.province,
    aliases: county.aliases,
  })),
  groupColors: PROVINCE_COLORS,
  frame: [
    [-10.7, 51.35],
    [-5.3, 51.35],
    [-5.3, 55.45],
    [-10.7, 55.45],
  ],
  viewBox: [640, 780],
  compactLabels: ["Louth", "Carlow", "Laois", "Down"],
  stripPrefixes: ["county", "contae", "co"],
  mapLabel: "Map of the 32 counties of Ireland",
  unitSingular: "county",
  unitPlural: "counties",
  placeholder: "Name a county…",
  credit: "The 32 traditional counties · boundaries from OSi / OSNI open data",
  helpIntro:
    "There are 32 counties on the island of Ireland — 26 in the Republic and 6 in Northern Ireland. Name them all.",
  helpItems: [
    "Type a county and press enter. Correct names fill in on the map.",
    "Colours mark the four provinces: Leinster, Munster, Connacht, and Ulster.",
    "Derry and Londonderry both count. Old names like King’s County do too.",
    "No list to pick from. If you know it, you can name it.",
  ],
  winTitle: "The thirty-two",
};
