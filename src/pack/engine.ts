import { formatTime } from "../counties";
import { buildAliasIndex, matchPlace } from "./match";
import { PackMap } from "./map";
import type { Pack, Place } from "./types";

type Session = {
  foundIds: string[];
  guesses: number;
  startedAt: number | null;
  stoppedAt: number | null;
  finished: boolean;
};

type StatusKind = "idle" | "ok" | "dup" | "bad" | "win" | "giveup";

export function startPack(pack: Pack): void {
  const total = pack.places.length;
  const placeById = new Map(pack.places.map((place) => [place.id, place]));
  const aliasIndex = buildAliasIndex(pack.places, pack.stripPrefixes);
  const sessionKey = `thecounties.pack.${pack.id}.session`;
  const bestTimeKey = `thecounties.pack.${pack.id}.bestTime`;
  const bestGuessesKey = `thecounties.pack.${pack.id}.bestGuesses`;

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
  const foundTotalEl = document.querySelector<HTMLElement>("#found-total")!;
  const guessLabel = document.querySelector<HTMLLabelElement>("#guess-label")!;
  const eyebrow = document.querySelector<HTMLElement>("#eyebrow")!;
  const heading = document.querySelector<HTMLElement>("#heading")!;
  const credit = document.querySelector<HTMLElement>("#credit")!;
  const helpIntro = document.querySelector<HTMLElement>("#help-intro")!;
  const helpList = document.querySelector<HTMLUListElement>("#help-list")!;
  const winTitle = document.querySelector<HTMLElement>("#win-title")!;
  const legend = document.querySelector<HTMLElement>("#legend")!;
  const confirmDialog = document.querySelector<HTMLDialogElement>("#confirm-dialog")!;
  const confirmTitle = document.querySelector<HTMLElement>("#confirm-title")!;
  const confirmBody = document.querySelector<HTMLElement>("#confirm-body")!;
  const confirmAccept = document.querySelector<HTMLButtonElement>("#confirm-accept")!;

  const appEl = document.querySelector<HTMLElement>(".app");
  const namedToggle = document.querySelector<HTMLButtonElement>("#named-toggle");
  const railEl = document.querySelector<HTMLElement>(".rail");
  const railClose = document.querySelector<HTMLButtonElement>("#rail-close");

  applyChrome();

  const map = new PackMap(mapSvg, pack);
  const found = new Set<string>();
  const foundOrder: Place[] = [];

  let guesses = 0;
  let startedAt: number | null = null;
  let stoppedAt: number | null = null;
  let timerId: number | null = null;
  let finished = false;
  let restoring = false;

  function applyChrome(): void {
    document.title = `${pack.title} — Name all ${total} ${pack.unitPlural}`;
    eyebrow.textContent = pack.eyebrow;
    heading.textContent = pack.title;
    foundTotalEl.textContent = `/ ${total} found`;
    input.placeholder = pack.placeholder;
    guessLabel.textContent = `${pack.unitSingular} name`;
    credit.textContent = pack.credit;
    helpIntro.textContent = pack.helpIntro;
    helpList.replaceChildren(
      ...pack.helpItems.map((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        return li;
      }),
    );
    winTitle.textContent = pack.winTitle;
    setStatus("idle", `Type a ${pack.unitSingular} to begin.`);

    legend.replaceChildren();
    for (const [name, color] of Object.entries(pack.groupColors)) {
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = color;
      const label = document.createElement("span");
      label.textContent = name;
      legend.append(swatch, label);
    }
  }

  function setStatus(kind: StatusKind, message: string): void {
    statusEl.dataset.kind = kind;
    statusEl.textContent = message;
  }

  /** One styled native dialog asks before anything irreversible. */
  function askConfirm(title: string, body: string, acceptLabel: string): Promise<boolean> {
    return new Promise((resolve) => {
      confirmTitle.textContent = title;
      confirmBody.textContent = body;
      confirmAccept.textContent = acceptLabel;
      let settled = false;
      const finish = (accepted: boolean) => {
        if (settled) return;
        settled = true;
        resolve(accepted);
      };
      confirmAccept.addEventListener(
        "click",
        () => {
          finish(true);
          confirmDialog.close();
        },
        { once: true },
      );
      confirmDialog.addEventListener("close", () => finish(false), { once: true });
      confirmDialog.showModal();
    });
  }

  function setListOpen(open: boolean): void {
    if (!appEl || !namedToggle) return;
    appEl.classList.toggle("list-open", open);
    namedToggle.setAttribute("aria-expanded", String(open));
  }

  namedToggle?.addEventListener("click", () => {
    setListOpen(!appEl?.classList.contains("list-open"));
  });
  railClose?.addEventListener("click", () => setListOpen(false));
  document.addEventListener("click", (event) => {
    if (!appEl?.classList.contains("list-open")) return;
    const target = event.target as Node | null;
    if (railEl?.contains(target) || namedToggle?.contains(target)) return;
    setListOpen(false);
  });

  function hasProgress(): boolean {
    return found.size > 0 || guesses > 0 || finished;
  }

  function syncActions(): void {
    giveUpButton.hidden = finished;
    startOverButton.hidden = !hasProgress();
    // An ended round stops looking playable: status and Start over own the dock.
    form.hidden = finished;
  }

  function readBestTime(): number | null {
    const raw = localStorage.getItem(bestTimeKey);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
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
      localStorage.removeItem(sessionKey);
      return;
    }

    const session: Session = {
      foundIds: foundOrder.map((place) => place.id),
      guesses,
      startedAt,
      stoppedAt,
      finished,
    };
    localStorage.setItem(sessionKey, JSON.stringify(session));
  }

  function readSession(): Session | null {
    const raw = localStorage.getItem(sessionKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Session;
      if (!Array.isArray(parsed.foundIds) || typeof parsed.guesses !== "number") return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function addFound(place: Place): void {
    found.add(place.id);
    foundOrder.push(place);
    map.markFound(place);

    const item = document.createElement("li");
    item.dataset.province = place.group;
    item.innerHTML = `<span>${place.name}</span><em>${place.group}</em>`;
    const nameEl = item.querySelector("span");
    if (nameEl) nameEl.style.color = pack.groupColors[place.group] ?? "";
    foundListEl.prepend(item);
  }

  /** A revealed miss joins the Named panel without counting as found. */
  function addMissed(place: Place): void {
    const item = document.createElement("li");
    item.dataset.province = place.group;
    item.classList.add("missed");
    item.innerHTML = `<span>${place.name}</span><em>${place.group}</em>`;
    const nameEl = item.querySelector("span");
    if (nameEl) nameEl.style.color = pack.groupTextColors?.[place.group] ?? pack.groupColors[place.group] ?? "";
    foundListEl.append(item);
  }

  /** The reveal says one short line; the map and the Named panel carry the names. */
  function announceGiveUp(): void {
    setStatus("giveup", `You had ${found.size} of ${total}. The rest are named on the map.`);
  }

  function saveBest(elapsed: number): void {
    const bestTime = readBestTime();
    if (bestTime === null || elapsed < bestTime) {
      localStorage.setItem(bestTimeKey, String(elapsed));
    }

    const bestGuessesRaw = localStorage.getItem(bestGuessesKey);
    const bestGuesses = bestGuessesRaw ? Number(bestGuessesRaw) : null;
    if (bestGuesses === null || guesses < bestGuesses) {
      localStorage.setItem(bestGuessesKey, String(guesses));
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
      const place = placeById.get(id);
      if (place && !found.has(place.id)) addFound(place);
    }

    if (finished) {
      input.disabled = true;
      if (found.size === total) {
        setStatus("win", `The lot of them. ${total} ${pack.unitPlural} in ${formatTime(elapsedMs())}.`);
      } else {
        map.revealRemaining(found);
        for (const place of pack.places) {
          if (!found.has(place.id)) addMissed(place);
        }
        announceGiveUp();
      }
      tick();
    } else if (startedAt !== null || found.size > 0 || guesses > 0) {
      if (found.size > 0) {
        setStatus("ok", `${found.size} of ${total} still on the map.`);
      }
      resumeTimer();
    }

    syncActions();
    renderStats();
    restoring = false;
  }

  function finishWin(): void {
    finished = true;
    stopTimer();
    const elapsed = elapsedMs();
    saveBest(elapsed);
    saveSession();
    renderStats();
    setStatus("win", `The lot of them. ${total} ${pack.unitPlural} in ${formatTime(elapsed)}.`);
    input.disabled = true;
    syncActions();
    winSummary.textContent = `You named every ${pack.unitSingular} in ${formatTime(elapsed)} across ${guesses} guesses.`;
    winDialog.showModal();
  }

  function submitGuess(raw: string): void {
    if (finished) return;
    const guess = raw.trim();
    if (!guess) return;

    startTimer();
    const place = matchPlace(guess, aliasIndex, pack.stripPrefixes);

    if (!place) {
      guesses += 1;
      saveSession();
      syncActions();
      renderStats();
      setStatus("bad", `Not one of the ${total}.`);
      form.classList.remove("shake");
      void form.offsetWidth;
      form.classList.add("shake");
      return;
    }

    if (found.has(place.id)) {
      setStatus("dup", `${place.name} is already on the map.`);
      return;
    }

    guesses += 1;
    addFound(place);
    saveSession();
    syncActions();
    renderStats();

    if (found.size === total) {
      finishWin();
      return;
    }

    setStatus("ok", `${place.name} · ${place.group}`);
  }

  function giveUp(): void {
    if (finished) return;
    finished = true;
    stopTimer();
    saveSession();
    map.revealRemaining(found);
    for (const place of pack.places) {
      if (!found.has(place.id)) addMissed(place);
    }
    input.disabled = true;
    syncActions();
    startOverButton.focus();
    announceGiveUp();
  }

  function resetGame(): void {
    found.clear();
    foundOrder.length = 0;
    guesses = 0;
    startedAt = null;
    stoppedAt = null;
    finished = false;
    stopTimer();
    localStorage.removeItem(sessionKey);
    timerEl.textContent = "0:00";
    foundListEl.replaceChildren();
    map.reset();
    input.disabled = false;
    input.value = "";
    syncActions();
    setStatus("idle", `Type a ${pack.unitSingular} to begin.`);
    renderStats();
    input.focus();
  }

  function shareResult(): void {
    const elapsed = elapsedMs();
    const text = `${pack.title}\n${found.size}/${total} in ${formatTime(elapsed)}\n${guesses} guesses\nthecounties`;

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

  giveUpButton.addEventListener("click", () => {
    if (finished) return;
    void askConfirm(
      "Show the rest?",
      "This ends the round. The places you missed get named on the map, and the timer stops.",
      "Show them",
    ).then((accepted) => {
      if (accepted) giveUp();
    });
  });
  startOverButton.addEventListener("click", () => {
    if (!hasProgress()) return;
    if (!finished) {
      void askConfirm("Start over?", "This clears your saved progress and empties the map.", "Start over").then(
        (accepted) => {
          if (accepted) resetGame();
        },
      );
      return;
    }
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
    .then(() => {
      restoreSession();
      input.focus();
    })
    .catch((error: unknown) => {
      setStatus("bad", error instanceof Error ? error.message : "Map failed to load.");
    });

  if (!localStorage.getItem(`thecounties.pack.${pack.id}.seenHelp`)) {
    overlay.showModal();
    localStorage.setItem(`thecounties.pack.${pack.id}.seenHelp`, "1");
  }
}
