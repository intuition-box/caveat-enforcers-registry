import assert from "node:assert/strict";
import test from "node:test";
import { preferIpfsBackedClaims } from "../src/claims-ipfs.ts";
import type { Claim } from "../src/types.ts";

function claim(overrides: Partial<Claim>): Claim {
  return {
    predicate: "has terms schema",
    object: "object",
    stake: "0",
    side: "support",
    ...overrides,
  };
}

// raw terms atom 0xraw1 is replaced by ipfs atom 0xipfs1.
const replacements = new Map([["0xraw1", "0xipfs1"]]);

test("drops the raw twin only when its ipfs replacement is present", () => {
  const claims = [
    claim({ objectId: "0xraw1", object: "json object", objectData: "{}" }),
    claim({
      objectId: "0xipfs1",
      object: "terms schema",
      objectData: "ipfs://bafkreiabc",
    }),
  ];
  const result = preferIpfsBackedClaims(claims, replacements);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.objectId, "0xipfs1");
});

test("keeps the raw claim when its replacement is not yet on chain", () => {
  // Partial migration: the ipfs replacement hasn't been written, so the raw
  // claim must stay visible rather than vanish.
  const claims = [
    claim({ objectId: "0xraw1", object: "json object", objectData: "{}" }),
  ];
  const result = preferIpfsBackedClaims(claims, replacements);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.objectId, "0xraw1");
});

test("never drops an unrelated claim under the same subject/predicate", () => {
  // A second, non-migrated audit under the same predicate must survive even
  // though a sibling has an ipfs replacement present.
  const claims = [
    claim({ objectId: "0xraw1", objectData: "{}" }), // migrated raw
    claim({ objectId: "0xipfs1", objectData: "ipfs://bafkreiabc" }), // its twin
    claim({ objectId: "0xotheraudit", objectData: "{}" }), // unrelated, not migrated
  ];
  const result = preferIpfsBackedClaims(claims, replacements);
  assert.equal(result.length, 2);
  assert.ok(result.some((c) => c.objectId === "0xipfs1"));
  assert.ok(result.some((c) => c.objectId === "0xotheraudit"));
  assert.ok(!result.some((c) => c.objectId === "0xraw1"));
});

test("matches replacement ids case-insensitively", () => {
  const claims = [
    claim({ objectId: "0xRAW1", objectData: "{}" }),
    claim({ objectId: "0xIPFS1", objectData: "ipfs://bafkreiabc" }),
  ];
  const result = preferIpfsBackedClaims(claims, replacements);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.objectId, "0xIPFS1");
});

test("returns the input unchanged when there are no replacements", () => {
  const claims = [claim({ objectId: "0xraw1", objectData: "{}" })];
  assert.deepEqual(preferIpfsBackedClaims(claims, new Map()), claims);
});
