import { geoMercator } from "d3-geo";
import type { FeatureCollection, Geometry, Position } from "geojson";
import { heatColor } from "./distance";

type WorldCollection = FeatureCollection<Geometry, { id: string; name: string }>;
type Projection = ReturnType<typeof geoMercator>;

const VIEW: [number, number] = [960, 560];
const UNGUESSED = "var(--county-empty)";

export class GlobleMap {
  private readonly svg: SVGSVGElement;
  private readonly paths = new Map<string, SVGPathElement>();
  private world: SVGGElement | null = null;
  private tooltip: HTMLElement | null = null;
  private view = { x: 0, y: 0, k: 1 };
  private dragging = false;
  private last = { x: 0, y: 0 };
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: { dist: number; k: number } | null = null;
  private lastTap = 0;

  constructor(svg: SVGSVGElement) {
    this.svg = svg;
  }

  async load(): Promise<WorldCollection> {
    const response = await fetch("/world.geojson");
    if (!response.ok) throw new Error("Could not load the world map.");
    const geojson = (await response.json()) as WorldCollection;
    this.render(geojson);
    this.bindPanZoom();
    return geojson;
  }

  paint(id: string, km: number, solved: boolean): void {
    const path = this.paths.get(id);
    if (!path) return;
    path.setAttribute("fill", heatColor(km, solved));
    path.classList.add("found", "just-found");
    if (solved) path.classList.add("solved");
    window.setTimeout(() => path.classList.remove("just-found"), 700);
  }

  revealTarget(id: string): void {
    const path = this.paths.get(id);
    if (!path) return;
    path.setAttribute("fill", heatColor(0, true));
    path.classList.add("found", "solved", "revealed");
  }

  reset(): void {
    for (const path of this.paths.values()) {
      path.classList.remove("found", "just-found", "solved", "revealed");
      path.setAttribute("fill", UNGUESSED);
    }
    this.view = { x: 0, y: 0, k: 1 };
    this.applyView();
  }

  private render(geojson: WorldCollection): void {
    const [width, height] = VIEW;
    this.svg.replaceChildren();
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", "World map");

    const projection = geoMercator().fitExtent(
      [
        [12, 8],
        [width - 12, height - 8],
      ],
      geojson,
    );

    const ocean = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    ocean.setAttribute("class", "ocean");
    ocean.setAttribute("width", String(width));
    ocean.setAttribute("height", String(height));
    this.svg.append(ocean);

    const world = document.createElementNS("http://www.w3.org/2000/svg", "g");
    world.setAttribute("class", "counties globle-world");
    this.world = world;

    for (const feature of geojson.features) {
      const { id, name } = feature.properties;
      const d = planarPath(feature.geometry, projection);
      if (!d) continue;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", d);
      path.setAttribute("class", "county");
      path.dataset.id = id;
      path.dataset.name = name;
      path.setAttribute("fill", UNGUESSED);
      world.append(path);
      this.paths.set(id, path);
    }

    this.svg.append(world);
    this.bindHover();
  }

  private applyView(): void {
    this.world?.setAttribute(
      "transform",
      `translate(${this.view.x} ${this.view.y}) scale(${this.view.k})`,
    );
  }

