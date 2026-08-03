import {
  decodeFunctionResult,
  encodeFunctionData,
  type AbiFunction,
  type Hex,
} from "viem";
import {
  normalizeEvmAddress,
  type RpcFetcher,
  type TermsSchema,
} from "./validation.js";

export type TermsDecoderCheck =
  | {
      status: "verified";
      address: string;
      functionName: string;
      fixtureIndex: number;
      decoded: Record<string, unknown>;
    }
  | { status: "skipped"; message: string }
  | { status: "error"; address: string; message: string };

type RpcPayload = {
  result?: unknown;
  error?: { message?: string };
};

const defaultRpcFetcher: RpcFetcher = (input, init) => {
  const fetcher = (globalThis as { fetch?: RpcFetcher }).fetch;
  if (!fetcher) {
    return Promise.reject(new Error("A fetch implementation is required."));
  }
  return fetcher(input, init);
};

function canonicalValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && /^0x[0-9a-f]+$/i.test(value)) {
    return value.toLowerCase();
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalValue(nested)]),
    );
  }
  return value;
}

function valuesMatch(expected: unknown, actual: unknown): boolean {
  return (
    JSON.stringify(canonicalValue(expected)) ===
    JSON.stringify(canonicalValue(actual))
  );
}

function decoderAbi(schema: TermsSchema): AbiFunction | null {
  const decoder = schema.decoderFunction;
  if (!decoder) return null;
  return {
    type: "function",
    name: decoder.name,
    stateMutability: "view",
    inputs: decoder.inputs.map((parameter) => ({
      name: parameter.name,
      type: parameter.type,
    })),
    outputs: decoder.outputs.map((parameter) => ({
      name: parameter.name,
      type: parameter.type,
    })),
  };
}

function decoderArgs(
  schema: TermsSchema,
  fixture: TermsSchema["fixtures"][number],
): unknown[] | null {
  const inputs = schema.decoderFunction?.inputs ?? [];
  if (inputs.length === 1 && inputs[0]?.type.trim().toLowerCase() === "bytes") {
    return [fixture.terms.trim()];
  }
  if (Array.isArray(fixture.decoderArgs)) return fixture.decoderArgs;
  return null;
}

export async function verifyTermsDecoder(
  rpcEndpoint: string,
  contractAddress: string,
  schema: TermsSchema,
  fixtureIndex = 0,
  fetcher: RpcFetcher = defaultRpcFetcher,
): Promise<TermsDecoderCheck> {
  const decoder = schema.decoderFunction;
  if (!decoder) {
    return {
      status: "skipped",
      message: "No decoder function was declared in the terms schema.",
    };
  }
  const address = normalizeEvmAddress(contractAddress);
  if (!address) {
    return {
      status: "error",
      address: contractAddress,
      message: "A valid contract address is required for decoder verification.",
    };
  }
  if (!rpcEndpoint.trim()) {
    return {
      status: "error",
      address,
      message: "An RPC endpoint is required for decoder verification.",
    };
  }
  const fixture = schema.fixtures[fixtureIndex];
  if (!fixture) {
    return {
      status: "error",
      address,
      message: `Terms fixture ${fixtureIndex} does not exist.`,
    };
  }
  const abi = decoderAbi(schema);
  const args = decoderArgs(schema, fixture);
  if (!abi || !args) {
    return {
      status: "error",
      address,
      message:
        "Decoder verification needs one bytes input or fixture.decoderArgs.",
    };
  }

  try {
    const data = encodeFunctionData({
      abi: [abi],
      functionName: decoder.name,
      args,
    });
    const response = await fetcher(rpcEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: address, data }, "latest"],
      }),
    });
    if (!response.ok) {
      return {
        status: "error",
        address,
        message: `RPC request failed (${response.status}).`,
      };
    }
    const payload = (await response.json()) as RpcPayload;
    if (payload.error) {
      return {
        status: "error",
        address,
        message: payload.error.message ?? "RPC returned an error.",
      };
    }
    if (
      typeof payload.result !== "string" ||
      !/^0x(?:[0-9a-f]{2})*$/i.test(payload.result)
    ) {
      return {
        status: "error",
        address,
        message: "RPC returned invalid decoder output.",
      };
    }
    const values = decodeFunctionResult({
      abi: [abi],
      functionName: decoder.name,
      data: payload.result as Hex,
    });
    const outputValues = Array.isArray(values) ? values : [values];
    const actual = Object.fromEntries(
      decoder.outputs.map((output, index) => [
        output.name,
        outputValues[index],
      ]),
    );
    if (!fixture.decoded || !valuesMatch(fixture.decoded, actual)) {
      return {
        status: "error",
        address,
        message: `Decoder output does not match fixture ${fixtureIndex}.`,
      };
    }
    return {
      status: "verified",
      address,
      functionName: decoder.name,
      fixtureIndex,
      decoded: actual,
    };
  } catch (error) {
    return {
      status: "error",
      address,
      message:
        error instanceof Error
          ? `Decoder verification failed: ${error.message}`
          : "Decoder verification failed.",
    };
  }
}
