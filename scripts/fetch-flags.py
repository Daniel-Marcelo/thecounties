#!/usr/bin/env python3
"""Fetch the 27 Brazilian state flag SVGs from Wikimedia Commons.

Asset names are fixed (f01..f27) in the order of SIGLAS so that
src/flags/data.ts can join on them without leaking the answer sigla.
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

SIGLAS = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
    "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
    "SP", "SE", "TO",
]

# Commons file titles, without the "File:" prefix, in SIGLAS order.
TITLES = {
    "AC": "Flag of Acre.svg", "AL": "Flag of Alagoas.svg", "AP": "Flag of Amapá.svg",
    "AM": "Flag of Amazonas.svg", "BA": "Flag of Bahia.svg", "CE": "Flag of Ceará.svg",
    "DF": "Flag of the Federal District (Brazil).svg", "ES": "Flag of Espírito Santo.svg",
    "GO": "Flag of Goiás.svg", "MA": "Flag of Maranhão.svg", "MT": "Flag of Mato Grosso.svg",
    "MS": "Flag of Mato Grosso do Sul.svg", "MG": "Flag of Minas Gerais.svg",
    "PA": "Flag of Pará.svg", "PB": "Flag of Paraíba.svg", "PR": "Flag of Paraná.svg",
    "PE": "Flag of Pernambuco.svg", "PI": "Flag of Piauí.svg", "RJ": "Flag of Rio de Janeiro (state).svg",
    "RN": "Flag of Rio Grande do Norte.svg", "RS": "Flag of Rio Grande do Sul.svg",
    "RO": "Flag of Rondônia.svg", "RR": "Flag of Roraima (Brazil).svg",
    "SC": "Flag of Santa Catarina.svg", "SP": "Flag of São Paulo (state).svg",
    "SE": "Flag of Sergipe.svg", "TO": "Flag of Tocantins.svg",
}

# Titles that do not exist on Commons under the brief's name. Each
# replacement is recorded in ATTRIBUTION.md next to its row.
SUBSTITUTES = {
    "DF": "Bandeira do Distrito Federal (Brasil).svg",
    "RR": "Bandeira de Roraima.svg",
    "SP": "Bandeira do estado de São Paulo.svg",
}

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = (
    "BrazilStateFlagsQuiz/1.0 "
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

    for index, sigla in enumerate(SIGLAS, start=1):
        asset = f"f{index:02d}"
        title = SUBSTITUTES.get(sigla, TITLES[sigla])
        substitute = SUBSTITUTES.get(sigla)
        print(f"{asset} {sigla}: File:{title}")
        try:
            info = fetch_info(title)
            payload = request_bytes(info["url"])
        except Exception as exc:  # noqa: BLE001 - report every fetch failure
            print(f"  FAILED: {exc}")
            failures.append(f"{asset} ({sigla}) File:{title}: {exc}")
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
            failures.append(f"{asset} ({sigla}) File:{title}: not an SVG payload")
            print("  FAILED: payload does not start with <svg or <?xml")
            time.sleep(2)
            continue
        # A few official flags are legitimately tiny (Acre is 254 bytes), so
        # a 1 KB floor alone would reject valid assets. Require a complete,
        # well-formed SVG document and note compact files instead.
        try:
            root = ET.fromstring(payload)
        except ET.ParseError as exc:
            failures.append(f"{asset} ({sigla}) File:{title}: malformed SVG ({exc})")
            print(f"  FAILED: malformed SVG ({exc})")
            time.sleep(2)
            continue
        if root.tag.rsplit("}", 1)[-1] != "svg":
            failures.append(f"{asset} ({sigla}) File:{title}: root element is not <svg>")
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
            title_note = f"{title} (substitute for {TITLES[sigla]})"
        rows.append(
            f"{asset} ({sigla}) — {title_note} — {license_name} — {artist} — {page_url}"
        )
        print(f"  saved {len(payload)} bytes")
        time.sleep(2)

    if failures:
        print("\nFetch failures:", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    attribution = OUT_DIR / "brazil-ATTRIBUTION.md"
    attribution.write_text(
        "# Flag attribution\n\n" + "\n".join(rows) + "\n", encoding="utf-8"
    )
    print(f"\nWrote {len(rows)} rows to {attribution}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
