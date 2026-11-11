#!/usr/bin/env python3
"""Pass 2 browser checks for a "Name them all" pack quiz.

Covers the responsive and stateful sides pass 1 does not: mobile/tablet
renders (no horizontal overflow, usable inputs), session save/restore across
reload (map fill + timer resume), give-up/reveal-remaining, and start-over.

Usage:
  python scripts/check-state.py --slug asia --total 47 --race-name India --row-name Vietnam \\
      [--base http://localhost:4304]

--race-name: a known-valid name, used by the map-load race check.
--row-name:  optional; a known-valid name whose group fill color fails AA on
             paper (Vietnam for asia, Cork for ireland). When given, the
             found-row contrast check runs.
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


# WCAG contrast ratio of every span under `sel` against its nearest painted
# ancestor background. Encodes the plan constraint: newly colored text on
# paper must be >= 4.5:1.
CONTRAST_JS = r"""
(sel) => {
  const ch = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lum = (r, g, b) => 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
  const nums = (s) => (s.match(/\d+(\.\d+)?/g) || []).map(Number);
  const bgOf = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const parts = nums(getComputedStyle(e).backgroundColor);
      const a = parts.length > 3 ? parts[3] : 1;
      if (a > 0) return [parts[0], parts[1], parts[2]];
    }
    return [255, 255, 255];
  };
  return Array.from(document.querySelectorAll(sel), (s) => {
    const f = nums(getComputedStyle(s).color);
    const b = bgOf(s);
    const la = lum(f[0], f[1], f[2]);
    const lb = lum(b[0], b[1], b[2]);
    return +(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)).toFixed(2));
  });
}
"""


def close_help(page) -> None:
    if page.locator("#help-dialog[open]").count():
        page.locator("#help-dialog [data-close]").click()


def mobile_run(base: str, page, width: int, height: int, slug: str, narrow: bool = False) -> None:
    page.set_viewport_size({"width": width, "height": height})
    page.goto(f"{base}/{slug}")
    page.wait_for_function("document.querySelectorAll('path.county').length > 0", timeout=15000)
    close_help(page)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_function("document.querySelectorAll('path.county').length > 0", timeout=15000)
    close_help(page)
    first = page.evaluate("document.querySelector('path.county').dataset.name")
    empty = page.locator("#named-empty")
    empty_speaks = (empty.count() == 1 and empty.evaluate("e => !e.hidden")
                    and "starts with your first" in (empty.text_content() or ""))
    assert_ok(f"mobile {width}px: empty rail speaks", empty_speaks,
              empty.text_content() if empty.count() else "#named-empty missing")
    label_px = page.locator(".stats small").first.evaluate("e => parseFloat(getComputedStyle(e).fontSize)")
    if narrow:
        # <=350px keeps the deliberate clip-guard override, below the 10px floor.
        assert_ok(f"mobile {width}px: stat labels keep the small override", label_px < 10, f"{label_px}px")
    else:
        assert_ok(f"mobile {width}px: stat labels reach 10px", label_px >= 10, f"{label_px}px")
    ph = page.locator("#guess").evaluate("e => getComputedStyle(e, '::placeholder').color")
    assert_ok(f"mobile {width}px: placeholder is muted ink", ph == "rgb(107, 97, 86)", ph)
    page.locator("#guess").fill(first)
    page.locator("#guess").press("Enter")
    page.wait_for_function("document.querySelector('#found-count')?.textContent === '1'", timeout=2000)
    assert_ok(f"mobile {width}px: answers work", True)
    assert_ok(f"mobile {width}px: empty rail yields",
              empty.count() == 1 and empty.evaluate("e => e.hidden"))
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
    # A reflexive Enter must not sit one keystroke from the destructive button.
    assert_ok("confirm dialog starts on the safe button",
              page.evaluate("document.activeElement?.id") == "confirm-cancel",
              page.evaluate("document.activeElement?.id") or "body")
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
    missed_ratios = page.evaluate(CONTRAST_JS, "#found-list li.missed span")
    assert_ok("missed rows pass AA", min(missed_ratios) >= 4.5, f"min {min(missed_ratios)}")
    assert_ok("focus lands on Start over",
              page.evaluate("document.activeElement?.id") == "start-over",
              page.evaluate("document.activeElement?.id") or "body")

    # The finished round must survive a reload unchanged (plan Review Focus 3)
    page.reload()
    page.wait_for_function("document.querySelectorAll('path.county').length > 0", timeout=15000)
    close_help(page)
    assert_ok("restored give-up keeps the short status",
              page.locator("#status").text_content() == expected_status,
              page.locator("#status").text_content() or "")
    assert_ok("restored give-up keeps missed rows",
              page.locator("#found-list li.missed").count() == total - 2)
    assert_ok("restored give-up hides the form",
              not page.locator("#guess-form").is_visible()
              and not page.locator("#guess").is_enabled())

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


def desktop_run(base: str, page, slug: str, total: int, row_name: str | None) -> None:
    """The composition is viewport-locked on phones; desktop owes the same:
    the guess bar visible on load at 1280x900, and no dead form after the
    round ends. `row_name` (optional) exercises the found-row text colors."""
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{base}/{slug}")
    page.wait_for_function("document.querySelectorAll('path.county').length > 0", timeout=15000)
    close_help(page)
    page.evaluate("localStorage.clear()")
    page.reload()
    page.wait_for_function("document.querySelectorAll('path.county').length > 0", timeout=15000)
    close_help(page)
    bottom = page.evaluate("document.querySelector('#guess-form').getBoundingClientRect().bottom")
    inner = page.evaluate("window.innerHeight")
    assert_ok("desktop 1280x900: guess bar visible on load", bottom <= inner, f"{bottom} > {inner}")

    # Short laptop-class viewports are where the dock used to fall off
    page.set_viewport_size({"width": 1280, "height": 760})
    page.wait_for_timeout(150)
    bottom = page.evaluate("document.querySelector('#guess-form').getBoundingClientRect().bottom")
    inner = page.evaluate("window.innerHeight")
    assert_ok("desktop 1280x760: guess bar visible on load", bottom <= inner, f"{bottom} > {inner}")

    first = page.evaluate("document.querySelector('path.county').dataset.name")

    if row_name:
        # Found rows carry the darker text variants, not the fill colors.
        page.locator("#guess").fill(row_name)
        page.locator("#guess").press("Enter")
        page.wait_for_function("document.querySelector('#found-count')?.textContent === '1'", timeout=2000)
        if first != row_name:
            page.locator("#guess").fill(first)
            page.locator("#guess").press("Enter")
            page.wait_for_function("document.querySelector('#found-count')?.textContent === '2'", timeout=2000)
        found_ratios = page.evaluate(CONTRAST_JS, "#found-list li span")
        assert_ok("found rows pass AA", min(found_ratios) >= 4.5, f"min {min(found_ratios)}")
    else:
        page.locator("#guess").fill(first)
        page.locator("#guess").press("Enter")
        page.wait_for_timeout(120)
    page.locator("#give-up").click()
    page.wait_for_selector("#confirm-dialog[open]")
    page.locator("#confirm-accept").click()
    page.wait_for_timeout(200)
    assert_ok("desktop: form retired after give-up", not page.locator("#guess-form").is_visible())
    assert_ok("desktop: start-over remains", page.locator("#start-over").is_visible())


def race_run(base: str, page, slug: str, race_name: str) -> None:
    """A guess typed before the geojson resolves still fills its place -
    counted once, drawn once. Needs one known-valid name for the pack."""
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{base}/{slug}")
    page.evaluate("localStorage.clear()")
    # Intercept only the reload's fetch, so exactly one route is ever held.
    pending: list = []
    page.route("**/*geojson*", lambda route: pending.append(route))
    page.reload()
    page.wait_for_timeout(250)
    if page.locator("#help-dialog[open]").count():
        page.locator("#help-dialog [data-close]").click()
    assert_ok("race: map held back", len(pending) == 1
              and page.locator("path.county").count() == 0)
    page.locator("#guess").fill(race_name)
    page.locator("#guess").press("Enter")
    page.wait_for_timeout(300)
    pending.pop().continue_()
    page.wait_for_function("document.querySelector('#found-count')?.textContent === '1'", timeout=5000)
    assert_ok("race: queued guess fills once", page.locator("path.county.found").count() == 1)
    page.unroute("**/*geojson*")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slug", required=True)
    parser.add_argument("--total", type=int, required=True)
    parser.add_argument("--base", default="http://localhost:4304")
    parser.add_argument("--race-name", required=True,
                        help="one known-valid name, used by the map-load race check")
    parser.add_argument("--row-name", default=None,
                        help="known-valid name whose group fill color fails AA on paper "
                             "(Vietnam for asia, Cork for ireland); enables the found-row "
                             "contrast check")
    args = parser.parse_args()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        mobile_run(args.base, page, 390, 844, args.slug)
        mobile_run(args.base, page, 768, 1024, args.slug)
        mobile_run(args.base, page, 350, 590, args.slug, narrow=True)
        save_restore_run(args.base, page, args.slug, args.total)
        desktop_run(args.base, page, args.slug, args.total, args.row_name)
        race_run(args.base, page, args.slug, args.race_name)
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
