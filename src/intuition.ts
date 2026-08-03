import {
  MultiVaultAbi,
  multiVaultCreateAtomsEncode,
  multiVaultCreateTriplesEncode,
} from "@0xintuition/protocol";
import { concatHex, keccak256, stringToHex } from "viem";
import { INTUITION_MAINNET_MULTIVAULT } from "./ontology.js";

export type IntuitionPublicClient = {
  readContract: (request: {
    address: string;
    abi: typeof MultiVaultAbi;
    functionName: string;
    args: readonly unknown[];
  }) => Promise<unknown>;
};

export type IntuitionTransactionRequest = {
  to: string;
  data: string;
  value?: string;
};

export type IntuitionTermCheck =
  | { status: "verified"; termId: string; data: string }
  | { status: "missing"; termId: string }
  | { status: "error"; termId: string; message: string };

export type IntuitionTripleCheck =
  | {
      status: "verified";
      tripleId: string;
      subjectId: string;
      predicateId: string;
      objectId: string;
    }
  | { status: "missing"; tripleId: string }
  | { status: "error"; tripleId: string; message: string };

export type IntuitionVaultCheck =
  | {
      status: "verified";
      termId: string;
      curveId: string;
      totalAssets: string;
      totalShares: string;
    }
  | { status: "error"; termId: string; curveId: string; message: string };

const bytes32Pattern = /^0x[0-9a-f]{64}$/i;
const bytesPattern = /^0x(?:[0-9a-f]{2})*$/i;
type Hex = `0x${string}`;

// MultiVaultCore derives term IDs with domain-separated salts. These are
// part of the deployed protocol, so a plain keccak256(data) is not a valid
// atom ID and a plain hash of the three components is not a valid triple ID.
const ATOM_SALT = keccak256(stringToHex("ATOM_SALT"));
const TRIPLE_SALT = keccak256(stringToHex("TRIPLE_SALT"));

export function intuitionAtomIdFromData(data: string): string {
  const normalized = normalizeBytes(data);
  if (!normalized) {
    throw new Error("Atom data must be even-length 0x-prefixed bytes.");
  }
  return keccak256(concatHex([ATOM_SALT, keccak256(normalized)]));
}

export function intuitionAtomIdFromText(text: string): string {
  return intuitionAtomIdFromData(stringToHex(text));
}

export function intuitionTripleIdFromComponents(
  subjectId: string,
  predicateId: string,
  objectId: string,
): string {
  const ids = [subjectId, predicateId, objectId].map(normalizeBytes32);
  if (ids.some((value) => value === null)) {
    throw new Error("Triple components must be 32-byte hex values.");
  }
  return keccak256(concatHex([TRIPLE_SALT, ...(ids as Hex[])]));
}

function normalizeBytes32(value: string): Hex | null {
  const normalized = value.trim().toLowerCase();
  return bytes32Pattern.test(normalized) ? (normalized as Hex) : null;
}

function normalizeBytes(value: string): Hex | null {
  const normalized = value.trim().toLowerCase();
  return bytesPattern.test(normalized) ? (normalized as Hex) : null;
}

function transactionAddress(address?: string): string {
  const candidate = (address ?? INTUITION_MAINNET_MULTIVAULT).trim();
  if (!/^0x[0-9a-f]{40}$/i.test(candidate)) {
    throw new Error("MultiVault address must be a valid EVM address.");
  }
  return candidate.toLowerCase();
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Onchain read failed.";
}

export async function verifyIntuitionTerm(
  publicClient: IntuitionPublicClient,
  termId: string,
  address = INTUITION_MAINNET_MULTIVAULT,
): Promise<IntuitionTermCheck> {
  const normalized = normalizeBytes32(termId);
  if (!normalized) {
    return {
      status: "error",
      termId,
      message: "Term ID must be a 32-byte hex value.",
    };
  }

  try {
    const created = await publicClient.readContract({
      address,
      abi: MultiVaultAbi,
      functionName: "isTermCreated",
      args: [normalized],
    });
    if (created !== true) return { status: "missing", termId: normalized };

    const data = await publicClient.readContract({
      address,
      abi: MultiVaultAbi,
      functionName: "getAtom",
      args: [normalized],
    });
    if (typeof data !== "string" || !bytesPattern.test(data)) {
      return {
        status: "error",
        termId: normalized,
        message: "MultiVault returned invalid atom data.",
      };
    }
    const derivedTermId = intuitionAtomIdFromData(data);
    if (derivedTermId.toLowerCase() !== normalized.toLowerCase()) {
      return {
        status: "error",
        termId: normalized,
        message: "MultiVault atom data does not match the requested term ID.",
      };
    }
    return { status: "verified", termId: normalized, data };
  } catch (error) {
    return { status: "error", termId: normalized, message: readError(error) };
  }
}

