import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildReferenceEnrichmentPlan,
  collectReferenceEnrichmentThings,
  intuitionAtomIdFromText,
  type ReferenceMetadataDocument,
} from "../src/index.ts";
import type { ReferenceSeedDocument } from "../src/reference-seed.ts";
import { prepareAtomDocument } from "../src/pin.ts";

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

test("collected Things reproduce the CIDs already pinned on chain", async () => {
  // Guards the atom-content builders against byte drift: this exact CID is the
  // AllowedCalldataEnforcer terms-schema atom created by the live migration.
  const { metadata } = await documents();
  const things = collectReferenceEnrichmentThings(metadata);
  const terms = things.find(
    ({ key }) => key === "terms-schema:AllowedCalldataEnforcer",
  );
  assert.ok(terms, "AllowedCalldataEnforcer terms Thing missing");
  assert.equal(
    prepareAtomDocument(terms!.thing).uri,
    "ipfs://bafkreibbjrqhposf5zpssn3dctgvti3v3h3ofaa274gtkvqz4myamqq6jm",
  );
});

test("collected keys pin exactly the JSON-valued atom families", async () => {
  const { metadata, reference } = await documents();
  const things = collectReferenceEnrichmentThings(metadata);
  assert.ok(things.length > 0);
  // Only terms schema, audit, and usage are collected for pinning.
  const isJsonFamily = (key: string) =>
    /^(terms-schema|audit|usage):/.test(key);
  assert.ok(things.every(({ key }) => isJsonFamily(key)));

  const ipfsContent = new Map(
    things.map(({ key, thing }) => [key, prepareAtomDocument(thing).uri]),
  );
  const migrated = buildReferenceEnrichmentPlan(metadata, reference, {
    ipfsContent,
  });
  // Every JSON-family atom was rewritten to an ipfs:// pointer; every other
  // atom (identity, predicate, chain, source…) is untouched. A drifted key
  // would leave a family atom as raw JSON and trip this.
  for (const atom of migrated.atoms) {
    if (isJsonFamily(atom.key)) {
      assert.match(atom.content, /^ipfs:\/\//, `${atom.key} was not pinned`);
    } else {
      assert.doesNotMatch(
        atom.content,
        /^ipfs:\/\//,
        `${atom.key} unexpectedly became ipfs`,
      );
    }
  }
});

test("ipfsContent rewrites the JSON atoms to ipfs:// pointers deterministically", async () => {
  const { metadata, reference } = await documents();
  const things = collectReferenceEnrichmentThings(metadata);

  // Simulate pinning: derive each Thing's ipfs:// URI offline (no network).
  const ipfsContent = new Map(
    things.map(({ key, thing }) => [key, prepareAtomDocument(thing).uri]),
  );

  const base = buildReferenceEnrichmentPlan(metadata, reference);
  const migrated = buildReferenceEnrichmentPlan(metadata, reference, {
    ipfsContent,
  });

  // Same number of atoms/triples — this is a content swap, not new structure.
  // (Shared usage contexts still deduplicate to one atom, as before.)
  assert.equal(migrated.atoms.length, base.atoms.length);
  assert.equal(migrated.triples.length, base.triples.length);

  // Every distinct pinned Thing resolves to an ipfs-backed atom, keyed by the
  // atom ID derived from its ipfs pointer (robust to shared/deduped atoms).
  const baseIds = new Set(base.atoms.map((a) => a.id.toLowerCase()));
  const seenUri = new Set<string>();
  for (const { thing } of things) {
    const uri = prepareAtomDocument(thing).uri;
    if (seenUri.has(uri)) continue;
    seenUri.add(uri);
    const id = intuitionAtomIdFromText(uri);
    const atom = migrated.atoms.find(
      (a) => a.id.toLowerCase() === id.toLowerCase(),
    );
    assert.ok(atom, `missing migrated atom for ${uri}`);
    assert.equal(atom!.content, uri);
    assert.match(atom!.content, /^ipfs:\/\/bafkrei[a-z2-7]+$/);
    // The ipfs atom is a brand-new identity, never one from the raw-JSON plan.
    assert.ok(
      !baseIds.has(id.toLowerCase()),
      `${uri} collides with a base atom`,
    );
  }

  // Every migrated triple references only atoms present in the migrated plan.
  const migratedIds = new Set(migrated.atoms.map((a) => a.id.toLowerCase()));
  for (const triple of migrated.triples) {
    assert.ok(migratedIds.has(triple.subjectId));
    assert.ok(migratedIds.has(triple.objectId));
  }

  // Terms schema now carries the full payload (no byte-limit truncation).
  const termsThing = things.find(({ key }) =>
    key.startsWith("terms-schema:"),
  )!.thing;
  assert.ok("termsSchema" in termsThing);
});
