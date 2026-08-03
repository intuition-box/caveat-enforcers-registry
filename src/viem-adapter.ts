import type { Address, Hex } from "viem";
import type {
  SubmissionWriteAdapter,
  SubmissionWriteTransaction,
} from "./write-workflow.js";
import type { TransactionReceiptCheck } from "./chain.js";

export type ViemAccount = Address | { address: Address };

export type ViemPublicTransactionClient = {
  call: (request: {
    to: Address;
    data: Hex;
    value?: bigint;
    account?: ViemAccount;
  }) => Promise<unknown>;
  waitForTransactionReceipt: (request: {
    hash: Hex;
  }) => Promise<{ status: "success" | "reverted"; blockNumber: bigint }>;
};

export type ViemWalletTransactionClient = {
  account?: ViemAccount | null;
  sendTransaction: (request: {
    account: ViemAccount;
    to: Address;
    data: Hex;
    value?: bigint;
  }) => Promise<Hex>;
};

export type ViemSubmissionWriteAdapterOptions = {
  publicClient: ViemPublicTransactionClient;
  walletClient: ViemWalletTransactionClient;
  account?: ViemAccount;
};

function asAddress(value: string): Address {
  if (!/^0x[a-f0-9]{40}$/i.test(value.trim())) {
    throw new Error("Transaction target must be a valid EVM address.");
  }
  return value.trim().toLowerCase() as Address;
}

function asData(value: string): Hex {
  if (!/^0x(?:[a-f0-9]{2})*$/i.test(value.trim())) {
    throw new Error("Transaction calldata must be even-length hex bytes.");
  }
  return value.trim().toLowerCase() as Hex;
}

function asValue(value: string | undefined): bigint | undefined {
  if (value === undefined) return undefined;
  try {
    const normalized = BigInt(value);
    if (normalized < 0n) throw new Error();
    return normalized;
  } catch {
    throw new Error("Transaction value must be a non-negative integer.");
  }
}

function requestParts(transaction: SubmissionWriteTransaction) {
  return {
    to: asAddress(transaction.request.to),
    data: asData(transaction.request.data),
    value: asValue(transaction.request.value),
  };
}

function hashFromReceipt(transactionHash: string): Hex {
  if (!/^0x[a-f0-9]{64}$/i.test(transactionHash.trim())) {
    throw new Error("Transaction hash must be 32-byte hex.");
  }
  return transactionHash.trim().toLowerCase() as Hex;
}

function accountAddress(account: ViemAccount): Address {
  return typeof account === "string" ? account : account.address;
}

export function createViemSubmissionWriteAdapter(
  options: ViemSubmissionWriteAdapterOptions,
): SubmissionWriteAdapter {
  const account = options.account ?? options.walletClient.account ?? undefined;
  if (!account) {
    throw new Error("A wallet account is required before submitting writes.");
  }

  return {
    simulate: async (request) => {
      await options.publicClient.call({
        to: asAddress(request.to),
        data: asData(request.data),
        value: asValue(request.value),
        account,
      });
    },
    send: async (request) =>
      options.walletClient.sendTransaction({
        account,
        to: asAddress(request.to),
        data: asData(request.data),
        value: asValue(request.value),
      }),
    waitForConfirmation: async (
      transactionHash,
    ): Promise<TransactionReceiptCheck> => {
      const hash = hashFromReceipt(transactionHash);
      try {
        const receipt = await options.publicClient.waitForTransactionReceipt({
          hash,
        });
        if (receipt.status === "success") {
          return {
            status: "confirmed",
            transactionHash: hash,
            blockNumber: receipt.blockNumber.toString(),
          };
        }
        return {
          status: "failed",
          transactionHash: hash,
          message: "The transaction reverted.",
        };
      } catch (error) {
        return {
          status: "error",
          transactionHash: hash,
          message:
            error instanceof Error
              ? error.message
              : "Receipt confirmation failed.",
        };
      }
    },
  };
}

export { accountAddress };
