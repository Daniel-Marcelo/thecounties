/**
 * Shared flag-quiz plumbing: the entity shape and the two scoring constants.
 * Everything quiz-specific (bank, assets, copy, storage prefix) lives in a
 * per-quiz config module — `brazil.ts`, `europe.ts` — described by
 * `config.ts`.
 */

export type StateFlag = { id: string; name: string; group: string };

export const FLAG_QUESTION_MS = 10000;
export const FLAG_MAX_POINTS = 1000;
/** Wrong picks offered alongside the answer (four options total). */
export const DISTRACTOR_COUNT = 3;
