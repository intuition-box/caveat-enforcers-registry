import { readFile, writeFile } from "node:fs/promises";
import { concatHex, keccak256, stringToHex } from "viem";

const seedPath = new URL("../data/composability-seed.json", import.meta.url);
const outputPath = new URL(
  "../data/composability-seed.triples.json",
  import.meta.url,
);
const ontologyPath = new URL(
  "../config/ontology.manifest.proposed.json",
  import.meta.url,
);
const atomSalt = keccak256(stringToHex("ATOM_SALT"));
const tripleSalt = keccak256(stringToHex("TRIPLE_SALT"));
const bytes32 = /^0x[0-9a-f]{64}$/i;

function atomId(text) {
  return keccak256(concatHex([atomSalt, keccak256(stringToHex(text))]));
}

function tripleId(subject, predicate, object) {
  if (![subject, predicate, object].every((value) => bytes32.test(value))) {
    throw new Error("Triple components must be 32-byte term IDs.");
  }
  return keccak256(concatHex([tripleSalt, subject, predicate, object]));
}

const seed = JSON.parse(await readFile(seedPath, "utf8"));
const ontology = JSON.parse(await readFile(ontologyPath, "utf8"));
const predicateIds = {
  complements: atomId("complements"),
  conflicts: ontology.predicates.conflictsWith,
};

const triples = seed.relationships.map((relationship) => {
  const subjectId = atomId(relationship.subjectType);
  const objectId = atomId(relationship.relatedType);
  const predicateId = predicateIds[relationship.relation];
  const relationshipId = tripleId(subjectId, predicateId, objectId);
  const contextId = atomId(relationship.context);
  const contextPredicateId = atomId("applies in context");
  const orderingId = relationship.ordering
    ? atomId(relationship.ordering)
    : null;
  const orderingPredicateId = atomId("requires ordering");
  const evidenceId = atomId(relationship.supportedBy);
  const evidencePredicateId = atomId("supported by");

  return {
    key: relationship.key,
    relationship: {
      id: relationshipId,
      subject: { label: relationship.subjectType, id: subjectId },
      predicate: {
        label: relationship.relation === "conflicts" ? "conflicts with" : "complements",
        id: predicateId,
        source:
          relationship.relation === "conflicts"
            ? "proposed ontology mainnet atom"
            : "permissionless derived atom",
      },
      object: { label: relationship.relatedType, id: objectId },
    },
    context: {
      id: tripleId(
        relationshipId,
        contextPredicateId,
        contextId,
      ),
      subjectId: relationshipId,
      predicateId: contextPredicateId,
      object: { label: relationship.context, id: contextId },
    },
    ...(orderingId
      ? {
          ordering: {
            id: tripleId(relationshipId, orderingPredicateId, orderingId),
            subjectId: relationshipId,
            predicateId: orderingPredicateId,
            object: { label: relationship.ordering, id: orderingId },
          },
        }
      : {}),
    evidence: {
      id: tripleId(relationshipId, evidencePredicateId, evidenceId),
      subjectId: relationshipId,
      predicateId: evidencePredicateId,
      object: { label: relationship.supportedBy, id: evidenceId },
    },
    evidenceNote: relationship.evidenceNote,
  };
});

await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      schemaVersion: seed.schemaVersion,
      chainId: seed.chainId,
      status: "canonical-id-plan",
      source: seed.source,
      triples,
    },
    null,
    2,
  )}\n`,
);
console.log(`Wrote ${triples.length} canonical composability relationship plans.`);
