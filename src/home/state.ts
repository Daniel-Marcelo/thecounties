export type HubEntry = {
  total: number;
  found: number;
  guesses: number;
  finished: boolean;
  bestTime: number | null;
  bestGuesses: number | null;
};

export type HubState = Record<string, HubEntry | null>;

export type FlagModeBest = {
  score: number | null;
  correct: number | null;
  total: number;
  /** The best-correct record, kept apart from the best-score one for the bar. */
  bestCorrect?: { correct: number; total: number } | null;
};

export type FlagsHubState = Record<"full" | "quick", FlagModeBest>;

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

/** Per-quiz storage prefixes and question counts the hub cards quote. */
const FLAGS_QUIZZES: Record<string, { storagePrefix: string; totals: Record<"full" | "quick", number> }> = {
  "brazil-flags": {
    storagePrefix: "thecounties.flags.brazil.run.",
    totals: { full: 27, quick: 10 },
  },
  "europe-flags": {
    storagePrefix: "thecounties.flags.europe.run.",
    totals: { full: 46, quick: 10 },
  },
  "ireland-flags": {
    storagePrefix: "thecounties.flags.ireland.run.",
    totals: { full: 32, quick: 10 },
  },
};

type FlagRecord = { total: number; correct: number; score: number | null };

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A stored best record; `null` when absent or malformed. */
function readFlagRecord(value: unknown, mode: string): FlagRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  if (rec.mode !== mode) return null;
  const total = finiteNumber(rec.total);
  const correct = finiteNumber(rec.correct);
  if (total === null || correct === null) return null;
  // Best-correct records carry no score; only best-score records require one.
  return { total, correct, score: finiteNumber(rec.score) };
}

function readFlagMode(mode: "full" | "quick", quiz: (typeof FLAGS_QUIZZES)[string]): FlagModeBest {
  const best: FlagModeBest = {
    score: null,
    correct: null,
    total: quiz.totals[mode],
    bestCorrect: null,
  };

  let raw: string | null;
  try {
    raw = localStorage.getItem(`${quiz.storagePrefix}${mode}`);
  } catch {
    return best;
  }
  if (!raw) return best;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return best;
  }
  if (!parsed || typeof parsed !== "object") return best;

  const record = parsed as Record<string, unknown>;
  const scoreRecord = readFlagRecord(record.bestScore, mode);
  const bestCorrect = readFlagRecord(record.bestCorrect, mode);
  const bestScore =
    scoreRecord && scoreRecord.score !== null
      ? {
          total: scoreRecord.total,
          correct: scoreRecord.correct,
          score: scoreRecord.score,
        }
      : null;

  if (bestScore) {
    best.score = bestScore.score;
    best.correct = bestScore.correct;
    best.total = bestScore.total;
  }
  if (bestCorrect) {
    best.bestCorrect = {
      correct: bestCorrect.correct,
      total: bestCorrect.total,
    };
    // A mode with only a correct record still gets a row, without a score.
    if (!bestScore) {
      best.correct = bestCorrect.correct;
      best.total = bestCorrect.total;
    }
  }
  return best;
}

/**
 * The flags quiz keeps two bests per mode; the hub card reads them all.
 * Corrupt or missing records read as nulls rather than errors. The card's
 * route slug picks which quiz's storage it reflects.
 */
export function readFlagsHubState(slug: string): FlagsHubState {
  const quiz = FLAGS_QUIZZES[slug];
  if (!quiz) {
    const empty: Record<"full" | "quick", FlagModeBest> = {
      full: { score: null, correct: null, total: 0, bestCorrect: null },
      quick: { score: null, correct: null, total: 0, bestCorrect: null },
    };
    return empty as FlagsHubState;
  }
  return {
    full: readFlagMode("full", quiz),
    quick: readFlagMode("quick", quiz),
  };
}
