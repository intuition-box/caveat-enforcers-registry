import {
  intuitionAtomIdFromText,
  intuitionTripleIdFromComponents,
} from "./intuition.js";
import { PROPOSED_ONTOLOGY_MANIFEST } from "./ontology.js";

/**
 * Plan builder for the composability relationship seed.
 *
 * Each relationship is expressed as Intuition triples so the community can
 * extend and attest to them over time (not hardcoded UI logic):
 *
 *   [subject enforcer/scope] -> conflicts with | complements -> [object]
 *   [relationship triple]     -> applies in context -> [use-case context]
 *   [relationship triple]     -> requires ordering  -> [ordering note]   (optional)
 *   [relationship triple]     -> supported by       -> [evidence source]
 *
 * Context, ordering, and evidence claims use the relationship triple's own term
 * ID as their subject, so they hang off the exact relationship they describe.
 */

export type ComposabilityRelation = "conflicts" | "complements";

export type ComposabilitySeedRelationship = {
  key: string;
  subjectType: string;
  relation: ComposabilityRelation;
  relatedType: string;
  context: string;
  ordering?: string;
  supportedBy: string;
  evidenceNote?: string;
};

export type ComposabilitySeedDocument = {
  schemaVersion: string;
  chainId: string;
  source: { repository: string };
  relationships: ComposabilitySeedRelationship[];
};

export type SeedAtom = { key: string; text: string; id: string };

export type SeedTriple = {
  key: string;
  role: "relationship" | "context" | "ordering" | "evidence";
  subjectId: string;
  predicateId: string;
  objectId: string;
  tripleId: string;
};

export type ComposabilitySeedPlan = {
  chainId: string;
  /** Text-derived atoms this seed creates when missing. */
  atoms: SeedAtom[];
  /**
   * Atom IDs the triples depend on but that this seed never creates from text
   * (e.g. the existing IPFS-backed `conflicts with` predicate). The runner must
   * verify these exist on-chain before creating any dependent triple.
   */
  requiredExistingAtomIds: string[];
  relationshipTriples: SeedTriple[];
  dependentTriples: SeedTriple[];
};

const PREDICATE_TEXT = {
  complements: "complements",
  appliesInContext: "applies in context",
  requiresOrdering: "requires ordering",
  supportedBy: "supported by",
} as const;

export function buildComposabilitySeedPlan(
  document: ComposabilitySeedDocument,
): ComposabilitySeedPlan {
  const conflictsPredicateId =
    PROPOSED_ONTOLOGY_MANIFEST.predicates.conflictsWith;
  if (!conflictsPredicateId) {
    throw new Error(
      "The proposed ontology is missing the conflicts-with predicate.",
    );
  }
  const requiredExistingAtomIds = new Set<string>();

  const atomsByText = new Map<string, SeedAtom>();
  const ensureAtom = (key: string, text: string): string => {
    const id = intuitionAtomIdFromText(text);
    if (!atomsByText.has(text)) atomsByText.set(text, { key, text, id });
    return id;
  };

  const relationshipTriples: SeedTriple[] = [];
  const dependentTriples: SeedTriple[] = [];

  for (const relationship of document.relationships) {
    const subjectId = ensureAtom(relationship.key, relationship.subjectType);
    const objectId = ensureAtom(relationship.key, relationship.relatedType);
    // The `conflicts with` predicate reuses the existing IPFS-backed mainnet
    // atom rather than minting a duplicate text atom; `complements` is a
    // permissionless text atom this seed creates when absent.
    let relationPredicateId: string;
    if (relationship.relation === "conflicts") {
      relationPredicateId = conflictsPredicateId;
      requiredExistingAtomIds.add(conflictsPredicateId);
    } else {
      relationPredicateId = ensureAtom(
        relationship.key,
        PREDICATE_TEXT.complements,
      );
    }
    const relationshipId = intuitionTripleIdFromComponents(
      subjectId,
      relationPredicateId,
      objectId,
    );
    relationshipTriples.push({
      key: relationship.key,
      role: "relationship",
      subjectId,
      predicateId: relationPredicateId,
      objectId,
      tripleId: relationshipId,
    });

    const contextPredicateId = ensureAtom(
      relationship.key,
      PREDICATE_TEXT.appliesInContext,
    );
    const contextObjectId = ensureAtom(relationship.key, relationship.context);
    dependentTriples.push({
      key: relationship.key,
      role: "context",
      subjectId: relationshipId,
      predicateId: contextPredicateId,
      objectId: contextObjectId,
      tripleId: intuitionTripleIdFromComponents(
        relationshipId,
        contextPredicateId,
        contextObjectId,
      ),
    });

    if (relationship.ordering) {
      const orderingPredicateId = ensureAtom(
        relationship.key,
        PREDICATE_TEXT.requiresOrdering,
      );
      const orderingObjectId = ensureAtom(
        relationship.key,
        relationship.ordering,
      );
      dependentTriples.push({
        key: relationship.key,
        role: "ordering",
        subjectId: relationshipId,
        predicateId: orderingPredicateId,
        objectId: orderingObjectId,
        tripleId: intuitionTripleIdFromComponents(
          relationshipId,
          orderingPredicateId,
          orderingObjectId,
        ),
      });
    }

    const evidencePredicateId = ensureAtom(
      relationship.key,
      PREDICATE_TEXT.supportedBy,
    );
    const evidenceObjectId = ensureAtom(
      relationship.key,
      relationship.supportedBy,
    );
    dependentTriples.push({
      key: relationship.key,
      role: "evidence",
      subjectId: relationshipId,
      predicateId: evidencePredicateId,
      objectId: evidenceObjectId,
      tripleId: intuitionTripleIdFromComponents(
        relationshipId,
        evidencePredicateId,
        evidenceObjectId,
      ),
    });
  }

  return {
    chainId: document.chainId,
    atoms: [...atomsByText.values()],
    requiredExistingAtomIds: [...requiredExistingAtomIds],
    relationshipTriples,
    dependentTriples,
  };
}
