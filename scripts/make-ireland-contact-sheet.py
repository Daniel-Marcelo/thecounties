#!/usr/bin/env python3
"""Contact sheet of the bundled cNN assets for the eyeball pass."""

from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
FLAGS = ROOT / "public" / "flags"
OUT = Path(__file__).resolve().parent / "contact-sheet"

LABELS = {
    "c01": "Carlow",
    "c02": "Cavan·Laois·Monaghan·Waterford",
    "c03": "Clare·Tipp·Roscommon·Longford·Wicklow",
    "c04": "Cork·Louth·Derry·Tyrone",
    "c05": "Donegal·Leitrim·Meath·Kerry",
    "c06": "Dublin",
    "c07": "Galway·Westmeath",
    "c08": "Kildare",
    "c09": "Kilkenny",
    "c10": "Limerick·Fermanagh",
    "c11": "Mayo",
    "c12": "Offaly",
    "c13": "Sligo",
    "c14": "Wexford",
    "c15": "Antrim",
    "c16": "Armagh",
    "c17": "Down",
}

cells = []
for stem, label in LABELS.items():
    svg = (FLAGS / f"{stem}.svg").read_text(encoding="utf-8")
    cells.append(
        f'<div class="cell"><img src="data:image/svg+xml;base64,'
        f'{__import__("base64").b64encode(svg.encode()).decode()}" />'
        f"<p><b>{stem}</b><br>{label}</p></div>"
    )

html = (
    "<!doctype html><html><head><style>"
    "body{font-family:sans-serif;background:#888;margin:0;padding:16px}"
    ".grid{display:grid;grid-template-columns:repeat(3,340px);gap:14px}"
    ".cell{background:#fff;padding:10px;border:1px solid #333}"
    "img{width:300px;height:150px;object-fit:contain;display:block;background:#ddd}"
    "p{margin:6px 0 0;font-size:12px}"
    "</style></head><body><div class='grid'>" + "".join(cells) + "</div></body></html>"
)

OUT.mkdir(parents=True, exist_ok=True)
page_path = OUT / "sheet.html"
page_path.write_text(html, encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1160, "height": 1600})
    page.goto(page_path.as_uri())
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / "sheet.png"), full_page=True)
    browser.close()
print(OUT / "sheet.png")
