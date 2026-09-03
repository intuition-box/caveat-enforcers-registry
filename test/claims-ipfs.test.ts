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

test("drops the raw-JSON twin when an ipfs-backed claim exists", () => {
  const claims = [
    claim({
      subjectId: "0xdep",
      predicateId: "0xterms",
      object: "json object",
      objectData: '{"schemaVersion":"1"}',
    }),
    claim({
      subjectId: "0xdep",
      predicateId: "0xterms",
      object: "AllowedTimeOfDay — terms schema",
      objectData: "ipfs://bafkreiabc",
    }),
  ];
  const result = preferIpfsBackedClaims(claims);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.objectData, "ipfs://bafkreiabc");
});

test("keeps non-ipfs claims for predicates with no ipfs variant", () => {
  const claims = [
    claim({
      subjectId: "0xdep",
      predicateId: "0ximplements",
      object: "AllowedTimeOfDayEnforcer",
      objectData: "AllowedTimeOfDayEnforcer",
    }),
    claim({
      subjectId: "0xdep",
      predicateId: "0xterms",
      object: "json object",
      objectData: '{"schemaVersion":"1"}',
    }),
    claim({
      subjectId: "0xdep",
      predicateId: "0xterms",
      object: "terms schema",
      objectData: "ipfs://bafkreiabc",
    }),
  ];
  const result = preferIpfsBackedClaims(claims);
  // implements (no ipfs variant) survives; the raw terms twin is dropped.
  assert.equal(result.length, 2);
  assert.ok(result.some((c) => c.predicateId === "0ximplements"));
  assert.ok(
    result.every(
      (c) => c.predicateId !== "0xterms" || c.objectData === "ipfs://bafkreiabc",
    ),
  );
});

test("a raw twin under a different subject is not dropped", () => {
  const claims = [
    claim({
      subjectId: "0xA",
      predicateId: "0xterms",
      objectData: "ipfs://bafkreiabc",
    }),
    claim({
      subjectId: "0xB",
      predicateId: "0xterms",
      objectData: '{"schemaVersion":"1"}',
    }),
  ];
  const result = preferIpfsBackedClaims(claims);
  assert.equal(result.length, 2);
});

test("returns the input unchanged when nothing is ipfs-backed", () => {
  const claims = [
    claim({ subjectId: "0xA", predicateId: "0xterms", objectData: "{}" }),
  ];
  assert.deepEqual(preferIpfsBackedClaims(claims), claims);
});
