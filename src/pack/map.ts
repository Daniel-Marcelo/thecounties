import { geoMercator } from "d3-geo";
import type { FeatureCollection, Geometry, Position } from "geojson";
import type { Pack, Place } from "./types";

type PlaceCollection = FeatureCollection<Geometry, Record<string, string>>;
type Projection = ReturnType<typeof geoMercator>;

const UNGUESSED_FILL = "var(--county-empty)";
const REVEALED_FILL = "var(--county-revealed)";

export class PackMap {
  private readonly svg: SVGSVGElement;
  private readonly pack: Pack;
  private readonly places: Map<string, Place>;
  private readonly paths = new Map<string, SVGPathElement>();
  private readonly labels = new Map<string, SVGTextElement>();
  private tooltip: HTMLElement | null = null;
  private revealed = false;

  constructor(svg: SVGSVGElement, pack: Pack) {
    this.svg = svg;
    this.pack = pack;
    this.places = new Map(pack.places.map((place) => [place.id, place]));
  }

  async load(): Promise<void> {
    const response = await fetch(this.pack.geojsonUrl);
    if (!response.ok) {
      throw new Error("Could not load the map.");
    }

    const geojson = (await response.json()) as PlaceCollection;
    this.render(geojson);
  }

  private render(geojson: PlaceCollection): void {
    const [width, height] = this.pack.viewBox;
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", this.pack.mapLabel);

    const projection = geoMercator().fitExtent(
      [
        [18, 12],
        [width - 18, height - 18],
      ],
      { type: "MultiPoint", coordinates: this.pack.frame },
    );

    const ocean = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    ocean.setAttribute("class", "ocean");
    ocean.setAttribute("width", String(width));
    ocean.setAttribute("height", String(height));
    this.svg.append(ocean);

    const placeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    placeLayer.setAttribute("class", "counties");
    const labelLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    labelLayer.setAttribute("class", "labels");
    labelLayer.setAttribute("aria-hidden", "true");

    for (const feature of geojson.features) {
      const id = feature.properties[this.pack.featureIdProperty];
      const place = id ? this.places.get(id) : undefined;
      if (!place) continue;

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", planarPath(feature.geometry, projection));
      path.setAttribute("class", "county");
      path.dataset.id = place.id;
      path.dataset.name = place.name;
      path.dataset.province = place.group;
      path.setAttribute("fill", UNGUESSED_FILL);
      placeLayer.append(path);
      this.paths.set(place.id, path);

      const [cx, cy] = labelPoint(feature.geometry, projection);
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", String(cx));
      label.setAttribute("y", String(cy));
      label.setAttribute("class", `county-label ${smallLabel(place.name, this.pack.compactLabels)}`);
      label.textContent = place.name;
      labelLayer.append(label);
      this.labels.set(place.id, label);
    }

    this.svg.append(placeLayer, labelLayer);
    this.bindHover();
  }

  markFound(place: Place): void {
    const path = this.paths.get(place.id);
    const label = this.labels.get(place.id);
    if (!path) return;

    path.classList.add("found", "just-found");
    path.setAttribute("fill", this.pack.groupColors[place.group] ?? "var(--leinster)");
    label?.classList.add("visible");
    window.setTimeout(() => path.classList.remove("just-found"), 700);
  }

  revealRemaining(foundIds: Set<string>): void {
    this.revealed = true;
    for (const [id, path] of this.paths) {
      if (foundIds.has(id)) continue;
      path.classList.add("revealed");
      path.setAttribute("fill", REVEALED_FILL);
      this.labels.get(id)?.classList.add("visible", "missed");
    }
  }

  reset(): void {
    this.revealed = false;
    for (const [id, path] of this.paths) {
      path.classList.remove("found", "revealed", "just-found");
      path.setAttribute("fill", UNGUESSED_FILL);
      this.labels.get(id)?.classList.remove("visible", "missed");
    }
  }

  private bindHover(): void {
    this.svg.addEventListener("pointermove", (event) => {
      const target = event.target;
      if (!(target instanceof SVGPathElement) || !target.classList.contains("county")) {
        this.hideTooltip();
        return;
      }

      const found =
        target.classList.contains("found") ||
        target.classList.contains("revealed") ||
        this.revealed;
      if (!found) {
        this.hideTooltip();
        return;
      }

      const name = target.dataset.name;
      const group = target.dataset.province;
      if (!name || !group) return;
      this.showTooltip(`${name} · ${group}`, event.clientX, event.clientY);
    });

    this.svg.addEventListener("pointerleave", () => this.hideTooltip());
  }

  private showTooltip(text: string, x: number, y: number): void {
    if (!this.tooltip) {
      this.tooltip = document.createElement("div");
      this.tooltip.className = "map-tooltip";
      document.body.append(this.tooltip);
    }
    this.tooltip.textContent = text;
    this.tooltip.hidden = false;
    this.tooltip.style.left = `${x + 14}px`;
    this.tooltip.style.top = `${y + 14}px`;
  }

  private hideTooltip(): void {
    if (this.tooltip) this.tooltip.hidden = true;
  }
}

function planarPath(geometry: Geometry, projection: Projection): string {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.map((ring) => ringPath(ring, projection)).join("");
  }
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates
      .map((polygon) => polygon.map((ring) => ringPath(ring, projection)).join(""))
      .join("");
  }
  return "";
}

function ringPath(ring: Position[], projection: Projection): string {
  const points = ring
    .map(([lon, lat]) => projection([lon, lat]))
    .filter((point): point is [number, number] => point !== null);
  if (points.length < 3) return "";
  return `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L")}Z`;
}

function labelPoint(geometry: Geometry, projection: Projection): [number, number] {
  const ring = largestRing(geometry);
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const [lon, lat] of ring) {
    const point = projection([lon, lat]);
    if (!point) continue;
    sx += point[0];
    sy += point[1];
    n += 1;
  }
  return n ? [sx / n, sy / n] : [0, 0];
}

function largestRing(geometry: Geometry): Position[] {
  const rings: Position[][] = [];
  if (geometry.type === "Polygon") {
    rings.push(...geometry.coordinates);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) rings.push(...polygon);
  }
  return rings.sort((a, b) => b.length - a.length)[0] ?? [];
}

function smallLabel(name: string, compactLabels: string[]): string {
  return name.length > 8 || compactLabels.includes(name) ? "compact" : "";
}