export async function verifyIntuitionTriple(
  publicClient: IntuitionPublicClient,
  tripleId: string,
  address = INTUITION_MAINNET_MULTIVAULT,
): Promise<IntuitionTripleCheck> {
  const normalized = normalizeBytes32(tripleId);
  if (!normalized) {
    return {
      status: "error",
      tripleId,
      message: "Triple ID must be a 32-byte hex value.",
    };
  }

  try {
    const result = await publicClient.readContract({
      address,
      abi: MultiVaultAbi,
      functionName: "getTriple",
      args: [normalized],
    });
    if (!Array.isArray(result) || result.length !== 3) {
      return {
        status: "error",
        tripleId: normalized,
        message: "MultiVault returned invalid triple components.",
      };
    }
    const ids = result.map((value) =>
      typeof value === "string" ? normalizeBytes32(value) : null,
    );
    if (ids.some((value) => value === null)) {
      return {
        status: "error",
        tripleId: normalized,
        message: "MultiVault returned invalid triple IDs.",
      };
    }
    if (ids.every((value) => value === "0x" + "0".repeat(64))) {
      return { status: "missing", tripleId: normalized };
    }
    const derivedTripleId = intuitionTripleIdFromComponents(
      ids[0]!,
      ids[1]!,
      ids[2]!,
    );
    if (derivedTripleId.toLowerCase() !== normalized.toLowerCase()) {
      return {
        status: "error",
        tripleId: normalized,
        message:
          "MultiVault triple components do not match the requested triple ID.",
      };
    }
    return {
      status: "verified",
      tripleId: normalized,
      subjectId: ids[0]!,
      predicateId: ids[1]!,
      objectId: ids[2]!,
    };
  } catch (error) {
    return { status: "error", tripleId: normalized, message: readError(error) };
  }
}

export async function readIntuitionVault(
  publicClient: IntuitionPublicClient,
  termId: string,
  curveId: string | bigint,
  address = INTUITION_MAINNET_MULTIVAULT,
): Promise<IntuitionVaultCheck> {
  const normalized = normalizeBytes32(termId);
  const normalizedCurve = String(curveId).trim();
  if (!normalized || !/^\d+$/.test(normalizedCurve)) {
    return {
      status: "error",
      termId,
      curveId: normalizedCurve,
      message: "Term ID and curve ID must be valid values.",
    };
  }

  try {
    const result = await publicClient.readContract({
      address,
      abi: MultiVaultAbi,
      functionName: "getVault",
      args: [normalized, BigInt(normalizedCurve)],
    });
    if (!Array.isArray(result) || result.length !== 2) {
      return {
        status: "error",
        termId: normalized,
        curveId: normalizedCurve,
        message: "MultiVault returned invalid vault state.",
      };
    }
    const values = result.map((value) =>
      typeof value === "bigint" || typeof value === "string"
        ? String(value)
        : null,
    );
    if (values.some((value) => value === null)) {
      return {
        status: "error",
        termId: normalized,
        curveId: normalizedCurve,
        message: "MultiVault returned non-numeric vault state.",
      };
    }
    return {
      status: "verified",
      termId: normalized,
      curveId: normalizedCurve,
      totalAssets: values[0]!,
      totalShares: values[1]!,
    };
  } catch (error) {
    return {
      status: "error",
      termId: normalized,
      curveId: normalizedCurve,
      message: readError(error),
    };
  }
}

export function encodeCreateAtoms(
  data: string[],
  assets: Array<string | bigint>,
  options: { value?: string; address?: string } = {},
): IntuitionTransactionRequest {
  if (!data.length || data.length !== assets.length) {
    throw new Error(
      "Atom data and asset arrays must be non-empty and aligned.",
    );
  }
  const normalized = data.map(normalizeBytes);
  if (normalized.some((value) => value === null)) {
    throw new Error("Atom data must be even-length 0x-prefixed bytes.");
  }
  const assetValues = assets.map((value) => BigInt(value));
  return {
    to: transactionAddress(options.address),
    data: multiVaultCreateAtomsEncode(normalized as Hex[], assetValues),
    ...(options.value === undefined ? {} : { value: options.value }),
  };
}

export function encodeCreateTriples(
  subjectIds: string[],
  predicateIds: string[],
  objectIds: string[],
  assets: Array<string | bigint>,
  options: { value?: string; address?: string } = {},
): IntuitionTransactionRequest {
  if (
    !subjectIds.length ||
    subjectIds.length !== predicateIds.length ||
    subjectIds.length !== objectIds.length ||
    subjectIds.length !== assets.length
  ) {
    throw new Error(
      "Triple ID and asset arrays must be non-empty and aligned.",
    );
  }
  const normalized = [subjectIds, predicateIds, objectIds].map((ids) =>
    ids.map(normalizeBytes32),
  );
  if (normalized.some((ids) => ids.some((value) => value === null))) {
    throw new Error("Triple IDs must be 32-byte hex values.");
  }
  const assetValues = assets.map((value) => BigInt(value));
  return {
    to: transactionAddress(options.address),
    data: multiVaultCreateTriplesEncode(
      normalized[0] as Hex[],
      normalized[1] as Hex[],
      normalized[2] as Hex[],
      assetValues,
    ),
    ...(options.value === undefined ? {} : { value: options.value }),
  };
}
