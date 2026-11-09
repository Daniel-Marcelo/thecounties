# Design: Brazil State Flags Quiz

Date: 2026-11-09
Status: Approved with Daniel (see Approaches for what was decided in conversation)

## Intent and the why

thecounties currently has one quiz *kind* per topic: fill-the-map packs and Globle. This adds a third kind — a **multiple-choice, speed-scored flag quiz** — as a different way to play: less typing, more reflex. Each question shows an official flag of one of Brazil's 27 federal units (26 states + Distrito Federal) with four name options. Tapping an option locks the answer instantly. Correct answers earn points, and the points drain with a visible countdown, so the quiz rewards both knowledge and speed.

## Goals

- Question screen: large flag, a counting-down timer bar, four name options, instant lock-in on tap or keyboard.
- Two modes, chosen by the player on a mode select screen:
  - **Full run** — all 27 flags, shuffled.
  - **Quick round** — 10 random flags, sampled without repeats.
- Scoring: each correct answer is worth up to **1,000 points**, draining **linearly to 0** across a **10-second countdown**. Wrong answer or timeout = 0.
- Instant feedback after answering: chosen option highlighted red if wrong, correct option highlighted green, points earned shown (e.g. "+847"). On timeout, show the correct answer as if it had been revealed.
- A **Next** button moves to the next question — the player, not a timer, controls pacing between questions.
- Results screen: total points, correct count out of total, mode played, comparison to best, "Play again" and "Change mode".
- Home hub integration: a new card for the quiz showing best score and best correct count **per mode**.
- Share card (image) earned at results, like the other quizzes.
- Keyboard support: options selectable with 1–4 (or A–D), Next with Enter/Space.
- Looks like the rest of the site: existing `src/style.css` token palette, Fraunces/Nunito fonts, responsive from mobile up. Question screen layout is the **stacked** vertical one (flag hero, options below; 2 options per row on very narrow screens if needed for long names).

## Non-goals

- No difficulty settings, no "hard mode", no streak/multiplier mechanics.
- No accounts, backend, or leaderboards — localStorage only, like everything else on the site.
- No mid-run restore after refresh. Runs are short (max 27 timed questions); a refreshed run simply restarts. (My call — see Make-calls.)
- No help dialog or onboarding flow; the rules fit on the mode select screen.
- Only Brazil. This design does not create a generic per-country-pack flag system; nothing about it should get in the way of one later, but Brazil is the only data set now.

## Anti-goals

- **No runtime external dependencies or API calls.** The countdown demands instant flag rendering; flags must be bundled local SVGs.
- **No new npm dependencies.** Vanilla TS + DOM, same as the rest.
- **No changes to existing quiz kinds' behavior.** The pack, Globle, and counties pages are untouched except for hub/home wiring listed below.

## Constraints

- Existing stack: Vite 6, vanilla TypeScript (strict), one global CSS file (`src/style.css`), hand-rolled routing, deploy to Vercel.
- QA is Python smoke scripts in `scripts/` plus `tsc --noEmit && vite build`. No JS test framework — follow that pattern.
- Brazil state data (ids, names, aliases, regions) already exists in `src/pack/brazil.ts`; geojson joins on `sigla`. The flag quiz reuses this data as its single source of truth rather than duplicating state names.

## Approaches

Two ways to build it were considered:

- **A. Its own quiz kind, following the Globle pattern (chosen).** New page, new engine module in `src/flags/`, bundled flag SVGs, special-cased hub card. Tradeoff: ~27 SVG assets to source and verify up front; in exchange, no dependencies, offline-instant flag rendering suited to a timed quiz, and a game kind that can evolve on its own.
- **B. Squeeze the multiple-choice quiz into the existing pack engine.** Rejected: the pack engine is built around the map (SVG geometry, alias text matching, input rails). A four-option flag quiz inside it means map-assuming branches everywhere, and it muddies both kinds. It was explicitly a non-starter for anything but a throwaway.

Also rejected: hotlinking external flag images or a third-party flag API (network dependency inside a 10-second countdown), and emoji flags (Brazilian states have none).

## The places and what they'd contain

- **Route `/brazil-flags`** → `brazil-flags.html` (new entry), engine at `src/flags/` (`main.ts`, `engine.ts`, plus a data helper). Build wiring mirrors Globle: add to `rollupOptions.input`, add a `'/brazil-flags': '/brazil-flags.html'` route to the Vite plugin's rewrite table and a `writeBundle` copy into `dist/brazil-flags/index.html`, and rewrites in `vercel.json`.
- **Flag data.** A map from state id (`"AC"`, …, `"DF"`) → local SVG path (`/flags/ac.svg`, …). Names/regions come from `brazilPack.places`.
- **Flag assets.** 27 official flag SVGs from Wikimedia Commons, saved to `public/flags/`, visually verified in the browser, each ideally < ~100 KB. Where a flag contains a detailed coat of arms, keep the official version if the file is reasonable; simplify only if sourcing fails. License note ("Flag images sourced from Wikimedia Commons") goes in the page credit footer.
- **Storage keys.** Best results per mode as JSON `{ score, correct, total, playedAt }` under `thecounties.flags.brazil.best.full` and `thecounties.flags.brazil.best.quick`. Written only when improved (high score only). `src/home/state.ts` reads these keys; `src/home/main.ts` renders the card, following the Globle special-case pattern.
- **Hub card copy.** Title, mode-select blurb on the page: "Four answers. One clock. No going back." with per-mode cards ("Full run — all 27 flags", "Quick round — 10 random flags") and a line explaining the drain ("Each correct answer is worth up to 1,000 points, draining with the timer.").

## Game flow (decided)

1. Mode select screen → click a mode.
2. Questions come in a fixed shuffled order for the run; per question: flag renders, countdown starts **when the question appears** (start-after-click is inherently satisfied because options are on screen instantly).
3. Tap (or key) an option → lock instantly, no confirm, no undo; stop the clock; compute points = round(1000 × remainingFraction) if correct.
4. Feedback shown, **Next** button appears; question stays until the player clicks Next.
5. After the last question, results screen with total, correct count, mode, best comparison, Play again / Change mode, and share card / share link.

Distractor selection: three names from the run's remaining pool, preferring the same region group as the answer for difficulty (my call), falling back to any state; always four distinct names.

## What's left to the builder

- Exact DOM structure, class names, and CSS (follow `src/style.css` conventions; mobile-first).
- Countdown implementation detail (rAF or interval) and the drain-bar animation.
- Share card drawing (reuse the canvas approach of `src/share-card.ts` with a flag-quiz layout — no map needed).
- Precise wording of microcopy on results and feedback states.
- A `scripts/check-flags.py` smoke check mirroring `check-pack.py`'s spirit plus the existing `tsc --noEmit && vite build` gate; manual browser verification of all 27 flags.

## Make-calls (decided by the builder in conversation with Daniel)

- Mid-run persistence skipped (runs are short and self-contained).
- Quick round sampling is a plain shuffle-then-take-10, no region balancing.
- Regions prefer same-region distractors, not a difficulty option in the UI.
- 10-second countdown fixed for both modes; no per-mode tuning.
- Keyboard letters/numbers are an alias for the visible buttons; no focus restructuring beyond standard accessibility.
