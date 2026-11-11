#!/usr/bin/env python3
"""Fetch the Irish county flag SVGs from Wikimedia Commons.

Asset names are fixed (c01..c18) in the order of each design group's first
appearance in the counties list (src/counties.ts) so that src/flags/ireland.ts
can join on them without leaking the answer id.

Ireland has no official county flags: each county's de facto flag is its GAA
colours, an UNORDERED pair of colours — Commons files for the same pair
disagree about arrangement (mirrored halves) and exact shades, and several
counties share a pair outright. So one asset serves every county whose colour
pair is the same, chosen from the Commons file that names the most group
members (or a county's dedicated file for singles). The engine
(src/flags/engine.ts) never offers same-asset entities as competing options,
which keeps those questions fair. Every candidate file was downloaded and
pixel-hashed, and colour pairs verified against each county's own Commons
file, before this mapping was committed.

By default the files are fetched from Commons. `--cache <dir> --meta <json>`
seeds from previously fetched copies and their captured extmetadata instead
(used for the initial commit, when Commons was rate-limiting).
"""

from __future__ import annotations

import argparse
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

# One Commons file per unordered colour pair, in first-appearance order of
# src/counties.ts. Counties listed together share one asset. The last field
# names the --cache file stem (scripts that seeded the cache save by key).
DESIGN_GROUPS = [
    ("c01", ["CARLOW"], "Flag of county Carlow.svg", "carlow"),
    (
        "c02",
        ["CAVAN", "LAOIS", "MONAGHAN", "WATERFORD"],
        "Flag of the counties of Cavan and Laois.svg",
        "cavan_laois",
    ),
    (
        "c03",
        ["CLARE", "TIPPERARY", "ROSCOMMON", "LONGFORD", "WICKLOW"],
        "Flag of Longford, Tipperary & Roscommon County.svg",
        "longford_tipperary_roscommon",
    ),
    (
        "c04",
        ["CORK", "LOUTH", "LONDONDERRY", "TYRONE"],
        "Flag of the counties of Derry and Tyrone.svg",
        "derry_tyrone",
    ),
    (
        "c05",
        ["DONEGAL", "LEITRIM", "MEATH", "KERRY"],
        "Flag of the counties of Donegal, Leitrim and Meath.svg",
        "donegal_leitrim_meath",
    ),
    ("c06", ["DUBLIN"], "Flag of county Dublin.svg", "dublin"),
    (
        "c07",
        ["GALWAY", "WESTMEATH"],
        "Flag of the counties of Galway and Westmeath.svg",
        "galway_westmeath",
    ),
    ("c08", ["KILDARE"], "Flag of county Kildare.svg", "kildare"),
    ("c09", ["KILKENNY"], "Flag of county Kilkenny.svg", "kilkenny"),
    (
        "c10",
        ["LIMERICK", "FERMANAGH"],
        "Flag of the counties of Fermanagh and Limerick.svg",
        "fermanagh_limerick",
    ),
    ("c11", ["MAYO"], "Flag of county Mayo.svg", "mayo"),
    ("c12", ["OFFALY"], "Flag of county Offaly.svg", "offaly"),
    ("c13", ["SLIGO"], "Flag of county Sligo.svg", "sligo"),
    ("c14", ["WEXFORD"], "Flag of county Wexford.svg", "wexford"),
    ("c15", ["ANTRIM"], "Flag of county Antrim.svg", "antrim"),
    ("c16", ["ARMAGH"], "Flag of county Armagh.svg", "armagh"),
    ("c17", ["DOWN"], "Flag of county Down.svg", "down"),
]

