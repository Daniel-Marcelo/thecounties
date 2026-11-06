# Mobile-first restructure — plan

Decisions (agreed with user):
- Scope: mobile-first restructure, keep the incumbent look (paper/Fraunces/Nunito world).
- Pack quiz mobile layout: map first, no scroll while playing; fixed bottom guess dock; "Named" behind a toggle sheet.
- Desktop keeps the current two-column map + rail composition; CSS written mobile-base + min-width layers.

## Checklist
- [x] Rewrite `src/style.css` mobile-first (base = phones; `min-width` layers restore tablet/desktop)
- [x] `pack.html` / `ireland.html`: `viewport-fit=cover` + `interactive-widget=resizes-content`, Named toggle + sheet close button
- [x] `globle.html` / `index.html`: viewport meta update
- [x] `src/pack/engine.ts`: wire named-toggle / close / scrim-tap close + live count
- [x] Verify: playwright screenshots 390/768/1280 (index, pack, globle), typecheck + build, detector run, pack checker script

## Verification notes (2026-11-06)
- Playwright renders verified at 320/390/768/1280 on all three page types; pack quiz at 390 sits in one
  viewport: stats strip → map → status → guess dock, no scroll; Named sheet opens/closes with toggle,
  Close button, and outside-tap. Desktop composition matches the previous two-column look.
- Globle custom control gestures: synthesized touch pointer drag pans the world (`translate(60 42)`),
  +/− zoom works, page stays unscrolled. Chromium-generated input, not real Safari hardware.
- `npm run build` (tsc + vite) green.
- `scripts/check-pack.py` on Asia: all 11 checks pass. Running it with `--slug ireland` still fails two
  string checks that hardcode "countries"/"type a country" wording — pre-existing for any non-"countries"
  pack (Ireland is "counties"); the playthrough, aliases, and win-dialog checks pass for Ireland.
- Detector: low-contrast findings resolved by darkening `--muted` #7a6e60 → #6b6156. Remaining warnings
  are deliberate incumbents: Fraunces brand font, heat-colored border-left encoding Globle guess temps.

## Known gaps (reported, not blockers)
- No real-device pass: iOS Safari keyboard behavior with the locked layout is emulated only
  (Android gets `interactive-widget=resizes-content`; iOS will visually scroll to the input).
  Recommend one real iPhone/Android pass before relying on it.
