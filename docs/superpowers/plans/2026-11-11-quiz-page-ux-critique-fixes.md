# Quiz Page UX Critique Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the five priority issues and the quick minors from the 2026-11-11
UX critique of the pack quiz page (`pack.html`), so the give-up moment is a
confirmed, legible decision, feedback is announced to screen readers, the
desktop dock is visible on load, and end-states stop looking playable.

**Architecture:** All changes are on the shared pack surface — `pack.html`
(markup), `src/pack/engine.ts` (behavior), `src/style.css` (tokens and layout),
plus extended assertions in `scripts/check-state.py` (pass-2 browser checks).
One new optional `Pack` field (`groupTextColors`) lets text use darker variants
of group colors without touching the map-fill identity colors. No new
dependencies.

**Tech Stack:** Vite + TypeScript, native `<dialog>`, vanilla CSS, Python +
Playwright browser checks against `npx vite preview --port 4304 --strictPort`.

**Spec:** The persisted critique snapshot in the main checkout:
`C:\Users\Daniel\Documents\dev\thecounties\.impeccable\critique\2026-11-11T00-30-14Z__pack-html.md`
(its Priority Issues and Minor Observations are quoted into the tasks below, so
this plan is self-contained).

## Global Constraints

- Brand voice: warm, wry, restrained. No badges or gaudy decoration. Copy is
  plainspoken ("The lot of them." register — short declaratives).
- Bar for done: `npm run build` green AND `python scripts/check-state.py --slug
  asia --total 47` AND `python scripts/check-pack.py --slug asia --total 47
  --groups West,Caucasus,Central,South,East,Southeast --alias turkiye --alias
  "east timor" --alias burma --alias ksa --alias bharat` all pass against
  `npx vite preview --port 4304 --strictPort`.
  (`check-pack.py`/`check-state.py` hardcode the word "country" in two
  assertions, so Ireland cannot be their target; Asia is the standing target.)
- Contrast: any newly colored text ≥ 4.5:1 against its actual background.
- No new dependencies; no accounts/backend; progress stays in localStorage.
- The map-fill identity colors (`PROVINCE_COLORS` in `src/counties.ts`) must
  not change; only text usages get darker variants.
- `check-pack.py` and `check-state.py` are shared by every pack: changes to
  them must keep working for country packs and counties packs alike.
- Scope is the pack quiz page only. The Globle page (`globle.html`,
  `src/globle/*`) shares CSS but is a separate surface — no behavior changes
  there in this plan; the status live-region gap on Globle is a deferred note.
- Fraunces stays (the critique's `overused-font` detector flag was judged a
  false positive — it is the pinned brand face).

## Review Focus

The five inputs the tasks' tests least exercise, each pinned to its task:

1. **Cancelling the confirm dialog** (Esc key, backdrop click, Cancel button)
   must leave the round exactly as it was — no reveal, no reset, no status
   change. Pinned in Task 1 (cancel-path assertions).
2. **Give-up with 0 found** — confirm on a fresh round, reveal fires, "You had
   0 of N." copy is correct, missed list = all N. Pinned in Task 2.
3. **Restored give-up session after reload** (localStorage `finished: true`,
   not all found) must render the same short status line, missed names in the
   Named panel, and hidden form. Pinned in Task 2.
4. **Guess typed before the geojson resolves** must still fill its county and
   count once — exactly once, with correct order. Pinned in Task 5 (route
   delay).
5. **Narrow screens ≤ 350px** keep the smaller stat-label override; the
   10px floor applies from 351px up. Pinned in Task 5.

---

### Task 1: Native confirm dialog for destructive actions

The critique (Priority Issue 1): "Reveal remaining" is a one-tap, irreversible
round-ender with no confirmation, while Start over (merely clearing progress)
gets `window.confirm`. Migrate both to one shared native `<dialog>` styled like
the existing sheets; retire `window.confirm`.

