#!/usr/bin/env python3
"""Build a regional quiz geojson from the shared world data.

Reads public/world.geojson (Natural Earth, 197 countries, properties.id = ISO
alpha-3), keeps the requested country features, and writes public/<name>.geojson
with properties {"id"} — the format the pack engine expects.

The map frame and viewBox aspect are derived from the included features' real
Mercator geometry, so packs never need hand-guessed frame numbers.

Usage:
  python scripts/build-region.py asia AFG,ARM,...,YEM
  python scripts/build-region.py africa --margin 0.03 --verbose
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORLD = ROOT / "public" / "world.geojson"

# Canvas heights chosen to sit well in the quiz layout: portrait regions get the
# taller canvas, landscape ones the shorter, wider one.
PORTRAIT_HEIGHT = 1040
LANDSCAPE_HEIGHT = 700


def merc_y(lat: float) -> float:
    return math.log(math.tan(math.radians(45 + lat / 2)))


def set_bbox(geometry: dict) -> tuple[float, float, float, float]:
    """Return (west, east, south, north) of a GeoJSON geometry."""
    xs: list[float] = []
    ys: list[float] = []
    polys = (
        [geometry["coordinates"]]
        if geometry["type"] == "Polygon"
        else geometry["coordinates"]
    )
    for polygon in polys:
        for ring in polygon:
            for x, y in ring:
                xs.append(x)
                ys.append(y)
    if not xs:
        return 0.0, 0.0, 0.0, 0.0
    return min(xs), max(xs), min(ys), max(ys)


def round_out_half(value: float, outward: bool) -> float:
    """Snap to the nearest 0.5° (rounding away from the map body)."""
    scaled = value * 2
    rounded = math.floor(scaled) if outward else math.ceil(scaled)
    return rounded / 2


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name", help="output slug, e.g. africa -> public/africa.geojson")
    parser.add_argument(
        "ids",
        help="comma-separated ISO alpha-3 ids to include (e.g. ALG,EGY,ZAF)",
    )
    parser.add_argument(
        "--margin",
        type=float,
        default=0.03,
        help="sea margin per side as a fraction of the span (default 0.03)",
    )
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    wanted = [i.strip().upper() for i in args.ids.split(",") if i.strip()]
    if not wanted:
        print("no country ids given", file=sys.stderr)
        return 1

    world = json.loads(WORLD.read_text(encoding="utf-8"))
    features = [f for f in world["features"] if f["properties"].get("id") in wanted]

    missing = sorted(set(wanted) - {f["properties"].get("id") for f in features})
    if missing:
        print(f"ids missing from world.geojson: {', '.join(missing)}", file=sys.stderr)
        return 1

    features.sort(key=lambda f: f["properties"]["id"])
    out_path = ROOT / "public" / f"{args.name}.geojson"
    out_path.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {"id": f["properties"]["id"]},
                        "geometry": f["geometry"],
                    }
                    for f in features
                ],
            }
        ),
        encoding="utf-8",
    )

    w0, w1, s0, s1 = None, None, None, None
    for f in features:
        b0, b1, c0, c1 = set_bbox(f["geometry"])
        w0 = b0 if w0 is None else min(w0, b0)
        w1 = b1 if w1 is None else max(w1, b1)
        s0 = c0 if s0 is None else min(s0, c0)
        s1 = c1 if s1 is None else max(s1, c1)

    lon_span = w1 - w0
    lat_span = s1 - s0
    frame_west = round_out_half(w0 - args.margin * lon_span, outward=True)
    frame_east = round_out_half(w1 + args.margin * lon_span, outward=True)
    frame_south = round_out_half(s0 - args.margin * lat_span, outward=True)
    frame_north = round_out_half(s1 + args.margin * lat_span, outward=True)

    aspect = math.radians(frame_east - frame_west) / (
        merc_y(frame_north) - merc_y(frame_south)
    )
    if aspect >= 1:
        height = LANDSCAPE_HEIGHT
    else:
        height = PORTRAIT_HEIGHT
    width = round(height * aspect)

    if args.verbose:
        print(
            json.dumps(
                {
                    "file": str(out_path.relative_to(ROOT)),
                    "features": len(features),
                    "frame": [[frame_west, frame_south], [frame_east, frame_north]],
                    "viewBox": [width, height],
                },
                indent=2,
            )
        )
    else:
        print(
            f"wrote {out_path.relative_to(ROOT)} ({len(features)} features) · "
            f"frame [{frame_west}, {frame_south}] -> [{frame_east}, {frame_north}] · "
            f"viewBox [{width}, {height}]"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
