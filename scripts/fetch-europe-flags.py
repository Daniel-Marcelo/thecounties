#!/usr/bin/env python3
"""Fetch the 46 European country flag SVGs from Wikimedia Commons.

Asset names are fixed (e01..e46) in the order of IDS so that
src/flags/europe.ts can join on them without leaking the answer id.
Commons titles were verified via the API before the count was committed.
"""

from __future__ import annotations

import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

# Europe pack order (src/pack/europe.ts); e01..e46 are assigned in this order.
IDS = [
    "ALB", "AND", "AUT", "BLR", "BEL", "BIH", "BGR", "HRV", "CYP", "CZE",
    "DNK", "EST", "FIN", "FRA", "DEU", "GRC", "HUN", "ISL", "IRL", "ITA",
    "KOS", "LVA", "LIE", "LTU", "LUX", "MLT", "MDA", "MCO", "MNE", "NLD",
    "MKD", "NOR", "POL", "PRT", "ROU", "RUS", "SMR", "SRB", "SVK", "SVN",
    "ESP", "SWE", "CHE", "UKR", "GBR", "VAT",
]

# Commons file titles, without the "File:" prefix, in IDS order.
TITLES = {
    "ALB": "Flag of Albania.svg", "AND": "Flag of Andorra.svg",
    "AUT": "Flag of Austria.svg", "BLR": "Flag of Belarus.svg",
    "BEL": "Flag of Belgium.svg", "BIH": "Flag of Bosnia and Herzegovina.svg",
    "BGR": "Flag of Bulgaria.svg", "HRV": "Flag of Croatia.svg",
    "CYP": "Flag of Cyprus.svg", "CZE": "Flag of the Czech Republic.svg",
    "DNK": "Flag of Denmark.svg", "EST": "Flag of Estonia.svg",
    "FIN": "Flag of Finland.svg", "FRA": "Flag of France.svg",
    "DEU": "Flag of Germany.svg", "GRC": "Flag of Greece.svg",
    "HUN": "Flag of Hungary.svg", "ISL": "Flag of Iceland.svg",
    "IRL": "Flag of Ireland.svg", "ITA": "Flag of Italy.svg",
    "KOS": "Flag of Kosovo.svg", "LVA": "Flag of Latvia.svg",
    "LIE": "Flag of Liechtenstein.svg", "LTU": "Flag of Lithuania.svg",
    "LUX": "Flag of Luxembourg.svg", "MLT": "Flag of Malta.svg",
    "MDA": "Flag of Moldova.svg", "MCO": "Flag of Monaco.svg",
    "MNE": "Flag of Montenegro.svg", "NLD": "Flag of the Netherlands.svg",
    "MKD": "Flag of North Macedonia.svg", "NOR": "Flag of Norway.svg",
    "POL": "Flag of Poland.svg", "PRT": "Flag of Portugal.svg",
    "ROU": "Flag of Romania.svg", "RUS": "Flag of Russia.svg",
    "SMR": "Flag of San Marino.svg", "SRB": "Flag of Serbia.svg",
    "SVK": "Flag of Slovakia.svg", "SVN": "Flag of Slovenia.svg",
    "ESP": "Flag of Spain.svg", "SWE": "Flag of Sweden.svg",
    "CHE": "Flag of Switzerland.svg", "UKR": "Flag of Ukraine.svg",
    "GBR": "Flag of the United Kingdom.svg", "VAT": "Flag of the Vatican City.svg",
}

# Titles verified present on Commons under the brief's name, so nothing to
# substitute. If one ever goes missing, record the replacement here — it is
# noted in ATTRIBUTION.md next to its row.
SUBSTITUTES: dict[str, str] = {}

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = (
    "EuropeCountryFlagsQuiz/1.0 "
    "(educational quiz project; https://github.com/; python-urllib)"
)
MAX_BYTES = 400 * 1024
ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "flags"


def request_bytes(url: str) -> bytes:
    """GET a URL, retrying on rate limiting and transient server errors."""
    delay = 30
    for attempt in range(5):
        req = urllib.request.Request(
            url,
            headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                return response.read()
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 500, 502, 503, 504) and attempt < 4:
                print(f"  {exc.code} from {url}; retrying in {delay}s")
                time.sleep(delay)
                delay *= 2
                continue
            raise
    raise RuntimeError(f"gave up on {url}")


