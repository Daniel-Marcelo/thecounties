import { FLAG_QUESTION_MS, flagPathFor, stateFlags } from "./data";
import {
  buildRun,
  scoreFor,
  type FlagMode,
  type FlagQuestion,
  type FlagResult,
} from "./engine";

const NAMES = new Map(stateFlags().map((flag) => [flag.id, flag.name]));
const OPTION_KEYS = ["1", "2", "3", "4"];

function screenEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>("#screen");
}

function displayName(id: string): string {
  return NAMES.get(id) ?? id;
}

/*
 * The active question owns the digit shortcuts. It is replaced on every
 * question and cleared when the run ends, so keys can never leak into the
 * mode-select/results views Task 5 will add.
 */
let handleQuestionKey: ((event: KeyboardEvent) => void) | null = null;

document.addEventListener("keydown", (event) => {
  handleQuestionKey?.(event);
});

/**
 * Renders and plays a whole run. Task 5's mode select calls this; until then
 * the bootstrap at the bottom of this file starts a quick run directly.
 */
export function startRun(mode: FlagMode): void {
  const run = buildRun(mode);
  let index = 0;
  let score = 0;
  let correctCount = 0;

  function renderRunComplete(result: FlagResult): void {
    // Temporary handoff: Task 5 replaces this body with the results view and
    // the single saveResult(result) call.
    console.log("flags:run-complete", result);

    const screen = screenEl();
    if (!screen) return;

    const section = document.createElement("section");
    section.className = "flag-question flag-finish";

    const eyebrow = document.createElement("p");
    eyebrow.className = "flag-counter";
    eyebrow.textContent = result.mode === "quick" ? "Quick round complete" : "Full run complete";

    const heading = document.createElement("h2");
    heading.textContent = `${result.score.toLocaleString("en-US")} pts`;

    const note = document.createElement("p");
    note.className = "flag-finish-note";
    note.textContent = `${result.correct} of ${result.total} flags named.`;

    section.append(eyebrow, heading, note);
    screen.replaceChildren(section);
  }

  function advance(): void {
    index += 1;
    if (index >= run.questions.length) {
      handleQuestionKey = null;
      renderRunComplete({
        mode: run.mode,
        total: run.questions.length,
        correct: correctCount,
        score,
        playedAt: Date.now(),
      });
      return;
    }
    renderQuestion(run.questions[index]!, index + 1);
  }

  function renderQuestion(question: FlagQuestion, position: number): void {
    const screen = screenEl();
    if (!screen) return;

    const total = run.questions.length;

    const section = document.createElement("section");
    section.className = "flag-question";
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
    let locked = false;
    let frame = 0;
    let deadline = 0;

    function remainingMs(): number {
      return Math.max(0, FLAG_QUESTION_MS - (performance.now() - startedAt));
    }

    function stopClock(): void {
      cancelAnimationFrame(frame);
      window.clearTimeout(deadline);
    }

    function lock(pickedId: string | null, timedOut: boolean): void {
      if (locked) return;
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
      next.addEventListener("click", advance);

      feedback.replaceChildren(pointsLine, next);
      next.focus();
    }

    function paint(): void {
      if (locked) return;
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
    deadline = window.setTimeout(() => lock(null, true), FLAG_QUESTION_MS);

    handleQuestionKey = (event: KeyboardEvent) => {
      if (locked) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const slot = OPTION_KEYS.indexOf(event.key);
      const button = slot === -1 ? undefined : options[slot];
      if (!button) return;
      event.preventDefault();
      lock(button.dataset.stateId ?? null, false);
    };

    paint();
  }

  renderQuestion(run.questions[0]!, 1);
}

// Temporary entry point: Task 5 swaps this for the mode-select view.
startRun("quick");
