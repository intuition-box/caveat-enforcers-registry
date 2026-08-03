import {
  INTUITION_MAINNET_MULTIVAULT,
  type OntologyManifest,
} from "./ontology.js";
import {
  encodeCreateAtoms,
  encodeCreateTriples,
  intuitionAtomIdFromText,
  intuitionTripleIdFromComponents,
  type IntuitionPublicClient,
  type IntuitionTransactionRequest,
  verifyIntuitionTerm,
  verifyIntuitionTriple,
} from "./intuition.js";
import type { TransactionReceiptCheck } from "./chain.js";
import { stringToHex } from "viem";
import type { SubmissionPlan, SubmissionPlanOperation } from "./submission.js";
import { normalizeEvmAddress } from "./validation.js";

export type SubmissionAtomResolution = {
  key: string;
  content: string;
  data: string;
  id: string;
  exists: boolean;
};

export type SubmissionTripleResolution = {
  key: string;
  subjectId: string;
  predicateId: string;
  objectId: string;
  tripleId: string;
  exists: boolean;
};

export type SubmissionResolution =
  | {
      status: "ready";
      atoms: SubmissionAtomResolution[];
      triples: SubmissionTripleResolution[];
      initialSignal: string;
      missingConfiguredTermIds: string[];
      warning: string;
    }
  | { status: "blocked"; message: string; missingConfiguredTermIds: string[] }
  | { status: "error"; message: string };

export type SubmissionWriteTransaction = {
  kind: "create-atoms" | "create-triples";
  request: IntuitionTransactionRequest;
  atomIds?: string[];
  tripleIds?: string[];
  dependsOn?: "create-atoms";
};

export type SubmissionWriteBatch =
  | {
      status: "ready";
      transactions: SubmissionWriteTransaction[];
      finalTripleIds: string[];
      warning: string;
    }
  | { status: "blocked"; message: string };

export type SubmissionWriteExecution =
  | {
      status: "submitted";
      transactionHashes: string[];
      nextTransactionIndex: number;
      message: string;
    }
  | {
      status: "blocked" | "failed";
      transactionHashes: string[];
      nextTransactionIndex: number;
      message: string;
    };

export type SubmissionOnchainVerification =
  | {
      status: "verified";
      atoms: SubmissionAtomResolution[];
      triples: SubmissionTripleResolution[];
      message: string;
    }
  | {
      status: "pending";
      missingAtomIds: string[];
      missingTripleIds: string[];
      message: string;
    }
  | { status: "error"; message: string };

export type SubmissionWriteAdapter = {
  simulate: (request: IntuitionTransactionRequest) => Promise<void>;
  send: (request: IntuitionTransactionRequest) => Promise<string>;
  waitForConfirmation?: (
    transactionHash: string,
  ) => Promise<TransactionReceiptCheck>;
};

export type SubmissionWriteOptions = {
  multivaultAddress?: string;
  atomAsset?: string | bigint;
  tripleAsset?: string | bigint;
  atomValue?: string;
  tripleValue?: string;
};

function nonNegativeInteger(
  value: string | bigint | undefined,
  label: string,
): string | null {
  if (value === undefined) return null;
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) {
    return `${label} must be a decimal integer.`;
  }
  try {
    const normalized = BigInt(value);
    return normalized >= 0n ? null : `${label} must be non-negative.`;
  } catch {
    return `${label} must be a decimal integer.`;
  }
}

function validateWriteOptions(options: SubmissionWriteOptions): string | null {
  if (
    options.multivaultAddress !== undefined &&
    !normalizeEvmAddress(options.multivaultAddress)
  ) {
    return "MultiVault address must be a valid EVM address.";
  }
  return (
    nonNegativeInteger(options.atomAsset, "Atom asset") ??
    nonNegativeInteger(options.tripleAsset, "Triple asset") ??
    nonNegativeInteger(options.atomValue, "Atom transaction value") ??
    nonNegativeInteger(options.tripleValue, "Triple transaction value")
  );
}

function uniqueMissingById<T extends { id: string; exists: boolean }>(
  values: T[],
): T[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (value.exists || seen.has(value.id.toLowerCase())) return false;
    seen.add(value.id.toLowerCase());
    return true;
  });
}

function uniqueMissingTriples(
  values: SubmissionTripleResolution[],
): SubmissionTripleResolution[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (value.exists || seen.has(value.tripleId.toLowerCase())) return false;
    seen.add(value.tripleId.toLowerCase());
    return true;
  });
}

type RawReadClient = IntuitionPublicClient;