def fetch_info(title: str) -> dict:
    """Return the imageinfo dict for a Commons file title."""
    query = urllib.parse.urlencode(
        {
            "action": "query",
            "format": "json",
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "titles": "File:" + title,
        }
    )
    data = json.loads(request_bytes(f"{API}?{query}"))
    pages = data.get("query", {}).get("pages", {})
    if not pages:
        raise RuntimeError("API returned no pages")
    page = next(iter(pages.values()))
    if "missing" in page:
        raise RuntimeError(f"page is missing: File:{title}")
    imageinfo = page.get("imageinfo")
    if not imageinfo:
        raise RuntimeError(f"no imageinfo for File:{title}")
    info = imageinfo[0]
    if not info.get("url"):
        raise RuntimeError(f"no file URL for File:{title}")
    return info


def plain_text(value: str) -> str:
    """Strip HTML tags and collapse whitespace."""
    text = re.sub(r"<[^>]+>", " ", value)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    rows: list[str] = []
    failures: list[str] = []

    for index, flag_id in enumerate(IDS, start=1):
        asset = f"e{index:02d}"
        title = SUBSTITUTES.get(flag_id, TITLES[flag_id])
        substitute = SUBSTITUTES.get(flag_id)
        print(f"{asset} {flag_id}: File:{title}")
        try:
            info = fetch_info(title)
            payload = request_bytes(info["url"])
        except Exception as exc:  # noqa: BLE001 - report every fetch failure
            print(f"  FAILED: {exc}")
            failures.append(f"{asset} ({flag_id}) File:{title}: {exc}")
            time.sleep(2)
            continue

        if len(payload) > MAX_BYTES:
            print(
                f"  REFUSED: {title} is {len(payload)} bytes "
                f"(> {MAX_BYTES}); simplify it manually."
            )
            return 1

        head = payload.lstrip(b"\xef\xbb\xbf \t\r\n")[:5]
        if not (head.startswith(b"<svg") or head.startswith(b"<?xml")):
            failures.append(f"{asset} ({flag_id}) File:{title}: not an SVG payload")
            print("  FAILED: payload does not start with <svg or <?xml")
            time.sleep(2)
            continue
        # Some official flags are legitimately tiny, so a size floor alone
        # would reject valid assets. Require a complete, well-formed SVG
        # document and note compact files instead.
        try:
            root = ET.fromstring(payload)
        except ET.ParseError as exc:
            failures.append(f"{asset} ({flag_id}) File:{title}: malformed SVG ({exc})")
            print(f"  FAILED: malformed SVG ({exc})")
            time.sleep(2)
            continue
        if root.tag.rsplit("}", 1)[-1] != "svg":
            failures.append(f"{asset} ({flag_id}) File:{title}: root element is not <svg>")
            print(f"  FAILED: root element is {root.tag!r}")
            time.sleep(2)
            continue
        if len(payload) <= 1024:
            print(f"  note: compact official SVG ({len(payload)} bytes), well-formed")

        (OUT_DIR / f"{asset}.svg").write_bytes(payload)

        metadata = info.get("extmetadata", {})
        license_name = plain_text(
            metadata.get("LicenseShortName", {}).get("value", "")
        ) or "Unknown license"
        artist = plain_text(metadata.get("Artist", {}).get("value", "")) or "Unknown author"
        page_url = info.get("descriptionurl") or "(no page URL)"

        title_note = title
        if substitute:
            title_note = f"{title} (substitute for {TITLES[flag_id]})"
        rows.append(
            f"{asset} ({flag_id}) — {title_note} — {license_name} — {artist} — {page_url}"
        )
        print(f"  saved {len(payload)} bytes")
        time.sleep(2)

    if failures:
        print("\nFetch failures:", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    attribution = OUT_DIR / "europe-ATTRIBUTION.md"
    attribution.write_text(
        "# Europe country flag attribution\n\n" + "\n".join(rows) + "\n",
        encoding="utf-8",
    )
    print(f"\nWrote {len(rows)} rows to {attribution}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
