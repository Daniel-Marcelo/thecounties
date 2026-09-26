#!/usr/bin/env python3
"""Build public/world.geojson for the Globle-style quiz (Sporcle's 197 countries)."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NE_COUNTRIES = Path("/tmp/ne-countries.json")
NE_UNITS = Path("/tmp/ne-map-units.json")
GLOBLE_PLACES = Path("/tmp/globle-data/places.json")
OUT_GEOJSON = ROOT / "public" / "world.geojson"
OUT_COUNTRIES = ROOT / "src" / "globle" / "countries.ts"

DISPLAY = {
    "United States of America": "United States",
    "Vatican": "Vatican City",
    "Republic of Serbia": "Serbia",
    "The Bahamas": "Bahamas",
    "East Timor": "Timor-Leste",
    "Ivory Coast": "Ivory Coast",
    "Republic of the Congo": "Congo",
    "Democratic Republic of the Congo": "DR Congo",
    "Federated States of Micronesia": "Micronesia",
    "United Republic of Tanzania": "Tanzania",
}

EXTRA_ALIASES: dict[str, list[str]] = {
    "United States": ["USA", "US", "United States of America", "America"],
    "United Kingdom": ["UK", "Britain", "Great Britain", "United Kingdom of Great Britain and Northern Ireland"],
    "United Arab Emirates": ["UAE"],
    "Czechia": ["Czech Republic"],
    "Eswatini": ["Swaziland"],
    "Myanmar": ["Burma"],
    "North Macedonia": ["Macedonia", "FYROM"],
    "Ivory Coast": ["Cote d'Ivoire", "Côte d'Ivoire", "Cote dIvoire"],
    "Cabo Verde": ["Cape Verde"],
    "Timor-Leste": ["East Timor", "Timor Leste"],
    "Vatican City": ["Vatican", "Holy See"],
    "DR Congo": [
        "Democratic Republic of the Congo",
        "Democratic Republic of Congo",
        "DRC",
        "DR Congo",
        "Congo-Kinshasa",
        "Dem. Rep. Congo",
    ],
    "Congo": ["Republic of the Congo", "Congo-Brazzaville", "Congo Republic", "Rep Congo"],
    "South Korea": ["Korea", "Republic of Korea", "ROK"],
    "North Korea": ["DPRK", "DPR Korea", "Democratic People's Republic of Korea"],
    "Bosnia and Herzegovina": ["Bosnia", "Bosnia Herzegovina", "Bosnia and Herz."],
    "Central African Republic": ["CAR"],
    "Dominican Republic": ["Dominican Rep."],
    "Equatorial Guinea": ["Eq. Guinea"],
    "Antigua and Barbuda": ["Antigua"],
    "Saint Kitts and Nevis": ["St Kitts and Nevis", "St. Kitts and Nevis", "Saint Kitts", "St Kitts"],
    "Saint Lucia": ["St Lucia", "St. Lucia"],
    "Saint Vincent and the Grenadines": [
        "St Vincent and the Grenadines",
        "St. Vincent and the Grenadines",
        "Saint Vincent",
        "St Vincent",
    ],
    "São Tomé and Príncipe": ["Sao Tome and Principe", "Sao Tome"],
    "Bahamas": ["The Bahamas"],
    "Gambia": ["The Gambia"],
    "Micronesia": ["FSM", "Federated States of Micronesia"],
    "Marshall Islands": ["RMI"],
    "Papua New Guinea": ["PNG"],
    "Saudi Arabia": ["KSA"],
    "South Africa": ["RSA"],
    "Turkey": ["Turkiye", "Türkiye"],
    "Taiwan": ["Republic of China", "ROC"],
    "Russia": ["Russian Federation"],
    "Syria": ["Syrian Arab Republic"],
    "Laos": ["Lao People's Democratic Republic"],
    "Moldova": ["Moldavia"],
    "Netherlands": ["Holland", "The Netherlands"],
    "United Republic of Tanzania": ["Tanzania"],
    "Tanzania": ["United Republic of Tanzania"],
    "Serbia": ["Republic of Serbia"],
    "Palestine": ["State of Palestine"],
    "China": ["PRC", "People's Republic of China"],
}

NAME_KEYS = ("admin", "name", "name_long", "abbrev", "name_alt", "formal")


def index_features(features: list[dict]) -> dict[str, dict]:
    idx: dict[str, dict] = {}
    for feature in features:
        props = feature["properties"]
        for key in ("ADMIN", "NAME", "NAME_LONG"):
            value = props.get(key)
            if value:
                idx[value.lower()] = feature
        iso = props.get("ISO_A2")
        if iso and iso != "-99":
            idx[f"iso:{iso}"] = feature
        eh = props.get("ISO_A2_EH")
        if eh and eh != "-99":
            idx[f"iso:{eh}"] = feature
        if props.get("ADM0_A3"):
            idx[f"a3:{props['ADM0_A3']}"] = feature
        if props.get("GU_A3"):
            idx[f"gu:{props['GU_A3']}"] = feature
    return idx


def lookup(place: dict, idx: dict[str, dict]) -> dict:
    keys = [place["admin"].lower(), place["name"].lower(), (place["name_long"] or "").lower()]
    if place["admin"] == "United Kingdom":
        keys = ["united kingdom", "a3:GBR"]
    elif place["iso2"] and place["admin"] != "Gabon":
        keys.append(f"iso:{place['iso2']}")
    for key in keys:
        if key and key in idx:
            return idx[key]
    raise KeyError(place["admin"])


def as_multipolygon(geometry: dict) -> list:
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiPolygon":
        return list(geometry["coordinates"])
    raise ValueError(geometry["type"])


def ts_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def main() -> None:
    countries = json.loads(NE_COUNTRIES.read_text())["features"]
    units = json.loads(NE_UNITS.read_text())["features"]
    places = json.loads(GLOBLE_PLACES.read_text())
    country_idx = index_features(countries)
    unit_idx = index_features(units)

    france = unit_idx["gu:FXX"]
    uk_parts = [unit_idx[f"gu:{code}"] for code in ("ENG", "SCT", "WLS", "NIR")]

    features: list[dict] = []
    records: list[dict] = []
    seen: set[str] = set()

    for place in places:
        source = lookup(place, country_idx)
        props = source["properties"]
        country_id = props["ADM0_A3"]
        if country_id in seen:
            raise SystemExit(f"duplicate id {country_id} for {place['admin']}")
        seen.add(country_id)

        display = DISPLAY.get(place["admin"], place["admin"])

        geometry = source["geometry"]
        if country_id == "FRA":
            geometry = france["geometry"]
        elif country_id == "GBR":
            rings = []
            for part in uk_parts:
                rings.extend(as_multipolygon(part["geometry"]))
            geometry = {"type": "MultiPolygon", "coordinates": rings}

        aliases: set[str] = set()
        for key in NAME_KEYS:
            value = place.get(key)
            if value and "." not in value:
                aliases.add(value)
        for value in (display, props.get("ADMIN"), props.get("NAME_LONG")):
            if value and "." not in value:
                aliases.add(value)
        for extra in EXTRA_ALIASES.get(display, []):
            aliases.add(extra)
        aliases.discard("")
        aliases.discard(display)

        features.append(
            {
                "type": "Feature",
                "properties": {"id": country_id, "name": display},
                "geometry": geometry,
            }
        )
        records.append({"id": country_id, "name": display, "aliases": sorted(aliases, key=str.lower)})

    OUT_GEOJSON.parent.mkdir(parents=True, exist_ok=True)
    raw_path = Path("/tmp/world-raw.geojson")
    raw_path.write_text(json.dumps({"type": "FeatureCollection", "features": features}))

    lines = [
        "export type Country = {",
        "  id: string;",
        "  name: string;",
        "  aliases: string[];",
        "};",
        "",
        "export const COUNTRIES: Country[] = [",
    ]
    for record in records:
        alias_lit = ", ".join(ts_string(alias) for alias in record["aliases"])
        lines.append(
            f"  {{ id: {ts_string(record['id'])}, name: {ts_string(record['name'])}, aliases: [{alias_lit}] }},"
        )
    lines.append("];")
    lines.append("")
    OUT_COUNTRIES.parent.mkdir(parents=True, exist_ok=True)
    OUT_COUNTRIES.write_text("\n".join(lines))
    print(f"wrote {len(records)} countries")


if __name__ == "__main__":
    main()
