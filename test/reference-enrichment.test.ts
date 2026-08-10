import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildReferenceEnrichmentPlan,
  intuitionAtomIdFromText,
  PROPOSED_ONTOLOGY_MANIFEST,
  type ReferenceMetadataDocument,
} from "../src/index.js";
import type { ReferenceSeedDocument } from "../src/reference-seed.js";

const metadataUrl = new URL(
  "../data/metamask-v1.7.0.metadata.json",
  import.meta.url,
);
const referenceUrl = new URL("../data/metamask-v1.3.0.json", import.meta.url);

async function documents(): Promise<{
  metadata: ReferenceMetadataDocument;
  reference: ReferenceSeedDocument;
}> {
  const [metadata, reference] = await Promise.all([
    readFile(metadataUrl, "utf8"),
    readFile(referenceUrl, "utf8"),
  ]);
  return {
    metadata: JSON.parse(metadata) as ReferenceMetadataDocument,
    reference: JSON.parse(reference) as ReferenceSeedDocument,
  };
}

test("reference enrichment covers all 32 deployments with reviewed evidence", async () => {
  const { metadata, reference } = await documents();
  const plan = buildReferenceEnrichmentPlan(metadata, reference);
  assert.equal(metadata.enforcers.length, 32);
  assert.equal(plan.atoms.length, 202);
  assert.equal(plan.triples.length, 265);
  assert.ok(
    plan.atoms.every(
      (atom) => new TextEncoder().encode(atom.content).length <= 1_000,
    ),
    "every atom must fit MultiVault's 1,000-byte payload limit",
  );
  for (const entry of metadata.enforcers) {
    const triples = plan.triples.filter(
      (triple) => triple.enforcerName === entry.name,
    );
    assert.equal(
      triples.filter((triple) => triple.key.startsWith("restricts:")).length,
      entry.restrictionDomains.length,
    );
    for (const key of [
      "affects-operation",
      "described-by",
      "has-terms-schema",
      "part-of-release",
      "used-by:0",
    ]) {
      assert.equal(
        triples.filter((triple) => triple.key === key).length,
        1,
        `${entry.name} is missing ${key}`,
      );
    }
    assert.equal(
      triples.filter((triple) => triple.key.startsWith("covered-by-audit:"))
        .length,
      entry.audits.length,
    );
    assert.equal(
      triples.filter((triple) => triple.key.startsWith("audited-by:")).length,
      entry.audits.length,
    );
  }
  const withoutExactAudit = metadata.enforcers.filter(
    (entry) => entry.audits.length === 0,
  );
  assert.deepEqual(
    withoutExactAudit.map((entry) => entry.name),
    ["NativeTokenPeriodTransferEnforcer"],
  );
  assert.equal(
    plan.triples.filter((triple) => triple.key.startsWith("covered-by-audit:"))
      .length,
    31,
  );
});

test("oversized terms schemas use verifiable compact documents", async () => {
  const { metadata, reference } = await documents();
  const plan = buildReferenceEnrichmentPlan(metadata, reference);
  const compact = plan.atoms.find(
    (atom) => atom.key === "terms-schema:DeployedEnforcer",
  );
  assert.ok(compact);
  const parsed = JSON.parse(compact.content) as {
    enforcer?: string;
    encoding?: unknown;
    canonicalDocument?: {
      algorithm?: string;
      digest?: string;
      uri?: string;
      jsonPointer?: string;
    };
  };
  assert.equal(parsed.enforcer, "DeployedEnforcer");
  assert.ok(parsed.encoding);
  assert.equal(parsed.canonicalDocument?.algorithm, "keccak256");
  assert.match(parsed.canonicalDocument?.digest ?? "", /^0x[0-9a-f]{64}$/);
  assert.match(
    parsed.canonicalDocument?.uri ?? "",
    /\/ab248bd\/data\/metamask-v1\.7\.0\.metadata\.json$/,
  );
  assert.equal(
    parsed.canonicalDocument?.jsonPointer,
    "/enforcers/6/termsSchema",
  );
});

test("every enrichment predicate ID is derived from its canonical label", () => {
  const labels = {
    hasTermsSchema: "has terms schema",
    restricts: "restricts",
    affectsOperation: "affects operation",
    describedBy: "described by",
    coveredByAudit: "covered by audit",
    auditedBy: "audited by",
    partOfRelease: "part of release",
    usedBy: "used by",
    complements: "complements",
    redundantWith: "redundant with",
    appliesInContext: "applies in context",
    requiresOrdering: "requires ordering",
    supportedBy: "supported by",
  } as const;
  for (const [key, label] of Object.entries(labels)) {
    assert.equal(
      PROPOSED_ONTOLOGY_MANIFEST.predicates[
        key as keyof typeof labels
      ]?.toLowerCase(),
      intuitionAtomIdFromText(label).toLowerCase(),
    );
  }
});

test("reference enrichment rejects incomplete metadata", async () => {
  const { metadata, reference } = await documents();
  assert.throws(
    () =>
      buildReferenceEnrichmentPlan(
        { ...metadata, enforcers: metadata.enforcers.slice(0, 31) },
        reference,
      ),
    /exactly 32/,
  );
});
