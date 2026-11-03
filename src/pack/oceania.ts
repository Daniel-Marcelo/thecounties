import type { Pack, Place } from "./types";

const AUSTRALASIA = "Australasia";
const MELANESIA = "Melanesia";
const MICRONESIA = "Micronesia";
const POLYNESIA = "Polynesia";

const places: Place[] = [
  { id: "AUS", name: "Australia", group: AUSTRALASIA, aliases: [] },
  { id: "FJI", name: "Fiji", group: MELANESIA, aliases: [] },
  { id: "KIR", name: "Kiribati", group: MICRONESIA, aliases: [] },
  { id: "MHL", name: "Marshall Islands", group: MICRONESIA, aliases: [] },
  { id: "FSM", name: "Micronesia", group: MICRONESIA, aliases: ["federated states of micronesia"] },
  { id: "NRU", name: "Nauru", group: MICRONESIA, aliases: [] },
  { id: "NZL", name: "New Zealand", group: AUSTRALASIA, aliases: ["nz"] },
  { id: "PLW", name: "Palau", group: MICRONESIA, aliases: ["belau"] },
  { id: "PNG", name: "Papua New Guinea", group: MELANESIA, aliases: ["png"] },
  { id: "WSM", name: "Samoa", group: POLYNESIA, aliases: ["western samoa"] },
  { id: "SLB", name: "Solomon Islands", group: MELANESIA, aliases: ["solomons"] },
  { id: "TON", name: "Tonga", group: POLYNESIA, aliases: [] },
  { id: "TUV", name: "Tuvalu", group: POLYNESIA, aliases: [] },
  { id: "VUT", name: "Vanuatu", group: MELANESIA, aliases: ["new hebrides"] },
];

export const oceaniaPack: Pack = {
  id: "oceania",
  title: "The Countries",
  eyebrow: "Oceania · 14 countries",
  geojsonUrl: "/oceania.geojson",
  featureIdProperty: "id",
  places,
  groupColors: {
    [AUSTRALASIA]: "#1d5a8a",
    [MELANESIA]: "#2f6b4f",
    [MICRONESIA]: "#c56a1a",
    [POLYNESIA]: "#b42318",
  },
  // Derived by `python scripts/build-region.py oceania ... --unwrap --verbose`.
  // The region crosses the antimeridian (Kiribati's Line Islands), so the frame
  // is built on unwrapped longitudes and the projection rotates to rotateLon.
  frame: [
    [110.5, -49],
    [205.5, -49],
    [205.5, 9],
    [110.5, 9],
  ],
  viewBox: [1017, 700],
  rotateLon: 158,
  compactLabels: [
    "Nauru",
    "Palau",
    "Fiji",
    "Samoa",
    "Tonga",
    "Tuvalu",
    "Kiribati",
    "Vanuatu",
  ],
  stripPrefixes: ["the", "republic of", "kingdom of", "commonwealth of", "federated states of"],
  mapLabel: "Map of the countries of Oceania",
  unitSingular: "country",
  unitPlural: "countries",
  placeholder: "Name a country…",
  credit: "14 countries of Oceania · boundaries from Natural Earth",
  helpIntro:
    "Name the 14 sovereign countries of Oceania — from Australia and New Zealand across Micronesia to the far Pacific. Indonesia and Timor-Leste live on the Asia map.",
  helpItems: [
    "Type a country and press enter. Correct names fill in on the map.",
    "Colours mark Australasia, Melanesia, Micronesia, and Polynesia.",
    "NZ and PNG both count. So do Belau, the New Hebrides, and Western Samoa.",
    "The map stretches past the date line — Kiribati's eastern islands sit far right.",
    "No list to pick from. If you know it, you can name it.",
  ],
  winTitle: "The fourteen",
};
