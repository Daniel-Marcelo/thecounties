#!/usr/bin/env python3
"""Capture eyeball screenshots of the Ireland flag quiz at three widths."""
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = "http://localhost:4387"
OUT = Path(__file__).resolve().parent.parent / ".superpowers" / "ireland-flags-screens"
OUT.mkdir(parents=True, exist_ok=True)

WIDTHS = [(360, 740), (820, 1180), (1280, 900)]


def shoot(name: str, page) -> None:
    page.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
    print(f"  shot {name}")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for i, (w, h) in enumerate([(1280, 900), (820, 1180), (360, 740)], start=1):
        context = browser.new_context(viewport={"width": w, "height": h})
        page = context.new_page()
        page.set_default_timeout(15000)
        page.goto(f"{BASE}/ireland-flags")
        page.wait_for_load_state("networkidle")

        # Audit: each mode card carries only its mode id.
        audit = page.evaluate(
            "() => Array.from(document.querySelectorAll('.flag-mode-card'))"
            "  .map(el => Array.from(el.attributes).map(a => a.name))"
        )
        print(f"  w{w}: mode card attrs = {audit}")

        shoot(f"mode-select-{w}.png", page)

        page.locator(".flag-mode-card[data-mode='quick']").click()
        page.wait_for_selector(".flag-image")
        page.wait_for_function(
            "() => { const i = document.querySelector('.flag-image');"
            " return !!i && i.complete && i.naturalWidth > 0; }"
        )
        audit2 = page.evaluate(
            "() => ({"
            "  img: Array.from(document.querySelector('.flag-image').attributes)"
            "    .map(a => a.name),"
            "  opts: Array.from(document.querySelectorAll('.flag-option'))"
            "    .map(el => Array.from(el.attributes).map(a => a.name)"
            "      .filter(n => n.startsWith('data-')))"
            "})"
        )
        print(f"  w{w}: question img attrs = {audit2['img']}")
        print(f"  w{w}: option data attrs = {audit2['opts']}")
        shoot(f"question-open-{w}.png", page)

        page.locator(".flag-option").first.click()
        page.wait_for_selector("#points-line")
        shoot(f"question-locked-{w}.png", page)

        # Play a whole quick round by tapping the revealed answer to get results.
        for _ in range(9):
            page.locator("#next").click()
            page.wait_for_selector(".flag-image")
            page.locator(".flag-option").first.click()
            page.wait_for_selector("#points-line")
        page.locator("#next").click()
        page.wait_for_selector(".flag-results")
        shoot(f"results-{w}.png", page)
        context.close()
    browser.close()
print(f"\nScreenshots in {OUT}")
