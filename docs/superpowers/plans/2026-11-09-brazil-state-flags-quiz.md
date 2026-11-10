# Brazil State Flags Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new quiz kind — Brazil state flags as 4-option multiple choice with a 10-second per-question countdown, instant lock-in, and speed-proportional scoring — wired into route/build/hub like Globle.

**Architecture:** Vanilla TS pages: a new `brazil-flags.html` entry + `src/flags/` engine (pure logic) + DOM wiring, reusing `brazilPack.places` for state names/regions and the existing style tokens. Flag SVGs are bundled assets under `public/flags/` with opaque filenames. Bests are localStorage JSON records read by the hub like every other quiz.

**Tech Stack:** Vite 6, TypeScript (strict), plain DOM/CSS, Python/Playwright browser checks (repo QA pattern), no new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-11-09-brazil-state-flags-quiz-design.md` — read it; this plan implements it and defers to it for the why.

## Global Constraints

Every task implicitly includes these, copied from the spec:

- No new npm dependencies. No runtime external API calls. Vanilla TS + DOM.
- Two modes: **full** = all 27 (26 states + DF) shuffled; **quick** = shuffle all 27, take 10.
- Four options per question, exactly one correct; **instant lock on first tap/keypress** (no confirm, no undo).
- Scoring: correct answer worth `round(1000 × remainingFraction)`; drain linearly to 0 over **10,000 ms**; wrong/timeout = 0.
- Feedback after answering (chosen option red if wrong, correct one green, points shown); **Next button controls pacing between questions**; results screen with Play again / Change mode.
- Best records **independent per metric and per mode**: best-score and best-correct each written only when improved, keys under `thecounties.flags.brazil.run.<mode>`.
- Hub card: ONE card, two per-mode stat rows (layout A from the conversation).
- Style: reuse `src/style.css` tokens/patterns only; Fraunces/Nunito already loaded in page head; stacked question layout (flag hero, options below).
- Visibility check in QA scripts must not depend on hidden debug attributes; use seeded localStorage and visible DOM.
- The question markup must NOT reveal which option is correct — no data attribute on the flag image tying it to an answer id. Option buttons carry only their own identity.

## Review Focus

Failure modes the spec implies that no single task's test exercises — each is pinned to the task that owns it:

1. **Timeout with no answer** → clock expires, 0 points, correct option revealed green, Next appears (not a hang). Test: Task 7 Step 3 (waiting browser case).
2. **Refresh mid-run** → run restarts cleanly from mode select, no partially-written bests. Test: Task 7 Step 3 (reload case) + Task 3 (saveResult only ever writes complete results).
3. **Double-tap on an option** → first tap locks; the second cannot re-score or unlock. Test: Task 7 Step 3 (two rapid clicks assert one place, one result line) + Task 4 (buttons disabled on lock).
4. **Corrupt or foreign localStorage** on the flags keys → hub and page render, data treated as no records. Test: Task 6 (check-home.py garbage-seed case).
5. **Long option names on 360px** ("Mato Grosso do Sul", "Distrito Federal") → buttons wrap/ellipsize without overflow or crush. Test: Task 7 Step 3 (narrow-viewport case).

---

### Task 1: Flag assets from Wikimedia Commons

**Files:**
- Create: `scripts/fetch-flags.py`
- Create: `public/flags/f01.svg` … `f27.svg` (opaque names — the img src must not leak the answer's sigla)
- Create: `public/flags/ATTRIBUTION.md`

**Interfaces:**
- Produces: 27 SVGs whose asset names (`f01`…`f27`, fixed) are the stable join key used by `src/flags/data.ts` in Task 3. Names must be assigned in this fixed list order and never reshuffled: `["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]`.

- [ ] **Step 1: Write `scripts/fetch-flags.py`**

A python script that, for each of the 27 sigla → Wikimedia Commons file title from the mapping table below, calls the Commons API
`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&titles=File:<title>` (URL-encode the title), then:

- downloads the SVG to `public/flags/<fNN>.svg` per the fixed order above;
- extracts from `extmetadata` the `LicenseShortName`, `Artist` (strip HTML tags), and page URL; writes a markdown line per file to `public/flags/ATTRIBUTION.md` with header `# Flag attribution` and one row `fNN (AC) — <title> — <license> — <artist> — <url>`;
- refuses any payload larger than 400 KB (print the file title and exit non-zero) — keep official versions, but flag outliers for manual simplification;
- verifies each saved file starts with `<svg` or `<?xml`, parses as well-formed XML, and has an `<svg>` root (amended: the original "> 1 KB" floor was a truncation heuristic; several official Commons SVGs are legitimately < 1 KB — files below 1 KB warn but do not fail); exits non-zero listing any fetch failure.

Mapping table (sigla → Commons file title; all are the official flag files):

```python
TITLES = {
  "AC": "Flag of Acre.svg", "AL": "Flag of Alagoas.svg", "AP": "Flag of Amapá.svg",
  "AM": "Flag of Amazonas.svg", "BA": "Flag of Bahia.svg", "CE": "Flag of Ceará.svg",
  "DF": "Flag of the Federal District (Brazil).svg", "ES": "Flag of Espírito Santo.svg",
  "GO": "Flag of Goiás.svg", "MA": "Flag of Maranhão.svg", "MT": "Flag of Mato Grosso.svg",
  "MS": "Flag of Mato Grosso do Sul.svg", "MG": "Flag of Minas Gerais.svg",
  "PA": "Flag of Pará.svg", "PB": "Flag of Paraíba.svg", "PR": "Flag of Paraná.svg",
  "PE": "Flag of Pernambuco.svg", "PI": "Flag of Piauí.svg", "RJ": "Flag of Rio de Janeiro (state).svg",
  "RN": "Flag of Rio Grande do Norte.svg", "RS": "Flag of Rio Grande do Sul.svg",
  "RO": "Flag of Rondônia.svg", "RR": "Flag of Roraima (Brazil).svg",
  "SC": "Flag of Santa Catarina.svg", "SP": "Flag of São Paulo (state).svg",
  "SE": "Flag of Sergipe.svg", "TO": "Flag of Tocantins.svg",
}
```

The implementing engineer MUST verify each title resolves (API returns a real URL; a `missing` pageinfo means try the Commons search for `File:Flag of <State>.svg` variants and record the substitute in ATTRIBUTION.md). If a licensed file demands named-author credit, the Artist row in ATTRIBUTION.md satisfies it; keep the file, do not downgrade to a simplified substitute unless > 400 KB.

- [ ] **Step 2: Run the fetcher and verify the assets**

Run: `python scripts/fetch-flags.py`
Expected: 27 files in `public/flags/` + `ATTRIBUTION.md` listing 27 rows; exit 0.

Run: `python -c "import glob,os; files=glob.glob('public/flags/f*.svg'); assert len(files)==27, files; [open(x,'rb').read(4) for x in files]; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add scripts/fetch-flags.py public/flags
git commit -m "flags: add 27 Brazil state flag SVGs with attribution"
```

### Task 2: Page shell, routes, build wiring

**Files:**
- Create: `brazil-flags.html` (clone head/meta/font links from `pack.html`; body is `.app` skeleton with header `eyebrow` "Brazil · The State Flags", `h1` "The State Flags", and empty `<main class="stage" id="screen">`; footer/credit line "Flag images sourced from Wikimedia Commons · per-file credits in /flags/ATTRIBUTION.md")
- Create: `src/flags/main.ts` (minimal stub that clears `#screen` — Tasks 4/5 replace its body)
- Modify: `vite.config.ts` (add `brazil-flags` to `rollupOptions.input`; add `"/brazil-flags": "/brazil-flags.html"` + trailing-slash twin to the rewrite table; in `writeBundle` copy `brazil-flags.html` → `dist/brazil-flags/index.html` exactly like the globle copy)
- Modify: `vercel.json` (rewrites `{ "source": "/brazil-flags", "destination": "/brazil-flags" }` and `"/brazil-flags/"` twin)
- Modify: `index.html` (add a third home section after "Guess the place": `<section class="home-section" aria-labelledby="multiple-choice"> <h2 id="multiple-choice">Multiple choice</h2> <ul class="home-list"><li><a class="home-quiz" href="/brazil-flags"> <span class="home-quiz-title">Brazil — The State Flags</span> <span class="home-quiz-meta">27 flags</span> <span class="home-quiz-blurb">Four answers. One clock. No going back.</span> </a></li></ul></section>`)

**Interfaces:**
- Produces: page reachable at `/brazil-flags` in dev/preview/prod; `#screen` mount point later tasks fill.

- [ ] **Step 1: Write the files above**

- [ ] **Step 2: Verify build + route**

Run: `npm run build`
Expected: exit 0; `dist/brazil-flags/index.html` exists.

Run dev server background + `Invoke-WebRequest http://localhost:5173/brazil-flags` (or `vite preview --port 4304 --strictPort` then the same request)
Expected: HTTP 200 and body contains `The State Flags`.

- [ ] **Step 3: Verify the hub card renders untouched-hub-safe** (no flags bests yet → card shows no progress bits)

Run: `python scripts/check-home.py --base http://localhost:4304` (after starting preview)
Expected: all prior checks still pass — flags card presence alone must not trip "fresh player: no progress elements" because check-home only counts `a.home-quiz .home-progress` elements.

- [ ] **Step 4: Commit**

```bash
git add brazil-flags.html src/flags/main.ts vite.config.ts vercel.json index.html
git commit -m "flags: page shell, routes, and hub listing"
```

### Task 3: Data + pure engine (run building, distractors, scoring, bests)

**Files:**
- Create: `src/flags/data.ts`
- Create: `src/flags/engine.ts`

**Interfaces:**
- Consumes: `brazilPack.places` (`src/pack/brazil.ts`) — fields `id`, `name`, `group`.
- Produces (all exported from `src/flags/engine.ts`; `data.ts` exports below):

```ts
// src/flags/data.ts
export type StateFlag = { id: string; name: string; group: string };
export const FLAG_QUESTION_MS = 10000;
export const FLAG_MAX_POINTS = 1000;
export function stateFlags(): StateFlag[];            // 27, from brazilPack.places (same order as places)
export function flagPathFor(id: string): string | null; // "/flags/fNN.svg" per Task 1's fixed order, null if unknown

// src/flags/engine.ts
export type FlagMode = "full" | "quick";
export type FlagQuestion = { answerId: string; options: string[] }; // 4 distinct sigla ids, options[?] contains answerId
export type FlagRun = { mode: FlagMode; questions: FlagQuestion[] };
export function buildRun(mode: FlagMode): FlagRun;
    // full: shuffle all 27 one question per answer; quick: shuffle 27, take 10.
    // For every question: distractors prefer the answer's `group` (fill up to 3 from the same group; fall back to the
    // whole 27-minus-answer pool), then shuffle the 4 options into `options`.
export function scoreFor(remainingMs: number): number;  // integer in [0, 1000]; linear from elapsed=0 → 1000 to elapsed=10000 → 0; never NaN; clamps negatives to 0
export type FlagResult = { mode: FlagMode; total: number; correct: number; score: number; playedAt: number };
export type FlagBests = { bestScore: FlagResult | null; bestCorrect: FlagResult | null };
export function readBests(mode: FlagMode): FlagBests;    // localStorage `thecounties.flags.brazil.run.<mode>`; any JSON corruption / wrong shape → both nulls, never throws
export function saveResult(result: FlagResult): void;    // writes ONLY improved records: bestScore when result.score strictly greater; bestCorrect when correct strictly greater; never writes partial/aborted runs
```

- [ ] **Step 1: Write `data.ts` and `engine.ts` to the exact signatures above**

Implementation notes the signatures pin: single run key per mode holds BOTH records (`{ bestScore, bestCorrect }` JSON object); `saveResult` reads, merges, writes the same key atomically (single `setItem`); `scoreFor` uses `FLAG_QUESTION_MS`/`FLAG_MAX_POINTS`, not magic numbers.

- [ ] **Step 2: Verify types**

Run: `npm run build`
Expected: exit 0 (tsc strict passes).

- [ ] **Step 3: Commit**

```bash
git add src/flags/data.ts src/flags/engine.ts
git commit -m "flags: question bank, distractor pick, drain scoring, best records"
```

### Task 4: Question screen — countdown, lock-in, feedback, Next

**Files:**
- Modify: `src/flags/main.ts` (full question flow; replaces the Task 2 placeholder body)
- Modify: `src/style.css` (append a `/* Flags quiz */` section: mode cards, stacked question layout, timer bar, option buttons, correct/wrong states — mobile-first, tokens only)

**Interfaces:**
- Consumes: everything exported from `src/flags/engine.ts` + `flagPathFor`.
- Produces (DOM contract Task 5/7 rely on): within `#screen`:
  - question view: an `img` for the flag (no data attributes — see Global Constraints); timer bar element `#timer-bar` (CSS width % of remaining); four `<button class="flag-option" data-state-id="<sigla>">` with the state's display name (the id is the option's own, not a hint); feedback view: `.flag-option.correct` and, on a wrong pick, `.flag-option.wrong` on the chosen one; a points line `#points-line` (e.g. "+847" / "Time's up — 0 pts"); `<button id="next">Next</button>`.
