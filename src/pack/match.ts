import type { Place } from "./types";

export function normalizeName(value: string, stripPrefixes: string[]): string {
  const prefix = stripPrefixes.length
    ? new RegExp(`^(${stripPrefixes.map(escapeRegExp).join("|")})\\s+`, "i")
    : null;

  let normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[./-]/g, " ");
  if (prefix) normalized = normalized.replace(prefix, "");
  return normalized.replace(/\s+/g, " ").trim();
}

export function buildAliasIndex(places: Place[], stripPrefixes: string[]): Map<string, Place> {
  const index = new Map<string, Place>();
  for (const place of places) {
    index.set(normalizeName(place.name, stripPrefixes), place);
    index.set(normalizeName(place.id, stripPrefixes), place);
    for (const alias of place.aliases) {
      index.set(normalizeName(alias, stripPrefixes), place);
    }
  }
  return index;
}

export function matchPlace(
  guess: string,
  index: Map<string, Place>,
  stripPrefixes: string[],
): Place | null {
  const normalized = normalizeName(guess, stripPrefixes);
  if (!normalized) return null;
  return index.get(normalized) ?? null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
