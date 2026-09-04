import {
  buildReferenceEnrichmentPlan,
  collectReferenceEnrichmentThings,
  type ReferenceMetadataDocument,
} from "./reference-enrichment.js";
import type { ReferenceSeedDocument } from "./reference-seed.js";
import { prepareAtomDocument } from "./pin.js";

const JSON_ATOM_FAMILY = /^(terms-schema|audit|usage):/;

/**
 * The exact raw-JSON atom → ipfs-backed atom replacements the IPFS migration
 * performs, derived offline (deterministic CIDs, no network). Keyed and valued
 * by lowercased atom ID.
 *
 * The backend uses this to hide a raw-JSON claim only when its precise ipfs
 * replacement is present — never by a coarse (subject, predicate) match — so
 * multi-valued predicates (multiple audits, multiple usages) and a partially
 * completed migration never drop an unrelated or not-yet-replaced claim.
 */
export function supersededAtomReplacements(
  metadata: ReferenceMetadataDocument,
  reference: ReferenceSeedDocument,
): Map<string, string> {
  const things = collectReferenceEnrichmentThings(metadata);
  const ipfsContent = new Map(
    things.map(({ key, thing }) => [key, prepareAtomDocument(thing).uri]),
  );
  const base = buildReferenceEnrichmentPlan(metadata, reference);
  const migrated = buildReferenceEnrichmentPlan(metadata, reference, {
    ipfsContent,
  });
  const migratedByKey = new Map(
    migrated.atoms.map((atom) => [atom.key, atom.id.toLowerCase()]),
  );
  const replacements = new Map<string, string>();
  for (const atom of base.atoms) {
    if (!JSON_ATOM_FAMILY.test(atom.key)) continue;
    const ipfsId = migratedByKey.get(atom.key);
    if (ipfsId && ipfsId !== atom.id.toLowerCase()) {
      replacements.set(atom.id.toLowerCase(), ipfsId);
    }
  }
  return replacements;
}