function atomOperations(
  plan: SubmissionPlan,
): Extract<SubmissionPlanOperation, { kind: "ensure-atom" }>[] {
  return plan.operations.filter(
    (
      operation,
    ): operation is Extract<SubmissionPlanOperation, { kind: "ensure-atom" }> =>
      operation.kind === "ensure-atom",
  );
}

function tripleOperations(
  plan: SubmissionPlan,
): Extract<SubmissionPlanOperation, { kind: "create-triple" }>[] {
  return plan.operations.filter(
    (
      operation,
    ): operation is Extract<
      SubmissionPlanOperation,
      { kind: "create-triple" }
    > => operation.kind === "create-triple",
  );
}

async function termExists(
  publicClient: RawReadClient,
  termId: string,
  address?: string,
): Promise<boolean> {
  const result = await verifyIntuitionTerm(
    publicClient,
    termId,
    address ?? INTUITION_MAINNET_MULTIVAULT,
  );
  if (result.status === "error") throw new Error(result.message);
  return result.status === "verified";
}

async function tripleExists(
  publicClient: RawReadClient,
  tripleId: string,
  subjectId: string,
  predicateId: string,
  objectId: string,
  address?: string,
): Promise<boolean> {
  const result = await verifyIntuitionTriple(
    publicClient,
    tripleId,
    address ?? INTUITION_MAINNET_MULTIVAULT,
  );
  if (result.status === "error") throw new Error(result.message);
  if (result.status === "missing") return false;
  if (
    result.subjectId !== subjectId.toLowerCase() ||
    result.predicateId !== predicateId.toLowerCase() ||
    result.objectId !== objectId.toLowerCase()
  ) {
    throw new Error(
      `MultiVault triple ${tripleId} resolves to different components.`,
    );
  }
  return true;
}

function idForContent(
  content: string,
  atoms: SubmissionAtomResolution[],
): string | null {
  return atoms.find((atom) => atom.content === content)?.id ?? null;
}

function resolveReference(
  reference: string,
  atoms: SubmissionAtomResolution[],
  triples: SubmissionTripleResolution[],
): string {
  if (reference.startsWith("@triple:")) {
    const key = reference.slice("@triple:".length);
    return triples.find((triple) => triple.key === key)?.tripleId ?? reference;
  }
  return idForContent(reference, atoms) ?? reference;
}

export async function resolveSubmissionWorkflow(
  plan: SubmissionPlan,
  ontology: OntologyManifest,
  publicClient: IntuitionPublicClient,
  options: { multivaultAddress?: string } = {},
): Promise<SubmissionResolution> {
  if (plan.status !== "ready-for-simulation") {
    return {
      status: "blocked",
      message:
        "Resolve is blocked until the submission plan is ready for simulation.",
      missingConfiguredTermIds: [],
    };
  }

  try {
    const address = options.multivaultAddress;
    const atoms: SubmissionAtomResolution[] = [];
    for (const operation of atomOperations(plan)) {
      const data = stringToHex(operation.content);
      const id = intuitionAtomIdFromText(operation.content);
      atoms.push({
        key: operation.key,
        content: operation.content,
        data,
        id,
        exists: await termExists(publicClient, id, address),
      });
    }

    const triples: SubmissionTripleResolution[] = [];
    for (const operation of tripleOperations(plan)) {
      const subjectId = resolveReference(operation.subject, atoms, triples);
      const objectId = resolveReference(operation.object, atoms, triples);
      if (
        !/^0x[0-9a-f]{64}$/i.test(subjectId) ||
        !/^0x[0-9a-f]{64}$/i.test(operation.predicateId) ||
        !/^0x[0-9a-f]{64}$/i.test(objectId)
      ) {
        return {
          status: "blocked",
          message: `Cannot resolve canonical IDs for the ${operation.key} triple.`,
          missingConfiguredTermIds: [],
        };
      }
      const tripleId = intuitionTripleIdFromComponents(
        subjectId,
        operation.predicateId,
        objectId,
      );
      triples.push({
        key: operation.key,
        subjectId,
        predicateId: operation.predicateId,
        objectId,
        tripleId,
        exists: await tripleExists(
          publicClient,
          tripleId,
          subjectId,
          operation.predicateId,
          objectId,
          address,
        ),
      });
    }

    const plannedPredicateIds = new Set(
      atomOperations(plan)
        .filter((operation) => operation.key.startsWith("ontology-predicate:"))
        .map((operation) =>
          intuitionAtomIdFromText(operation.content).toLowerCase(),
        ),
    );
    const configuredIds = [
      ontology.deploymentClassId,
      ...Object.values(ontology.predicates).filter((id): id is string =>
        Boolean(id?.trim()),
      ),
    ].filter((id) => !plannedPredicateIds.has(id.toLowerCase()));
    const configuredExists = await Promise.all(
      configuredIds.map(async (id) => ({
        id,
        exists: /^0x[0-9a-f]{64}$/i.test(id)
          ? await termExists(publicClient, id, address)
          : false,
      })),
    );
    const missingConfiguredTermIds = configuredExists
      .filter((item) => !item.exists)
      .map((item) => item.id);

    return {
      status: "ready",
      atoms,
      triples,
      initialSignal: plan.initialSignal,
      missingConfiguredTermIds,
      warning:
        "This resolution is read-only. Configured ontology terms must already exist; proposed ontology predicate atoms are included in the ordered write batch when they are new.",
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The submission could not be resolved against MultiVault.",
    };
  }
}

