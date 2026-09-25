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
};
