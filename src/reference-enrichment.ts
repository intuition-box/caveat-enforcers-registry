import { keccak256, stringToHex } from "viem";
import {
  intuitionAtomIdFromText,
  intuitionTripleIdFromComponents,
} from "./intuition.js";
import { PROPOSED_ONTOLOGY_MANIFEST } from "./ontology.js";
import { canonicalJson } from "./submission.js";
import type {
  ReferenceSeedAtom,
  ReferenceSeedDocument,
  ReferenceSeedTriple,
} from "./reference-seed.js";
import {
  buildCaip10,
  normalizeEvmAddress,
  validateTermsSchema,
  type SubmissionUsageEvidence,
  type TermsSchema,
} from "./validation.js";

export type ReferenceAuditEvidence = {
  auditor: string;
  reportUrl: string;
  repository: string;
  sourceCommit: string;
  scope: string;
  qualification: string;
};

export type ReferenceMetadataEntry = {
  name: string;
  address: string;
  restrictionDomains: string[];
  operation: string;
  purpose: string;
  termsSchema: TermsSchema;
  audits: ReferenceAuditEvidence[];
  usage: SubmissionUsageEvidence[];
};

export type ReferenceMetadataDocument = {
  source: {
    repository: string;
    delegationCoreCommit: string;
    status: string;
  };
  enforcers: ReferenceMetadataEntry[];
};

export type ReferenceEnrichmentPlan = {
  chainId: string;
  sourceRelease: string;
  atoms: ReferenceSeedAtom[];
  triples: ReferenceSeedTriple[];
};

const CHAIN_ID = "1155";
const MAX_ATOM_CONTENT_BYTES = 1_000;
const REFERENCE_METADATA_URI =
  "https://raw.githubusercontent.com/intuition-box/caveat-enforcers-registry/ab248bd/data/metamask-v1.7.0.metadata.json";
const PREDICATE_LABELS = {
  hasTermsSchema: "has terms schema",
  restricts: "restricts",
  affectsOperation: "affects operation",
  describedBy: "described by",
  coveredByAudit: "covered by audit",
  auditedBy: "audited by",
  partOfRelease: "part of release",
  usedBy: "used by",
} as const;

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function addAtom(
  atoms: Map<string, ReferenceSeedAtom>,
  key: string,
  content: string,
): ReferenceSeedAtom {
  const normalized = requiredText(content, `${key} content`);
  const id = intuitionAtomIdFromText(normalized);
  const existing = atoms.get(id.toLowerCase());
  if (existing) {
    if (existing.content !== normalized) {
      throw new Error(`Atom ID collision detected for ${key}.`);
    }
    return existing;
  }
  const atom = {
    key,
    content: normalized,
    data: stringToHex(normalized),
    id,
  };
  atoms.set(id.toLowerCase(), atom);
  return atom;
}

/**
 * MultiVault rejects atom payloads above 1,000 bytes. Preserve smaller terms
 * documents verbatim; for larger documents, publish the complete encoding
 * shape plus a content digest and immutable source pointer to the canonical
 * fixture-rich document. This keeps every graph claim independently
 * verifiable without reducing the human-readable schema shown by clients.
 */
function termsSchemaAtomContent(schema: TermsSchema, index: number): string {
  const complete = canonicalJson(schema);
  if (new TextEncoder().encode(complete).length <= MAX_ATOM_CONTENT_BYTES) {
    return complete;
  }

  const compact = canonicalJson({
    schemaVersion: schema.schemaVersion,
    enforcer: schema.enforcer,
    encoding: schema.encoding,
    canonicalDocument: {
      algorithm: "keccak256",
      digest: keccak256(stringToHex(complete)),
      uri: REFERENCE_METADATA_URI,
      jsonPointer: `/enforcers/${index}/termsSchema`,
    },
  });
  if (new TextEncoder().encode(compact).length > MAX_ATOM_CONTENT_BYTES) {
    throw new Error(
      `Compact terms schema for ${schema.enforcer} exceeds the MultiVault atom limit.`,
    );
  }
  return compact;
}