export function buildSubmissionWriteBatch(
  resolution: SubmissionResolution,
  options: SubmissionWriteOptions = {},
): SubmissionWriteBatch {
  if (resolution.status !== "ready") {
    return { status: "blocked", message: resolution.message };
  }
  if (resolution.missingConfiguredTermIds.length) {
    return {
      status: "blocked",
      message: `Configured ontology terms are missing: ${resolution.missingConfiguredTermIds.join(
        ", ",
      )}`,
    };
  }
  const optionsError = validateWriteOptions(options);
  if (optionsError) return { status: "blocked", message: optionsError };

  const transactions: SubmissionWriteTransaction[] = [];
  try {
    const atomsToCreate = uniqueMissingById(resolution.atoms);
    if (atomsToCreate.length) {
      const atomAsset = options.atomAsset ?? 0n;
      transactions.push({
        kind: "create-atoms",
        request: encodeCreateAtoms(
          atomsToCreate.map((atom) => atom.data),
          atomsToCreate.map(() => atomAsset),
          {
            address: options.multivaultAddress,
            value: options.atomValue,
          },
        ),
        atomIds: atomsToCreate.map((atom) => atom.id),
      });
    }

    const triplesToCreate = uniqueMissingTriples(resolution.triples);
    if (triplesToCreate.length) {
      const tripleAsset = options.tripleAsset ?? 0n;
      transactions.push({
        kind: "create-triples",
        request: encodeCreateTriples(
          triplesToCreate.map((triple) => triple.subjectId),
          triplesToCreate.map((triple) => triple.predicateId),
          triplesToCreate.map((triple) => triple.objectId),
          triplesToCreate.map(
            (triple) =>
              options.tripleAsset ??
              (triple.key === "membership"
                ? resolution.initialSignal
                : tripleAsset),
          ),
          {
            address: options.multivaultAddress,
            value: options.tripleValue,
          },
        ),
        tripleIds: triplesToCreate.map((triple) => triple.tripleId),
        ...(atomsToCreate.length ? { dependsOn: "create-atoms" as const } : {}),
      });
    }
  } catch (error) {
    return {
      status: "blocked",
      message:
        error instanceof Error
          ? `Write calldata could not be encoded: ${error.message}`
          : "Write calldata could not be encoded.",
    };
  }

  return {
    status: "ready",
    transactions,
    finalTripleIds: resolution.triples.map((triple) => triple.tripleId),
    warning:
      "Transactions are unsigned. Wait for the atom receipt before submitting a dependent triple transaction, then verify every receipt and indexer result.",
  };
}

