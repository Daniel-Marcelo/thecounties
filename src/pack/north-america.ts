import type { Pack, Place } from "./types";

const NORTHERN = "Northern";
const CENTRAL = "Central";
const CARIBBEAN = "Caribbean";

const places: Place[] = [
  { id: "ATG", name: "Antigua and Barbuda", group: CARIBBEAN, aliases: ["antigua"] },
  { id: "BHS", name: "Bahamas", group: CARIBBEAN, aliases: ["the bahamas"] },
  { id: "BRB", name: "Barbados", group: CARIBBEAN, aliases: [] },
  { id: "BLZ", name: "Belize", group: CENTRAL, aliases: [] },
  { id: "CAN", name: "Canada", group: NORTHERN, aliases: [] },
  { id: "CRI", name: "Costa Rica", group: CENTRAL, aliases: [] },
  { id: "CUB", name: "Cuba", group: CARIBBEAN, aliases: [] },
  { id: "DMA", name: "Dominica", group: CARIBBEAN, aliases: [] },
  { id: "DOM", name: "Dominican Republic", group: CARIBBEAN, aliases: ["dominican rep"] },
  { id: "SLV", name: "El Salvador", group: CENTRAL, aliases: [] },
  { id: "GRD", name: "Grenada", group: CARIBBEAN, aliases: [] },
  { id: "GTM", name: "Guatemala", group: CENTRAL, aliases: [] },
  { id: "HTI", name: "Haiti", group: CARIBBEAN, aliases: [] },
  { id: "HND", name: "Honduras", group: CENTRAL, aliases: [] },
  { id: "JAM", name: "Jamaica", group: CARIBBEAN, aliases: [] },
  { id: "MEX", name: "Mexico", group: CENTRAL, aliases: [] },
  { id: "NIC", name: "Nicaragua", group: CENTRAL, aliases: [] },
  { id: "PAN", name: "Panama", group: CENTRAL, aliases: [] },
  { id: "KNA", name: "Saint Kitts and Nevis", group: CARIBBEAN, aliases: ["saint kitts", "st kitts", "st kitts and nevis"] },
  { id: "LCA", name: "Saint Lucia", group: CARIBBEAN, aliases: ["st lucia"] },
  { id: "VCT", name: "Saint Vincent and the Grenadines", group: CARIBBEAN, aliases: ["saint vincent", "st vincent", "st vincent and the grenadines"] },
  { id: "TTO", name: "Trinidad and Tobago", group: CARIBBEAN, aliases: ["trinidad"] },
  { id: "USA", name: "United States", group: NORTHERN, aliases: ["united states of america", "america"] },
];

export const northAmericaPack: Pack = {
  id: "north-america",
  title: "The Countries",
  eyebrow: "North America · 23 countries",
  geojsonUrl: "/north-america.geojson",
  featureIdProperty: "id",
  places,
  groupColors: {
    [NORTHERN]: "#1d5a8a",
    [CENTRAL]: "#2f6b4f",
    [CARIBBEAN]: "#c56a1a",
  },
  // Derived by `python scripts/build-region.py north-america CAN,USA,MEX,GTM,BLZ,SLV,HND,NIC,CRI,PAN,CUB,HTI,DOM,JAM,TTO,BHS,BRB,ATG,DMA,GRD,KNA,LCA,VCT`.
  frame: [
    [-175.5, 4.5],
    [-49.5, 4.5],
    [-49.5, 85.0],
    [-175.5, 85.0],
  ],
  viewBox: [749, 1040],
  compactLabels: [
    "Bahamas",
    "Barbados",
    "Belize",
    "Costa Rica",
    "Cuba",
    "Dominica",
    "El Salvador",
    "Grenada",
    "Guatemala",
    "Haiti",
    "Honduras",
    "Jamaica",
    "Nicaragua",
    "Panama",
  ],
  stripPrefixes: ["the", "republic of"],
  mapLabel: "Map of the countries of North America",
  unitSingular: "country",
  unitPlural: "countries",
  placeholder: "Name a country…",
  credit: "23 countries of North America · boundaries from Natural Earth",
  helpIntro:
    "Name the 23 sovereign countries of North America, from Canada and the United States through Central America to the Caribbean. Greenland isn't a country — it belongs to the Kingdom of Denmark.",
  helpItems: [
    "Type a country and press enter. Correct names fill in on the map.",
    "Colours mark Northern, Central, and Caribbean North America.",
    "America and USA count for the United States, as do St Lucia or St Vincent.",
    "The small islands count too — Barbados, Dominica, Grenada, all of them.",
    "No list to pick from. If you know it, you can name it.",
  ],
  winTitle: "The twenty-three",
};
