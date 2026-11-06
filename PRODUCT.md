# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The developer and their circle — people who enjoy geography and maps and are
handed the link directly. They arrive, pick a quiz, and play within seconds.
Casual neighbours of this core audience (social-media passers-by) follow the
same path; they are welcome but not the focus.

## Product Purpose

The Counties is a growing hub of map quizzes. The core concept is "name them
all": the site shows a plain map of one region, and the player types every
country, county, or state from memory until the map is filled. Side games
(the Globle mode — the map gets hotter as you get closer) share the hub.

Success is: friends and geography fans play a region, enjoy it, share a
result, and come back when the next region ships. New regions join the site
over time.

## Positioning

The thing a neighbouring quiz site could not truthfully copy: **the map is the
interface** — you don't answer questions about geography, you name the map
itself, on a single clean drawn frame, with no login and no list to pick from.
Each pack is one region, described as a data file and a few strings, powered by
one shared engine.

## Operating Context

- Deploys to Vercel from main on push (thecounties.vercel.app).
- Built with Vite + TypeScript; static output, no server component.
- Quiz data is drawn from `public/world.geojson`; pack geometry and map frames
  are derived by `scripts/build-region.py` (never hand-guessed).
- `scripts/check-pack.py` / `scripts/check-state.py` run full browser
  checkouts of every pack before and after deploys — a green run is the bar
  for "checking passed".
- Adding a quiz is four wiring touches (pack registry, Vite slugs, Vercel
  rewrites, hub card) plus the data pack.

## Capabilities and Constraints

- No accounts, no backend, no analytics; progress (found states, timer, bests)
  lives in localStorage.
- Region sets are sovereign countries/states from Natural Earth; some regions
  need antimeridian handling (Oceania) via projection rotation.
- Packs may alias colloquial or formal names; aliases must never normalize to
  another pack's answer (mapping is exact after normalization).
- Small islands may carry display-only short map labels; answers remain full
  names.
- Explicitly undecided: monetization, accounts, new game categories beyond
  map-fill and the Globle mode.

## Brand Commitments

- Name: **The Counties** — ties the original Irish-counties pack to the hub.
- Voice: warm, wry, restrained. Copy speaks plainly and with a light touch
  ("The lot of them.", win titles count the set: "The twenty-three").
- No emblems, badges, or gaudy decoration; the site presents honestly as
  "open map data" (Natural Earth) and credits boundaries in every pack.

## Evidence on Hand

- Eight working packs (Ireland, Brazil, Europe, South America, North America,
  Asia, Oceania, Africa) plus the Globle mode, live in production.
- Checker scripts with Playwright full playthroughs; QA screenshots captured
  per session at mobile/desktop widths.
- No testimonials, press, usage metrics, or player numbers exist — future
  work must not fabricate them.

## Product Principles

1. **The map is the interface.** Discovery, feedback, and completion all live
   on the drawn map, never in a form list.
2. **No list, no login.** If you know it, you can name it; nothing gates the
   first keystroke except a small help card.
3. **Derive, don't hand-guess.** Frames, counts, and geometry come from the
   data pipeline and checking scripts, not from eyes or vibes.
4. **One engine, many worlds.** New content is data (a pack file), not new
   code; shared engine changes must serve every pack.
5. **Understated confidence.** The design speaks quietly; polish shows in
   details, not in volume.

## Accessibility & Inclusion

- Keyboard-first play: the guess input is the primary control; dialogs are
  native `<dialog>` with focus management.
- The map carries an image role and a text label; names of found places are
  always present in the DOM ("Named" panel) so state is read without colour.
- Responsive through small phone widths; quizzes remain playable at 390px
  with no horizontal scroll (checked by scripts every pack).
