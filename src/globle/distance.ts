import type { FeatureCollection, Geometry, Position } from "geojson";

const EARTH_KM = 6371;
const BORDER_ZERO_KM = 10;
const MAX_POINTS = 80;

export function sampleBorders(
  geojson: FeatureCollection<Geometry, { id: string }>,
): Map<string, Position[]> {
  const samples = new Map<string, Position[]>();
  for (const feature of geojson.features) {
    const points = flattenPoints(feature.geometry);
    samples.set(feature.properties.id, downsample(points, MAX_POINTS));
  }
  return samples;
}

export function borderKm(a: Position[], b: Position[]): number {
  let min = Infinity;
  for (const pa of a) {
    for (const pb of b) {
      const d = haversineKm(pa, pb);
      if (d < min) min = d;
      if (min === 0) return 0;
    }
  }
  if (!Number.isFinite(min)) return 20000;
  return min < BORDER_ZERO_KM ? 0 : Math.round(min);
}

export function heatColor(km: number, solved = false): string {
  if (solved) return "#8f1d14";
  const t = Math.max(0, Math.min(1, 1 - km / 20000));
  const e = t ** 1.35;
  const r = Math.round(244 + (193 - 244) * e);
  const g = Math.round(239 + (18 - 239) * e);
  const b = Math.round(228 + (31 - 228) * e);
  return `rgb(${r} ${g} ${b})`;
}

export function formatKm(km: number): string {
  return `${km.toLocaleString("en-GB")} km`;
}

function haversineKm(a: Position, b: Position): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function flattenPoints(geometry: Geometry): Position[] {
  const points: Position[] = [];
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) points.push(...ring);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) points.push(...ring);
    }
  }
  return points;
}

function downsample(points: Position[], max: number): Position[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const sampled: Position[] = [];
  for (let i = 0; i < max; i += 1) {
    sampled.push(points[Math.floor(i * step)]!);
  }
  return sampled;
}
