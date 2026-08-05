import test from "node:test";
import assert from "node:assert/strict";
import {
  PROPOSED_DEPLOYMENT_CLASS_ID,
  PROPOSED_DEPLOYMENT_CLASS_LABEL,
} from "../src/ontology.js";
import { intuitionAtomIdFromText } from "../src/intuition.js";
import { buildReferenceSeedPlan } from "../src/reference-seed.js";

function fixtureDocument(count = 32) {
  return {
    source: { repository: "https://github.com/MetaMask/smart-accounts-kit" },
    enforcers: Array.from({ length: count }, (_, index) => ({
      name: `Fixture${index}Enforcer`,
      address: `0x${(index + 1).toString(16).padStart(40, "0")}`,
      codeStatus: "observed",
    })),
  };
}

test("reference seed plan contains 32 deployments with deterministic IDs", () => {
  const plan = buildReferenceSeedPlan(fixtureDocument());
  assert.equal(plan.atoms.length, 69);
  assert.equal(plan.triples.length, 128);
  assert.equal(plan.classId, PROPOSED_DEPLOYMENT_CLASS_ID);
  assert.equal(
    plan.classId,
    intuitionAtomIdFromText(PROPOSED_DEPLOYMENT_CLASS_LABEL),
  );
  assert.equal(
    new Set(plan.atoms.map((atom) => atom.id.toLowerCase())).size,
    plan.atoms.length,
  );
  assert.equal(
    new Set(plan.triples.map((triple) => triple.tripleId.toLowerCase())).size,
    plan.triples.length,
  );
  assert.equal(
    plan.triples.filter((triple) => triple.key === "membership").length,
    32,
  );
});

test("reference seed plan fails closed on an incomplete or duplicate dataset", () => {
  assert.throws(
    () => buildReferenceSeedPlan(fixtureDocument(31)),
    /exactly 32/,
  );
  const duplicate = fixtureDocument();
  duplicate.enforcers[1].address = duplicate.enforcers[0].address;
  assert.throws(
    () => buildReferenceSeedPlan(duplicate),
    /Duplicate enforcer address/,
  );
});