- Keyboard: keys `1`–`4` map to the options; `Enter`/`Space` activate the focused Next.

- [ ] **Step 1: Implement the question flow**

Locked-in mechanics the markup contract leaves fixed: the countdown starts when the question view renders (use `performance.now()`); the clock stops on first tap/keypress; clicking an already-locked option does nothing; on lock, all four buttons get `disabled`; on expiry, the timeout view is identical to wrong-answer feedback (`+0` / "Time's up — 0 pts", correct option green); text feedback lives in `#points-line` and the correct name.

- [ ] **Step 2: Verify by hand in the browser**

Run dev server, play a quick run manually.
Expected: tapping an option locks instantly; points line shows a positive number when early answers are correct; timer bar visually drains; Next advances; after the 10th of a quick run, question flow hands the run data over (Task 5 completes what happens next — for now log the result object in console).

- [ ] **Step 3: Commit**

```bash
git add src/flags/main.ts src/style.css
git commit -m "flags: question screen with countdown, instant lock, feedback, next"
```

### Task 5: Mode select + results + share card

**Files:**
- Modify: `src/flags/main.ts` (mode select view and results view; wire Task 4's run handoff into `FlagResult` + results screen)
- Create: `src/flags/share.ts`
- Modify: `src/style.css` (results + share button styles)

**Interfaces:**
- Consumes: `buildRun`, `readBests`, `saveResult`, `scoreFor` from engine; `copyPng`, `downloadShareCard`, `shareableFile` from `../share-card`.
- Produces:

```ts
// src/flags/share.ts
export function renderFlagsShareCard(result: FlagResult): Promise<Blob>;
    // 1200x675 PNG, same paper/ink canvas style as src/share-card.ts:
    // eyebrow "BRAZIL · THE STATE FLAGS", mode line ("Full run · 27 flags" / "Quick round · 10 flags"),
    // big total score, "x of y named", footer "thecounties.vercel.app/brazil-flags"
```

Results view contract: total points, `correct of total` line, mode name, one comparison line per improved metric ("New best!" / previous best), an updated-vs-previous note only as microcopy, buttons **Play again** (same mode → fresh `buildRun`), **Change mode** (back to mode select), and share actions (Web Share if `navigator.canShare({files})`, else Copy PNG button with a toast fallback to download) reusing the three share-card helpers.

Mode select view contract (matches the approved mockup): eyebrow "Brazil · New · The State Flags", h1 "Four answers. One clock. No going back.", the drain explainer line "Each correct answer is worth up to 1,000 points, draining with the timer.", and two mode cards labeled "Full run — All 27 flags" / "Quick round — 10 random flags"; each also shows that mode's best (or nothing before records exist).

- [ ] **Step 1: Implement both views + share**

`saveResult` fires exactly once per finished run, at "Next" after the final question.

- [ ] **Step 2: Verify by hand**

Full run played to the end: results numbers add up (sum of per-question point pops = total), bests show, Play again reshuffles (first answer differs across two runs most likely), share downloads a PNG.

- [ ] **Step 3: Commit**

```bash
git add src/flags/main.ts src/flags/share.ts src/style.css
git commit -m "flags: mode select, results, share card"
```

### Task 6: Hub wiring — bests per mode on the home card

**Files:**
- Modify: `src/home/state.ts`
- Modify: `src/home/main.ts`
- Modify: `scripts/check-home.py`

**Interfaces:**
- Consumes: the storage shape written by `saveResult` (`thecounties.flags.brazil.run.full|quick`).
- Produces (used by `render()` in `src/home/main.ts`):

```ts
// src/home/state.ts (additions alongside the existing types)
export type FlagModeBest = { score: number | null; correct: number | null; total: number };
export type FlagsHubState = Record<"full" | "quick", FlagModeBest>;
export function readFlagsHubState(): FlagsHubState; // per mode: nulls where that record absent/corrupt (a mode never has a null FlagModeBest object itself)
```

- `renderFlagsCard(card)`: for a mode with any best, append a stat row `<span class="home-stat-row"><span>Full run</span><b>24,830 pts · 25/27</b></span>` (same shape for Quick round); when the best-correct record of the FIRST mode that has one exists, append ONE `span.home-progress` (aria-hidden) — bar width uses that best-correct count over its total (via the existing `barWidth`), with `.home-progress-label` "Best full run: x of 27 flags" (or the quick wording when only quick has records). The `.home-progress` element exists only when some best exists, keeping check-home's fresh-player count at 0.
- `render()`: `if (slug === "brazil-flags") { renderFlagsCard(card); continue; }` — before the globle branch.

- [ ] **Step 1: Implement the two functions + branch**

- [ ] **Step 2: Extend `scripts/check-home.py`**

Add a case (after the existing cases; same `run_case` helper) seeding:

```python
FLAGS_FULL = "thecounties.flags.brazil.run.full"
FLAGS_QUICK = "thecounties.flags.brazil.run.quick"
FLAGS_FULL_VAL = ('{"bestScore":{"mode":"full","total":27,"correct":25,"score":24830,"playedAt":1000},'
                  '"bestCorrect":{"mode":"full","total":27,"correct":27,"playedAt":2000}}')
FLAGS_QUICK_VAL = ('{"bestScore":{"mode":"quick","total":10,"correct":10,"score":8910,"playedAt":1000},'
                   '"bestCorrect":null}')
```

Assertions on the card `a.home-quiz[href='/brazil-flags']`:
- stat rows exist and their text contains `24,830 pts · 25/27` and `8,910 pts · 10/10`;
- `.home-progress` count for the flags card is exactly 1 (bar exists because full has a best-correct of 27);
- bar width is exactly `barWidth(27, 27)` = "100%" (percentage, capped at 100; compute further rounding expectations with the page's own `barWidth` semantics).

- corrupt case: seed `FLAGS_FULL` with `not-json` → reload → all prior assertions about OTHER cards still true, no page errors, flags card has NO `.home-progress` element.

- [ ] **Step 3: Verify start preview and run checks**

Run: `python scripts/check-home.py --base http://localhost:4304`
Expected: every check including the new ones passes.

- [ ] **Step 4: Commit**

```bash
git add src/home/state.ts src/home/main.ts scripts/check-home.py
git commit -m "flags: hub card with per-mode bests"
```

### Task 7: Browser check suite + full verification

**Files:**
- Create: `scripts/check-flags.py`

**Interfaces:**
- Consumes: `/brazil-flags` served by preview; storage keys from engine.

- [ ] **Step 1: Write `scripts/check-flags.py`** (playwright, same `assert_ok`/`PROBLEMS` pattern as check-home/check-pack, `--base` default `http://localhost:4304`, exit non-zero on any problem)

Cases:
1. **Load + mode select:** goto `/brazil-flags`; no page errors; h1 present; two mode cards; drain explainer line present. Flag asset integrity is covered per question in case 2 (`img.complete && naturalWidth > 0` checked on every question view).
2. **Quick round, locked behavior, timeout:** click "Quick round"; `#timer-bar` exists; exactly 4 `.flag-option` buttons each with non-empty text; counter contains "1 of 10". Rapid double-click the SAME option button twice within 100 ms → buttons become `disabled` and exactly one `#points-line` appears with one pop value (no second reveal); clicks on locked buttons must not change anything (assert the value in `#points-line` does not change after the second click). Submit via `#next` — counter now "2 of 10". For a timeout: on question 3, click nothing, wait until `#points-line` contains "Time's up" (10 s max wait), assert `#next` appeared. Play remaining questions clicking twice each time. Assert the results screen: total = the sum of the per-question pops read after each reveal (this catches double-scoring end-to-end); `correct of total` line present; then assert storage: `localStorage['thecounties.flags.brazil.run.quick']` parses and `bestScore.score` equals the results total.
3. **Bests appear on the hub:** seed the FULL key with `FLAGS_FULL_VAL` (Task 6's constant — re-derive by import-free literal duplication is forbidden; read it from `scripts/check-home.py` by `import`ing it: `from check_home import FLAGS_FULL_VAL`? check-home is `check-home.py` with a dash — use `importlib` on path or copy the constant with a comment `# keep in sync with check-home.py`; choose importlib), reload `/` (hub), assert flags card stat rows for full exist.
4. **Refresh mid-run:** start a run, click one answer, reload `/brazil-flags` → back at mode select; storage keys unchanged from before the run (compare whole localStorage before/after).
5. **Narrow viewport:** viewport 360x740; every `.flag-option`'s `el.scrollHeight <= el.clientHeight + 2` OR its `offsetHeight` ≤ 3 lines (i.e. no clipping) at all times in a quick run; no horizontal scrollbar (`document.documentElement.scrollWidth <= 361`).
6. **Keyboard:** with focus on the question view, pressing `Digit1` locks an option; pressing `Enter` on focus of Next advances.

- [ ] **Step 2: Run the full gate**

Run preview (`npm run preview -- --port 4304 --strictPort` background), then:

```bash
python scripts/check-flags.py --base http://localhost:4304
python scripts/check-home.py --base http://localhost:4304
npm run build
```

Expected: all checks pass, build exits 0, and no regressions on the existing suites.

- [ ] **Step 3: Fix anything the checks catch, re-run to green, then commit**

```bash
git add scripts/check-flags.py
git commit -m "flags: browser check suite for the quiz"
```

### Task 8: Final polish pass and deploy verification

**Files:**
- Modify: only as the sweep finds (wording of microcopy to match the site's voice, spacing/typography knobs in the flags CSS block, `title`/meta for `brazil-flags.html`)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1:** Play a full run and a quick run at each of 360/820/1280 widths; check the impeccable eye for the timer bar contrast, the feedback state's legibility, the results screen hierarchy. Fix what a professional designer would fix — within `src/style.css`'s flags section and the HTML.

- [ ] **Step 2:** Re-run Task 7 Step 2's gate to green.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "flags: polish pass"
```

- [ ] **Step 4:** Report to Daniel with screenshots; deploy decision (Vercel deploy skill) is theirs to trigger.
