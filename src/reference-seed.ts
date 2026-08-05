import {
  PROPOSED_DEPLOYMENT_CLASS_ID,
  PROPOSED_DEPLOYMENT_CLASS_LABEL,
  PROPOSED_ONTOLOGY_MANIFEST,
} from "./ontology.js";
import {
  intuitionAtomIdFromText,
  intuitionTripleIdFromComponents,
} from "./intuition.js";
import { buildCaip10, normalizeEvmAddress } from "./validation.js";
import { stringToHex } from "viem";

export type ReferenceSeedEntry = {
  name: string;
  address: string;
  codeStatus?: string;
};

export type ReferenceSeedDocument = {
  source: {
    repository: string;
  };
  enforcers: ReferenceSeedEntry[];
};

export type ReferenceSeedAtom = {
  key: string;
  content: string;
  data: string;
  id: string;
};

export type ReferenceSeedTriple = {
  key: string;
  enforcerName: string;
  subjectId: string;
  predicateId: string;
  objectId: string;
  tripleId: string;
};

export type ReferenceSeedPlan = {
  chainId: string;
  sourceRepository: string;
  classId: string;
  atoms: ReferenceSeedAtom[];
  triples: ReferenceSeedTriple[];
};

const CHAIN_ID = "1155";
const CHAIN_ATOM = `eip155:${CHAIN_ID}`;
const IMPLEMENTS_PREDICATE = "implements";
const SOURCE_AT_PREDICATE = "source at";

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
  const normalizedContent = requiredText(content, `${key} content`);
  const id = intuitionAtomIdFromText(normalizedContent);
  const existing = atoms.get(id.toLowerCase());
  if (existing) {
    if (existing.content !== normalizedContent) {
      throw new Error(`Atom ID collision detected for ${key}.`);
    }
    return existing;
  }
  const atom = {
    key,
    content: normalizedContent,
    data: stringToHex(normalizedContent),
    id,
  };
  atoms.set(id.toLowerCase(), atom);
  return atom;
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
  const existing = triples.get(tripleId.toLowerCase());
  if (existing) return;
  triples.set(tripleId.toLowerCase(), {
    key,
    enforcerName,
    subjectId: subjectId.toLowerCase(),
    predicateId: predicateId.toLowerCase(),
    objectId: objectId.toLowerCase(),
    tripleId,
  });
}

/**
 * Build the deterministic, minimal launch seed for the 32 MetaMask
 * deployments. The seed intentionally writes identity, implementation,
 * chain, and source claims only; the richer terms/evidence records belong to
 * later reviewed submissions and are not present in the reference dataset.
 */
export function buildReferenceSeedPlan(
  document: ReferenceSeedDocument,
): ReferenceSeedPlan {
  const sourceRepository = requiredText(
    document.source?.repository,
    "source.repository",
  );
  if (!Array.isArray(document.enforcers) || document.enforcers.length !== 32) {
    throw new Error(
      `Expected exactly 32 MetaMask enforcers, received ${document.enforcers?.length ?? 0}.`,
    );
  }

  const atoms = new Map<string, ReferenceSeedAtom>();
  const triples = new Map<string, ReferenceSeedTriple>();
  const names = new Set<string>();
  const addresses = new Set<string>();

  const classAtom = addAtom(
    atoms,
    "ontology-class:deployment",
    PROPOSED_DEPLOYMENT_CLASS_LABEL,
  );
  if (
    classAtom.id.toLowerCase() !== PROPOSED_DEPLOYMENT_CLASS_ID.toLowerCase()
  ) {
    throw new Error(
      "The deployment-class label no longer derives to the declared class ID.",
    );
  }

  const implementsPredicateAtom = addAtom(
    atoms,
    "ontology-predicate:implements",
    IMPLEMENTS_PREDICATE,
  );
  const sourceAtPredicateAtom = addAtom(
    atoms,
    "ontology-predicate:source-at",
    SOURCE_AT_PREDICATE,
  );
  const chainAtom = addAtom(atoms, "chain", CHAIN_ATOM);
  const sourceAtom = addAtom(atoms, "source-url", sourceRepository);

  const membershipPredicate = PROPOSED_ONTOLOGY_MANIFEST.predicates.membership;
  const deployedOnPredicate = PROPOSED_ONTOLOGY_MANIFEST.predicates.deployedOn;
  if (!membershipPredicate || !deployedOnPredicate) {
    throw new Error(
      "The proposed ontology is missing required seed predicates.",
    );
  }

  for (const entry of document.enforcers) {
    const name = requiredText(entry.name, "enforcer.name");
    const address = normalizeEvmAddress(entry.address);
    if (!address) {
      throw new Error(`Invalid EVM address for ${name}.`);
    }
    if (entry.codeStatus && entry.codeStatus !== "observed") {
      throw new Error(`Reference enforcer ${name} has no observed bytecode.`);
    }
    if (names.has(name)) throw new Error(`Duplicate enforcer name: ${name}.`);
    if (addresses.has(address)) {
      throw new Error(`Duplicate enforcer address: ${address}.`);
    }
    names.add(name);
    addresses.add(address);

    const deployment = addAtom(
      atoms,
      `deployment:${name}`,
      buildCaip10(CHAIN_ID, address),
    );
    const type = addAtom(atoms, `enforcer-type:${name}`, name);

    addTriple(
      triples,
      "membership",
      name,
      deployment.id,
      membershipPredicate,
      classAtom.id,
    );
    addTriple(
      triples,
      "implements",
      name,
      deployment.id,
      implementsPredicateAtom.id,
      type.id,
    );
    addTriple(
      triples,
      "deployed-on",
      name,
      deployment.id,
      deployedOnPredicate,
      chainAtom.id,
    );
    addTriple(
      triples,
      "source-at",
      name,
      deployment.id,
      sourceAtPredicateAtom.id,
      sourceAtom.id,
    );
  }

  return {
    chainId: CHAIN_ID,
    sourceRepository,
    classId: classAtom.id,
    atoms: [...atoms.values()],
    triples: [...triples.values()],
  };
}
