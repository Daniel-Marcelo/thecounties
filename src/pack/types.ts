export type Place = {
  id: string;
  name: string;
  group: string;
  aliases: string[];
};

export type Pack = {
  id: string;
  title: string;
  eyebrow: string;
  geojsonUrl: string;
  featureIdProperty: string;
  places: Place[];
  groupColors: Record<string, string>;
  frame: [number, number][];
  viewBox: [number, number];
  compactLabels: string[];
  stripPrefixes: string[];
  mapLabel: string;
  unitSingular: string;
  unitPlural: string;
  placeholder: string;
  credit: string;
  helpIntro: string;
  helpItems: string[];
  winTitle: string;
};
