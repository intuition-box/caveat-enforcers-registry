import type { RegistryEntry } from "./registry.js";

export type RegistryFilters = {
  query?: string;
  chain?: string;
  domain?: string;
  operation?: string;
};

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function entrySearchText(entry: RegistryEntry): string {
  return normalize(
    [
      entry.label,
      entry.description,
      entry.domain,
      entry.operation,
      entry.chain,
      entry.source,
      entry.terms,
      ...entry.claims.flatMap((claim) => [
        claim.predicate,
        claim.object,
        claim.predicateLabel ?? "",
        claim.objectLabel ?? "",
      ]),
    ].join(" "),
  );
}

export function filterRegistryEntries(
  entries: RegistryEntry[],
  filters: RegistryFilters = {},
): RegistryEntry[] {
  const query = normalize(filters.query ?? "");
  const chain = normalize(filters.chain ?? "");
  const domain = normalize(filters.domain ?? "");
  const operation = normalize(filters.operation ?? "");

  return entries.filter((entry) => {
    if (query && !entrySearchText(entry).includes(query)) return false;
    if (chain && normalize(entry.chain) !== chain) return false;
    if (domain && normalize(entry.domain) !== domain) return false;
    if (operation && normalize(entry.operation) !== operation) return false;
    return true;
  });
}

export function registryFilterOptions(entries: RegistryEntry[]): {
  chains: string[];
  domains: string[];
  operations: string[];
} {
  const unique = (values: string[]) =>
    [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

  return {
    chains: unique(entries.map((entry) => entry.chain)),
    domains: unique(entries.map((entry) => entry.domain)),
    operations: unique(entries.map((entry) => entry.operation)),
  };
}
