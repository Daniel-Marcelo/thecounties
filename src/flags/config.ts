import type { StateFlag } from "./data";

/**
 * One flags quiz. Adding a quiz means adding one of these — the engine, the
 * app, the share card, and the checkers all take the config, never hardcode
 * a quiz's copy, totals, or storage keys.
 */
export type FlagQuizConfig = {
  /** Route slug, e.g. "brazil-flags" — also seeds the share filename. */
  slug: string;
  /** localStorage key prefix, e.g. "thecounties.flags.brazil.run." */
  storagePrefix: string;
  /** Questions in a quick round. */
  quickCount: number;
  /** The full question bank, derived from the matching pack's places. */
  bank: readonly StateFlag[];
  /**
   * Opaque asset join keyed by entity id (ISO3 → eNN/fNN file stem). Note the
   * mapping is id-keyed: the pack's places order is never relied on.
   */
  flagIds: Record<string, string>;
  copy: {
    /** Mode-select eyebrow, e.g. "Brazil · New · The State Flags". */
    modeEyebrow: string;
    modeHeadline: string;
    modeExplainer: string;
    /** Alt text for the question image. */
    flagAlt: string;
    /** Web Share title. */
    shareTitle: string;
    /** Letter-spaced caption on the share card. */
    shareCaption: string;
    /** Footer URL painted on the share card. */
    shareFooter: string;
  };
};

/** `/flags/eNN.svg` for a bank id, or null when the join has no row for it. */
export function flagPathFor(config: FlagQuizConfig, id: string): string | null {
  if (!Object.hasOwn(config.flagIds, id)) return null;
  return `/flags/${config.flagIds[id]}.svg`;
}