function addTriple(
  triples: Map<string, ReferenceSeedTriple>,
  key: string,
  enforcerName: string,
  subjectId: string,
  predicateId: string,
  objectId: string,
): void {
  const tripleId = intuitionTripleIdFromComponents(
    subjectId,
    predicateId,
    objectId,
  );
  if (triples.has(tripleId.toLowerCase())) return;
  triples.set(tripleId.toLowerCase(), {
    key,
    enforcerName,
    subjectId: subjectId.toLowerCase(),
    predicateId: predicateId.toLowerCase(),
    objectId: objectId.toLowerCase(),
    tripleId,
  });
}

function requiredPredicate(key: keyof typeof PREDICATE_LABELS): {
  id: string;
  label: string;
} {
  const label = PREDICATE_LABELS[key];
  const id = PROPOSED_ONTOLOGY_MANIFEST.predicates[key];
  if (!id) throw new Error(`Missing ontology predicate: ${key}.`);
  const derived = intuitionAtomIdFromText(label);
  if (derived.toLowerCase() !== id.toLowerCase()) {
    throw new Error(`Ontology predicate ${key} does not match ${label}.`);
  }
  return { id, label };
}

/**
 * Build the reviewed, idempotent enrichment plan for the 32 already-seeded
 * MetaMask deployments. This plan adds source-derived semantics and codec
 * evidence; it never writes an audit claim without an exact external audit.
 */