**Files:**
- Modify: `pack.html` (add `#confirm-dialog` after `#win-dialog`)
- Modify: `src/pack/engine.ts` (add `askConfirm`, rewire both buttons)
- Modify: `src/style.css` (`.win-actions` reuse is already generic; add
  `#confirm-dialog` spacing only if needed)
- Test: `scripts/check-state.py` (new assertions), `scripts/check-pack.py`
  (update start-over flow to confirm through the dialog)

**Interfaces:**
- Consumes: existing `giveUp()`, `resetGame()`, `hasProgress()`, `finished`
  flag in `src/pack/engine.ts`.
- Produces: `askConfirm(title: string, body: string, acceptLabel: string):
  Promise<boolean>` inside `startPack`'s scope (module-private; not exported).
  Dialog element ids used by checks: `#confirm-dialog`, `#confirm-title`,
  `#confirm-body`, `#confirm-accept`, cancel via `[data-close]`.

- [ ] **Step 1: Write the failing checks** — in `scripts/check-state.py`,
  inside `save_restore_run`, after the two finds and before reload give-up:
  change `page.locator("#give-up").click()` to expect the dialog and CANCEL
  first (click `#confirm-dialog [data-close]`), assert no reveal happened
  (`path.county.revealed` count still 0 and `#status` still `data-kind='ok'`),
  then click `#give-up` again and click `#confirm-accept`, asserting the reveal
  proceeds (`revealed == total - 2`). Also replace the `page.on("dialog",
  lambda d: d.accept())` line and plain start-over click with: click
  `#start-over`, wait for `#confirm-dialog[open]`, click `#confirm-accept`,
  then assert reset as before. Do the same dialog-confirm dance for the
  start-over click in `scripts/check-pack.py` (it currently relies on
  `page.on("dialog", d.accept())`).
- [ ] **Step 2: Run** `python scripts/check-state.py --slug asia --total 47`
  — Expected: FAIL (no `#confirm-dialog` exists; reveal fires instantly).
- [ ] **Step 3: Implement.** In `pack.html`, after `#win-dialog`:

  ```html
  <dialog id="confirm-dialog" class="sheet" aria-labelledby="confirm-title">
    <h2 id="confirm-title"></h2>
    <p id="confirm-body"></p>
    <div class="win-actions">
      <button type="button" id="confirm-accept"></button>
      <button type="button" data-close class="ghost">Keep playing</button>
    </div>
  </dialog>
  ```

  In `engine.ts`, add element lookups for the four ids and:

  ```ts
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
      confirmAccept.addEventListener("click", () => { finish(true); confirmDialog.close(); }, { once: true });
      confirmDialog.addEventListener("close", () => finish(false), { once: true });
      confirmDialog.showModal();
    });
  }
  ```

  Rewire: `giveUpButton` click → `if (finished) return; if (await askConfirm(
  "Show the rest?", "This ends the round. The places you missed get named on
  the map, and the timer stops.", "Show them")) giveUp();`
  `startOverButton` click → keep the existing rule that a finished round
  resets without asking; for an unfinished round with progress, replace
  `window.confirm(...)` with `await askConfirm("Start over?", "This clears
  your saved progress and empties the map.", "Start over")`.
  Copy is on-voice: short declaratives, no exclamation marks.