export async function verifySubmissionWriteBatchOnchain(
  resolution: SubmissionResolution,
  publicClient: IntuitionPublicClient,
  options: { multivaultAddress?: string } = {},
): Promise<SubmissionOnchainVerification> {
  if (resolution.status !== "ready") {
    return { status: "error", message: resolution.message };
  }
  const address = options.multivaultAddress;
  const missingAtomIds: string[] = [];
  const missingTripleIds: string[] = [];
  try {
    for (const atom of resolution.atoms) {
      const result = await verifyIntuitionTerm(
        publicClient,
        atom.id,
        address ?? INTUITION_MAINNET_MULTIVAULT,
      );
      if (result.status === "error") {
        return { status: "error", message: result.message };
      }
      if (result.status === "missing") {
        missingAtomIds.push(atom.id);
        continue;
      }
      if (result.data.toLowerCase() !== atom.data.toLowerCase()) {
        return {
          status: "error",
          message: `Atom ${atom.id} returned different data than the planned submission.`,
        };
      }
    }

    if (missingAtomIds.length) {
      return {
        status: "pending",
        missingAtomIds,
        missingTripleIds,
        message:
          "The planned atoms are not visible onchain yet, so dependent triples cannot be verified.",
      };
    }

    for (const triple of resolution.triples) {
      const result = await verifyIntuitionTriple(
        publicClient,
        triple.tripleId,
        address ?? INTUITION_MAINNET_MULTIVAULT,
      );
      if (result.status === "error") {
        return { status: "error", message: result.message };
      }
      if (result.status === "missing") {
        missingTripleIds.push(triple.tripleId);
        continue;
      }
      if (
        result.subjectId !== triple.subjectId.toLowerCase() ||
        result.predicateId !== triple.predicateId.toLowerCase() ||
        result.objectId !== triple.objectId.toLowerCase()
      ) {
        return {
          status: "error",
          message: `Triple ${triple.tripleId} returned different components than the planned submission.`,
        };
      }
    }
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Onchain submission verification failed.",
    };
  }

  if (missingAtomIds.length || missingTripleIds.length) {
    return {
      status: "pending",
      missingAtomIds,
      missingTripleIds,
      message:
        "The receipt may be confirmed, but not every planned atom and triple is visible onchain yet.",
    };
  }
  return {
    status: "verified",
    atoms: resolution.atoms,
    triples: resolution.triples,
    message:
      "Every planned atom and triple matches the expected MultiVault state.",
  };
}

export async function executeSubmissionWriteBatch(
  batch: SubmissionWriteBatch,
  adapter: SubmissionWriteAdapter,
  startAt = 0,
  priorTransactionHash?: string,
  priorReceiptConfirmed = false,
): Promise<SubmissionWriteExecution> {
  const firstIndex = Math.min(
    Math.max(Math.floor(startAt), 0),
    batch.status === "ready" ? batch.transactions.length : 0,
  );
  if (batch.status !== "ready") {
    return {
      status: "blocked",
      transactionHashes: [],
      nextTransactionIndex: firstIndex,
      message: batch.message,
    };
  }
  const transactionHashes: string[] = [];
  for (let index = firstIndex; index < batch.transactions.length; index += 1) {
    const transaction = batch.transactions[index];
    if (!transaction) break;
    if (transaction.dependsOn) {
      const previousHash = transactionHashes.at(-1) ?? priorTransactionHash;
      if (
        !previousHash ||
        (!adapter.waitForConfirmation && !priorReceiptConfirmed)
      ) {
        return {
          status: "blocked",
          transactionHashes,
          nextTransactionIndex: index,
          message:
            "The dependent transaction is paused until the previous receipt can be confirmed.",
        };
      }
      if (!priorReceiptConfirmed || transactionHashes.length > 0) {
        if (!adapter.waitForConfirmation) {
          return {
            status: "blocked",
            transactionHashes,
            nextTransactionIndex: index,
            message: "A receipt confirmer is required before dependent writes.",
          };
        }
        let receipt: TransactionReceiptCheck;
        try {
          receipt = await adapter.waitForConfirmation(previousHash);
        } catch (error) {
          return {
            status: "blocked",
            transactionHashes,
            nextTransactionIndex: index,
            message:
              error instanceof Error
                ? error.message
                : "The previous transaction receipt could not be confirmed.",
          };
        }
        if (receipt.status !== "confirmed") {
          return {
            status: receipt.status === "failed" ? "failed" : "blocked",
            transactionHashes,
            nextTransactionIndex: index,
            message: receipt.message,
          };
        }
      }
    }
    try {
      await adapter.simulate(transaction.request);
      const hash = await adapter.send(transaction.request);
      if (!/^0x[0-9a-f]{64}$/i.test(hash.trim())) {
        return {
          status: "failed",
          transactionHashes,
          nextTransactionIndex: index,
          message: "The wallet returned an invalid transaction hash.",
        };
      }
      transactionHashes.push(hash.trim());
    } catch (error) {
      return {
        status: "failed",
        transactionHashes,
        nextTransactionIndex: index,
        message:
          error instanceof Error ? error.message : "The transaction failed.",
      };
    }
  }
  return {
    status: "submitted",
    transactionHashes,
    nextTransactionIndex: batch.transactions.length,
    message:
      transactionHashes.length === 0
        ? "No new transaction was required; every planned record already exists."
        : "All planned transactions were submitted. Verify receipts and indexer discovery next.",
  };
}