# The full 32-county list from src/counties.ts — the groups must cover it.
ALL_IDS = [
    "CARLOW", "CAVAN", "CLARE", "CORK", "DONEGAL", "DUBLIN", "GALWAY",
    "KERRY", "KILDARE", "KILKENNY", "LAOIS", "LEITRIM", "LIMERICK",
    "LONGFORD", "LOUTH", "MAYO", "MEATH", "MONAGHAN", "OFFALY", "ROSCOMMON",
    "SLIGO", "TIPPERARY", "WATERFORD", "WESTMEATH", "WEXFORD", "WICKLOW",
    "ANTRIM", "ARMAGH", "DOWN", "FERMANAGH", "LONDONDERRY", "TYRONE",
]

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = (
    "IrelandCountyFlagsQuiz/1.0 "
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


def validate(payload: bytes, label: str) -> bool:
    """Well-formed SVG with an <svg> root; prints the verdict."""
    if len(payload) > MAX_BYTES:
        print(f"  REFUSED: {label} is {len(payload)} bytes (> {MAX_BYTES})")
        return False
    head = payload.lstrip(b"\xef\xbb\xbf \t\r\n")[:5]
    if not (head.startswith(b"<svg") or head.startswith(b"<?xml")):
        print(f"  FAILED: {label} payload does not start with <svg or <?xml")
        return False
    try:
        root = ET.fromstring(payload)
    except ET.ParseError as exc:
        print(f"  FAILED: {label} malformed SVG ({exc})")
        return False
    if root.tag.rsplit("}", 1)[-1] != "svg":
        print(f"  FAILED: {label} root element is {root.tag!r}")
        return False
    if len(payload) <= 1024:
        print(f"  note: compact SVG ({len(payload)} bytes), well-formed")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=None,
                        help="directory of previously fetched SVGs, keyed by cache stem")
    parser.add_argument("--meta", type=Path, default=None,
                        help="JSON sidecar with cached extmetadata rows")
    args = parser.parse_args()

    covered = [flag_id for _, ids, _, _ in DESIGN_GROUPS for flag_id in ids]
    if sorted(covered) != sorted(ALL_IDS):
        missing = sorted(set(ALL_IDS) - set(covered))
        extra = sorted(set(covered) - set(ALL_IDS))
        print(
            "Design groups do not cover the 32 counties exactly: "
            f"missing={missing} extra={extra}",
            file=sys.stderr,
        )
        return 1

    meta_rows: dict[str, dict] = {}
    if args.meta and args.meta.exists():
        for row in json.loads(args.meta.read_text(encoding="utf-8")):
            if "key" in row:
                meta_rows[row["key"]] = row

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    rows: list[str] = []
    failures: list[str] = []

    for asset, flag_ids, title, cache_key in DESIGN_GROUPS:
        print(f"{asset} ({', '.join(flag_ids)}): File:{title}")
        payload: bytes | None = None
        info: dict | None = None
        cache_file = args.cache / f"{cache_key}.svg" if args.cache else None

        try:
            if cache_file and cache_file.exists():
                payload = cache_file.read_bytes()
                print(f"  from cache: {cache_file.name}")
                info = meta_rows.get(cache_key)
                if info is None:
                    print("  no cached metadata; fetching from Commons")
                    info = fetch_info(title)
            else:
                info = fetch_info(title)
                payload = request_bytes(info["url"])
        except Exception as exc:  # noqa: BLE001 - report every fetch failure
            print(f"  FAILED: {exc}")
            failures.append(f"{asset} ({', '.join(flag_ids)}) File:{title}: {exc}")
            time.sleep(2)
            continue

        if not validate(payload, title):
            failures.append(f"{asset} ({', '.join(flag_ids)}) File:{title}: invalid SVG")
            time.sleep(2)
            continue

        (OUT_DIR / f"{asset}.svg").write_bytes(payload)

        if info is not None and "extmetadata" in info:
            metadata = info["extmetadata"]
            license_name = plain_text(
                metadata.get("LicenseShortName", {}).get("value", "")
            ) or "Unknown license"
            artist = plain_text(metadata.get("Artist", {}).get("value", "")) or "Unknown author"
            page_url = info.get("descriptionurl") or "(no page URL)"
        else:
            # Cached sidecar row: license/artist/page already plain text.
            license_name = (info or {}).get("license") or "Unknown license"
            artist = (info or {}).get("artist") or "Unknown author"
            page_url = (info or {}).get("page") or "(no page URL)"

        rows.append(
            f"{asset} ({', '.join(flag_ids)}) — {title} — {license_name} — {artist} — {page_url}"
        )
        print(f"  saved {len(payload)} bytes")
        time.sleep(2)

    if failures:
        print("\nFetch failures:", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    attribution = OUT_DIR / "ireland-ATTRIBUTION.md"
    attribution.write_text(
        "# Ireland county flag attribution\n"
        "\n"
        "One asset per unordered colour pair; counties listed together share\n"
        "identical GAA county colours, so they share one Commons file (Commons\n"
        "holds several arrangements and shades of the same pair). The engine\n"
        "keeps same-asset counties from ever competing as options in a\n"
        "question.\n\n"
        + "\n".join(rows)
        + "\n",
        encoding="utf-8",
    )
    print(f"\nWrote {len(rows)} rows to {attribution}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