- [ ] **Step 4: Run** `python scripts/check-state.py --slug asia --total 47`
  and `python scripts/check-pack.py --slug asia --total 47 --groups
  West,Caucasus,Central,South,East,Southeast --alias turkiye --alias "east
  timor" --alias burma --alias ksa --alias bharat` — Expected: PASS (both).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "pack: confirm the reveal and start-over with a native dialog"`

### Task 2: Give-up reveal — contrast, status copy, missed names, focus

Critique Priority Issues 1–2: the give-up status runs at 3.36:1, dumps up to
29 comma-separated names as a status wall that outweighs the revealed map, and
drops keyboard focus when the input disables.

**Files:**
- Modify: `src/counties.ts` (add text-variant color constant next to
  `PROVINCE_COLORS`)
- Modify: `src/pack/types.ts` (optional `groupTextColors?: Record<string,
  string>` on `Pack`)
- Modify: `src/pack/ireland.ts` (pass `groupTextColors`)
- Modify: `src/pack/engine.ts` (status copy, missed-name rows, focus)
- Modify: `src/style.css` (`--munster-text` token, giveup status color,
  Munster list-row rule)
- Test: `scripts/check-state.py`

**Interfaces:**
- Consumes: Task 1's confirmed reveal flow; `map.revealRemaining(found)`;
  `foundListEl`; `pack.groupColors`.
- Produces: `addMissed(place: Place): void` (module-private) — appends a
  `.missed` row to `#found-list` WITHOUT adding to `found`/`foundOrder`/stats.
  `announceGiveUp(): void` (module-private) used by both `giveUp()` and the
  restored-finished branch of `restoreSession()`. Text color lookup:
  `pack.groupTextColors?.[place.group] ?? pack.groupColors[place.group] ?? ""`.

- [ ] **Step 1: Write the failing checks** — in `check-state.py`
  `save_restore_run`, after the confirmed give-up from Task 1, assert:
  (a) status text is exactly `You had 2 of 47. The rest are named on the map.`
  (no comma list — `"Still out" not in` status text); (b) computed
  `color` of `#status[data-kind='giveup']` is `rgb(143, 74, 14)`; (c) the
  Named panel contains 45 rows marked missed:
  `#found-list li.missed` count equals `total - 2` and each missed row's span
  is not empty; (d) after give-up, `document.activeElement.id == 'start-over'` and
  `#guess-form` is at least disabled (the visibility assert lands in
  Task 4); (e) give-up from a fresh round: after the Task 1 start-over
  reset, click `#give-up`, confirm, and assert status is exactly
  `You had 0 of 47. The rest are named on the map.` with 47 `.missed`
  rows.
- [ ] **Step 2: Run** — Expected: FAIL (status is the comma wall in
  `--munster` orange; no `.missed` rows; focus on body).
- [ ] **Step 3: Implement.**
  - `src/counties.ts`: `export const PROVINCE_TEXT_COLORS: Record<Province,
    string> = { ...PROVINCE_COLORS, Munster: "#8f4a0e" }` (contrast 5.2:1 on
    `--paper-deep`, 5.6:1 on `--paper`; the other three already pass ≥4.5:1).
  - `src/pack/types.ts`: add `groupTextColors?: Record<string, string>;` to
    `Pack` with a one-line doc comment: text usages of group colors (status
    line, Named rows) where the fill color fails AA on paper.
  - `ireland.ts`: `groupTextColors: PROVINCE_TEXT_COLORS`.
  - `engine.ts`:
    - `announceGiveUp()`: sets status kind `"giveup"` to
      `You had ${found.size} of ${total}. The rest are named on the map.` —
      no name list.
    - `addMissed(place)`: builds the same row markup as `addFound`
      (`data-province`, span + em), adds class `missed`, colors the span via
      the text-color lookup, and appends to `foundListEl` (after found rows —
      use `append`, found rows use `prepend`).
    - `giveUp()` and the restored-finished branch of `restoreSession()` both
      call `map.revealRemaining(found)`, then
      `pack.places.filter(p => !found.has(p.id)).forEach(addMissed)`, then
      `announceGiveUp()`, then `syncActions()`.
    - After disabling the input in `giveUp()`, call
      `startOverButton.focus()`.
  - `style.css`: in `:root` add `--munster-text: #8f4a0e;`; change
    `#status[data-kind="giveup"]` color to `var(--munster-text)`; change
    `#found-list li[data-province="Munster"] span` color to
    `var(--munster-text)`.
