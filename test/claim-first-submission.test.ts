import assert from "node:assert/strict";
import test from "node:test";
import { PROPOSED_ONTOLOGY_MANIFEST } from "../src/ontology.js";
import { buildSubmissionPlan } from "../src/submission.js";
import { validateSubmission } from "../src/validation.js";

const ADDRESS = "0x1111111111111111111111111111111111111111";
const WALLET = "0x2222222222222222222222222222222222222222";

const claimFirstExample = {
  version: "2" as const,
  identity: {
    chainId: "1155",
    contractAddress: ADDRESS,
    displayName: "AllowedTimeOfDayEnforcer",
  },
  claims: [
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
    {
      subject: { kind: "deployment" as const },
      predicate: { kind: "value" as const, value: "useful for payroll" },
      object: { kind: "value" as const, value: "Contributor payroll" },
    },
  ],
  submitterWallet: WALLET,
};

test("claim-first submissions require identity and at least one explicit claim", () => {
  const result = validateSubmission({
    version: "2",
    identity: { chainId: "1155", contractAddress: ADDRESS },
    claims: [],
    submitterWallet: WALLET,
  });
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.equal(result.issues.some((issue) => issue.path === "claims"), true);
});

test("claim-first submissions accept reviewed and readable custom predicates", () => {
  const result = validateSubmission(claimFirstExample);
  assert.equal(result.valid, true);
  if (!result.valid || result.value.version !== "2") return;
  assert.equal(result.value.caip10, `caip10:eip155:1155:${ADDRESS}`);
  assert.equal(result.value.claims.length, 2);
  assert.deepEqual(result.value.claims[1]?.predicate, {
    kind: "value",
    value: "useful for payroll",
  });
});

test("claim-first submissions reject malformed existing term references", () => {
  const result = validateSubmission({
    ...claimFirstExample,
    claims: [
      {
        subject: { kind: "term", termId: "not-a-term" },
        predicate: claimFirstExample.claims[0]!.predicate,
        object: { kind: "term", termId: "also-not-a-term" },
      },
    ],
  });
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.deepEqual(
    result.issues.map((issue) => issue.path),
    ["claims[0].subject.termId", "claims[0].object.termId"],
  );
});

test("claim-first plans contain membership and only contributor-selected semantic claims", () => {
  const validated = validateSubmission(claimFirstExample);
  assert.equal(validated.valid, true);
  if (!validated.valid) return;
  const plan = buildSubmissionPlan(
    validated.value,
    PROPOSED_ONTOLOGY_MANIFEST,
    { status: "verified", address: ADDRESS, codeLength: 1 },
    { status: "verified", expectedChainId: "1155", actualChainId: "1155" },
  );
  const triples = plan.operations.filter(
    (operation) => operation.kind === "create-triple",
  );
  assert.deepEqual(
    triples.map((triple) => triple.key),
    ["membership", "claim:0", "claim:1"],
  );
  assert.equal(
    plan.operations.some((operation) => operation.key === "source-at"),
    false,
  );
  assert.equal(
    plan.operations.some(
      (operation) => operation.key === "has-terms-schema",
    ),
    false,
  );
});

test("claim-first plans create readable custom predicates but retain canonical terms", () => {
  const validated = validateSubmission(claimFirstExample);
  assert.equal(validated.valid, true);
  if (!validated.valid) return;
  const plan = buildSubmissionPlan(
    validated.value,
    PROPOSED_ONTOLOGY_MANIFEST,
    { status: "verified", address: ADDRESS, codeLength: 1 },
    { status: "verified", expectedChainId: "1155", actualChainId: "1155" },
  );
  assert.equal(
    plan.operations.some(
      (operation) =>
        operation.kind === "ensure-atom" &&
        operation.content === "useful for payroll",
    ),
    true,
  );
  assert.equal(
    plan.operations.some(
      (operation) =>
        operation.kind === "ensure-atom" &&
        operation.content === PROPOSED_ONTOLOGY_MANIFEST.predicates.sourceAt,
    ),
    false,
  );
});

export { claimFirstExample };
