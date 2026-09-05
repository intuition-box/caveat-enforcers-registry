import assert from "node:assert/strict";
import test from "node:test";
import {
  CLAIM_TEMPLATES,
  claimFirstInputFromWizard,
  initialSubmitWizardState,
  legacySubmissionClaims,
  submitWizardReducer,
} from "../web/submit-wizard.js";

const identity = {
  chainId: "1155",
  contractAddress: "0x1111111111111111111111111111111111111111",
  displayName: "AllowedTimeOfDayEnforcer",
};

test("the wizard advances identity through a repeatable claim loop to review", () => {
  let state = initialSubmitWizardState();
  state = submitWizardReducer(state, { type: "identity-verified", identity });
  assert.equal(state.panel, "claim-choice");
  state = submitWizardReducer(state, {
    type: "choose-predicate",
    templateKey: "source",
  });
  assert.equal(state.panel, "claim-details");
  state = submitWizardReducer(state, {
    type: "update-draft",
    patch: { objectValue: "https://github.com/example/enforcer" },
  });
  state = submitWizardReducer(state, { type: "preview-claim" });
  assert.equal(state.panel, "claim-confirm");
  state = submitWizardReducer(state, { type: "confirm-claim" });
  assert.equal(state.panel, "claim-saved");
  assert.equal(state.claims.length, 1);
  state = submitWizardReducer(state, { type: "review" });
  assert.equal(state.panel, "review");
});

test("saved claims can be edited and removed without changing identity", () => {
  let state = initialSubmitWizardState(identity);
  for (const [templateKey, objectValue] of [
    ["source", "https://github.com/example/enforcer"],
    ["purpose", "Limits execution to business hours"],
  ] as const) {
    state = submitWizardReducer(state, {
      type: "choose-predicate",
      templateKey,
    });
    state = submitWizardReducer(state, {
      type: "update-draft",
      patch: { objectValue },
    });
    state = submitWizardReducer(state, { type: "preview-claim" });
    state = submitWizardReducer(state, { type: "confirm-claim" });
    state = submitWizardReducer(state, { type: "add-another" });
  }
  const firstId = state.claims[0]!.id;
  state = submitWizardReducer(state, { type: "edit-claim", id: firstId });
  assert.equal(state.panel, "claim-details");
  state = submitWizardReducer(state, {
    type: "update-draft",
    patch: { objectValue: "https://github.com/example/enforcer/tree/v1" },
  });
  state = submitWizardReducer(state, { type: "preview-claim" });
  state = submitWizardReducer(state, { type: "confirm-claim" });
  assert.equal(state.claims[0]!.objectValue.endsWith("/v1"), true);
  state = submitWizardReducer(state, { type: "remove-claim", id: firstId });
  assert.equal(state.claims.length, 1);
  assert.deepEqual(state.identity, identity);
});

test("custom predicates and visible claims produce version two input", () => {
  let state = initialSubmitWizardState(identity);
  state = submitWizardReducer(state, {
    type: "choose-predicate",
    templateKey: "custom",
  });
  state = submitWizardReducer(state, {
    type: "update-draft",
    patch: {
      predicateLabel: "useful for payroll",
      objectValue: "Contributor payroll",
    },
  });
  state = submitWizardReducer(state, { type: "preview-claim" });
  state = submitWizardReducer(state, { type: "confirm-claim" });
  const input = claimFirstInputFromWizard(
    state,
    "0x2222222222222222222222222222222222222222",
  );
  assert.equal(input.version, "2");
  assert.deepEqual(input.claims[0]!.predicate, {
    kind: "value",
    value: "useful for payroll",
  });
  assert.equal(input.claims.length, 1);
});

test("legacy submission fields become visible editable claim drafts", () => {
  const claims = legacySubmissionClaims({
    enforcerName: "AllowedTimeOfDayEnforcer",
    description: "Limits calls by local time",
    sourceUrl: "https://github.com/example/enforcer",
    restrictionDomain: "Time window",
    operation: "Delegated contract call",
    termsSchema: { schemaVersion: "1" },
  });
  assert.deepEqual(
    claims.map((claim) => claim.templateKey),
    ["type", "purpose", "source", "restriction", "operation", "terms"],
  );
});

test("the reviewed predicate catalogue contains no mandatory template", () => {
  assert.equal(
    CLAIM_TEMPLATES.every((template) => !template.required),
    true,
  );
  assert.equal(
    CLAIM_TEMPLATES.some((template) => template.key === "deployer"),
    true,
  );
  assert.equal(
    CLAIM_TEMPLATES.some((template) => template.key === "composability"),
    true,
  );
});
