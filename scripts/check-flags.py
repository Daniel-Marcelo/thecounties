#!/usr/bin/env python3
"""Browser checks for the Brazil state flags quiz.

The quiz should offer two modes, play a ten-question quick round with one
instant lock and a clock that drains to a timeout, keep its own score honest
end to end, remember bests on the hub, survive a mid-run reload, stay readable
at phone width, and play from the keyboard.

Assumes the quiz is reachable at <base>/brazil-flags (serve the build via
`npm run preview -- --port 4304 --strictPort` in a background job).

Usage:
  python scripts/check-flags.py [--base http://localhost:4304]
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

PROBLEMS: list[str] = []

QUICK_KEY = "thecounties.flags.brazil.run.quick"
FULL_KEY = "thecounties.flags.brazil.run.full"
QUICK_QUESTIONS = 10
POP_RE = re.compile(r"^\+(\d+)\b")


def assert_ok(name: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  OK    {name}")
    else:
        print(f"  FAIL  {name} {detail}")
        PROBLEMS.append(name)


def load_check_home():
    """Load check-home.py by path so its flags seeds stay single-sourced.

    The file name has a dash, so it cannot be imported by name; importlib on
    the path keeps FLAGS_FULL_VAL from drifting between the two suites.
    """
    path = Path(__file__).resolve().with_name("check-home.py")
    spec = importlib.util.spec_from_file_location("check_home_mod", path)
    if spec is None or spec.loader is None:
        raise SystemExit(f"could not load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def open_page(p, base: str, path: str = "/brazil-flags",
              seeds: dict[str, str] | None = None, viewport=None):
    """Open a page at `path`, seed localStorage, reload, return the triple."""
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport=viewport or {"width": 1280, "height": 900})
    page = context.new_page()
    page.set_default_timeout(15000)
    errors: list[str] = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"{base}{path}")
    page.wait_for_load_state("networkidle")
    page.evaluate(
        "s => { localStorage.clear(); "
        "for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }",
        seeds or {},
    )
    page.reload()
    page.wait_for_load_state("networkidle")
    return browser, page, errors


def start_quick(page) -> None:
    page.locator(".flag-mode-card[data-mode='quick']").click()


def counter_text(page) -> str:
    line = page.locator(".flag-counter")
    return (line.first.text_content() or "").strip() if line.count() else ""


def assert_counter(page, position: int, label: str) -> None:
    want = f"{position} of {QUICK_QUESTIONS}"
    try:
        page.wait_for_function(
            "([n, t]) => { const c = document.querySelector('.flag-counter');"
            " return !!c && c.textContent.trim() === `${n} of ${t}`; }",
            arg=[position, QUICK_QUESTIONS],
        )
        ok = True
    except PlaywrightTimeoutError:
        ok = False
    assert_ok(f"{label}: counter reads {want}", ok, counter_text(page))


def points_text(page) -> str:
    line = page.locator("#points-line")
    return (line.text_content() or "").strip() if line.count() else ""


def pop_value(text: str) -> int:
    """Points a reveal claims: '+847' scores, anything else scores zero."""
    match = POP_RE.match(text)
    return int(match.group(1)) if match else 0


def wait_flag_image(page, label: str) -> None:
    try:
        page.wait_for_function(
            "() => { const i = document.querySelector('.flag-image');"
            " return !!i && i.complete && i.naturalWidth > 0; }",
            timeout=10000,
        )
        ok = True
    except PlaywrightTimeoutError:
        ok = False
    assert_ok(f"{label}: flag image loaded", ok)


def measure_options(page) -> list[dict]:
    return page.evaluate(
        "() => Array.from(document.querySelectorAll('.flag-option')).map((el) => {"
        "  const cs = getComputedStyle(el);"
        "  return {"
        "    text: (el.textContent || '').trim(),"
        "    scrollHeight: el.scrollHeight,"
        "    clientHeight: el.clientHeight,"
        "    offsetHeight: el.offsetHeight,"
        "    lineHeight: parseFloat(cs.lineHeight) || 0,"
        "  };"
        "})"
    )


def clipped_options(rows: list[dict]) -> list[str]:
    """Options whose text is cut off: neither an exact fit nor a short button."""
    bad: list[str] = []
    for row in rows:
        fits = row["scrollHeight"] <= row["clientHeight"] + 2
        short = (row["lineHeight"] > 0
                 and row["offsetHeight"] <= 3 * row["lineHeight"] + 2)
        if not (fits or short):
            bad.append(f"{row['text']} "
                       f"({row['scrollHeight']} > {row['clientHeight']})")
    return bad


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://localhost:4304")
    args = parser.parse_args()
    base = args.base
    print(f"Brazil state flags checks at {base}")

    with sync_playwright() as p:
        # 1. Load and mode select: chrome, two modes, and the drain explainer.
        browser, page, errors = open_page(p, base)
        assert_ok("load: h1 present", page.locator("h1").count() >= 1)
        cards = page.locator(".flag-mode-card")
        assert_ok("load: two mode cards", cards.count() == 2,
                  f"found {cards.count()}")
        explainer = (page.locator(".flag-explainer").first.text_content()
                     or "").strip()
        assert_ok("load: drain explainer present",
                  "draining with the timer" in explainer, explainer)
        cards_text = " | ".join((cards.nth(i).text_content() or "").strip()
                                for i in range(cards.count()))
        assert_ok("load: Full run and Quick round offered",
                  "Full run" in cards_text and "Quick round" in cards_text,
                  cards_text)
        assert_ok("load: no page errors", not errors, "; ".join(errors))

        # 2. Quick round: one lock per question, a timeout, honest totals.
        start_quick(page)
        assert_counter(page, 1, "quick")
        options = page.locator(".flag-option")
        assert_ok("quick q1: exactly four options", options.count() == 4,
                  f"found {options.count()}")
        names = [(options.nth(i).text_content() or "").strip()
                 for i in range(options.count())]
        assert_ok("quick q1: every option has a name", all(names), repr(names))
        state_names = [(options.nth(i).locator(".flag-option-name").text_content()
                        or "").strip()
                       for i in range(options.count())]
        assert_ok("quick q1: every option names a state", all(state_names),
                  repr(state_names))
        assert_ok("quick q1: timer bar present",
                  page.locator("#timer-bar").count() == 1)
        wait_flag_image(page, "quick q1")

        # Rapid double-tap the same option: the first tap locks, the second is
        # inert (the buttons are disabled), so the reveal cannot move.
        first = options.first
        first.click()
        first_pop = points_text(page)
        page.evaluate("el => el.click()", first.element_handle())
        second_pop = points_text(page)
        assert_ok("lock: exactly one points line",
                  page.locator("#points-line").count() == 1)
        disabled = page.locator(".flag-option[disabled]").count()
        assert_ok("lock: all four options disabled", disabled == 4,
                  f"found {disabled}")
        assert_ok("lock: one pop value", bool(first_pop), first_pop)
        assert_ok("lock: second tap changes nothing", second_pop == first_pop,
                  f"{first_pop!r} -> {second_pop!r}")

        pop_texts = [first_pop]
        page.locator("#next").click()
        assert_counter(page, 2, "next")

        # Question 2: a normal answer, read its pop.
        wait_flag_image(page, "quick q2")
        page.locator(".flag-option").nth(1).click()
        page.wait_for_selector("#points-line", timeout=5000)
        pop_texts.append(points_text(page))
        page.locator("#next").click()

        # Question 3: answer nothing and let the clock drain to a timeout.
        assert_counter(page, 3, "timeout")
        wait_flag_image(page, "quick q3")
        try:
            page.wait_for_function(
                "() => { const p = document.querySelector('#points-line');"
                " return !!p && p.textContent.includes(\"Time's up\"); }",
                timeout=15000,
            )
            timed_out = True
        except PlaywrightTimeoutError:
            timed_out = False
        timeout_pop = points_text(page)
        assert_ok("timeout: 'Time's up' inside 10 s", timed_out, timeout_pop)
        assert_ok("timeout: next appears", page.locator("#next").count() == 1)
        assert_ok("timeout: options locked",
                  page.locator(".flag-option[disabled]").count() == 4)
        pop_texts.append(timeout_pop)
        page.locator("#next").click()

        # Questions 4–10: answer every one and read each pop.
        for position in range(4, QUICK_QUESTIONS + 1):
            assert_counter(page, position, "quick")
            wait_flag_image(page, f"quick q{position}")
            page.locator(".flag-option").nth(position % 4).click()
            page.wait_for_selector("#points-line", timeout=5000)
            pop_texts.append(points_text(page))
            page.locator("#next").click()

        page.wait_for_selector(".flag-results", timeout=15000)
        total_text = (page.locator(".flag-result-total").text_content()
                      or "").strip()
        total = int(re.sub(r"\D", "", total_text) or "0")
        expected = sum(pop_value(text) for text in pop_texts)
        assert_ok("results: one reveal read per question",
                  len(pop_texts) == QUICK_QUESTIONS, f"read {len(pop_texts)}")
        assert_ok(f"results: total {total} is the sum of the pops",
                  total == expected, f"expected {expected} from {pop_texts}")

        correct_line = (page.locator(".flag-result-correct").text_content()
                        or "").strip()
        parsed_correct = re.fullmatch(r"(\d+) of 10 named", correct_line)
        assert_ok("results: 'correct of 10' line present",
                  parsed_correct is not None, correct_line)
        expected_correct = sum(1 for text in pop_texts if POP_RE.match(text))
        correct = int(parsed_correct.group(1)) if parsed_correct else -1
        assert_ok("results: correct count matches the reveals",
                  correct == expected_correct,
                  f"{correct} vs {expected_correct}")

        raw = page.evaluate("k => localStorage.getItem(k)", QUICK_KEY)
        assert_ok("storage: quick key written", raw is not None)
        try:
            stored = json.loads(raw) if raw else None
        except json.JSONDecodeError:
            stored = None
        best = (stored or {}).get("bestScore")
        assert_ok("storage: quick record parses", isinstance(stored, dict))
        assert_ok("storage: bestScore.score equals the results total",
                  isinstance(best, dict) and best.get("score") == total,
                  f"{best} vs {total}")
        assert_ok("quick round: no page errors", not errors, "; ".join(errors))
        browser.close()

        # 3. Bests appear on the hub, seeded from check-home's own constant.
        check_home = load_check_home()
        seeded = json.loads(check_home.FLAGS_FULL_VAL)
        best = seeded["bestScore"]
        browser, page, errors = open_page(
            p, base, path="/", seeds={FULL_KEY: check_home.FLAGS_FULL_VAL})
        flags = page.locator("a.home-quiz[href='/brazil-flags']")
        rows = flags.locator(".home-stat-row")
        assert_ok("hub: flags card has a stat row", rows.count() >= 1,
                  f"found {rows.count()}")
        rows_text = " | ".join((rows.nth(i).text_content() or "").strip()
                               for i in range(rows.count()))
        expected_row = (f"Full run {best['score']:,} pts · "
                        f"{best['correct']}/{best['total']}")
        assert_ok("hub: full run best row", expected_row in rows_text,
                  rows_text)
        assert_ok("hub: no page errors", not errors, "; ".join(errors))
        browser.close()

        # 4. Refresh mid-run: back to mode select, storage untouched.
        browser, page, errors = open_page(p, base)
        before = page.evaluate(
            "() => Object.fromEntries(Object.entries(localStorage))")
        start_quick(page)
        assert_counter(page, 1, "reload")
        page.locator(".flag-option").first.click()
        page.wait_for_selector("#points-line", timeout=5000)
        page.reload()
        page.wait_for_load_state("networkidle")
        assert_ok("reload: back at mode select",
                  page.locator(".flag-modes-view").count() == 1)
        after = page.evaluate(
            "() => Object.fromEntries(Object.entries(localStorage))")
        assert_ok("reload: storage unchanged", before == after,
                  f"{before} -> {after}")
        assert_ok("reload: no page errors", not errors, "; ".join(errors))
        browser.close()

        # 5. Phone width: no clipped option text, no horizontal scrollbar, at
        #    every point of a quick round (before and after each lock).
        browser, page, errors = open_page(
            p, base, viewport={"width": 360, "height": 740})
        start_quick(page)
        clipped: list[str] = []
        wide: list[str] = []
        for position in range(1, QUICK_QUESTIONS + 1):
            assert_counter(page, position, "360px")
            wait_flag_image(page, f"360px q{position}")
            opened = measure_options(page)
            if len(opened) != 4:
                clipped.append(
                    f"q{position} open: measured {len(opened)} options")
            clipped.extend(f"q{position} open: {bad}"
                           for bad in clipped_options(opened))
            page.locator(".flag-option").nth(position % 4).click()
            page.wait_for_selector("#points-line", timeout=5000)
            rows = measure_options(page)
            if len(rows) != 4:
                clipped.append(
                    f"q{position} locked: measured {len(rows)} options")
            clipped.extend(f"q{position} locked: {bad}"
                           for bad in clipped_options(rows))
            size = page.evaluate(
                "({w: document.documentElement.scrollWidth,"
                " c: document.documentElement.clientWidth})")
            if size["w"] > 361:
                wide.append(f"q{position}: {size}")
            page.locator("#next").click()
        assert_ok("360px: option text never clipped", not clipped,
                  "; ".join(clipped))
        assert_ok("360px: no horizontal scrollbar", not wide, "; ".join(wide))
        assert_ok("360px: no page errors", not errors, "; ".join(errors))
        browser.close()

        # 6. Keyboard: Digit1 locks, Enter on the focused Next advances.
        browser, page, errors = open_page(p, base)
        start_quick(page)
        assert_counter(page, 1, "keyboard")
        focused = page.evaluate(
            "() => (document.activeElement && document.activeElement.className)"
            " || ''")
        assert_ok("keyboard: question view takes focus",
                  "flag-question" in focused, focused)
        page.keyboard.press("Digit1")
        page.wait_for_selector("#points-line", timeout=5000)
        assert_ok("keyboard: Digit1 locks",
                  page.locator(".flag-option[disabled]").count() == 4)
        assert_ok("keyboard: Digit1 reveal", bool(points_text(page)),
                  points_text(page))
        try:
            page.wait_for_function(
                "() => document.activeElement"
                " && document.activeElement.id === 'next'", timeout=5000)
            next_focused = True
        except PlaywrightTimeoutError:
            next_focused = False
        assert_ok("keyboard: Next takes focus", next_focused)
        page.keyboard.press("Enter")
        assert_counter(page, 2, "keyboard: Enter")
        assert_ok("keyboard: no page errors", not errors, "; ".join(errors))
        browser.close()

    print()
    if PROBLEMS:
        print(f"FAILURES: {', '.join(sorted(set(PROBLEMS)))}")
        return 1
    print("Brazil state flags checks: all passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
