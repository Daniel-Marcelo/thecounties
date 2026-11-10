#!/usr/bin/env python3
"""Browser checks for the home hub's progress shelf.

The hub should remember the player: partly-played packs show a quiet
progress bar and a named count, finished packs say so in the site's voice,
bests carry over, and corrupt/legacy data is tolerated without errors.

Usage:
  python scripts/check-home.py [--base http://localhost:4304]
"""

from __future__ import annotations

import argparse
import sys

from playwright.sync_api import sync_playwright

PROBLEMS: list[str] = []

PACK_KEY = "thecounties.pack.ireland.session"
PACK_BEST_KEY = "thecounties.pack.ireland.bestTime"
GLOBLE_KEY = "thecounties.globle.session"
GLOBLE_BEST_KEY = "thecounties.globle.bestGuesses"

PARTWAY_SESSION = ('{"foundIds":["Dublin","Cork","Mayo","Galway"],'
                   '"guesses":5,"startedAt":1000,"stoppedAt":61000,'
                   '"finished":false}')

FLAGS_FULL = "thecounties.flags.brazil.run.full"
FLAGS_QUICK = "thecounties.flags.brazil.run.quick"
FLAGS_FULL_VAL = ('{"bestScore":{"mode":"full","total":27,"correct":25,"score":24830,"playedAt":1000},'
                  '"bestCorrect":{"mode":"full","total":27,"correct":27,"score":27110,"playedAt":2000}}')
FLAGS_QUICK_VAL = ('{"bestScore":{"mode":"quick","total":10,"correct":10,"score":8910,"playedAt":1000},'
                   '"bestCorrect":null}')


def assert_ok(name: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  OK    {name}")
    else:
        print(f"  FAIL  {name} {detail}")
        PROBLEMS.append(name)


def run_case(p, base: str, seeds: dict[str, str], viewport=None):
    """Seed localStorage, reload the hub, return (browser, page, errors)."""
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport=viewport or {"width": 1280, "height": 900})
    page = context.new_page()
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"{base}/")
    page.wait_for_load_state("networkidle")
    if seeds:
        page.evaluate(
            "s => { localStorage.clear(); "
            "for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }",
            seeds,
        )
    else:
        page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_load_state("networkidle")
    return browser, page, errors


