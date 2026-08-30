import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PROPOSED_ONTOLOGY_MANIFEST } from "../src/ontology.js";
import { buildSubmissionPlan } from "../src/submission.js";
import { validateSubmission } from "../src/validation.js";

const example = JSON.parse(
  readFileSync(
    new URL("../schema/submission.example.json", import.meta.url),
    "utf8",
  ),
);

test("modular additional claims preserve exact predicates in the write plan", () => {
  const validated = validateSubmission(example);
  assert.equal(validated.valid, true);
  if (!validated.valid) return;

  const plan = buildSubmissionPlan(
    validated.value,
    PROPOSED_ONTOLOGY_MANIFEST,
    {
      status: "verified",
      address: validated.value.contractAddress,
      codeLength: 1,
    },
    { status: "verified", expectedChainId: "1155", actualChainId: "1155" },
  );
  const claim = plan.operations.find(
    (operation) => operation.key === "additional-claim:0",
  );
  assert.deepEqual(claim, {
    kind: "create-triple",
    key: "additional-claim:0",
    subject: validated.value.caip10,
    predicateId:
      "0x9df1961750a1787da8ed4a143f23014393a2c63d6a0032766b643b8256e4a8e9",
    object: "Example payroll agent",
    note: "Contributor-supplied used by claim.",
  });
});

test("modular claims reject ambiguous predicates and oversized objects", () => {
  const result = validateSubmission({
    ...example,
    additionalClaims: [
      {
        subject: "deployment",
        predicateId: "used by",
        object: "x".repeat(1_001),
      },
    ],
  });
  assert.equal(result.valid, false);
  if (result.valid) return;
  assert.deepEqual(
    result.issues
      .filter((issue) => issue.path.startsWith("additionalClaims"))
      .map((issue) => issue.path),
    ["additionalClaims[0].predicateId", "additionalClaims[0].object"],
  );
});
