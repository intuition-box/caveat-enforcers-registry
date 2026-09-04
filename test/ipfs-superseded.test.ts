import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { supersededAtomReplacements } from "../src/ipfs-superseded.ts";
import type { ReferenceMetadataDocument } from "../src/reference-enrichment.ts";
import type { ReferenceSeedDocument } from "../src/reference-seed.ts";

async function documents(): Promise<{
  metadata: ReferenceMetadataDocument;
  reference: ReferenceSeedDocument;
}> {
  const [metadata, reference] = await Promise.all([
    readFile(
      new URL("../data/metamask-v1.7.0.metadata.json", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../data/metamask-v1.3.0.json", import.meta.url), "utf8"),
  ]);
  return {
    metadata: JSON.parse(metadata) as ReferenceMetadataDocument,
    reference: JSON.parse(reference) as ReferenceSeedDocument,
  };
}

test("supersededAtomReplacements maps each raw JSON atom to a distinct ipfs atom", async () => {
  const { metadata, reference } = await documents();
  const replacements = supersededAtomReplacements(metadata, reference);

  // One entry per unique JSON-valued atom (matches the migration's 64 docs).
  assert.equal(replacements.size, 64);

  for (const [rawId, ipfsId] of replacements) {
    assert.match(rawId, /^0x[0-9a-f]{64}$/);
    assert.match(ipfsId, /^0x[0-9a-f]{64}$/);
    assert.notEqual(rawId, ipfsId); // the swap always changes the atom identity
  }

  // Raw and ipfs id spaces are disjoint — no raw atom is also a replacement.
  const rawIds = new Set(replacements.keys());
  for (const ipfsId of replacements.values()) {
    assert.ok(!rawIds.has(ipfsId));
  }
});

test("the replacement map is deterministic across runs", async () => {
  const { metadata, reference } = await documents();
  const a = supersededAtomReplacements(metadata, reference);
  const b = supersededAtomReplacements(metadata, reference);
  assert.deepEqual([...a.entries()].sort(), [...b.entries()].sort());
});
