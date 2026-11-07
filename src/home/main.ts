import { formatTime } from "../counties";
import { readHubState, type HubEntry } from "./state";

/** Slug from a card's href: "/ireland" -> "ireland". */
function slugFromCard(card: HTMLAnchorElement): string | null {
  const href = card.getAttribute("href");
  if (!href) return null;
  return href.startsWith("/") ? href.slice(1) : href;
}

function barWidth(found: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.min(100, Math.round((found / total) * 1000) / 10)}%`;
}

function bestText(entry: {
  bestTime: number | null;
  bestGuesses: number | null;
}): string {
  if (entry.bestTime !== null) return `${formatTime(entry.bestTime)} best`;
  if (entry.bestGuesses !== null) return `best ${entry.bestGuesses} guesses`;
  return "";
}

function renderPackCard(card: Element, entry: HubEntry) {
  const meta = card.querySelector<HTMLElement>(".home-quiz-meta");
  const progress = document.createElement("span");
  progress.className = "home-progress";
  progress.setAttribute("aria-hidden", "true");

  const bar = document.createElement("i");
  const label = document.createElement("span");
  label.className = "home-progress-label";
  if (entry.finished) {
    if (meta) {
      const best = bestText(entry);
      meta.textContent = best ? `The lot of them. · ${best}` : "The lot of them.";
    }
    // The full-width bar takes its own line; the label sits quietly beneath.
    progress.classList.add("done");
    bar.style.width = "100%";
    progress.appendChild(bar);
    label.textContent = `${entry.found} of ${entry.total}`;
  } else {
    bar.style.width = barWidth(entry.found, entry.total);
    progress.appendChild(bar);
    label.textContent = `${entry.found} of ${entry.total} named`;
  }
  progress.appendChild(label);
  card.appendChild(progress);
}

function renderGlobleCard(card: Element, entry: HubEntry) {
  // Globle has no map-fill progress: it speaks in best guesses only.
  if (entry.bestGuesses === null) return;
  const progress = document.createElement("span");
  progress.className = "home-progress";
  progress.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "home-progress-label";
  label.textContent = `best ${entry.bestGuesses} guesses`;
  progress.appendChild(label);
  card.appendChild(progress);
}

function render() {
  const state = readHubState();
  for (const card of document.querySelectorAll<HTMLAnchorElement>("a.home-quiz")) {
    const slug = slugFromCard(card);
    if (!slug) continue;
    const entry = state[slug];
    if (!entry) continue;
    if (slug === "globle") renderGlobleCard(card, entry);
    else renderPackCard(card, entry);
  }
}

render();
