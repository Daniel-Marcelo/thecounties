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
};
