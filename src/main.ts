import { COUNTIES, COUNTY_BY_ID, formatTime, matchCounty, type County } from "./counties";
import { IrelandMap } from "./map";

const TOTAL = COUNTIES.length;
const BEST_TIME_KEY = "thecounties.bestTime";
const BEST_GUESSES_KEY = "thecounties.bestGuesses";
const SESSION_KEY = "thecounties.session";

type Session = {
  foundIds: string[];
  guesses: number;
  startedAt: number | null;
  stoppedAt: number | null;
  finished: boolean;
};

type StatusKind = "idle" | "ok" | "dup" | "bad" | "win" | "giveup";

const mapSvg = document.querySelector<SVGSVGElement>("#map")!;
const form = document.querySelector<HTMLFormElement>("#guess-form")!;
const input = document.querySelector<HTMLInputElement>("#guess")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const foundCountEl = document.querySelector<HTMLElement>("#found-count")!;
const guessCountEl = document.querySelector<HTMLElement>("#guess-count")!;
const timerEl = document.querySelector<HTMLElement>("#timer")!;
const bestEl = document.querySelector<HTMLElement>("#best")!;
const foundListEl = document.querySelector<HTMLUListElement>("#found-list")!;
const giveUpButton = document.querySelector<HTMLButtonElement>("#give-up")!;
const startOverButton = document.querySelector<HTMLButtonElement>("#start-over")!;
const helpButton = document.querySelector<HTMLButtonElement>("#help")!;
const overlay = document.querySelector<HTMLDialogElement>("#help-dialog")!;
const winDialog = document.querySelector<HTMLDialogElement>("#win-dialog")!;
const winSummary = document.querySelector<HTMLParagraphElement>("#win-summary")!;
const shareButton = document.querySelector<HTMLButtonElement>("#share")!;

const map = new IrelandMap(mapSvg);
const found = new Set<string>();
const foundOrder: County[] = [];

let guesses = 0;
let startedAt: number | null = null;
let stoppedAt: number | null = null;
let timerId: number | null = null;
let finished = false;
let restoring = false;

function setStatus(kind: StatusKind, message: string): void {
  statusEl.dataset.kind = kind;
  statusEl.textContent = message;
}

function hasProgress(): boolean {
  return found.size > 0 || guesses > 0 || finished;
}

function syncActions(): void {
  giveUpButton.hidden = finished;
  startOverButton.hidden = !hasProgress();
}

function renderStats(): void {
  foundCountEl.textContent = String(found.size);
  guessCountEl.textContent = String(guesses);
  const bestTime = readBestTime();
  bestEl.textContent = bestTime === null ? "—" : formatTime(bestTime);
}

function elapsedMs(): number {
  if (startedAt === null) return 0;
  return (stoppedAt ?? Date.now()) - startedAt;
}

function tick(): void {
  if (startedAt === null) return;
  timerEl.textContent = formatTime(elapsedMs());
}

function startTimer(): void {
  if (startedAt !== null) return;
  startedAt = Date.now();
  resumeTimer();
}

function resumeTimer(): void {
  if (timerId !== null || startedAt === null || finished) return;
  timerId = window.setInterval(tick, 250);
  tick();
}

function stopTimer(): void {
  if (stoppedAt === null && startedAt !== null) {
    stoppedAt = Date.now();
  }
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
  tick();
}