export function buildReferenceEnrichmentPlan(
  metadata: ReferenceMetadataDocument,
  reference: ReferenceSeedDocument,
): ReferenceEnrichmentPlan {
  if (metadata.enforcers.length !== 32 || reference.enforcers.length !== 32) {
    throw new Error("Reference enrichment requires exactly 32 enforcers.");
  }
  const referenceByName = new Map(
    reference.enforcers.map((entry) => [entry.name, entry]),
  );
  const atoms = new Map<string, ReferenceSeedAtom>();
  const triples = new Map<string, ReferenceSeedTriple>();
  const seenNames = new Set<string>();
  const seenAddresses = new Set<string>();
  const predicates = Object.fromEntries(
    Object.keys(PREDICATE_LABELS).map((key) => [
      key,
      requiredPredicate(key as keyof typeof PREDICATE_LABELS),
    ]),
  ) as Record<keyof typeof PREDICATE_LABELS, { id: string; label: string }>;

  for (const [key, predicate] of Object.entries(predicates)) {
    const atom = addAtom(atoms, `ontology-predicate:${key}`, predicate.label);
    if (atom.id.toLowerCase() !== predicate.id.toLowerCase()) {
      throw new Error(`Derived predicate mismatch for ${key}.`);
    }
  }

  const repository = requiredText(
    metadata.source.repository,
    "source.repository",
  );
  const sourceCommit = requiredText(
    metadata.source.delegationCoreCommit,
    "source.delegationCoreCommit",
  );
  const sourceRelease = `${repository} @ ${sourceCommit}`;
  const releaseAtom = addAtom(atoms, "source-release", sourceRelease);

  for (const [entryIndex, entry] of metadata.enforcers.entries()) {
    const name = requiredText(entry.name, "enforcer.name");
    const address = normalizeEvmAddress(entry.address);
    const referenceEntry = referenceByName.get(name);
    if (!address) throw new Error(`Invalid address for ${name}.`);
    if (!referenceEntry)
      throw new Error(`Unknown reference enforcer: ${name}.`);
    if (normalizeEvmAddress(referenceEntry.address) !== address) {
      throw new Error(`Reference address mismatch for ${name}.`);
    }
    if (seenNames.has(name) || seenAddresses.has(address)) {
      throw new Error(`Duplicate enrichment identity: ${name}.`);
    }
    seenNames.add(name);
    seenAddresses.add(address);
    if (
      !Array.isArray(entry.restrictionDomains) ||
      !entry.restrictionDomains.length
    ) {
      throw new Error(`${name} needs at least one restriction domain.`);
    }
    const schemaIssues = validateTermsSchema(entry.termsSchema);
    if (schemaIssues.length) {
      throw new Error(
        `Invalid terms schema for ${name}: ${schemaIssues[0]?.path} ${schemaIssues[0]?.message}`,
      );
    }
    if (entry.termsSchema.enforcer !== name) {
      throw new Error(`Terms schema identity mismatch for ${name}.`);
    }

    const deployment = addAtom(
      atoms,
      `deployment:${name}`,
      buildCaip10(CHAIN_ID, address),
    );
    const type = addAtom(atoms, `enforcer-type:${name}`, name);
    const operation = addAtom(
      atoms,
      `operation:${entry.operation}`,
      requiredText(entry.operation, `${name}.operation`),
    );
    const purpose = addAtom(
      atoms,
      `description:${name}`,
      requiredText(entry.purpose, `${name}.purpose`),
    );
    const terms = addAtom(
      atoms,
      `terms-schema:${name}`,
      termsSchemaAtomContent(entry.termsSchema, entryIndex),
    );

    for (const domainValue of entry.restrictionDomains) {
      const domain = addAtom(
        atoms,
        `restriction-domain:${domainValue}`,
        requiredText(domainValue, `${name}.restrictionDomains`),
      );
      addTriple(
        triples,
        `restricts:${domain.content}`,
        name,
        type.id,
        predicates.restricts.id,
        domain.id,
      );
    }
    addTriple(
      triples,
      "affects-operation",
      name,
      type.id,
      predicates.affectsOperation.id,
      operation.id,
    );
    addTriple(
      triples,
      "described-by",
      name,
      type.id,
      predicates.describedBy.id,
      purpose.id,
    );
    addTriple(
      triples,
      "has-terms-schema",
      name,
      deployment.id,
      predicates.hasTermsSchema.id,
      terms.id,
    );
    addTriple(
      triples,
      "part-of-release",
      name,
      deployment.id,
      predicates.partOfRelease.id,
      releaseAtom.id,
    );

    if (!Array.isArray(entry.audits)) {
      throw new Error(`${name}.audits must be an array.`);
    }
    for (const [index, audit] of entry.audits.entries()) {
      const normalizedAudit: ReferenceAuditEvidence = {
        auditor: requiredText(audit.auditor, `${name}.audits.${index}.auditor`),
        reportUrl: requiredText(
          audit.reportUrl,
          `${name}.audits.${index}.reportUrl`,
        ),
        repository: requiredText(
          audit.repository,
          `${name}.audits.${index}.repository`,
        ),
        sourceCommit: requiredText(
          audit.sourceCommit,
          `${name}.audits.${index}.sourceCommit`,
        ),
        scope: requiredText(audit.scope, `${name}.audits.${index}.scope`),
        qualification: requiredText(
          audit.qualification,
          `${name}.audits.${index}.qualification`,
        ),
      };
      if (
        !/^https:\/\/github\.com\/MetaMask\/delegation-framework\//i.test(
          normalizedAudit.reportUrl,
        )
      ) {
        throw new Error(
          `${name}.audits.${index}.reportUrl is not an official MetaMask artifact.`,
        );
      }
      if (!/^[0-9a-f]{40}$/i.test(normalizedAudit.sourceCommit)) {
        throw new Error(
          `${name}.audits.${index}.sourceCommit must be a full commit SHA.`,
        );
      }
      if (normalizedAudit.scope !== `src/enforcers/${name}.sol`) {
        throw new Error(
          `${name}.audits.${index}.scope does not match the enforcer.`,
        );
      }
      const auditAtom = addAtom(
        atoms,
        `audit:${name}:${index}`,
        canonicalJson(normalizedAudit),
      );
      const auditorAtom = addAtom(
        atoms,
        `auditor:${normalizedAudit.auditor}`,
        normalizedAudit.auditor,
      );
      addTriple(
        triples,
        `covered-by-audit:${index}`,
        name,
        type.id,
        predicates.coveredByAudit.id,
        auditAtom.id,
      );
      addTriple(
        triples,
        `audited-by:${index}`,
        name,
        auditAtom.id,
        predicates.auditedBy.id,
        auditorAtom.id,
      );
    }

    for (const [index, usage] of entry.usage.entries()) {
      const usageContent = canonicalJson(usage);
      const usageAtom = addAtom(atoms, `usage:${name}:${index}`, usageContent);
      addTriple(
        triples,
        `used-by:${index}`,
        name,
        deployment.id,
        predicates.usedBy.id,
        usageAtom.id,
      );
    }
  }

  if (seenNames.size !== referenceByName.size) {
    throw new Error("Reference metadata does not cover the complete seed set.");
  }
  return {
    chainId: CHAIN_ID,
    sourceRelease,
    atoms: [...atoms.values()],
    triples: [...triples.values()],
  };
}
