export type HubEntry = {
  total: number;
  found: number;
  guesses: number;
  finished: boolean;
  bestTime: number | null;
  bestGuesses: number | null;
};

export type HubState = Record<string, HubEntry | null>;

/** Place totals, exactly as the hub cards advertise them. */
const TOTALS: Record<string, number> = {
  ireland: 32,
  brazil: 27,
  europe: 46,
  "south-america": 12,
  "north-america": 23,
  asia: 47,
  oceania: 14,
  africa: 54,
  globle: 197,
};

function readNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function readSession(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Found count for a pack session; invalid shapes count as untouched. */
function readFound(session: unknown): number {
  if (!session || typeof session !== "object") return 0;
  const foundIds = (session as { foundIds?: unknown }).foundIds;
  return Array.isArray(foundIds)
    ? foundIds.filter((id) => typeof id === "string").length
    : 0;
}

/**
 * The hub's memory of each card, read only from localStorage — the same
 * keys the pack and Globle engines already write. `null` for a card with
 * no session and no best: render it exactly as the static markup does.
 */
export function readHubState(): HubState {
  const state: HubState = {};
  for (const slug of Object.keys(TOTALS)) {
    const entry: HubEntry = {
      total: TOTALS[slug],
      found: 0,
      guesses: 0,
      finished: false,
      bestTime: null,
      bestGuesses: null,
    };

    const session = readSession(
      slug === "globle"
        ? "thecounties.globle.session"
        : `thecounties.pack.${slug}.session`,
    );
    if (session && typeof session === "object") {
      const rec = session as Record<string, unknown>;
      if (slug === "globle") {
        const guesses = rec.guesses;
        entry.guesses = Array.isArray(guesses) ? guesses.length : 0;
        entry.finished = rec.finished === true;
      } else {
        entry.found = readFound(session);
        entry.guesses = typeof rec.guesses === "number" ? rec.guesses : 0;
        entry.finished = rec.finished === true;
      }
    }

    entry.bestTime = readNumber(`thecounties.pack.${slug}.bestTime`);
    entry.bestGuesses =
      readNumber(`thecounties.pack.${slug}.bestGuesses`) ??
      (slug === "globle" ? readNumber("thecounties.globle.bestGuesses") : null);

    state[slug] =
      entry.found > 0 ||
      entry.finished ||
      entry.bestTime !== null ||
      entry.bestGuesses !== null
        ? entry
        : null;
  }
  return state;
}