  private bindPanZoom(): void {
    const wrap = this.svg.parentElement;
    if (!wrap) return;

    wrap.querySelector("#zoom-in")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.zoomCenter(1.4, wrap);
    });
    wrap.querySelector("#zoom-out")?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.zoomCenter(1 / 1.4, wrap);
    });
    wrap.querySelectorAll(".map-zoom button").forEach((button) => {
      button.addEventListener("pointerdown", (event) => event.stopPropagation());
    });

    wrap.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      wrap.setPointerCapture(event.pointerId);
      if (this.pointers.size === 1) {
        this.dragging = true;
        this.last = { x: event.clientX, y: event.clientY };
      } else {
        this.dragging = false;
      }
    });
    wrap.addEventListener("pointermove", (event) => {
      if (this.pinch || this.pointers.size !== 1 || !this.dragging) return;
      if (!this.pointers.has(event.pointerId)) return;
      this.view.x += event.clientX - this.last.x;
      this.view.y += event.clientY - this.last.y;
      this.last = { x: event.clientX, y: event.clientY };
      this.pointers.set(event.pointerId, this.last);
      this.applyView();
    });
    const stopPointer = (event: PointerEvent) => {
      const start = this.pointers.get(event.pointerId);
      this.pointers.delete(event.pointerId);
      this.dragging = this.pointers.size === 1;
      if (this.dragging) {
        const remaining = [...this.pointers.values()][0];
        if (remaining) this.last = remaining;
      }
      if (!start || this.pointers.size > 0 || this.pinch) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      const now = Date.now();
      if (moved < 12 && now - this.lastTap < 320) {
        this.zoomAt(event.clientX, event.clientY, 1.8, wrap);
        this.lastTap = 0;
      } else {
        this.lastTap = moved < 12 ? now : 0;
      }
    };
    wrap.addEventListener("pointerup", stopPointer);
    wrap.addEventListener("pointercancel", stopPointer);
    wrap.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.12 : 1 / 1.12, wrap);
      },
      { passive: false },
    );
    wrap.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 2) return;
        event.preventDefault();
        this.dragging = false;
        this.pinch = { dist: touchDist(event.touches), k: this.view.k };
      },
      { passive: false },
    );
    wrap.addEventListener(
      "touchmove",
      (event) => {
        if (event.touches.length !== 2 || !this.pinch) return;
        event.preventDefault();
        const a = event.touches[0]!;
        const b = event.touches[1]!;
        const dist = touchDist(event.touches);
        this.zoomAt(
          (a.clientX + b.clientX) / 2,
          (a.clientY + b.clientY) / 2,
          this.pinch.k * (dist / this.pinch.dist) / this.view.k,
          wrap,
        );
      },
      { passive: false },
    );
    wrap.addEventListener("touchend", () => {
      this.pinch = null;
    });
    wrap.addEventListener("touchcancel", () => {
      this.pinch = null;
    });
  }

  private zoomCenter(factor: number, wrap: HTMLElement): void {
    const rect = wrap.getBoundingClientRect();
    this.zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor, wrap);
  }

  private zoomAt(clientX: number, clientY: number, factor: number, wrap: HTMLElement): void {
    const next = Math.min(12, Math.max(1, this.view.k * factor));
    const rect = wrap.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const px = ((clientX - rect.left) / rect.width) * VIEW[0];
    const py = ((clientY - rect.top) / rect.height) * VIEW[1];
    const scale = next / this.view.k;
    this.view.x = px - scale * (px - this.view.x);
    this.view.y = py - scale * (py - this.view.y);
    this.view.k = next;
    if (next === 1) this.view = { x: 0, y: 0, k: 1 };
    this.applyView();
  }

  private bindHover(): void {
    this.svg.addEventListener("pointermove", (event) => {
      if (this.dragging) {
        this.hideTooltip();
        return;
      }
      const target = event.target;
      if (!(target instanceof SVGPathElement) || !target.classList.contains("found")) {
        this.hideTooltip();
        return;
      }
      const name = target.dataset.name;
      if (!name) return;
      this.showTooltip(name, event.clientX, event.clientY);
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

function touchDist(touches: TouchList): number {
  const a = touches[0]!;
  const b = touches[1]!;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function planarPath(geometry: Geometry, projection: Projection): string {
  return ringsOf(geometry)
    .flatMap((ring) => splitAntimeridian(ring))
    .map((ring) => ringPath(ring, projection))
    .join("");
}

function ringsOf(geometry: Geometry): Position[][] {
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

function splitAntimeridian(ring: Position[]): Position[][] {
  if (ring.length < 3) return [];
  const parts: Position[][] = [[]];
  for (const point of ring) {
    const current = parts[parts.length - 1]!;
    const prev = current[current.length - 1];
    if (prev && Math.abs(point[0] - prev[0]) > 180) {
      const east = prev[0] > 0;
      current.push([east ? 180 : -180, prev[1]]);
      parts.push([[east ? -180 : 180, point[1]], point]);
    } else {
      current.push(point);
    }
  }
  return parts
    .filter((part) => part.length >= 3)
    .map((part) => {
      const first = part[0]!;
      const last = part[part.length - 1]!;
      if (first[0] !== last[0] || first[1] !== last[1]) part.push(first);
      return part;
    });
}

function ringPath(ring: Position[], projection: Projection): string {
  const points = ring
    .map(([lon, lat]) => projection([lon, lat]))
    .filter((point): point is [number, number] => point !== null);
  if (points.length < 3) return "";
  return `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join("L")}Z`;
}