- [ ] **Step 4: Run** both suites — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "pack: give-up reveal — AA contrast, short status, missed names in the Named panel"`

### Task 3: Screen-reader feedback and dialog labeling

Critique Priority Issue 3 + persona Sam: `#status` has no live region, dialogs
announce as unnamed regions, the input's focus indicator is a border-color
shift only.

**Files:**
- Modify: `pack.html` (`role="status"` on `#status`; ids/`aria-labelledby` on
  `#help-dialog` and `#win-dialog`)
- Modify: `src/style.css` (visible `:focus-visible` outline on `#guess`)
- Test: `scripts/check-state.py`

**Interfaces:**
- Consumes: existing dialogs; Task 1's `#confirm-dialog` already carries
  `aria-labelledby="confirm-title"`.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Write the failing checks** — in `check-state.py`
  `save_restore_run` start: assert `#status` has `role="status"`;
  `#help-dialog` has `aria-labelledby` pointing at an existing element id and
  `#win-dialog` likewise. In `mobile_run` (or a fresh desktop pass), focus
  `#guess` via keyboard (`page.locator("#guess").focus()` then assert
  `outline-width` of the focused element is `2px`).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `pack.html`: `<p id="status" data-kind="idle" role="status"></p>`;
    `<dialog id="help-dialog" class="sheet" aria-labelledby="help-title">`
    with `<h2 id="help-title">How to play</h2>`;
    `<dialog id="win-dialog" class="sheet win" aria-labelledby="win-title">`.
  - `style.css`: after the existing `#guess:focus` rule add
    `#guess:focus-visible { outline: 2px solid #8a7455; outline-offset: 2px; }`
    (matches the global `:focus-visible` token; keep the border-color change
    for pointer focus).
- [ ] **Step 4: Run** both suites — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "pack: announce status to screen readers; label dialogs; visible input focus ring"`

### Task 4: Desktop fold and dead end-state controls

Critique Priority Issues 4–5: at 1280×900 the input sits below the fold on
load (`min-height: 62vh` stack ≈ 960px), and after a game ends the disabled
input + active-looking Guess button still look playable.

**Files:**
- Modify: `src/style.css` (three `62vh` occurrences in the ≥820px layer →
  `52vh`)
- Modify: `src/pack/engine.ts` (`syncActions` hides `#guess-form` when
  `finished`)
- Test: `scripts/check-state.py`

**Interfaces:**
- Consumes: `syncActions()` (already called from every state change);
  `finished` flag.
- Produces: `syncActions()` now also toggles `form.hidden = finished` —
  Task 2's restore path calls `syncActions()` already, so restored finished
  sessions hide the form for free.

- [ ] **Step 1: Write the failing checks** — in `check-state.py`: new
  `desktop_run(base, page, slug)`: viewport 1280×900, fresh session,
  assert `page.locator("#guess").bounding_box()["y"] + height <= 900`
  (use `evaluate` on `getBoundingClientRect().bottom <= window.innerHeight`).
  After a full give-up, assert `#guess-form` is hidden
  (`not page.locator("#guess-form").is_visible()`), `#start-over` visible,
  and the actions row still reachable.
- [ ] **Step 2: Run** — Expected: FAIL (input bottom ≈ 960px > 900; form
  visible after finished).
- [ ] **Step 3: Implement.**
  - `style.css` ≥820px layer: `.app:not(.globle-app) .map-wrap`,
    `.app:not(.globle-app) #map`, and `.app:not(.globle-app) .rail`:
    `min-height: 62vh` → `min-height: 52vh` (all three, they form one
    composition; 52vh puts the dock at ≈ 890px on a 900px viewport).
  - `engine.ts` `syncActions()`: add `form.hidden = finished;`
