import type { SubmissionExecutionResult } from "../src/backend";

export type SubmissionOutcome = {
  tone: "success" | "progress" | "error";
  title: string;
  message: string;
  transactionHashes: string[];
  confirmedTransactions: number;
  totalTransactions: number;
  indexed: boolean;
  deploymentId: string | null;
};

export function submissionOutcomeFromResult(
  result: SubmissionExecutionResult,
): SubmissionOutcome {
  if (!("execution" in result)) {
    return {
      tone: "error",
      title:
        result.status === "invalid"
          ? "Submission needs changes"
          : "Submission paused",
      message:
        result.status === "invalid"
          ? result.issues
              .map((issue) => `${issue.path}: ${issue.message}`)
              .join("; ")
          : result.message,
      transactionHashes: [],
      confirmedTransactions: 0,
      totalTransactions: 0,
      indexed: false,
      deploymentId: null,
    };
  }

  const transactionHashes = result.execution.transactionHashes;
  const confirmedTransactions = result.receipts.filter(
    (receipt) => receipt.status === "confirmed",
  ).length;
  const totalTransactions = result.resolved.batch.transactions.length;
  const indexed = result.status === "indexed";
  const completeOnchain =
    indexed ||
    result.status === "confirmed-onchain" ||
    result.verification?.status === "verified";
  const failed =
    result.status === "failed" ||
    result.status === "error" ||
    result.status === "blocked";

  return {
    tone: failed ? "error" : completeOnchain ? "success" : "progress",
    title: indexed
      ? "Enforcer listed"
      : completeOnchain
        ? "Confirmed on Intuition"
        : failed
          ? transactionHashes.length
            ? "Submission needs attention"
            : "Submission did not start"
          : "Submission in progress",
    message: indexed
      ? "The registry indexed this deployment and its claims. It is now available in the live registry."
      : completeOnchain
        ? "All registry writes are confirmed onchain. The public index may need a short moment to display the record."
        : result.message,
    transactionHashes,
    confirmedTransactions,
    totalTransactions,
    indexed,
    deploymentId: result.resolved.prepared.plan.deployment,
  };
}
