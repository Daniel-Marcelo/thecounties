export type Place = {
  id: string;
  name: string;
  group: string;
  aliases: string[];
  /** Display-only label for the map. Never matched against guesses; leaves name free for answers. */
  mapName?: string;
};

export type Pack = {
  id: string;
  title: string;
  eyebrow: string;
  geojsonUrl: string;
  featureIdProperty: string;
  places: Place[];
  groupColors: Record<string, string>;
  /**
   * Darker variants of groupColors for TEXT usages (status line, Named rows)
   * where the fill color would fail AA contrast on paper. Map fills keep
   * groupColors. Unset groups fall back to groupColors.
   */
  groupTextColors?: Record<string, string>;
  frame: [number, number][];
  viewBox: [number, number];
  /**
   * Central meridian the projection should rotate to. Required for regions
   * that span the antimeridian (e.g. Oceania): the frame is built on
   * unwrapped longitudes, and d3's mercator wraps them back into [-180, 180]
   * unless the projection is rotated. Leave unset for every other region.
   */
  rotateLon?: number;
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
