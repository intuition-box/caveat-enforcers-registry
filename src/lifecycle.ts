import type { TransactionReceiptCheck } from "./chain.js";
import type { IndexingStatus } from "./indexing.js";
import type { SubmissionPlan, SubmissionSimulation } from "./submission.js";

export type SubmissionLifecycleState =
  | "blocked"
  | "plan-ready"
  | "simulation-passed"
  | "submitted"
  | "confirmed-onchain"
  | "indexed"
  | "failed";

export type SubmissionSession = {
  state: SubmissionLifecycleState;
  plan: SubmissionPlan;
  simulation?: SubmissionSimulation;
  transactionHash?: string;
  receipt?: TransactionReceiptCheck;
  indexing?: IndexingStatus;
  message: string;
};

export type IntuitionWriteAdapter = {
  simulate: (plan: SubmissionPlan) => Promise<SubmissionSimulation>;
  submit: (plan: SubmissionPlan) => Promise<{ transactionHash: string }>;
};

const transactionHashPattern = /^0x[0-9a-f]{64}$/i;

export function createSubmissionSession(
  plan: SubmissionPlan,
): SubmissionSession {
  return plan.status === "ready-for-simulation"
    ? {
        state: "plan-ready",
        plan,
        message: "Plan is ready for an injected simulator.",
      }
    : {
        state: "blocked",
        plan,
        message:
          "Submission is blocked until ontology configuration and code checks pass.",
      };
}

export function recordSimulation(
  session: SubmissionSession,
  simulation: SubmissionSimulation,
): SubmissionSession {
  if (session.state !== "plan-ready") return session;
  if (simulation.status === "passed") {
    return {
      ...session,
      state: "simulation-passed",
      simulation,
      message: simulation.message,
    };
  }
  return {
    ...session,
    state: simulation.status === "failed" ? "failed" : "blocked",
    simulation,
    message: simulation.message,
  };
}

export function recordSubmission(
  session: SubmissionSession,
  transactionHash: string,
): SubmissionSession {
  if (session.state !== "simulation-passed") return session;
  if (!transactionHashPattern.test(transactionHash.trim())) {
    return {
      ...session,
      state: "failed",
      message:
        "A submitted transaction requires a passed simulation and a valid transaction hash.",
    };
  }
  return {
    ...session,
    state: "submitted",
    transactionHash: transactionHash.trim(),
    message: "Transaction submitted. Waiting for a receipt.",
  };
}

export function recordReceipt(
  session: SubmissionSession,
  receipt: TransactionReceiptCheck,
): SubmissionSession {
  if (session.state !== "submitted") return session;
  if (receipt.status === "confirmed") {
    return {
      ...session,
      state: "confirmed-onchain",
      receipt,
      message: "Receipt confirmed onchain. Waiting for indexer discovery.",
    };
  }
  if (receipt.status === "failed" || receipt.status === "error") {
    return {
      ...session,
      state: "failed",
      receipt,
      message: receipt.message,
    };
  }
  return { ...session, receipt, message: receipt.message };
}

export function recordIndexing(
  session: SubmissionSession,
  indexing: IndexingStatus,
): SubmissionSession {
  if (session.state !== "confirmed-onchain") return session;
  return {
    ...session,
    state: indexing.phase === "indexed" ? "indexed" : "confirmed-onchain",
    indexing,
    message: indexing.message,
  };
}

export async function executeWithAdapter(
  plan: SubmissionPlan,
  adapter: IntuitionWriteAdapter,
): Promise<SubmissionSession> {
  let session = createSubmissionSession(plan);
  if (session.state === "blocked") return session;

  session = recordSimulation(session, await adapter.simulate(plan));
  if (session.state !== "simulation-passed") return session;

  try {
    const result = await adapter.submit(plan);
    return recordSubmission(session, result.transactionHash);
  } catch (error) {
    return {
      ...session,
      state: "failed",
      message:
        error instanceof Error
          ? error.message
          : "Transaction submission failed.",
    };
  }
}
