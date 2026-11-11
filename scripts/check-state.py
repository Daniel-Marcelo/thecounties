#!/usr/bin/env python3
"""Pass 2 browser checks for a "Name them all" pack quiz.

Covers the responsive and stateful sides pass 1 does not: mobile/tablet
renders (no horizontal overflow, usable inputs), session save/restore across
reload (map fill + timer resume), give-up/reveal-remaining, and start-over.

Usage:
  python scripts/check-state.py --slug asia --total 47 [--base http://localhost:4304]
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import sync_playwright

PROBLEMS: list[str] = []


def assert_ok(name: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  OK    {name}")
    else:
        print(f"  FAIL  {name} {detail}")
        PROBLEMS.append(name)


def close_help(page) -> None:
    if page.locator("#help-dialog[open]").count():
        page.locator("#help-dialog [data-close]").click()


def mobile_run(base: str, page, width: int, height: int, slug: str) -> None:
    page.set_viewport_size({"width": width, "height": height})
    page.goto(f"{base}/{slug}")
    page.wait_for_function("document.querySelectorAll('path.county').length > 0", timeout=15000)
    close_help(page)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_function("document.querySelectorAll('path.county').length > 0", timeout=15000)
    close_help(page)
    first = page.evaluate("document.querySelector('path.county').dataset.name")
    page.locator("#guess").fill(first)
    page.locator("#guess").press("Enter")
    page.wait_for_function("document.querySelector('#found-count')?.textContent === '1'", timeout=2000)
    assert_ok(f"mobile {width}px: answers work", True)
    assert_ok(f"mobile {width}px: status is a live region",
              page.locator("#status[role='status']").count() == 1)
    page.locator("#guess").focus()
    outline = page.locator("#guess").evaluate("e => getComputedStyle(e).outlineWidth")
    assert_ok(f"mobile {width}px: input focus ring visible", outline == "2px", outline)
    overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
    assert_ok(f"mobile {width}px: no horizontal scroll", not overflow)
    assert_ok(f"mobile {width}px: input usable", page.locator("#guess").is_visible()
              and page.locator("#guess").is_enabled())
    page.screenshot(path=str(Path(tempfile.gettempdir()) / f"qa-{slug}-{width}.png"))


def save_restore_run(base: str, page, slug: str, total: int) -> None:
    page.set_viewport_size({"width": 1100, "height": 900})
    page.goto(f"{base}/{slug}")
    page.wait_for_function("document.querySelectorAll('path.county').length > 0", timeout=15000)
    close_help(page)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_function("document.querySelectorAll('path.county').length > 0", timeout=15000)
    close_help(page)
    # The status line announces itself; the dialogs announce their titles.
    assert_ok("status is a live region", page.locator("#status[role='status']").count() == 1)
    assert_ok("help dialog is labelled",
              page.locator("#help-dialog[aria-labelledby='help-title']").count() == 1)
    assert_ok("win dialog is labelled",
              page.locator("#win-dialog[aria-labelledby='win-title']").count() == 1)

    first = page.evaluate("document.querySelector('path.county').dataset.name")
    second = page.evaluate("document.querySelectorAll('path.county')[1].dataset.name")
    for name in (first, second):
        page.locator("#guess").fill(name)
        page.locator("#guess").press("Enter")
        page.wait_for_timeout(120)
    page.wait_for_function("document.querySelector('#found-count')?.textContent === '2'", timeout=2000)
    assert_ok("2 saved pre-reload", page.locator("path.county.found").count() == 2)

    # Start over mid-round asks first; cancelling keeps progress
    page.locator("#start-over").click()
    page.wait_for_selector("#confirm-dialog[open]")
    page.locator("#confirm-dialog [data-close]").click()
    page.wait_for_timeout(150)
    assert_ok("start-over cancelled keeps progress",
              page.locator("path.county.found").count() == 2
              and page.locator("#confirm-dialog[open]").count() == 0)

    page.reload()
    page.wait_for_function("document.querySelectorAll('path.county').length > 0", timeout=15000)
    close_help(page)
    page.wait_for_function("document.querySelector('#found-count')?.textContent === '2'", timeout=2000)
    assert_ok("session restored after reload", page.locator("path.county.found").count() == 2)
    page.wait_for_function("document.querySelector('#timer')?.textContent !== '0:00'", timeout=2000)
    assert_ok("timer resumed", True)

    # Give-up must ask first; cancelling changes nothing
    page.locator("#give-up").click()
    page.wait_for_selector("#confirm-dialog[open]")
    page.locator("#confirm-dialog [data-close]").click()
    page.wait_for_timeout(150)
    assert_ok("reveal cancelled",
              page.locator("path.county.revealed").count() == 0
              and page.locator("#status[data-kind='ok']").count() == 1)

    page.locator("#give-up").click()
    page.wait_for_selector("#confirm-dialog[open]")
    page.locator("#confirm-accept").click()
    page.wait_for_function(
        f"document.querySelectorAll('path.county.revealed').length === {total - 2}", timeout=2000)
    assert_ok("reveal remaining", True)
    assert_ok("input disabled after give-up", not page.locator("#guess").is_enabled())

    # The reveal reads as one short line, legible, with the missed names in
    # the Named panel - not a comma wall in the status.
    expected_status = f"You had 2 of {total}. The rest are named on the map."
    assert_ok("give-up status is the short line",
              page.locator("#status").text_content() == expected_status,
              page.locator("#status").text_content() or "")
    assert_ok("give-up status passes AA",
              page.locator("#status").evaluate(
                  "e => getComputedStyle(e).color") == "rgb(143, 74, 14)",
              page.locator("#status").evaluate("e => getComputedStyle(e).color"))
    missed_rows = page.locator("#found-list li.missed")
    assert_ok("missed names in the Named panel",
              missed_rows.count() == total - 2
              and (missed_rows.first.locator("span").text_content() or "") != "")
    assert_ok("focus lands on Start over",
              page.evaluate("document.activeElement?.id") == "start-over",
              page.evaluate("document.activeElement?.id") or "body")

    # A finished round resets without asking
    page.locator("#start-over").click()
    page.wait_for_function(
        "document.querySelector('#found-count')?.textContent === '0' && "
        "document.querySelectorAll('path.county.found').length === 0", timeout=2000)
    assert_ok("start over resets", True)
    assert_ok("input enabled after reset", page.locator("#guess").is_enabled())

    # Giving up on a fresh round reads the same way
    page.locator("#give-up").click()
    page.wait_for_selector("#confirm-dialog[open]")
    page.locator("#confirm-accept").click()
    page.wait_for_timeout(200)
    assert_ok("fresh give-up status",
              page.locator("#status").text_content()
              == f"You had 0 of {total}. The rest are named on the map.",
              page.locator("#status").text_content() or "")
    assert_ok("all missed on a fresh give-up",
              page.locator("#found-list li.missed").count() == total)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--total", type=int, required=True)
    parser.add_argument("--base", default="http://localhost:4304")
    args = parser.parse_args()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        mobile_run(args.base, page, 390, 844, args.slug)
        mobile_run(args.base, page, 768, 1024, args.slug)
        save_restore_run(args.base, page, args.slug, args.total)
        if errors:
            print("PAGE ERRORS:")
            for e in errors:
                print(" ", e)
            PROBLEMS.append("page errors")
        browser.close()

    print()
    if PROBLEMS:
        print(f"FAILURES: {', '.join(PROBLEMS)}")
        return 1
    print("Pass 2: all checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
