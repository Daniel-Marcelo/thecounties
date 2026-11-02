import type { Pack, Place } from "./types";

const NORTHERN = "Northern";
const SOUTHERN = "Southern";

const places: Place[] = [
  { id: "ARG", name: "Argentina", group: SOUTHERN, aliases: [] },
  { id: "BOL", name: "Bolivia", group: SOUTHERN, aliases: ["plurinational state of bolivia"] },
  { id: "BRA", name: "Brazil", group: NORTHERN, aliases: ["brasil"] },
  { id: "CHL", name: "Chile", group: SOUTHERN, aliases: [] },
  { id: "COL", name: "Colombia", group: NORTHERN, aliases: [] },
  { id: "ECU", name: "Ecuador", group: NORTHERN, aliases: [] },
  { id: "GUY", name: "Guyana", group: NORTHERN, aliases: ["cooperative republic of guyana", "guiana"] },
  { id: "PER", name: "Peru", group: SOUTHERN, aliases: ["peru"] },
  { id: "PRY", name: "Paraguay", group: SOUTHERN, aliases: [] },
  { id: "SUR", name: "Suriname", group: NORTHERN, aliases: ["surinam"] },
  { id: "URY", name: "Uruguay", group: SOUTHERN, aliases: ["oriental republic of uruguay"] },
  { id: "VEN", name: "Venezuela", group: NORTHERN, aliases: ["bolivarian republic of venezuela"] },
];

export const southAmericaPack: Pack = {
  id: "south-america",
  title: "The Countries",
  eyebrow: "South America · 12 countries",
  geojsonUrl: "/south-america.geojson",
  featureIdProperty: "id",
  places,
  groupColors: {
    [NORTHERN]: "#1d5a8a",
    [SOUTHERN]: "#c56a1a",
  },
  frame: [
    [-82, -56.5],
    [-34.5, -56.5],
    [-34.5, 12.7],
    [-82, 12.7],
  ],
  viewBox: [605, 1040],
  compactLabels: ["Ecuador", "Guyana", "Suriname", "Uruguay", "Paraguay"],
  stripPrefixes: [
    "the",
    "republic of",
    "bolivarian republic of",
    "cooperative republic of",
    "oriental republic of",
    "federative republic of",
    "plurinational state of",
  ],
  mapLabel: "Map of the countries of South America",
  unitSingular: "country",
  unitPlural: "countries",
  placeholder: "Name a country…",
  credit: "12 countries of South America · boundaries from Natural Earth",
  helpIntro:
    "South America has 12 sovereign countries, from Colombia in the north to Argentina in the south. Name every one of them.",
  helpItems: [
    "Type a country and press enter. Correct names fill in on the map.",
    "Colours mark the two halves of the continent. Brazil straddles the equator, counted with the north here.",
    "Brasil without the z counts, as do Surinam and Perù.",
    "No list to pick from. If you know it, you can name it.",
  ],
  winTitle: "The twelve",
};
