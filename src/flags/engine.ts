import {
  DISTRACTOR_COUNT,
  FLAG_MAX_POINTS,
  FLAG_QUESTION_MS,
  type StateFlag,
} from "./data";

export type FlagMode = "full" | "quick";
export type FlagQuestion = { answerId: string; options: string[] };
export type FlagRun = { mode: FlagMode; questions: FlagQuestion[] };
export type FlagResult = {
  mode: FlagMode;
  total: number;
  correct: number;
  score: number;
  playedAt: number;
};
export type FlagBests = {
  bestScore: FlagResult | null;
  bestCorrect: FlagResult | null;
};

/** Quick-round length when the caller passes no explicit count. */
const QUICK_DEFAULT = 10;

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = swap;
  }
  return copy;
}

/**
 * Distractors must be visually distinct from the answer. Two entities whose
 * flag assets are the same file — e.g. Irish counties that share identical
 * GAA colour designs — would render identical options and make the question
 * unanswerable, so they are excluded from the pool. Quizzes whose assets are
 * unique per entity (Brazil, Europe) are unaffected.
 */
function pickDistractors(
  answer: StateFlag,
  all: StateFlag[],
  assets?: Readonly<Record<string, string>>,
): string[] {
  const answerAsset = assets?.[answer.id];
  const pool = all.filter((flag) => {
    if (flag.id === answer.id) return false;
    if (answerAsset !== undefined && assets?.[flag.id] === answerAsset) return false;
    return true;
  });
  const sameGroup = shuffle(pool.filter((flag) => flag.group === answer.group));
  const otherGroups = shuffle(pool.filter((flag) => flag.group !== answer.group));

  const picks = sameGroup.slice(0, DISTRACTOR_COUNT);
  for (const flag of otherGroups) {
    if (picks.length === DISTRACTOR_COUNT) break;
    picks.push(flag);
  }
  return picks.map((flag) => flag.id);
}

export function buildRun(
  bank: readonly StateFlag[],
  mode: FlagMode,
  quickCount: number = QUICK_DEFAULT,
  assets?: Readonly<Record<string, string>>,
): FlagRun {
  const answers = shuffle(bank);
  const selected = mode === "quick" ? answers.slice(0, quickCount) : answers;

  const questions = selected.map((answer) => ({
    answerId: answer.id,
    options: shuffle([
      answer.id,
      ...pickDistractors(answer, [...bank], assets),
    ]),
  }));

  return { mode, questions };
}

export function scoreFor(remainingMs: number): number {
  if (Number.isNaN(remainingMs) || remainingMs <= 0) return 0;
  if (remainingMs >= FLAG_QUESTION_MS) return FLAG_MAX_POINTS;
  return Math.min(
    FLAG_MAX_POINTS,
    Math.round((remainingMs / FLAG_QUESTION_MS) * FLAG_MAX_POINTS),
  );
}

function storageKey(mode: FlagMode, storagePrefix: string): string {
  return `${storagePrefix}${mode}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidResult(value: unknown, mode: FlagMode): value is FlagResult {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record.mode === mode &&
    isFiniteNumber(record.total) &&
    isFiniteNumber(record.correct) &&
    isFiniteNumber(record.score) &&
    isFiniteNumber(record.playedAt)
  );
}

/**
 * `undefined` marks a malformed record, `null` a legitimately empty one.
 */
function resultFrom(value: unknown, mode: FlagMode): FlagResult | null | undefined {
  if (value === null) return null;
  return isValidResult(value, mode) ? value : undefined;
}

export function readBests(mode: FlagMode, storagePrefix: string): FlagBests {
  const empty: FlagBests = { bestScore: null, bestCorrect: null };

  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(mode, storagePrefix));
  } catch {
    return empty;
  }
  if (!raw) return empty;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return empty;

    const record = parsed as Record<string, unknown>;
    const bestScore = resultFrom(record.bestScore, mode);
    const bestCorrect = resultFrom(record.bestCorrect, mode);
    if (bestScore === undefined || bestCorrect === undefined) return empty;

    return { bestScore, bestCorrect };
  } catch {
    return empty;
  }
}

export function saveResult(result: FlagResult, storagePrefix: string): void {
  const current = readBests(result.mode, storagePrefix);
  let bestScore = current.bestScore;
  let bestCorrect = current.bestCorrect;
  let changed = false;

  if (bestScore === null || result.score > bestScore.score) {
    bestScore = result;
    changed = true;
  }
  if (bestCorrect === null || result.correct > bestCorrect.correct) {
    bestCorrect = result;
    changed = true;
  }
  if (!changed) return;

  try {
    localStorage.setItem(
      storageKey(result.mode, storagePrefix),
      JSON.stringify({ bestScore, bestCorrect }),
    );
  } catch {
    // Bests are a nicety; storage failures must not interrupt the run.
  }
}
