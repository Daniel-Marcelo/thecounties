import { geoMercator } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { COUNTY_BY_ID, PROVINCE_COLORS, type County } from "./counties";

type CountyProperties = { COUNTY: string };
type CountyFeature = Feature<Geometry, CountyProperties>;
type CountyCollection = FeatureCollection<Geometry, CountyProperties>;
type Projection = ReturnType<typeof geoMercator>;

const UNGUESSED_FILL = "var(--county-empty)";
const REVEALED_FILL = "var(--county-revealed)";

const IRELAND_FRAME = {
  type: "MultiPoint" as const,
  coordinates: [
    [-10.7, 51.35],
    [-5.3, 51.35],
    [-5.3, 55.45],
    [-10.7, 55.45],
  ],
};

export class IrelandMap {
  private readonly svg: SVGSVGElement;
  private readonly paths = new Map<string, SVGPathElement>();
  private readonly labels = new Map<string, SVGTextElement>();
  private tooltip: HTMLElement | null = null;
  private revealed = false;

  constructor(svg: SVGSVGElement) {
    this.svg = svg;
  }

  async load(): Promise<void> {
    const response = await fetch("/counties.geojson");
    if (!response.ok) {
      throw new Error("Could not load the county map.");
    }

    const geojson = (await response.json()) as CountyCollection;
    this.render(geojson);
  }

  private render(geojson: CountyCollection): void {
    const width = 640;
    const height = 780;
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", "Map of the 32 counties of Ireland");

    const projection = geoMercator().fitExtent(
      [
        [18, 12],
        [width - 18, height - 18],
      ],
      IRELAND_FRAME,
    );

    const ocean = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    ocean.setAttribute("class", "ocean");
    ocean.setAttribute("width", String(width));
    ocean.setAttribute("height", String(height));
    this.svg.append(ocean);

    const countyLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    countyLayer.setAttribute("class", "counties");
    const labelLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    labelLayer.setAttribute("class", "labels");
    labelLayer.setAttribute("aria-hidden", "true");

    for (const feature of geojson.features) {
      const id = feature.properties.COUNTY;
      const county = COUNTY_BY_ID.get(id);
      if (!county) continue;

      const countyPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      countyPath.setAttribute("d", planarPath(feature.geometry, projection));
      countyPath.setAttribute("class", "county");
      countyPath.dataset.id = id;
      countyPath.dataset.name = county.name;
      countyPath.dataset.province = county.province;
      countyPath.setAttribute("fill", UNGUESSED_FILL);
      countyLayer.append(countyPath);
      this.paths.set(id, countyPath);

      const [cx, cy] = labelPoint(feature.geometry, projection);
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", String(cx));
      label.setAttribute("y", String(cy));
      label.setAttribute("class", `county-label ${smallLabel(county.name)}`);
      label.textContent = county.name;
      labelLayer.append(label);
      this.labels.set(id, label);
    }

    this.svg.append(countyLayer, labelLayer);
    this.bindHover();
  }

  markFound(county: County): void {
    const path = this.paths.get(county.id);
    const label = this.labels.get(county.id);
    if (!path) return;

    path.classList.add("found", "just-found");
    path.setAttribute("fill", PROVINCE_COLORS[county.province]);
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
      const province = target.dataset.province;
      if (!name || !province) return;
      this.showTooltip(`${name} · ${province}`, event.clientX, event.clientY);
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

function smallLabel(name: string): string {
  return name.length > 8 || ["Louth", "Carlow", "Laois", "Down"].includes(name) ? "compact" : "";
}
