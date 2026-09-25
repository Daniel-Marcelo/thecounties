import type { Pack, Place } from "./types";

const NORTH = "North";
const NORTHEAST = "Northeast";
const CENTER_WEST = "Center-West";
const SOUTHEAST = "Southeast";
const SOUTH = "South";

const places: Place[] = [
  { id: "AC", name: "Acre", group: NORTH, aliases: [] },
  { id: "AL", name: "Alagoas", group: NORTHEAST, aliases: [] },
  { id: "AP", name: "Amapá", group: NORTH, aliases: ["amapa"] },
  { id: "AM", name: "Amazonas", group: NORTH, aliases: ["amazon"] },
  { id: "BA", name: "Bahia", group: NORTHEAST, aliases: [] },
  { id: "CE", name: "Ceará", group: NORTHEAST, aliases: ["ceara"] },
  { id: "DF", name: "Distrito Federal", group: CENTER_WEST, aliases: ["federal district", "brasilia", "brasília"] },
  { id: "ES", name: "Espírito Santo", group: SOUTHEAST, aliases: ["espirito santo"] },
  { id: "GO", name: "Goiás", group: CENTER_WEST, aliases: ["goias"] },
  { id: "MA", name: "Maranhão", group: NORTHEAST, aliases: ["maranhao"] },
  { id: "MT", name: "Mato Grosso", group: CENTER_WEST, aliases: [] },
  { id: "MS", name: "Mato Grosso do Sul", group: CENTER_WEST, aliases: ["mato grosso sul"] },
  { id: "MG", name: "Minas Gerais", group: SOUTHEAST, aliases: ["minas"] },
  { id: "PA", name: "Pará", group: NORTH, aliases: ["para"] },
  { id: "PB", name: "Paraíba", group: NORTHEAST, aliases: ["paraiba"] },
  { id: "PR", name: "Paraná", group: SOUTH, aliases: ["parana"] },
  { id: "PE", name: "Pernambuco", group: NORTHEAST, aliases: [] },
  { id: "PI", name: "Piauí", group: NORTHEAST, aliases: ["piaui"] },
  { id: "RJ", name: "Rio de Janeiro", group: SOUTHEAST, aliases: ["rio"] },
  { id: "RN", name: "Rio Grande do Norte", group: NORTHEAST, aliases: [] },
  { id: "RS", name: "Rio Grande do Sul", group: SOUTH, aliases: [] },
  { id: "RO", name: "Rondônia", group: NORTH, aliases: ["rondonia"] },
  { id: "RR", name: "Roraima", group: NORTH, aliases: [] },
  { id: "SC", name: "Santa Catarina", group: SOUTH, aliases: [] },
  { id: "SP", name: "São Paulo", group: SOUTHEAST, aliases: ["sao paulo"] },
  { id: "SE", name: "Sergipe", group: NORTHEAST, aliases: [] },
  { id: "TO", name: "Tocantins", group: NORTH, aliases: [] },
];

export const brazilPack: Pack = {
  id: "brazil",
  title: "The States",
  eyebrow: "Brazil · 26 states + DF",
  geojsonUrl: "/brazil.geojson",
  featureIdProperty: "sigla",
  places,
  groupColors: {
    [NORTH]: "#1d5a8a",
    [NORTHEAST]: "#c56a1a",
    [CENTER_WEST]: "#2f6b4f",
    [SOUTHEAST]: "#b42318",
    [SOUTH]: "#6b4c9a",
  },
  frame: [
    [-74.1, -33.8],
    [-34.7, -33.8],
    [-34.7, 5.3],
    [-74.1, 5.3],
  ],
  viewBox: [640, 720],
  compactLabels: ["Acre", "Amapá", "Ceará", "Goiás", "Pará", "Piauí", "Sergipe"],
  stripPrefixes: ["estado", "estado do", "estado de", "estado da", "state of", "state"],
  mapLabel: "Map of the states of Brazil",
  unitSingular: "state",
  unitPlural: "states",
  placeholder: "Name a state…",
  credit: "26 states and the Federal District · boundaries from IBGE via open data",
  helpIntro:
    "Brazil has 26 states and a Federal District. Name every one of them.",
  helpItems: [
    "Type a state and press enter. Correct names fill in on the map.",
    "Colours mark the five regions: North, Northeast, Center-West, Southeast, and South.",
    "Abbreviations count: SP, RJ, DF. So do names without accents.",
    "No list to pick from. If you know it, you can name it.",
  ],
  winTitle: "The twenty-seven",
};
