import { FLAG_QUESTION_MS, flagPathFor, stateFlags } from "./data";
import {
  buildRun,
  readBests,
  saveResult,
  scoreFor,
  type FlagBests,
  type FlagMode,
  type FlagQuestion,
  type FlagResult,
} from "./engine";
import { copyPng, downloadShareCard, shareableFile } from "../share-card";
import { renderFlagsShareCard } from "./share";

const NAMES = new Map(stateFlags().map((flag) => [flag.id, flag.name]));
const OPTION_KEYS = ["1", "2", "3", "4"];
const MODE_LABEL: Record<FlagMode, string> = {
  full: "Full run",
  quick: "Quick round",
};
const MODE_DETAIL: Record<FlagMode, string> = {
  full: "All 27 flags",
  quick: "10 random flags",
};
const MODES: readonly FlagMode[] = ["full", "quick"];

function screenEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>("#screen");
}

function displayName(id: string): string {
  return NAMES.get(id) ?? id;
}

function formattedScore(score: number): string {
  return score.toLocaleString("en-US");
}

/*
 * A live question owns its clock (rAF + kill-switch timeout) and the 1–4 key
 * handler. Every transition — next question, results, mode select, replay —
 * runs `teardownActiveView()` first, so an abandoned question can never fire
 * a late timeout against a detached node or keep swallowing digit keys.
 */
let activeCleanup: (() => void) | null = null;
let handleQuestionKey: ((event: KeyboardEvent) => void) | null = null;

function teardownActiveView(): void {
  activeCleanup?.();
  activeCleanup = null;
  handleQuestionKey = null;
}

document.addEventListener("keydown", (event) => {
  handleQuestionKey?.(event);
});

/* --------------------------------------------------------------- mode select */

