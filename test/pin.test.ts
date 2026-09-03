import assert from "node:assert/strict";
import test from "node:test";
import {
  atomThingJson,
  cidV1Raw,
  prepareAtomDocument,
  pinAtomDocument,
  stableStringify,
} from "../src/pin.ts";

test("cidV1Raw reproduces a live Intuition ipfs atom CID", () => {
  // Live atom 0x0c1d4996… on Intuition mainnet: type Thing, data ipfs://…,
  // label "Gymnothorax griseus". These are the exact bytes it was pinned as.
  const bytes = new TextEncoder().encode(
    '{"@context":"https://schema.org","@type":"Thing","description":"","image":"https://inaturalist-open-data.s3.amazonaws.com/photos/272424276/original.jpg","name":"Gymnothorax griseus","url":""}',
  );
  assert.equal(
    cidV1Raw(bytes),
    "bafkreiho23acckbswn5wmwituztdxosoheab5bdiwiwaubvdfin5fq54pi",
  );
});

test("atomThingJson matches the live atom's canonical byte order", () => {
  // Reconstructing the same Thing from fields must reproduce the exact bytes,
  // proving key ordering is locale-independent and CID-stable.
  const json = atomThingJson({
    name: "Gymnothorax griseus",
    description: "",
    image:
      "https://inaturalist-open-data.s3.amazonaws.com/photos/272424276/original.jpg",
    url: "",
  });
  assert.equal(
    json,
    '{"@context":"https://schema.org","@type":"Thing","description":"","image":"https://inaturalist-open-data.s3.amazonaws.com/photos/272424276/original.jpg","name":"Gymnothorax griseus","url":""}',
  );
  assert.equal(
    cidV1Raw(new TextEncoder().encode(json)),
    "bafkreiho23acckbswn5wmwituztdxosoheab5bdiwiwaubvdfin5fq54pi",
  );
});

test("stableStringify sorts nested keys deterministically", () => {
  assert.equal(
    stableStringify({ b: 1, a: { d: 2, c: 3 } }),
    '{"a":{"c":3,"d":2},"b":1}',
  );
});

test("prepareAtomDocument embeds a structured payload under a named Thing", () => {
  const prepared = prepareAtomDocument({
    name: "Terms schema · AllowedTimeOfDayEnforcer",
    description: "How the encoded caveat terms are interpreted.",
    termsSchema: { fields: [{ name: "start", type: "uint32" }] },
  });
  const parsed = JSON.parse(prepared.json) as Record<string, unknown>;
  assert.equal(parsed["@type"], "Thing");
  assert.equal(parsed.name, "Terms schema · AllowedTimeOfDayEnforcer");
  assert.deepEqual(parsed.termsSchema, {
    fields: [{ name: "start", type: "uint32" }],
  });
  assert.equal(prepared.uri, `ipfs://${prepared.cid}`);
  assert.match(prepared.cid, /^bafkrei[a-z2-7]+$/);
});

test("pinAtomDocument fails closed when a raw CID disagrees with the bytes", async () => {
  await assert.rejects(
    pinAtomDocument({ name: "X" }, async () => ({
      cid: "bafkreiaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    })),
    /does not match the deterministic CID/,
  );
});

test("pinAtomDocument accepts the service CID it actually derives", async () => {
  const prepared = prepareAtomDocument({ name: "X" });
  const result = await pinAtomDocument({ name: "X" }, async () => ({
    cid: prepared.cid,
  }));
  assert.equal(result.uri, `ipfs://${prepared.cid}`);
});

test("pinAtomDocument requires a name", () => {
  assert.throws(() => prepareAtomDocument({ name: "" }), /non-empty name/);
});
