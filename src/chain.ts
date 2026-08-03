import { normalizeChainId, type RpcFetcher } from "./validation.js";

export type RpcChainCheck =
  | { status: "verified"; expectedChainId: string; actualChainId: string }
  | { status: "mismatch"; expectedChainId: string; actualChainId: string }
  | { status: "error"; expectedChainId: string; message: string };

export type TransactionReceiptCheck =
  | {
      status: "confirmed";
      transactionHash: string;
      blockNumber: string;
    }
  | { status: "failed"; transactionHash: string; message: string }
  | { status: "pending"; transactionHash: string; message: string }
  | { status: "error"; transactionHash: string; message: string };

type RpcPayload = {
  result?: unknown;
  error?: { message?: string };
};

async function rpcCall(
  endpoint: string,
  method: string,
  params: unknown[],
  fetcher: RpcFetcher,
): Promise<{ ok: true; result: unknown } | { ok: false; message: string }> {
  try {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!response.ok)
      return { ok: false, message: `RPC request failed (${response.status}).` };
    const payload = (await response.json()) as RpcPayload;
    if (payload.error)
      return {
        ok: false,
        message: payload.error.message ?? "RPC returned an error.",
      };
    return { ok: true, result: payload.result };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "RPC request failed.",
    };
  }
}

const defaultRpcFetcher: RpcFetcher = (input, init) => {
  const fetcher = (globalThis as { fetch?: RpcFetcher }).fetch;
  if (!fetcher)
    return Promise.reject(new Error("A fetch implementation is required."));
  return fetcher(input, init);
};

export async function verifyRpcChainId(
  rpcEndpoint: string,
  expectedChainId: string | number,
  fetcher: RpcFetcher = defaultRpcFetcher,
): Promise<RpcChainCheck> {
  const expected = normalizeChainId(expectedChainId) ?? String(expectedChainId);
  if (!rpcEndpoint.trim()) {
    return {
      status: "error",
      expectedChainId: expected,
      message: "An RPC endpoint is required.",
    };
  }
  const response = await rpcCall(rpcEndpoint, "eth_chainId", [], fetcher);
  if (!response.ok)
    return {
      status: "error",
      expectedChainId: expected,
      message: response.message,
    };
  if (
    typeof response.result !== "string" ||
    !/^0x[0-9a-f]+$/i.test(response.result)
  ) {
    return {
      status: "error",
      expectedChainId: expected,
      message: "RPC returned an invalid chain ID.",
    };
  }
  const actual = String(parseInt(response.result, 16));
  return actual === expected
    ? { status: "verified", expectedChainId: expected, actualChainId: actual }
    : { status: "mismatch", expectedChainId: expected, actualChainId: actual };
}

export async function verifyTransactionReceipt(
  rpcEndpoint: string,
  transactionHash: string,
  fetcher: RpcFetcher = defaultRpcFetcher,
): Promise<TransactionReceiptCheck> {
  if (!/^0x[0-9a-f]{64}$/i.test(transactionHash.trim())) {
    return {
      status: "error",
      transactionHash,
      message: "Transaction hash must be 32-byte hex.",
    };
  }
  if (!rpcEndpoint.trim()) {
    return {
      status: "error",
      transactionHash,
      message: "An RPC endpoint is required.",
    };
  }

  const response = await rpcCall(
    rpcEndpoint,
    "eth_getTransactionReceipt",
    [transactionHash.trim()],
    fetcher,
  );
  if (!response.ok)
    return { status: "error", transactionHash, message: response.message };
  if (response.result === null) {
    return {
      status: "pending",
      transactionHash,
      message: "The transaction is not mined yet.",
    };
  }

  if (!response.result || typeof response.result !== "object") {
    return {
      status: "error",
      transactionHash,
      message: "RPC returned an invalid receipt.",
    };
  }

  const receipt = response.result as {
    status?: unknown;
    blockNumber?: unknown;
  };
  if (receipt.status === "0x1") {
    return {
      status: "confirmed",
      transactionHash,
      blockNumber:
        typeof receipt.blockNumber === "string"
          ? receipt.blockNumber
          : "unknown",
    };
  }
  if (receipt.status === "0x0") {
    return {
      status: "failed",
      transactionHash,
      message: "The transaction reverted.",
    };
  }
  return {
    status: "error",
    transactionHash,
    message: "Receipt status was not recognized.",
  };
}