function modeBestNote(mode: FlagMode): string | null {
  const bests = readBests(mode);
  const parts: string[] = [];
  if (bests.bestScore) parts.push(`Best ${formattedScore(bests.bestScore.score)} pts`);
  if (bests.bestCorrect) {
    parts.push(`${bests.bestCorrect.correct}/${bests.bestCorrect.total}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function showModeSelect(): void {
  teardownActiveView();
  clearToastTimer();

  const screen = screenEl();
  if (!screen) return;

  const section = document.createElement("section");
  section.className = "flag-modes-view";

  const eyebrow = document.createElement("p");
  eyebrow.className = "flag-eyebrow";
  eyebrow.textContent = "Brazil · New · The State Flags";

  const heading = document.createElement("h1");
  heading.className = "flag-headline";
  heading.tabIndex = -1;
  heading.textContent = "Four answers. One clock. No going back.";

  const explainer = document.createElement("p");
  explainer.className = "flag-explainer";
  explainer.textContent =
    "Each correct answer is worth up to 1,000 points, draining with the timer.";

  const modes = document.createElement("div");
  modes.className = "flag-modes";
  modes.setAttribute("role", "group");
  modes.setAttribute("aria-label", "Choose a mode");

  for (const mode of MODES) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "flag-mode-card";
    card.dataset.mode = mode;

    const name = document.createElement("strong");
    name.textContent = MODE_LABEL[mode];

    const detail = document.createElement("small");
    detail.textContent = MODE_DETAIL[mode];

    card.append(name, detail);

    const best = modeBestNote(mode);
    if (best) {
      const bestLine = document.createElement("span");
      bestLine.className = "flag-mode-best";
      bestLine.textContent = best;
      card.append(bestLine);
    }

    const accessibleLabel = `${MODE_LABEL[mode]} — ${MODE_DETAIL[mode]}${best ? `. ${best}` : ""}`;
    card.setAttribute("aria-label", accessibleLabel);

    card.addEventListener("click", () => startRun(mode));
    modes.append(card);
  }

  section.append(eyebrow, heading, explainer, modes);
  screen.replaceChildren(section);
  heading.focus({ preventScroll: true });
}

/* --------------------------------------------------------------------- a run */

/**
 * Renders and plays one whole run. The mode select, Play again, and Change
 * mode all funnel through here; each call builds a fresh shuffled run.
 */
export function startRun(mode: FlagMode): void {
  teardownActiveView();
  clearToastTimer();

  const run = buildRun(mode);
  let index = 0;
  let score = 0;
  let correctCount = 0;
  let advancing = false;

  function finishRun(): void {
    const result: FlagResult = {
      mode: run.mode,
      total: run.questions.length,
      correct: correctCount,
      score,
      playedAt: Date.now(),
    };
    // Read the old records before saving: once saved they are overwritten.
    const previous = readBests(run.mode);
    saveResult(result);
    renderResults(result, previous);
  }

  function advance(): void {
    if (advancing) return;
    advancing = true;
    teardownActiveView();
    index += 1;

    if (index >= run.questions.length) {
      finishRun();
      return;
    }

    renderQuestion(run.questions[index]!, index + 1);
    advancing = false;
  }

  function renderQuestion(question: FlagQuestion, position: number): void {
    teardownActiveView();

    const screen = screenEl();
    if (!screen) return;

    const total = run.questions.length;

    const section = document.createElement("section");
    section.className = "flag-question";
    section.tabIndex = -1;
    section.setAttribute("aria-label", `Question ${position} of ${total}`);

    const top = document.createElement("div");
    top.className = "flag-top";
    const counter = document.createElement("p");
    counter.className = "flag-counter";
    counter.textContent = `${position} of ${total}`;
    top.append(counter);

    const hero = document.createElement("div");
    hero.className = "flag-hero";
    const image = document.createElement("img");
    image.className = "flag-image";
    image.alt = "Flag of a Brazilian state";
    image.decoding = "async";
    image.draggable = false;
    const source = flagPathFor(question.answerId);
    if (source) image.src = source;
    hero.append(image);

    const timerTrack = document.createElement("div");
    timerTrack.className = "flag-timer";
    timerTrack.setAttribute("aria-hidden", "true");
    const timerBar = document.createElement("i");
    timerBar.id = "timer-bar";
    timerTrack.append(timerBar);

    const optionsWrap = document.createElement("div");
    optionsWrap.className = "flag-options";
    const options = question.options.map((id, slot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "flag-option";
      button.dataset.stateId = id;

      const key = document.createElement("span");
      key.className = "flag-option-key";
      key.setAttribute("aria-hidden", "true");
      key.textContent = OPTION_KEYS[slot] ?? "";

      const name = document.createElement("span");
      name.className = "flag-option-name";
      name.textContent = displayName(id);

      button.append(key, name);
      return button;
    });
    optionsWrap.append(...options);

    const feedback = document.createElement("div");
    feedback.className = "flag-feedback";

    section.append(top, hero, timerTrack, optionsWrap, feedback);
    screen.replaceChildren(section);

    // The clock is measured from the moment the question view is in the DOM.
    const startedAt = performance.now();
    let abandoned = false;
    let locked = false;
    let advanceRequested = false;
    let frame = 0;
    let deadline = 0;

    function remainingMs(): number {
      return Math.max(0, FLAG_QUESTION_MS - (performance.now() - startedAt));
    }

    function stopClock(): void {
      cancelAnimationFrame(frame);
      window.clearTimeout(deadline);
    }

    activeCleanup = () => {
      abandoned = true;
      stopClock();
    };

    function lock(pickedId: string | null, timedOut: boolean): void {
      if (locked || abandoned) return;
      locked = true;
      stopClock();

      const remaining = timedOut ? 0 : remainingMs();
      const expired = remaining <= 0;
      const chosenId = expired ? null : pickedId;
      const isCorrect = chosenId !== null && chosenId === question.answerId;
      const points = isCorrect ? scoreFor(remaining) : 0;

      if (isCorrect) {
        correctCount += 1;
        score += points;
      }

      for (const button of options) button.disabled = true;

      for (const button of options) {
        if (button.dataset.stateId === question.answerId) {
          button.classList.add("correct");
        } else if (chosenId !== null && button.dataset.stateId === chosenId) {
          button.classList.add("wrong");
        }
      }

      timerBar.style.width = expired ? "0%" : `${(remaining / FLAG_QUESTION_MS) * 100}%`;

      const pointsLine = document.createElement("p");
      pointsLine.id = "points-line";
      if (isCorrect) {
        pointsLine.dataset.kind = "correct";
        pointsLine.textContent = `+${points} · ${displayName(question.answerId)}`;
      } else if (expired) {
        pointsLine.dataset.kind = "timeout";
        pointsLine.textContent = `Time's up — 0 pts · ${displayName(question.answerId)}`;
      } else {
        pointsLine.dataset.kind = "wrong";
        pointsLine.textContent = `0 pts · ${displayName(question.answerId)}`;
      }

      const next = document.createElement("button");
      next.id = "next";
      next.type = "button";
      next.textContent = "Next";
      // One advance per question: a double-click cannot skip a question even
      // though the first click detaches this button from the document.
      next.addEventListener("click", () => {
        if (advanceRequested) return;
        advanceRequested = true;
        next.disabled = true;
        advance();
      });

      feedback.replaceChildren(pointsLine, next);
      next.focus();
    }

    function paint(): void {
      if (locked || abandoned) return;
      const remaining = remainingMs();
      timerBar.style.width = `${(remaining / FLAG_QUESTION_MS) * 100}%`;
      if (remaining <= 0) {
        lock(null, true);
        return;
      }
      frame = requestAnimationFrame(paint);
    }

    for (const button of options) {
      button.addEventListener("click", () => {
        lock(button.dataset.stateId ?? null, false);
      });
    }

    /*
     * A timestamp-checked timeout, independent of rAF: throttled frames can
     * never leave a question hanging, and a late tap is scored as a timeout.
     */
    deadline = window.setTimeout(() => {
      if (!abandoned) lock(null, true);
    }, FLAG_QUESTION_MS);

    handleQuestionKey = (event: KeyboardEvent) => {
      if (locked || abandoned) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const slot = OPTION_KEYS.indexOf(event.key);
      const button = slot === -1 ? undefined : options[slot];
      if (!button) return;
      event.preventDefault();
      lock(button.dataset.stateId ?? null, false);
    };

    paint();
    section.focus({ preventScroll: true });
  }

  renderQuestion(run.questions[0]!, 1);
}

