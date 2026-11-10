# Design: Home navigation for quiz pages

Date: 2026-11-10 · Status: approved in conversation with Daniel

## Intent

Every quiz page (the eight shared "Name them all" packs and Globle) needs a way
back to the home hub. Today the only exit is the browser's back button, which is
invisible on deep links and shared URLs.

## Approach (chosen)

A round home icon button in the quiz topbar, styled exactly like the existing
`?` help button, sitting next to it on the right. Chosen over:

- **Clickable quiz title / wordmark** — the topbar's prominent text is the quiz
  name, not a brand wordmark; hiding a link in it muddies the affordance.
- **Breadcrumb** — the hierarchy is one level deep (hub → quiz); a breadcrumb
  is clutter with no wayfinding value.
- **Back arrow** — wrong semantic: for visitors arriving from a shared URL,
  "back" exits the site; "home" always means the quiz directory.

The control is a real `<a href="/">` (middle-click / new-tab friendly), never a
JS button, and no confirm-on-leave is needed because progress lives in
localStorage.

## The shape

- Glyph: a house icon drawn as a small inline SVG (stroke-based, currentColor),
  matching the existing icon-button weight; `aria-label="Home — all quizzes"`.
- Placement: right end of the topbar, left of the `?` help button, both wrapped
  in a `.topbar-actions` flex box so the two-site topbar grid
  (`1fr auto` phone / `1fr auto 1fr` desktop) keeps working.
- Scope: `pack.html`, `ireland.html` (dev copy of pack), `globle.html`, plus
  `.icon-btn` / `.topbar-actions` styles in `src/style.css`.

## Non-goals

- No changes to the home hub itself, the win dialog, or pack engine code.
- No breadcrumb, footer link, or in-page menu.
