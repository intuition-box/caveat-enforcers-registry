import type { Claim } from "./types.js";

/**
 * Hide a raw-JSON object atom only when its exact ipfs-backed replacement is
 * present in the same claim set. `replacements` maps a superseded raw atom ID
 * to the ipfs atom ID that replaces it (both lowercased); see
 * supersededAtomReplacements.
 *
 * Matching on the precise replacement — never a coarse (subject, predicate)
 * group — means multi-valued predicates (an enforcer with several audits or
 * usage contexts) and a partially completed migration never drop an unrelated
 * claim or one whose replacement is not yet on chain.
 */
export function preferIpfsBackedClaims(
  claims: Claim[],
  replacements: ReadonlyMap<string, string> = new Map(),
): Claim[] {
  if (replacements.size === 0) return claims;
  const presentObjectIds = new Set(
    claims
      .map((claim) => claim.objectId?.toLowerCase())
      .filter((id): id is string => Boolean(id)),
  );
  return claims.filter((claim) => {
    const objectId = claim.objectId?.toLowerCase();
    if (!objectId) return true;
    const replacement = replacements.get(objectId);
    // Drop this raw claim only when its specific ipfs replacement is visible.
    return !(replacement && presentObjectIds.has(replacement));
  });
}
