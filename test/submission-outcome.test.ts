import assert from "node:assert/strict";
import test from "node:test";
import { submissionOutcomeFromResult } from "../web/submission-outcome";
import type { SubmissionExecutionResult } from "../src/backend";

const readyResult = {
  status: "ready",
  prepared: { plan: { deployment: "0xdeployment" } },
  batch: { transactions: [{}, {}] },
} as unknown as Extract<
  SubmissionExecutionResult,
  { resolved: unknown }
>["resolved"];

test("indexed submissions produce an explicit persistent success outcome", () => {
  const outcome = submissionOutcomeFromResult({
    status: "indexed",
    resolved: readyResult,
    execution: {
      status: "submitted",
      transactionHashes: ["0xatoms", "0xtriples"],
      nextTransactionIndex: 2,
      message: "submitted",
    },
    receipts: [
      { status: "confirmed", transactionHash: "0xatoms", blockNumber: "1" },
      {
        status: "confirmed",
        transactionHash: "0xtriples",
        blockNumber: "2",
      },
    ],
    verification: {
      status: "verified",
      atoms: [],
      triples: [],
      message: "verified",
    },
    indexing: { phase: "indexed", attempts: 1, message: "indexed" },
    message: "indexed",
  } as SubmissionExecutionResult);

  assert.equal(outcome.tone, "success");
  assert.equal(outcome.title, "Enforcer listed");
  assert.equal(outcome.confirmedTransactions, 2);
  assert.equal(outcome.totalTransactions, 2);
  assert.equal(outcome.indexed, true);
  assert.deepEqual(outcome.transactionHashes, ["0xatoms", "0xtriples"]);
});

test("partial submissions retain transaction evidence and show attention state", () => {
  const outcome = submissionOutcomeFromResult({
    status: "failed",
    resolved: readyResult,
    execution: {
      status: "failed",
      transactionHashes: ["0xatoms"],
      nextTransactionIndex: 1,
      message: "Second wallet request was rejected.",
    },
    receipts: [],
    message: "Second wallet request was rejected.",
  } as SubmissionExecutionResult);

  assert.equal(outcome.tone, "error");
  assert.equal(outcome.title, "Submission needs attention");
  assert.deepEqual(outcome.transactionHashes, ["0xatoms"]);
  assert.equal(outcome.indexed, false);
});
