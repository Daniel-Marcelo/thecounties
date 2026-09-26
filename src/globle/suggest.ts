import { normalizeName } from "../pack/match";
import type { Country } from "./countries";

const LIMIT = 8;

export function suggestCountries(
  query: string,
  countries: Country[],
  guessedIds: Set<string>,
  stripPrefixes: string[],
): Country[] {
  const needle = normalizeName(query, stripPrefixes);
  if (needle.length < 2) return [];

  const hits: { country: Country; rank: number }[] = [];
  for (const country of countries) {
    if (guessedIds.has(country.id)) continue;
    const name = normalizeName(country.name, stripPrefixes);
    const aliases = country.aliases.map((alias) => normalizeName(alias, stripPrefixes));
    let rank = 9;
    if (name.startsWith(needle)) rank = 0;
    else if (aliases.some((alias) => alias.startsWith(needle))) rank = 1;
    else if (name.split(" ").some((word) => word.startsWith(needle))) rank = 2;
    else if (aliases.some((alias) => alias.split(" ").some((word) => word.startsWith(needle)))) rank = 3;
    if (rank === 9) continue;
    hits.push({ country, rank });
  }

  hits.sort((a, b) => a.rank - b.rank || a.country.name.localeCompare(b.country.name));
  return hits.slice(0, LIMIT).map((hit) => hit.country);
}
