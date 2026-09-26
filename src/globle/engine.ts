import type { FeatureCollection, Geometry, Position } from "geojson";
import { formatTime } from "../counties";
import { buildAliasIndex, matchPlace } from "../pack/match";
import type { Place } from "../pack/types";
import { COUNTRIES, type Country } from "./countries";
import { borderKm, formatKm, heatColor, sampleBorders } from "./distance";
import { GlobleMap } from "./map";

type Guess = { id: string; km: number };

type Session = {
  targetId: string;
  guesses: Guess[];
  startedAt: number | null;
  stoppedAt: number | null;
  finished: boolean;
  revealed: boolean;
};

const STRIP = ["republic of", "the", "kingdom of", "state of", "federation of"];
const SESSION_KEY = "thecounties.globle.session";
const BEST_KEY = "thecounties.globle.bestGuesses";
const HELP_KEY = "thecounties.globle.seenHelp";

const places: Place[] = COUNTRIES.map((country) => ({
  id: country.id,
  name: country.name,
  group: "",
  aliases: country.aliases,
}));

export function startGloble(): void {
  const countryById = new Map(COUNTRIES.map((country) => [country.id, country]));
  const aliasIndex = buildAliasIndex(places, STRIP);
  const guessed = new Map<string, Guess>();

  const mapSvg = document.querySelector<SVGSVGElement>("#map")!;
  const form = document.querySelector<HTMLFormElement>("#guess-form")!;
  const input = document.querySelector<HTMLInputElement>("#guess")!;
  const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
  const guessCountEl = document.querySelector<HTMLElement>("#guess-count")!;
  const closestEl = document.querySelector<HTMLElement>("#closest")!;
  const timerEl = document.querySelector<HTMLElement>("#timer")!;
  const bestEl = document.querySelector<HTMLElement>("#best")!;
  const guessListEl = document.querySelector<HTMLUListElement>("#found-list")!;
  const giveUpButton = document.querySelector<HTMLButtonElement>("#give-up")!;
  const startOverButton = document.querySelector<HTMLButtonElement>("#start-over")!;
  const helpButton = document.querySelector<HTMLButtonElement>("#help")!;
  const overlay = document.querySelector<HTMLDialogElement>("#help-dialog")!;
  const winDialog = document.querySelector<HTMLDialogElement>("#win-dialog")!;
  const winSummary = document.querySelector<HTMLParagraphElement>("#win-summary")!;
  const shareButton = document.querySelector<HTMLButtonElement>("#share")!;

  const map = new GlobleMap(mapSvg);
  let borders = new Map<string, Position[]>();
  let target: Country = pickCountry();
  let startedAt: number | null = null;
  let stoppedAt: number | null = null;
  let timerId: number | null = null;
  let finished = false;
  let revealed = false;
  let restoring = false;

  function pickCountry(exceptId?: string): Country {
    const pool = exceptId ? COUNTRIES.filter((country) => country.id !== exceptId) : COUNTRIES;
    return pool[Math.floor(Math.random() * pool.length)]!;
  }

  function setStatus(kind: string, message: string): void {
    statusEl.dataset.kind = kind;
    statusEl.textContent = message;
  }

  function hasProgress(): boolean {
    return guessed.size > 0 || finished;
  }

  function syncActions(): void {
    giveUpButton.hidden = finished;
    startOverButton.hidden = !hasProgress();
  }

  function closestKm(): number | null {
    if (guessed.size === 0) return null;
    return Math.min(...[...guessed.values()].map((guess) => guess.km));
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
    if (stoppedAt === null && startedAt !== null) stoppedAt = Date.now();
    if (timerId !== null) {
      window.clearInterval(timerId);
      timerId = null;
    }
    tick();
  }

  function renderStats(): void {
    guessCountEl.textContent = String(guessed.size);
    const closest = closestKm();
    closestEl.textContent = closest === null ? "—" : formatKm(closest);
    const best = localStorage.getItem(BEST_KEY);
    bestEl.textContent = best ?? "—";
  }

  function saveSession(): void {
    if (restoring) return;
    if (guessed.size === 0 && !finished) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    const session: Session = {
      targetId: target.id,
      guesses: [...guessed.values()],
      startedAt,
      stoppedAt,
      finished,
      revealed,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function addGuess(country: Country, km: number, solved: boolean): void {
    const guess = { id: country.id, km };
    guessed.set(country.id, guess);
    map.paint(country.id, km, solved);

    const item = document.createElement("li");
    item.style.setProperty("--heat", heatColor(km, solved));
    item.innerHTML = `<span>${country.name}</span><em>${solved ? "found" : formatKm(km)}</em>`;
    guessListEl.prepend(item);
  }

  function finishWin(): void {
    finished = true;
    stopTimer();
    const guesses = guessed.size;
    const bestRaw = localStorage.getItem(BEST_KEY);
    const best = bestRaw ? Number(bestRaw) : null;
    if (best === null || guesses < best) localStorage.setItem(BEST_KEY, String(guesses));
    saveSession();
    renderStats();
    syncActions();
    input.disabled = true;
    setStatus("win", `${target.name}. ${guesses} guesses in ${formatTime(elapsedMs())}.`);
    winSummary.textContent = `The country was ${target.name}. You found it in ${guesses} guesses.`;
    winDialog.showModal();
  }

  function submitGuess(raw: string): void {
    if (finished) return;
    const guess = raw.trim();
    if (!guess) return;
    startTimer();
    const place = matchPlace(guess, aliasIndex, STRIP);
    if (!place) {
      setStatus("bad", "Not a country in this game.");
      form.classList.remove("shake");
      void form.offsetWidth;
      form.classList.add("shake");
      return;
    }
    if (guessed.has(place.id)) {
      setStatus("dup", `${place.name} is already on the map.`);
      return;
    }

    const country = countryById.get(place.id)!;
    const km = place.id === target.id ? 0 : borderKm(borders.get(place.id)!, borders.get(target.id)!);
    addGuess(country, km, place.id === target.id);
    saveSession();
    syncActions();
    renderStats();

    if (place.id === target.id) {
      finishWin();
      return;
    }
    setStatus("ok", `${country.name} · ${formatKm(km)}`);
  }

  function giveUp(): void {
    if (finished) return;
    finished = true;
    revealed = true;
    stopTimer();
    map.revealTarget(target.id);
    input.disabled = true;
    saveSession();
    syncActions();
    setStatus("giveup", `It was ${target.name}.`);
  }

  function resetGame(): void {
    guessed.clear();
    startedAt = null;
    stoppedAt = null;
    finished = false;
    revealed = false;
    stopTimer();
    target = pickCountry(target.id);
    localStorage.removeItem(SESSION_KEY);
    timerEl.textContent = "0:00";
    guessListEl.replaceChildren();
    map.reset();
    input.disabled = false;
    input.value = "";
    syncActions();
    renderStats();
    setStatus("idle", "Type a country to begin.");
    input.focus();
  }

  function restoreSession(): void {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const session = JSON.parse(raw) as Session;
      const saved = countryById.get(session.targetId);
      if (!saved || !Array.isArray(session.guesses)) return;
      restoring = true;
      target = saved;
      startedAt = session.startedAt;
      stoppedAt = session.stoppedAt;
      finished = session.finished;
      revealed = session.revealed;
      for (const guess of session.guesses) {
        const country = countryById.get(guess.id);
        if (!country || guessed.has(country.id)) continue;
        addGuess(country, guess.km, country.id === target.id);
      }
      if (finished) {
        input.disabled = true;
        if (revealed && !guessed.has(target.id)) map.revealTarget(target.id);
        setStatus(
          guessed.has(target.id) ? "win" : "giveup",
          guessed.has(target.id)
            ? `${target.name}. ${guessed.size} guesses in ${formatTime(elapsedMs())}.`
            : `It was ${target.name}.`,
        );
        tick();
      } else if (guessed.size > 0) {
        const closest = closestKm();
        setStatus("ok", closest === null ? `${guessed.size} guesses.` : `Closest so far: ${formatKm(closest)}.`);
        if (startedAt !== null) resumeTimer();
      } else if (startedAt !== null) {
        resumeTimer();
      }
      syncActions();
      renderStats();
      restoring = false;
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  function shareResult(): void {
    const text = guessed.has(target.id)
      ? `The Counties · Globle\n${target.name} in ${guessed.size} guesses\nthecounties.vercel.app/globle`
      : `The Counties · Globle\nGave up after ${guessed.size} guesses\nthecounties.vercel.app/globle`;
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
  giveUpButton.addEventListener("click", giveUp);
  startOverButton.addEventListener("click", () => {
    if (!hasProgress()) return;
    if (!finished && !window.confirm("Start a new country? This clears your saved game.")) return;
    resetGame();
  });
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

  renderStats();
  void map
    .load()
    .then((geojson: FeatureCollection<Geometry, { id: string; name: string }>) => {
      borders = sampleBorders(geojson);
      restoreSession();
      input.focus();
    })
    .catch((error: unknown) => {
      setStatus("bad", error instanceof Error ? error.message : "Map failed to load.");
    });

  if (!localStorage.getItem(HELP_KEY)) {
    overlay.showModal();
    localStorage.setItem(HELP_KEY, "1");
  }
}
