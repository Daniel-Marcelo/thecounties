import { formatTime } from "../counties";
import { readFlagsHubState, readHubState, type HubEntry } from "./state";

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

const FLAG_MODES = [
  { key: "full", label: "Full run", wording: "full run" },
  { key: "quick", label: "Quick round", wording: "quick round" },
] as const;

function formatPoints(points: number): string {
  return points.toLocaleString("en-US");
}

function renderFlagsCard(card: Element) {
  const flags = readFlagsHubState();
  for (const mode of FLAG_MODES) {
    const best = flags[mode.key];
    if (best.score === null && best.correct === null) continue;
    const row = document.createElement("span");
    row.className = "home-stat-row";
    const name = document.createElement("span");
    name.textContent = mode.label;
    const value = document.createElement("b");
    const parts: string[] = [];
    if (best.score !== null) parts.push(`${formatPoints(best.score)} pts`);
    if (best.correct !== null) parts.push(`${best.correct}/${best.total}`);
    value.textContent = parts.join(" · ");
    row.append(name, value);
    card.appendChild(row);
  }

  // One bar, from the first mode that has a best-correct record to show.
  const barMode = FLAG_MODES.find((mode) => flags[mode.key].bestCorrect);
  if (!barMode) return;
  const bestCorrect = flags[barMode.key].bestCorrect;
  if (!bestCorrect) return;

  const progress = document.createElement("span");
  progress.className = "home-progress";
  progress.setAttribute("aria-hidden", "true");
  const bar = document.createElement("i");
  bar.style.width = barWidth(bestCorrect.correct, bestCorrect.total);
  const label = document.createElement("span");
  label.className = "home-progress-label";
  label.textContent =
    `Best ${barMode.wording}: ${bestCorrect.correct} of ` +
    `${bestCorrect.total} flags`;
  progress.append(bar, label);
  card.appendChild(progress);
}

function render() {
  const state = readHubState();
  for (const card of document.querySelectorAll<HTMLAnchorElement>("a.home-quiz")) {
    const slug = slugFromCard(card);
    if (!slug) continue;
    if (slug === "brazil-flags") {
      renderFlagsCard(card);
      continue;
    }
    const entry = state[slug];
    if (!entry) continue;
    if (slug === "globle") renderGlobleCard(card, entry);
    else renderPackCard(card, entry);
  }
}

render();
