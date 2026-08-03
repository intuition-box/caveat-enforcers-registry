import { MultiVaultAbi, multiVaultDepositEncode } from "@0xintuition/protocol";
import { type Hex } from "viem";
import { INTUITION_MAINNET_MULTIVAULT } from "./ontology.js";
import { normalizeEvmAddress } from "./validation.js";
import {
  type IntuitionPublicClient,
  type IntuitionTransactionRequest,
  type IntuitionVaultCheck,
  readIntuitionVault,
  verifyIntuitionTriple,
} from "./intuition.js";
import type { TransactionReceiptCheck } from "./chain.js";

export type CurationAction = "support" | "oppose";

export type CurationInput = {
  claimId: string;
  action: CurationAction;
  receiver: string;
  amount: string;
  curveId: string | number;
  minShares?: string | number;
};

export type CurationPlan =
  | {
      status: "ready";
      action: CurationAction;
      claimId: string;
      targetTermId: string;
      receiver: string;
      amount: string;
      curveId: string;
      minShares: string;
      request: IntuitionTransactionRequest;
      warning: string;
    }
  | { status: "blocked" | "error"; message: string };

export type CurationWriteAdapter = {
  simulate: (request: IntuitionTransactionRequest) => Promise<void>;
  send: (request: IntuitionTransactionRequest) => Promise<string>;
  waitForConfirmation?: (
    transactionHash: string,
  ) => Promise<TransactionReceiptCheck>;
};

export type CurationExecution =
  | {
      status: "confirmed" | "submitted" | "pending" | "failed" | "error";
      plan: Extract<CurationPlan, { status: "ready" }>;
      transactionHash: string;
      receipt?: TransactionReceiptCheck;
      vault?: IntuitionVaultCheck;
      message: string;
    }
  | Extract<CurationPlan, { status: "blocked" | "error" }>;

const bytes32Pattern = /^0x[0-9a-f]{64}$/i;

function decimal(value: string | number | undefined, fallback: string) {
  const normalized = value === undefined ? fallback : String(value).trim();
  return /^\d+$/.test(normalized) ? normalized : null;
}

export async function prepareCurationDeposit(
  input: CurationInput,
  publicClient: IntuitionPublicClient,
  options: { multivaultAddress?: string } = {},
): Promise<CurationPlan> {
  const multivaultAddress = normalizeEvmAddress(
    options.multivaultAddress ?? INTUITION_MAINNET_MULTIVAULT,
  );
  if (!multivaultAddress) {
    return { status: "error", message: "MultiVault address is invalid." };
  }
  if (!bytes32Pattern.test(input.claimId.trim())) {
    return {
      status: "error",
      message: "Claim ID must be a 32-byte hex value.",
    };
  }
  if (input.action !== "support" && input.action !== "oppose") {
    return {
      status: "error",
      message: "Curation action must be support or oppose.",
    };
  }
  const receiver = normalizeEvmAddress(input.receiver);
  if (!receiver) {
    return {
      status: "error",
      message: "Receiver must be a valid EVM address.",
    };
  }
  const amount = decimal(input.amount, "0");
  if (!amount || amount === "0") {
    return {
      status: "error",
      message: "Deposit amount must be a positive decimal integer.",
    };
  }
  const curveId = decimal(input.curveId, "");
  if (!curveId) {
    return { status: "error", message: "Curve ID must be a decimal integer." };
  }
  const minShares = decimal(input.minShares, "0");
  if (!minShares) {
    return {
      status: "error",
      message: "Minimum shares must be a decimal integer.",
    };
  }

  const claimId = input.claimId.trim().toLowerCase();
  const triple = await verifyIntuitionTriple(
    publicClient,
    claimId,
    multivaultAddress,
  );
  if (triple.status === "error")
    return { status: "error", message: triple.message };
  if (triple.status === "missing") {
    return {
      status: "blocked",
      message: "The claim is not present in MultiVault yet.",
    };
  }

  let targetTermId = claimId;
  if (input.action === "oppose") {
    try {
      const counterId = await publicClient.readContract({
        address: multivaultAddress,
        abi: MultiVaultAbi,
        functionName: "getCounterIdFromTripleId",
        args: [claimId],
      });
      if (typeof counterId !== "string" || !bytes32Pattern.test(counterId)) {
        return {
          status: "error",
          message: "MultiVault returned an invalid counter-claim ID.",
        };
      }
      targetTermId = counterId.toLowerCase();
    } catch (error) {
      return {
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Counter-claim resolution failed.",
      };
    }
  }

  const request: IntuitionTransactionRequest = {
    to: multivaultAddress,
    data: multiVaultDepositEncode(
      receiver as `0x${string}`,
      targetTermId as Hex,
      BigInt(curveId),
      BigInt(minShares),
    ),
    value: amount,
  };
  return {
    status: "ready",
    action: input.action,
    claimId,
    targetTermId,
    receiver,
    amount,
    curveId,
    minShares,
    request,
    warning:
      "This is an unsigned curation deposit. Simulate it and verify the receipt before presenting the signal as confirmed.",
  };
}

export async function executeCurationDeposit(
  input: CurationInput,
  publicClient: IntuitionPublicClient,
  adapter: CurationWriteAdapter,
  options: { multivaultAddress?: string } = {},
): Promise<CurationExecution> {
  const plan = await prepareCurationDeposit(input, publicClient, options);
  if (plan.status !== "ready") return plan;

  let transactionHash: string;
  try {
    await adapter.simulate(plan.request);
    transactionHash = await adapter.send(plan.request);
  } catch (error) {
    return {
      status: "failed",
      plan,
      transactionHash: "",
      message:
        error instanceof Error ? error.message : "The curation deposit failed.",
    };
  }

  if (!/^0x[0-9a-f]{64}$/i.test(transactionHash.trim())) {
    return {
      status: "failed",
      plan,
      transactionHash: transactionHash.trim(),
      message: "The wallet returned an invalid transaction hash.",
    };
  }
  transactionHash = transactionHash.trim();

  if (!adapter.waitForConfirmation) {
    return {
      status: "submitted",
      plan,
      transactionHash,
      message:
        "The curation deposit was submitted. Attach a receipt confirmer before treating the signal as confirmed.",
    };
  }

  let receipt: TransactionReceiptCheck;
  try {
    receipt = await adapter.waitForConfirmation(transactionHash);
  } catch (error) {
    return {
      status: "error",
      plan,
      transactionHash,
      message:
        error instanceof Error
          ? error.message
          : "Curation receipt confirmation failed.",
    };
  }
  if (receipt.status !== "confirmed") {
    return {
      status:
        receipt.status === "failed" || receipt.status === "error"
          ? "failed"
          : "pending",
      plan,
      transactionHash,
      receipt,
      message: receipt.message,
    };
  }

  const vault = await readIntuitionVault(
    publicClient,
    plan.targetTermId,
    plan.curveId,
    options.multivaultAddress ?? INTUITION_MAINNET_MULTIVAULT,
  );
  if (vault.status !== "verified") {
    return {
      status: vault.status === "error" ? "error" : "pending",
      plan,
      transactionHash,
      receipt,
      vault,
      message:
        vault.status === "error"
          ? vault.message
          : "The receipt is confirmed, but the target vault is not readable yet.",
    };
  }
  return {
    status: "confirmed",
    plan,
    transactionHash,
    receipt,
    vault,
    message:
      "The curation deposit receipt and target MultiVault vault were verified.",
  };
}