function saveSession(): void {
  if (restoring) return;
  if (found.size === 0 && guesses === 0 && !finished) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }

  const session: Session = {
    foundIds: foundOrder.map((county) => county.id),
    guesses,
    startedAt,
    stoppedAt,
    finished,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function readSession(): Session | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Session;
    if (!Array.isArray(parsed.foundIds) || typeof parsed.guesses !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function restoreSession(): void {
  const session = readSession();
  if (!session) return;

  restoring = true;
  guesses = session.guesses;
  startedAt = session.startedAt;
  stoppedAt = session.stoppedAt;
  finished = session.finished;

  for (const id of session.foundIds) {
    const county = COUNTY_BY_ID.get(id);
    if (county && !found.has(county.id)) addFound(county);
  }

  if (finished) {
    input.disabled = true;
    if (found.size === TOTAL) {
      setStatus("win", `The lot of them. ${TOTAL} counties in ${formatTime(elapsedMs())}.`);
    } else {
      map.revealRemaining(found);
      const missed = COUNTIES.filter((county) => !found.has(county.id)).map((county) => county.name);
      setStatus(
        "giveup",
        missed.length
          ? `You had ${found.size} of ${TOTAL}. Still out: ${missed.join(", ")}.`
          : `You had them all.`,
      );
    }
    tick();
  } else if (startedAt !== null || found.size > 0 || guesses > 0) {
    if (found.size > 0) {
      setStatus("ok", `${found.size} of ${TOTAL} still on the map.`);
    }
    resumeTimer();
  }

  syncActions();
  renderStats();
  restoring = false;
}

function readBestTime(): number | null {
  const raw = localStorage.getItem(BEST_TIME_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function saveBest(elapsed: number): void {
  const bestTime = readBestTime();
  if (bestTime === null || elapsed < bestTime) {
    localStorage.setItem(BEST_TIME_KEY, String(elapsed));
  }

  const bestGuessesRaw = localStorage.getItem(BEST_GUESSES_KEY);
  const bestGuesses = bestGuessesRaw ? Number(bestGuessesRaw) : null;
  if (bestGuesses === null || guesses < bestGuesses) {
    localStorage.setItem(BEST_GUESSES_KEY, String(guesses));
  }
}

function addFound(county: County): void {
  found.add(county.id);
  foundOrder.push(county);
  map.markFound(county);

  const item = document.createElement("li");
  item.dataset.province = county.province;
  item.innerHTML = `<span>${county.name}</span><em>${county.province}</em>`;
  foundListEl.prepend(item);
}

function finishWin(): void {
  finished = true;
  stopTimer();
  const elapsed = elapsedMs();
  saveBest(elapsed);
  saveSession();
  renderStats();
  setStatus("win", `The lot of them. ${TOTAL} counties in ${formatTime(elapsed)}.`);
  input.disabled = true;
  syncActions();
  winSummary.textContent = `You named every county in ${formatTime(elapsed)} across ${guesses} guesses.`;
  winDialog.showModal();
}

function submitGuess(raw: string): void {
  if (finished) return;
  const guess = raw.trim();
  if (!guess) return;

  startTimer();
  const county = matchCounty(guess);

  if (!county) {
    guesses += 1;
    saveSession();
    syncActions();
    renderStats();
    setStatus("bad", "Not one of the 32.");
    form.classList.remove("shake");
    void form.offsetWidth;
    form.classList.add("shake");
    return;
  }

  if (found.has(county.id)) {
    setStatus("dup", `${county.name} is already on the map.`);
    return;
  }

  guesses += 1;
  addFound(county);
  saveSession();
  syncActions();
  renderStats();

  if (found.size === TOTAL) {
    finishWin();
    return;
  }

  setStatus("ok", `${county.name} · ${county.province}`);
}

function giveUp(): void {
  if (finished) return;
  finished = true;
  stopTimer();
  saveSession();
  map.revealRemaining(found);
  input.disabled = true;
  syncActions();

  const missed = COUNTIES.filter((county) => !found.has(county.id)).map((county) => county.name);
  setStatus(
    "giveup",
    missed.length
      ? `You had ${found.size} of ${TOTAL}. Still out: ${missed.join(", ")}.`
      : `You had them all.`,
  );
}

function resetGame(): void {
  found.clear();
  foundOrder.length = 0;
  guesses = 0;
  startedAt = null;
  stoppedAt = null;
  finished = false;
  stopTimer();
  localStorage.removeItem(SESSION_KEY);
  timerEl.textContent = "0:00";
  foundListEl.replaceChildren();
  map.reset();
  input.disabled = false;
  input.value = "";
  syncActions();
  setStatus("idle", "Type a county to begin.");
  renderStats();
  input.focus();
}

function shareResult(): void {
  const elapsed = elapsedMs();
  const text = `The Counties\n${found.size}/${TOTAL} in ${formatTime(elapsed)}\n${guesses} guesses\nthecounties`;

  const done = () => {
    shareButton.textContent = "Copied";
    window.setTimeout(() => {
      shareButton.textContent = "Share";
    }, 1600);
  };

  if (navigator.share) {
    void navigator.share({ text }).catch(() => {
      void navigator.clipboard.writeText(text).then(done);
    });
    return;
  }

  void navigator.clipboard.writeText(text).then(done);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  submitGuess(input.value);
  input.value = "";
  input.focus();
});

function requestStartOver(): void {
  if (!hasProgress()) return;
  if (!finished && !window.confirm("Start over from scratch? This clears your saved progress.")) {
    return;
  }
  resetGame();
}

giveUpButton.addEventListener("click", giveUp);
startOverButton.addEventListener("click", requestStartOver);
shareButton.addEventListener("click", shareResult);

helpButton.addEventListener("click", () => overlay.showModal());
overlay.addEventListener("click", (event) => {
  if (event.target === overlay) overlay.close();
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    (button.closest("dialog") as HTMLDialogElement | null)?.close();
  });
});

async function start(): Promise<void> {
  renderStats();
  try {
    await map.load();
    restoreSession();
    input.focus();
  } catch (error) {
    setStatus("bad", error instanceof Error ? error.message : "Map failed to load.");
  }

  if (!localStorage.getItem("thecounties.seenHelp")) {
    overlay.showModal();
    localStorage.setItem("thecounties.seenHelp", "1");
  }
}

void start();
