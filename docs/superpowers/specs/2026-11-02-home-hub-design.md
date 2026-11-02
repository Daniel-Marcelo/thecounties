# Home hub design

## Goal

Turn `/` into a sectioned quiz directory for The Counties. The Ireland quiz moves fully onto the existing pack route at `/ireland`. More quizzes will be added later, so the hub is organized by game type, not a flat equal grid.

## Routing

| Path | Role |
|------|------|
| `/` | New hub (replaces the Ireland-only root quiz) |
| `/ireland` | Ireland counties “name them all” (pack engine) |
| `/brazil` | Brazil states pack |
| `/europe` | Europe countries pack |
| `/globle` | Globle-style country guess |

No redirect from `/` to `/ireland`. Old root bookmarks land on the hub. Pack and Globle Vite/Vercel wiring stay as they are.

## Layout

Reuse the existing visual system: Fraunces + Nunito, paper/ink CSS variables, same `src/style.css` tokens.

**Hero (first viewport)**

- Brand: **The Counties** as the dominant signal
- One supporting line: map quizzes — name them all, or guess the place
- No quiz list, stats, or secondary marketing in the hero

**Directory (below hero)**

1. **Name them all** — Ireland, Brazil, Europe
2. **Guess the place** — Globle

Each quiz is a full-width interactive link row (title, count/subtitle, one-line blurb). Soft dividers and hover; not decorative cards. Stacked on mobile; same list pattern on desktop (no multi-column gallery).

**Footer**

Short credit line, consistent with quiz pages.

## Copy

| Quiz | Subtitle | Blurb |
|------|----------|-------|
| Ireland | 32 counties | Fill the map of the island |
| Brazil | 27 states | Name every state and the Distrito Federal |
| Europe | 46 countries | From Iceland to Cyprus, including the microstates |
| Globle | 197 countries | The map gets hotter as you get closer |

Hub `<title>` / meta description describe the site as a collection of map quizzes. Quiz pages keep their own titles and descriptions.

## Implementation

- Replace `index.html` with static hub markup (little or no JS).
- Add hub styles to `src/style.css` using existing tokens; no new font stack.
- Remove the standalone root quiz: `src/main.ts` and `src/map.ts` (`IrelandMap` is only used by the root page). Keep `src/counties.ts` (used by the Ireland pack).
- Vite `main` entry remains `index.html` (now the hub). Pack and globle entries unchanged.
- Hardcode the four quiz links for this pass. A shared quiz registry is out of scope; adding a quiz later is a small HTML (and copy) edit plus a new section only if the game type is new.

## Out of scope

- Shared quiz registry / data-driven hub
- New quiz packs or Globle variants
- Redirects from `/` to `/ireland`
- Redesigning quiz pages or changing the design system
- Progress / best-score summaries on the hub
