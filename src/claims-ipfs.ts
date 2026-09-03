import type { Claim } from "./types.js";

/**
 * The IPFS atom migration is additive: when a JSON-valued object atom (terms
 * schema, audit, usage) is re-published as an `ipfs://<CID>` document, the old
 * raw-JSON atom still exists on chain (atoms are immutable), so both produce a
 * claim for the same (subject, predicate). Surface only the ipfs-backed one so
 * the registry never shows an opaque "json object" beside its readable twin.
 *
 * Claims for a (subject, predicate) that has no ipfs-backed variant are left
 * untouched, so predicates that were never migrated are unaffected.
 */
export function preferIpfsBackedClaims(claims: Claim[]): Claim[] {
  const ipfsBackedGroups = new Set<string>();
  for (const claim of claims) {
    if (isIpfsBacked(claim)) ipfsBackedGroups.add(groupKey(claim));
  }
  if (ipfsBackedGroups.size === 0) return claims;
  return claims.filter(
    (claim) => isIpfsBacked(claim) || !ipfsBackedGroups.has(groupKey(claim)),
  );
}

function isIpfsBacked(claim: Claim): boolean {
  return Boolean(claim.objectData?.startsWith("ipfs://"));
}

function groupKey(claim: Claim): string {
  return `${claim.subjectId ?? ""}::${claim.predicateId ?? claim.predicate}`;
}