- [ ] **Step 4: Run** both suites — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "pack: keep the dock on a 900px-tall desktop viewport; retire dead end-state controls"`

### Task 5: Quick minors — placeholder, stat labels, empty rail, load race

Critique Minor Observations: browser-default placeholder at 4.4:1, mobile stat
micro-labels at 8.96px, the tall empty Named rail, and the map-load race (a
guess before the geojson resolves is counted but never fills).

**Files:**
- Modify: `src/style.css` (`::placeholder`, `.stats small`)
- Modify: `pack.html` (`#named-empty` paragraph in the rail)
- Modify: `src/pack/engine.ts` (empty-state toggle; guess queue until the map
  has loaded)
- Test: `scripts/check-state.py`

**Interfaces:**
- Consumes: `map.load()` promise in `engine.ts`; `foundListEl`.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Write the failing checks** — in `check-state.py`:
  (a) in `mobile_run(390)`: computed `font-size` of each `.stats small` is
  ≥ 10px (parse `getComputedStyle(...).fontSize` ≥ `"10px"`); computed
  `::placeholder` color of `#guess` is `rgb(107, 97, 86)` (i.e.
  `var(--muted)`), not the Chromium default `rgb(117, 117, 117)`;
  (b) fresh load: `#named-empty` visible with text "Nothing yet — the list
  starts with your first county."; after one correct guess it is hidden;
  (c) race: `page.route("**/asia.geojson", lambda route:
  (time.sleep(1.0), route.continue_()))` — check the actual URL first
  (`pack.geojsonUrl`; use a pattern that matches it), type one valid name
  during the delay, then after load assert the county has class `found` and
  `#found-count` is 1 (counted exactly once).
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `style.css`: `#guess::placeholder { color: var(--muted); opacity: 1; }`
    next to the `#guess` rules; `.stats small` base `font-size: 0.56rem` →
    `0.625rem` (10px floor from 351px up; the ≤350px override stays
    deliberately smaller — clipping rule for the narrowest phones).
  - `pack.html`: inside `#named`, after `#found-list`:
    `<p id="named-empty" class="rail-empty" hidden>Nothing yet — the list
    starts with your first county.</p>`
  - `style.css`: `.rail-empty { margin: 4px 2px; color: var(--muted);
    font-size: 0.88rem; font-weight: 700; }` and
    `.rail-empty[hidden] { display: none; }`
  - `engine.ts`: lookup `namedEmpty`; add
    `function syncRailEmpty(): void { namedEmpty.hidden =
    foundListEl.children.length > 0; }` called from `addFound`, `addMissed`,
    `resetGame`, and at the end of `restoreSession`.
  - Load race: add `let mapReady = false; const pendingGuesses: string[] =
    [];` In `submitGuess`, right after the empty-trim guard:
    `if (!mapReady) { pendingGuesses.push(raw.trim()); return; }` In the
    `map.load().then(...)` handler: `mapReady = true;` FIRST call
    `restoreSession()`, then `for (const guess of pendingGuesses.splice(0))
    submitGuess(guess);` then `input.focus()`.
- [ ] **Step 4: Run** both suites — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "pack: muted placeholder, 10px stat labels, honest empty rail, queue guesses until the map loads"`

### Task 6: Full verification and design-detector pass

- [ ] **Step 1:** `npm run build` — Expected: PASS (tsc + vite).
- [ ] **Step 2:** Both suites green against `npx vite preview --port 4304
  --strictPort` (check-state with asia; check-pack with asia and full
  groups/aliases as in Global Constraints) — Expected: PASS.
- [ ] **Step 3:** Run the mechanical detector over the changed UI targets:
  `& "C:\Users\Daniel\.config\opencode\skills\impeccable\scripts\impeccable.cmd"
  detect --json pack.html` from the main checkout path convention — run it
  against this worktree's `pack.html`. Expected: no NEW findings vs the
  2026-11-11 run (the known intentional ones — Fraunces, ≤350px micro-labels —
  are accepted; the placeholder, Munster-text, and 390px label findings must
  be gone).
- [ ] **Step 4:** Commit anything outstanding; report results.
