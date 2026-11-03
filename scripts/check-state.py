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

    first = page.evaluate("document.querySelector('path.county').dataset.name")
    second = page.evaluate("document.querySelectorAll('path.county')[1].dataset.name")
    for name in (first, second):
        page.locator("#guess").fill(name)
        page.locator("#guess").press("Enter")
        page.wait_for_timeout(120)
    page.wait_for_function("document.querySelector('#found-count')?.textContent === '2'", timeout=2000)
    assert_ok("2 saved pre-reload", page.locator("path.county.found").count() == 2)

    page.reload()
    page.wait_for_function("document.querySelectorAll('path.county').length > 0", timeout=15000)
    close_help(page)
    page.wait_for_function("document.querySelector('#found-count')?.textContent === '2'", timeout=2000)
    assert_ok("session restored after reload", page.locator("path.county.found").count() == 2)
    page.wait_for_function("document.querySelector('#timer')?.textContent !== '0:00'", timeout=2000)
    assert_ok("timer resumed", True)

    page.locator("#give-up").click()
    page.wait_for_function(
        f"document.querySelectorAll('path.county.revealed').length === {total - 2}", timeout=2000)
    assert_ok("reveal remaining", True)
    assert_ok("input disabled after give-up", not page.locator("#guess").is_enabled())

    page.on("dialog", lambda d: d.accept())
    page.locator("#start-over").click()
    page.wait_for_function(
        "document.querySelector('#found-count')?.textContent === '0' && "
        "document.querySelectorAll('path.county.found').length === 0", timeout=2000)
    assert_ok("start over resets", True)
    assert_ok("input enabled after reset", page.locator("#guess").is_enabled())


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