def progress_label(card) -> str:
    label = card.locator(".home-progress-label")
    return label.first.text_content().strip() if label.count() else ""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://localhost:4304")
    args = parser.parse_args()
    base = args.base
    print(f"Home hub checks at {base}")

    with sync_playwright() as p:
        # 1. Fresh player: no keys -> no progress UI anywhere.
        browser, page, errors = run_case(p, base, {})
        fresh_progress = page.locator("a.home-quiz .home-progress").count()
        assert_ok("fresh player: no progress elements", fresh_progress == 0,
                  f"found {fresh_progress}")
        assert_ok("fresh player: no page errors", not errors, "; ".join(errors))
        browser.close()

        # 2. Partway: 4 of 32 ireland counties -> quiet bar at 12.5% + label.
        browser, page, errors = run_case(p, base, {PACK_KEY: PARTWAY_SESSION})
        ireland = page.locator("a.home-quiz[href='/ireland']")
        bar = ireland.locator(".home-progress i")
        assert_ok("partway: ireland has a progress bar", bar.count() == 1)
        if bar.count():
            width = bar.first.evaluate("el => el.style.width")
            assert_ok("partway: bar width 12.5%", width == "12.5%", width)
        label_text = progress_label(ireland)
        assert_ok("partway: label '4 of 32 named'",
                  label_text == "4 of 32 named", label_text)
        others = page.locator("a.home-quiz .home-progress").count()
        assert_ok("partway: only ireland touched", others == 1, f"got {others}")
        assert_ok("partway: no page errors", not errors, "; ".join(errors))
        browser.close()

        # 3. Finished pack: "The lot of them." + best time, no shouting.
        finished_ids = ",".join(f'"c{i}"' for i in range(32))
        finished = {PACK_KEY: '{"foundIds":[' + finished_ids + '],"guesses":32,'
                    '"startedAt":1000,"stoppedAt":244000,"finished":true}',
                    PACK_BEST_KEY: "243000"}
        browser, page, errors = run_case(p, base, finished)
        ireland = page.locator("a.home-quiz[href='/ireland']")
        meta_text = (ireland.locator(".home-quiz-meta").first
                     .text_content() or "").strip()
        assert_ok("finished: meta starts 'The lot of them.'",
                  meta_text.startswith("The lot of them."), meta_text)
        assert_ok("finished: meta carries the best", "4:03" in meta_text,
                  meta_text)
        label_text = progress_label(ireland)
        assert_ok("finished: label '32 of 32'",
                  label_text == "32 of 32", label_text)
        bar = ireland.locator(".home-progress i")
        width = (bar.first.evaluate("el => el.style.width")
                 if bar.count() else "")
        assert_ok("finished: full bar", width == "100%", width)
        assert_ok("finished: no page errors", not errors, "; ".join(errors))
        browser.close()

        # 4. Globle: best score reads through, label in the site's voice.
        globle = {GLOBLE_KEY: '{"targetId":"IDN","guesses":[{"id":"IDN","km":0}],'
                  '"startedAt":0,"stoppedAt":61000,"finished":true}',
                  GLOBLE_BEST_KEY: "7"}
        browser, page, errors = run_case(p, base, globle)
        gl = page.locator("a.home-quiz[href='/globle']")
        label_text = progress_label(gl)
        assert_ok("globle: label 'best 7 guesses'",
                  label_text == "best 7 guesses", label_text)
        assert_ok("globle: no page errors", not errors, "; ".join(errors))
        browser.close()

        # 5. Legacy junk: a corrupt session renders like fresh, no error.
        browser, page, errors = run_case(p, base, {PACK_KEY: '{"foundIds":true}'})
        junked = page.locator("a.home-quiz[href='/ireland'] .home-progress").count()
        assert_ok("legacy junk: ireland renders like fresh", junked == 0,
                  f"got {junked}")
        assert_ok("legacy junk: no page errors", not errors, "; ".join(errors))
        browser.close()

        # 6. Partway at phone width: no horizontal scroll.
        browser, page, errors = run_case(p, base, {PACK_KEY: PARTWAY_SESSION},
                                         viewport={"width": 390, "height": 844})
        overflow = page.evaluate(
            "({w: document.documentElement.scrollWidth, "
            "c: document.documentElement.clientWidth})")
        assert_ok("390px: no horizontal scroll",
                  overflow["w"] <= overflow["c"], str(overflow))
        assert_ok("390px: no page errors", not errors, "; ".join(errors))
        browser.close()

        # 7. Flags card: one stat row per mode, one bar for the best-correct
        #    record of the first mode that has one.
        browser, page, errors = run_case(
            p, base, {FLAGS_FULL: FLAGS_FULL_VAL, FLAGS_QUICK: FLAGS_QUICK_VAL})
        flags = page.locator("a.home-quiz[href='/brazil-flags']")
        rows = flags.locator(".home-stat-row")
        assert_ok("flags: two stat rows", rows.count() == 2,
                  f"found {rows.count()}")
        rows_text = " | ".join(
            (rows.nth(i).text_content() or "").strip()
            for i in range(rows.count()))
        assert_ok("flags: full stat row",
                  "24,830 pts · 25/27" in rows_text, rows_text)
        assert_ok("flags: quick stat row",
                  "8,910 pts · 10/10" in rows_text, rows_text)
        full_row_text = (rows.nth(0).text_content() or "").strip()
        assert_ok("flags: full row has separator space",
                  full_row_text == "Full run 24,830 pts · 25/27",
                  full_row_text)
        flag_progress = flags.locator(".home-progress").count()
        assert_ok("flags: one progress element", flag_progress == 1,
                  f"found {flag_progress}")
        progress_done = flags.locator(".home-progress.done").count()
        assert_ok("flags: full bar gets done class", progress_done == 1,
                  f"found {progress_done}")
        bar = flags.locator(".home-progress i")
        width = (bar.first.evaluate("el => el.style.width")
                 if bar.count() else "")
        assert_ok("flags: bar width 100%", width == "100%", width)
        label_text = progress_label(flags)
        assert_ok("flags: label 'Best full run: 27 of 27 flags'",
                  label_text == "Best full run: 27 of 27 flags", label_text)
        assert_ok("flags: no page errors", not errors, "; ".join(errors))
        browser.close()

        # 8. Corrupt flags record: other cards untouched, no bar, no error.
        browser, page, errors = run_case(
            p, base, {FLAGS_FULL: "not-json", PACK_KEY: PARTWAY_SESSION,
                      GLOBLE_KEY: '{"targetId":"IDN","guesses":[{"id":"IDN","km":0}],'
                      '"startedAt":0,"stoppedAt":61000,"finished":true}',
                      GLOBLE_BEST_KEY: "7"})
        flags = page.locator("a.home-quiz[href='/brazil-flags']")
        flag_progress = flags.locator(".home-progress").count()
        assert_ok("corrupt flags: no progress element", flag_progress == 0,
                  f"found {flag_progress}")
        ireland = page.locator("a.home-quiz[href='/ireland']")
        label_text = progress_label(ireland)
        assert_ok("corrupt flags: ireland still reads partway",
                  label_text == "4 of 32 named", label_text)
        globle = page.locator("a.home-quiz[href='/globle']")
        label_text = progress_label(globle)
        assert_ok("corrupt flags: globle still reads its best",
                  label_text == "best 7 guesses", label_text)
        assert_ok("corrupt flags: no page errors", not errors, "; ".join(errors))
        browser.close()

        # 9. Flags best at phone width: a full (27/27) bar is 100% wide, so it
        #    must take the done/block layout and never push the page wider
        #    than the viewport.
        FLAGS_QUICK_GONE_VAL = '{"bestScore":null,"bestCorrect":null}'
        browser, page, errors = run_case(
            p, base, {FLAGS_FULL: FLAGS_FULL_VAL, FLAGS_QUICK: FLAGS_QUICK_VAL},
            viewport={"width": 390, "height": 844})
        flags = page.locator("a.home-quiz[href='/brazil-flags']")
        assert_ok("390px flags: full bar gets done class",
                  flags.locator(".home-progress.done").count() == 1)
        overflow = page.evaluate(
            "({w: document.documentElement.scrollWidth, "
            "c: document.documentElement.clientWidth})")
        assert_ok("390px flags seed 27/27: no horizontal scroll",
                  overflow["w"] <= overflow["c"], str(overflow))
        assert_ok("390px flags seed 27/27: no page errors", not errors,
                  "; ".join(errors))
        browser.close()

        #    Second context: a near-full NOT-done bar (quick 9/10), the other
        #    end of the same squeeze risk.
        FLAGS_QUICK_PART_VAL = ('{"bestScore":{"mode":"quick","total":10,"correct":9,'
                                '"score":7910,"playedAt":1000},'
                                '"bestCorrect":{"mode":"quick","total":10,"correct":9,'
                                '"playedAt":2000}}')
        browser, page, errors = run_case(
            p, base, {FLAGS_FULL: FLAGS_QUICK_GONE_VAL,
                      FLAGS_QUICK: FLAGS_QUICK_PART_VAL},
            viewport={"width": 390, "height": 844})
        overflow = page.evaluate(
            "({w: document.documentElement.scrollWidth, "
            "c: document.documentElement.clientWidth})")
        # Task 8: near-full bars take the done-style block layout, so the
        # label sits on its own line and nothing overflows the viewport.
        assert_ok("390px flags seed quick 9/10: no overflow",
                  overflow["w"] <= overflow["c"], str(overflow))
        assert_ok("390px flags seed quick 9/10: no page errors", not errors,
                  "; ".join(errors))
        browser.close()

    print()
    if PROBLEMS:
        print(f"FAILURES: {', '.join(sorted(set(PROBLEMS)))}")
        return 1
    print("Home hub checks: all passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