/* ------------------------------------------------------------------ results */

type ShareCapability = "share" | "copy";

function canShareFiles(): boolean {
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
    return false;
  }
  try {
    const probe = new File([new Uint8Array([0])], "card.png", { type: "image/png" });
    return navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

function comparisonLines(result: FlagResult, previous: FlagBests): string[] {
  const lines: string[] = [];

  const scoreImproved = previous.bestScore === null || result.score > previous.bestScore.score;
  if (scoreImproved) {
    lines.push(
      previous.bestScore === null
        ? `New best! ${formattedScore(result.score)} pts`
        : `Personal best: ${formattedScore(result.score)} pts`,
    );
  }

  const correctImproved =
    previous.bestCorrect === null || result.correct > previous.bestCorrect.correct;
  if (correctImproved) {
    lines.push(
      previous.bestCorrect === null
        ? `New best! ${result.correct} of ${result.total} named`
        : `Personal best: ${result.correct} of ${result.total} named`,
    );
  }

  return lines;
}

function previousNote(result: FlagResult, previous: FlagBests): string | null {
  if (previous.bestScore === null && previous.bestCorrect === null) return null;

  const improved =
    (previous.bestScore !== null && result.score > previous.bestScore.score) ||
    (previous.bestCorrect !== null && result.correct > previous.bestCorrect.correct) ||
    previous.bestScore === null ||
    previous.bestCorrect === null;
  if (!improved) return null;

  const parts: string[] = [];
  if (previous.bestScore) parts.push(`${formattedScore(previous.bestScore.score)} pts`);
  if (previous.bestCorrect) {
    parts.push(`${previous.bestCorrect.correct} of ${previous.bestCorrect.total}`);
  }
  return parts.length > 0 ? `Previous best: ${parts.join(" · ")}.` : null;
}

function renderResults(result: FlagResult, previous: FlagBests): void {
  teardownActiveView();
  clearToastTimer();

  const screen = screenEl();
  if (!screen) return;

  const section = document.createElement("section");
  section.className = "flag-results";
  section.setAttribute("aria-labelledby", "flag-results-title");

  const eyebrow = document.createElement("p");
  eyebrow.className = "flag-counter";
  eyebrow.textContent = `${MODE_LABEL[result.mode]} · ${result.total} flags`;

  const totalScore = document.createElement("h2");
  totalScore.id = "flag-results-title";
  totalScore.className = "flag-result-total";
  totalScore.tabIndex = -1;
  totalScore.textContent = `${formattedScore(result.score)} pts`;

  const correctLine = document.createElement("p");
  correctLine.className = "flag-result-correct";
  correctLine.textContent = `${result.correct} of ${result.total} named`;

  section.append(eyebrow, totalScore, correctLine);

  const comparisons = comparisonLines(result, previous);
  if (comparisons.length > 0) {
    const bestLines = document.createElement("div");
    bestLines.className = "flag-run-bests";
    for (const text of comparisons) {
      const line = document.createElement("p");
      line.className = "flag-best-line";
      line.textContent = text;
      bestLines.append(line);
    }
    section.append(bestLines);
  }

  const noteText = previousNote(result, previous);
  if (noteText) {
    const note = document.createElement("p");
    note.className = "flag-result-note";
    note.textContent = noteText;
    section.append(note);
  }

  const actions = document.createElement("div");
  actions.className = "flag-result-actions";

  const playAgain = document.createElement("button");
  playAgain.type = "button";
  playAgain.id = "play-again";
  playAgain.className = "flag-action flag-action-primary";
  playAgain.textContent = "Play again";
  playAgain.addEventListener("click", () => startRun(result.mode));

  const changeMode = document.createElement("button");
  changeMode.type = "button";
  changeMode.id = "change-mode";
  changeMode.className = "flag-action";
  changeMode.textContent = "Change mode";
  changeMode.addEventListener("click", showModeSelect);

  actions.append(playAgain, changeMode);
  section.append(actions);

  /* ------------------------------------------------------------- share card */

  const shareBlock = document.createElement("div");
  shareBlock.className = "flag-share";

  const shareTitle = document.createElement("p");
  shareTitle.className = "flag-share-title";
  shareTitle.textContent = "Share this run";

  const shareActions = document.createElement("div");
  shareActions.className = "flag-share-actions";

  const capability: ShareCapability = canShareFiles() ? "share" : "copy";
  const filename = `brazil-flags-${result.mode}.png`;

  const shareButton = document.createElement("button");
  shareButton.type = "button";
  shareButton.id = "share-card";
  shareButton.className = "flag-share-btn";
  shareButton.textContent = capability === "share" ? "Share result" : "Copy PNG";

  const downloadButton = document.createElement("button");
  downloadButton.type = "button";
  downloadButton.id = "download-card";
  downloadButton.className = "flag-share-btn";
  downloadButton.textContent = "Download PNG";

  const toast = document.createElement("p");
  toast.className = "flag-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.hidden = true;

  let cardPromise: Promise<Blob> | null = null;

  function getCard(): Promise<Blob> {
    cardPromise ??= renderFlagsShareCard(result).catch((error: unknown) => {
      cardPromise = null;
      throw error;
    });
    return cardPromise;
  }

  function showToast(message: string): void {
    toast.textContent = message;
    toast.hidden = false;
    clearToastTimer();
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
      toast.textContent = "";
    }, 2600);
  }

  async function fallbackToCopy(blob: Blob): Promise<void> {
    if (await copyPng(blob)) {
      showToast("PNG copied to clipboard");
      return;
    }
    downloadShareCard(blob, filename);
    showToast("PNG downloaded");
  }

  async function shareResult(): Promise<void> {
    shareButton.disabled = true;
    shareButton.textContent = "Preparing…";
    try {
      const blob = await getCard();
      const file = shareableFile(blob, filename);
      const canUseWebShare =
        typeof navigator.share === "function" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });

      if (canUseWebShare) {
        try {
          await navigator.share({
            files: [file],
            title: "Brazil · The State Flags",
            text: `${formattedScore(result.score)} pts · ${result.correct} of ${result.total} named`,
          });
          showToast("Shared");
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          await fallbackToCopy(blob);
        }
      } else {
        await fallbackToCopy(blob);
      }
    } catch {
      showToast("Couldn't make the card.");
    } finally {
      shareButton.disabled = false;
      shareButton.textContent = capability === "share" ? "Share result" : "Copy PNG";
    }
  }

  shareButton.addEventListener("click", () => {
    void shareResult();
  });

  downloadButton.addEventListener("click", () => {
    downloadButton.disabled = true;
    void getCard()
      .then((blob) => {
        downloadShareCard(blob, filename);
        showToast("PNG downloaded");
      })
      .catch(() => showToast("Couldn't make the card."))
      .finally(() => {
        downloadButton.disabled = false;
      });
  });

  // Warm the canvas while the results are being read, so the share click stays
  // inside the browser's user-activation window.
  void getCard().catch(() => {});

  shareActions.append(shareButton, downloadButton);
  shareBlock.append(shareTitle, shareActions, toast);
  section.append(shareBlock);

  screen.replaceChildren(section);
  totalScore.focus({ preventScroll: true });
}

/* --------------------------------------------------------------- view state */

let toastTimer = 0;

function clearToastTimer(): void {
  window.clearTimeout(toastTimer);
  toastTimer = 0;
}

showModeSelect();
