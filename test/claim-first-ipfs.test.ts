import assert from "node:assert/strict";
import test from "node:test";
import { PROPOSED_ONTOLOGY_MANIFEST } from "../src/ontology.ts";
import {
  buildSubmissionPlan,
  collectClaimFirstSubmissionThings,
  createOntologyManifest,
  validateSubmission,
} from "../src/index.ts";
import { prepareAtomDocument } from "../src/pin.ts";

const ADDRESS = "0x1111111111111111111111111111111111111111";
const WALLET = "0x2222222222222222222222222222222222222222";

const submission = {
  version: "2" as const,
  identity: {
    chainId: "1155",
    contractAddress: ADDRESS,
    displayName: "AllowedTimeOfDayEnforcer",
  },
  claims: [
    // Plain-text object → stays a text atom (not pinned).
    {
      subject: { kind: "deployment" as const },
      predicate: {
        kind: "term" as const,
        termId: PROPOSED_ONTOLOGY_MANIFEST.predicates.sourceAt!,
        label: "source at",
      },
      object: {
        kind: "value" as const,
        value: "https://github.com/example/enforcer",
      },
    },
    // JSON-object value → pinned to IPFS.
    {
      subject: { kind: "deployment" as const },
      predicate: { kind: "value" as const, value: "has terms schema" },
      object: {
        kind: "value" as const,
        value: '{"schemaVersion":"1.0.0","encoding":"packed"}',
      },
    },
  ],
  submitterWallet: WALLET,
};

function claimFirstValue() {
  const validated = validateSubmission(submission);
  assert.equal(validated.valid, true);
  if (!validated.valid) throw new Error("fixture invalid");
  const value = validated.value;
  if (!("version" in value)) throw new Error("expected claim-first");
  return value;
}

test("only JSON-object claim objects are collected for pinning", () => {
  const things = collectClaimFirstSubmissionThings(claimFirstValue());
  assert.equal(things.length, 1);
  assert.equal(things[0]!.index, 1); // the second claim, the JSON one
  assert.equal(
    things[0]!.thing.name,
    "AllowedTimeOfDayEnforcer — has terms schema",
  );
});

test("claim-first plan writes an ipfs:// atom for a JSON object claim", () => {
  const value = claimFirstValue();
  const collected = collectClaimFirstSubmissionThings(value);
  const claimObjects = new Map(
    collected.map(({ index, thing }) => [
      index,
      prepareAtomDocument(thing).uri,
    ]),
  );
  const ontology = createOntologyManifest({ version: "1.0.0" });
  const codeCheck = {
    status: "verified" as const,
    address: ADDRESS,
    codeLength: 100,
  };

  const raw = buildSubmissionPlan(value, ontology, codeCheck);
  const pinned = buildSubmissionPlan(value, ontology, codeCheck, undefined, {
    claimObjects,
  });

  const objectAtom = (plan: typeof raw, key: string) =>
    plan.operations.find((op) => op.kind === "ensure-atom" && op.key === key);

  // The JSON claim object is now an ipfs pointer…
  const jsonRaw = objectAtom(raw, "claim-object:1");
  const jsonPinned = objectAtom(pinned, "claim-object:1");
  assert.ok(
    jsonRaw?.kind === "ensure-atom" && jsonPinned?.kind === "ensure-atom",
  );
  assert.match(jsonRaw.content, /^\{/);
  assert.match(jsonPinned.content, /^ipfs:\/\/bafkrei/);

  // …while the plain-text claim object is untouched.
  const textPinned = objectAtom(pinned, "claim-object:0");
  assert.ok(textPinned?.kind === "ensure-atom");
  assert.equal(textPinned.content, "https://github.com/example/enforcer");

  // The triple for the JSON claim points at the ipfs atom too.
  const triple = pinned.operations.find(
    (op) => op.kind === "create-triple" && op.key === "claim:1",
  );
  assert.ok(triple?.kind === "create-triple");
  assert.match(triple.object, /^ipfs:\/\/bafkrei/);
});
