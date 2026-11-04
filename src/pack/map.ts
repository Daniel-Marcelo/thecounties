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
  private readonly leaders = new Map<string, SVGLineElement>();
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
    await this.settleLabels();
  }

  private render(geojson: PlaceCollection): void {
    const [width, height] = this.pack.viewBox;
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", this.pack.mapLabel);

    const projection = (this.pack.rotateLon
      ? geoMercator().rotate([-this.pack.rotateLon, 0])
      : geoMercator()
    ).fitExtent(
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

      const display = place.mapName ?? place.name;
      const [cx, cy] = labelPoint(feature.geometry, projection);
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", String(cx));
      label.setAttribute("y", String(cy));
      label.setAttribute("class", `county-label ${smallLabel(display, this.pack.compactLabels)}`);
      label.textContent = display;
      labelLayer.append(label);
      this.labels.set(place.id, label);
    }

    const leaderGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    leaderGroup.setAttribute("class", "label-leaders");
    this.leaderGroup = leaderGroup;
    this.svg.append(leaderGroup, placeLayer, labelLayer);
    this.bindHover();
  }

  private leaderGroup: SVGGElement | null = null;

  markFound(place: Place): void {
    const path = this.paths.get(place.id);
    const label = this.labels.get(place.id);
    if (!path) return;

    path.classList.add("found", "just-found");
    path.setAttribute("fill", this.pack.groupColors[place.group] ?? "var(--leinster)");
    label?.classList.add("visible");
    this.leaders.get(place.id)?.classList.add("visible");
    window.setTimeout(() => path.classList.remove("just-found"), 700);
  }

  revealRemaining(foundIds: Set<string>): void {
    this.revealed = true;
    for (const [id, path] of this.paths) {
      if (foundIds.has(id)) continue;
      path.classList.add("revealed");
      path.setAttribute("fill", REVEALED_FILL);
      this.labels.get(id)?.classList.add("visible", "missed");
      this.leaders.get(id)?.classList.add("visible", "missed");
    }
  }

  reset(): void {
    this.revealed = false;
    for (const [id, path] of this.paths) {
      path.classList.remove("found", "revealed", "just-found");
      path.setAttribute("fill", UNGUESSED_FILL);
      this.labels.get(id)?.classList.remove("visible", "missed");
      this.leaders.get(id)?.classList.remove("visible", "missed");
    }
  }

  private async settleLabels(): Promise<void> {
    try {
      await document.fonts.ready;
    } catch {
      // Fall back to fallback-font metrics; the pass still resolves overlaps.
    }
    this.resolveLabels();
  }

  /**
   * At render time every label sits on its own island's centroid, and small
   * neighbours in dense regions (the Caribbean, SE Asia, European microstates)
   * overlap once several become visible together. After the real font loads,
   * measure the exact label boxes and part them: the largest countries keep
   * their anchor first, then smaller labels take the nearest free spot,
   * preferring vertical moves. A label pushed well off its island pulls a thin
   * leader line so the connection stays readable.
   */
  private resolveLabels(): void {
    if (!this.leaderGroup) return;

    const width = this.pack.viewBox[0];
    const height = this.pack.viewBox[1];
    const PAD = 10;
    const GAP = 3;
    const STEP = 9;
    const MAX_RINGS = 9;
    const LEADER_THRESHOLD = 8;

    type Box = { left: number; right: number; top: number; bottom: number };
    type Entry = {
      id: string;
      el: SVGTextElement;
      anchorX: number;
      anchorY: number;
      halfW: number;
      halfH: number;
      area: number;
    };

    const entries: Entry[] = [];
    for (const [id, el] of this.labels) {
      const area = this.paths.get(id)?.getBBox().width ?? 0;
      const box = el.getBBox();
      entries.push({
        id,
        el,
        anchorX: Number(el.getAttribute("x") ?? 0),
        anchorY: Number(el.getAttribute("y") ?? 0),
        halfW: box.width / 2 + GAP,
        halfH: box.height / 2 + GAP,
        area,
      });
    }
    // Large countries hold their ground first; little islands yield.
    entries.sort((a, b) => b.area - a.area);

    const placed: Box[] = [];
    const overlaps = (x: number, y: number, e: Entry, skip: Box | null): boolean => {
      const box: Box = {
        left: x - e.halfW,
        right: x + e.halfW,
        top: y - e.halfH,
        bottom: y + e.halfH,
      };
      if (box.left < PAD || box.right > width - PAD || box.top < PAD || box.bottom > height - PAD) {
        return true;
      }
      for (const other of placed) {
        if (other === skip) continue;
        if (
          box.left < other.right &&
          box.right > other.left &&
          box.top < other.bottom &&
          box.bottom > other.top
        ) {
          return true;
        }
      }
      return false;
    };

    for (const e of entries) {
      let x = e.anchorX;
      let y = e.anchorY;
      if (overlaps(x, y, e, null)) {
        let found = false;
        let fallbackX = x;
        let fallbackY = y;
        for (let ring = 1; ring <= MAX_RINGS && !found; ring += 1) {
          const d = ring * STEP;
          for (const [dx, dy] of [
            [0, -d],
            [0, d],
            [-d, 0],
            [d, 0],
            [-d, -d],
            [d, -d],
            [-d, d],
            [d, d],
          ]) {
            const cx = e.anchorX + dx;
            const cy = e.anchorY + dy;
            if (!overlaps(cx, cy, e, null)) {
              x = cx;
              y = cy;
              found = true;
              break;
            }
            fallbackX = cx;
            fallbackY = cy;
          }
        }
        if (!found) {
          x = fallbackX;
          y = fallbackY;
        }
      }

      e.el.setAttribute("x", String(x));
      e.el.setAttribute("y", String(y));
      placed.push({
        left: x - e.halfW,
        right: x + e.halfW,
        top: y - e.halfH,
        bottom: y + e.halfH,
      });

      const moved = Math.hypot(x - e.anchorX, y - e.anchorY);
      if (moved > LEADER_THRESHOLD) {
        this.drawLeader(e, e.anchorX, e.anchorY, x, y);
      }
    }
  }

  private drawLeader(e: { id: string; halfW: number; halfH: number }, fx: number, fy: number, tx: number, ty: number): void {
    if (!this.leaderGroup) return;
    // Anchor the line on the label's own island; end at the nearest edge of the
    // moved label box so the path stays as short as possible.
    const boxLeft = tx - e.halfW;
    const boxRight = tx + e.halfW;
    const boxTop = ty - e.halfH;
    const boxBottom = ty + e.halfH;
    const ex = Math.min(boxRight, Math.max(boxLeft, fx));
    const ey = Math.min(boxBottom, Math.max(boxTop, fy));
    const inside = ex === fx && ey === fy;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(fx));
    line.setAttribute("y1", String(fy));
    line.setAttribute("x2", String(ex));
    line.setAttribute("y2", String(ey));
    line.setAttribute("class", "county-leader");
    line.dataset.id = e.id;
    if (!inside) {
      this.leaderGroup.append(line);
    }
    this.leaders.set(e.id, line);
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
