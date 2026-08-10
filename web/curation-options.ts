import type { Claim } from "../src/types";

export type CurationRegistryRecord = {
  id: string;
  label: string;
  implementation?: string;
  createdAt: string;
};

export type CurationEnforcerOption = {
  deploymentId: string;
  number: number;
  numberLabel: string;
  canonicalName: string;
  createdAt: string;
};

function canonicalName(record: CurationRegistryRecord): string {
  const implementation = record.implementation?.trim();
  if (implementation) return implementation;
  return record.label.trim() || "Unnamed enforcer";
}

export function buildCurationEnforcerOptions(
  records: CurationRegistryRecord[],
): CurationEnforcerOption[] {
  const ordered = [...records].sort((left, right) => {
    const byCreatedAt = left.createdAt.localeCompare(right.createdAt);
    return byCreatedAt || left.id.localeCompare(right.id);
  });
  const digits = Math.max(2, String(ordered.length).length);
  return ordered.map((record, index) => ({
    deploymentId: record.id,
    number: index + 1,
    numberLabel: `#${String(index + 1).padStart(digits, "0")}`,
    canonicalName: canonicalName(record),
    createdAt: record.createdAt,
  }));
}

export function curationClaimLabel(claim: Claim): string {
  const object = claim.object.replace(/\s+/g, " ").trim();
  const conciseObject =
    object.length > 88 ? `${object.slice(0, 85).trimEnd()}…` : object;
  return `${claim.predicate} → ${conciseObject}`;
}
