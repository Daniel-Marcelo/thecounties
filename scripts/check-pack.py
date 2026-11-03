#!/usr/bin/env python3
"""Pass 1 browser checks for a "Name them all" pack quiz.

Assumes the quiz is reachable at <base>/<slug> (serve via `npm run preview`,
e.g. `npx vite preview --port 4304 --strictPort` in a background job).

Checks chrome, map paths, groups legend, bad-guess rejection, a full
playthrough from the DOM (works for any region size), alias spellings, the win
dialog, and the hub card. Exits non-zero if anything fails.

Usage:
  python scripts/check-pack.py --slug asia --total 47 \
      --groups West,Caucasus,Central,South,East,Southeast \
      --alias turkiye --alias "east timor" --alias burma --alias ksa --alias bharat \
      [--base http://localhost:4304]
"""

from __future__ import annotations

import argparse
import sys

from playwright.sync_api import sync_playwright

PROBLEMS: list[str] = []


def assert_ok(name: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  OK    {name}")
    else:
        print(f"  FAIL  {name} {detail}")
        PROBLEMS.append(name)


def run(base: str, slug: str, total: int, groups: list[str], aliases: list[str]) -> None:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        page.goto(f"{base}/{slug}")
        page.wait_for_function("document.querySelectorAll('path.county').length > 0", timeout=15000)
        page.wait_for_function(
            f"document.querySelectorAll('path.county').length === {total}", timeout=10000)
        if page.locator("#help-dialog[open]").count():
            help_text = page.locator("#help-list").text_content() or ""
            page.locator("#help-dialog [data-close]").click()

        assert_ok("title", f"name all {total} countries" in page.title().lower(), page.title())
        assert_ok("stats", page.locator("#found-total").text_content().strip().lower() == f"/ {total} found")
        assert_ok(f"{total} country paths", page.locator("path.county").count() == total)
        legend_text = (page.locator("#legend").text_content() or "").lower()
        assert_ok("legend groups", page.locator("#legend .swatch").count() == len(groups)
                  and all(g.lower() in legend_text for g in groups))
        assert_ok("status idle", page.locator("#status").text_content().lower() == "type a country to begin.")

        # Wrong answer is rejected while the input is enabled
        page.locator("#guess").fill("Atlantis")
        page.locator("#guess").press("Enter")
        page.wait_for_timeout(150)
        assert_ok("bad guess rejected", page.locator("#status[data-kind='bad']").count() == 1)

        # Full playthrough, names read straight from the map so this
        # automatically covers every country in the pack
        ids = page.evaluate("Array.from(document.querySelectorAll('path.county')).map(e => e.dataset.id)")
        for i in ids:
            name = page.evaluate(f"document.querySelector(\"path.county[data-id='{i}']\").dataset.name")
            page.locator("#guess").fill(name)
            page.locator("#guess").press("Enter")
            page.wait_for_timeout(40)
        page.wait_for_function(
            f"document.querySelector('#found-count')?.textContent === '{total}'", timeout=30000)
        assert_ok(f"all {total} found", True)
        assert_ok("win dialog open", page.locator("#win-dialog[open]").count() == 1)
        assert_ok("map fully filled", page.locator("path.county.found").count() == total)
        page.locator("#win-dialog [data-close]").click()

        # Alias spellings each claim the right country on a fresh round
        page.on("dialog", lambda d: d.accept())
        page.locator("#start-over").click()
        page.wait_for_function(
            "document.querySelector('#found-count')?.textContent === '0'", timeout=2000)
        page.evaluate("localStorage.clear()")
        for alias in aliases:
            page.locator("#guess").fill(alias)
            page.locator("#guess").press("Enter")
            page.wait_for_timeout(80)
        assert_ok("aliases accepted", page.locator("#found-count").text_content() == str(len(aliases)))

        # Hub card
        page.goto(base)
        page.wait_for_load_state("networkidle")
        card = page.locator(f'a[href="/{slug}"]')
        assert_ok("hub card", card.count() == 1
                  and f"{total} " in card.text_content().lower())

        if errors:
            print("PAGE ERRORS:")
            for e in errors:
                print(" ", e)
            PROBLEMS.append("page errors")
        browser.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slug", required=True, help="pack id, e.g. asia")
    parser.add_argument("--total", type=int, required=True, help="number of countries in the pack")
    parser.add_argument("--groups", default="", help="comma-separated group names")
    parser.add_argument("--alias", action="append", default=[],
                        help="an alias spelling to test; repeatable")
    parser.add_argument("--base", default="http://localhost:4304", help="server base url")
    args = parser.parse_args()

    groups = [g.strip() for g in args.groups.split(",") if g.strip()]
    run(args.base, args.slug, args.total, groups, args.alias)
    print()
    if PROBLEMS:
        print(f"FAILURES: {', '.join(PROBLEMS)}")
        return 1
    print("Pass 1: all checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
