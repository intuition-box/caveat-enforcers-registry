import assert from "node:assert/strict";
import test from "node:test";
import { deriveEnforcerPresentation } from "../src/enforcer-presentation.js";

test("derives reviewed presentation metadata for seeded implementations", () => {
  assert.deepEqual(deriveEnforcerPresentation("TimestampEnforcer"), {
    domain: "Time window",
    operation: "Execution eligibility",
    purpose: "Sets a valid time window for execution.",
  });
  assert.deepEqual(deriveEnforcerPresentation("ERC20TransferAmountEnforcer"), {
    domain: "Amount limit",
    operation: "ERC-20 transfer",
    purpose: "Limits cumulative ERC-20 transfer value.",
  });
  assert.deepEqual(deriveEnforcerPresentation("ApprovalRevocationEnforcer"), {
    domain: "Approval revocation",
    operation: "Token approval",
    purpose: "Requires token approvals to be revoked after delegated use.",
  });
});

test("unknown implementations receive conservative presentation metadata", () => {
  assert.deepEqual(deriveEnforcerPresentation("SessionTransferEnforcer"), {
    domain: "Other boundary",
    operation: "Token transfer",
    purpose: "Session Transfer caveat applied to delegated execution.",
  });
});
