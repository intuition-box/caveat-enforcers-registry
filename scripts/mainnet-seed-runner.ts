import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { MultiVaultAbi } from "@0xintuition/protocol";
import {
  encodeCreateAtoms,
  encodeCreateTriples,
  verifyIntuitionTerm,
  verifyIntuitionTriple,
  type IntuitionPublicClient,
} from "../src/intuition.js";
import {
  INTUITION_MAINNET_CHAIN_ID,
  INTUITION_MAINNET_MULTIVAULT,
  INTUITION_MAINNET_RPC,
} from "../src/ontology.js";
import type {
  ReferenceSeedAtom,
  ReferenceSeedTriple,
} from "../src/reference-seed.js";

// Structured terms and audit atoms can be several kilobytes each. Eight keeps
// the worst reviewed enrichment batches below Intuition's practical gas limit.
const DEFAULT_BATCH_SIZE = 8;

const INTUITION_CHAIN = {
  id: Number(INTUITION_MAINNET_CHAIN_ID),
  name: "Intuition Mainnet",
  nativeCurrency: { name: "TRUST", symbol: "TRUST", decimals: 18 },
  rpcUrls: { default: { http: [INTUITION_MAINNET_RPC] } },
} as const;

export type MainnetSeedPlan = {
  atoms: ReferenceSeedAtom[];
  triples: ReferenceSeedTriple[];
};

export type MainnetSeedState = {
  missingAtoms: ReferenceSeedAtom[];
  missingTriples: ReferenceSeedTriple[];
};

type Options = {
  execute: boolean;
  batchSize: number;
};

function positiveInteger(value: string, flag: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function parseOptions(argv: string[], label: string): Options {
  if (argv[0] === "--") argv = argv.slice(1);
  if (argv.includes("--help")) {
    console.log(`Usage:
  pnpm ${label} -- --dry-run
  INTUITION_SEED_PRIVATE_KEY=<secret> pnpm ${label} -- --execute --confirm-mainnet

Options:
  --dry-run                         Read and plan only (default)
  --execute --confirm-mainnet       Broadcast the reviewed mainnet plan
  --batch-size <n>                  Terms per transaction (default ${DEFAULT_BATCH_SIZE})
`);
    process.exit(0);
  }
  const execute = argv.includes("--execute");
  if (execute && argv.includes("--dry-run")) {
    throw new Error("Choose either --dry-run or --execute.");
  }
  if (execute && !argv.includes("--confirm-mainnet")) {
    throw new Error(
      "Mainnet execution requires both --execute and --confirm-mainnet.",
    );
  }
  let batchSize = DEFAULT_BATCH_SIZE;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--batch-size") {
      const value = argv[index + 1];
      if (!value) throw new Error("--batch-size requires a value.");
      batchSize = positiveInteger(value, flag);
      index += 1;
      continue;
    }
    if (
      flag !== "--execute" &&
      flag !== "--dry-run" &&
      flag !== "--confirm-mainnet"
    ) {
      throw new Error(`Unknown option: ${flag}`);
    }
  }
  return { execute, batchSize };
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  worker: (value: T) => Promise<R>,
  concurrency = 12,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  async function run(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      results[index] = await worker(values[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => run()),
  );
  return results;
}

const address = (value: string): Address => value as Address;
const hex = (value: string): Hex => value as Hex;

export async function readMainnetSeedState(
  publicClient: ReturnType<typeof createPublicClient>,
  plan: MainnetSeedPlan,
): Promise<MainnetSeedState> {
  const atomResults = await mapWithConcurrency(plan.atoms, async (atom) => {
    const result = await verifyIntuitionTerm(
      publicClient as unknown as IntuitionPublicClient,
      atom.id,
      INTUITION_MAINNET_MULTIVAULT,
    );
    if (result.status === "error") throw new Error(result.message);
    if (result.status === "missing") return atom;
    if (result.data.toLowerCase() !== atom.data.toLowerCase()) {
      throw new Error(`Existing atom ${atom.id} has different data.`);
    }
    return null;
  });
  const tripleResults = await mapWithConcurrency(
    plan.triples,
    async (triple) => {
      const created = await publicClient.readContract({
        address: INTUITION_MAINNET_MULTIVAULT,
        abi: MultiVaultAbi,
        functionName: "isTermCreated",
        args: [hex(triple.tripleId)],
      });
      if (created !== true) return triple;
      const result = await verifyIntuitionTriple(
        publicClient as unknown as IntuitionPublicClient,
        triple.tripleId,
        INTUITION_MAINNET_MULTIVAULT,
      );
      if (result.status === "error") throw new Error(result.message);
      if (result.status === "missing") return triple;
      if (
        result.subjectId !== triple.subjectId.toLowerCase() ||
        result.predicateId !== triple.predicateId.toLowerCase() ||
        result.objectId !== triple.objectId.toLowerCase()
      ) {
        throw new Error(
          `Existing triple ${triple.tripleId} has different components.`,
        );
      }
      return null;
    },
  );
  return {
    missingAtoms: atomResults.filter(
      (atom): atom is ReferenceSeedAtom => atom !== null,
    ),
    missingTriples: tripleResults.filter(
      (triple): triple is ReferenceSeedTriple => triple !== null,
    ),
  };
}

async function sendAndConfirm(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
  request: { to: string; data: string; value?: string },
  label: string,
): Promise<void> {
  const to = address(request.to.toLowerCase());
  const data = hex(request.data);
  const value = request.value === undefined ? 0n : BigInt(request.value);
  const gasPrice = await publicClient.getGasPrice();
  await publicClient.call({ account: account.address, to, data, value });
  const transactionHash = await walletClient.sendTransaction({
    account,
    chain: INTUITION_CHAIN,
    to,
    data,
    value,
    gasPrice,
    type: "legacy",
  });
  console.log(`${label}: ${transactionHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
  });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${transactionHash}`);
  }
}

type PlannedRequest = {
  request: { to: string; data: string; value?: string };
  label: string;
};

async function preflightRequests(
  publicClient: ReturnType<typeof createPublicClient>,
  account: Address,
  requests: PlannedRequest[],
): Promise<void> {
  for (const item of requests) {
    await publicClient.call({
      account,
      to: address(item.request.to.toLowerCase()),
      data: hex(item.request.data),
      value: item.request.value === undefined ? 0n : BigInt(item.request.value),
    });
  }
  console.log(
    `Preflight: ${requests.length} ${requests.length === 1 ? "batch" : "batches"} simulated successfully.`,
  );
}

export async function runMainnetSeed(
  plan: MainnetSeedPlan,
  argv: string[],
  options: { command: string; title: string },
): Promise<MainnetSeedState> {
  const parsed = parseOptions(argv, options.command);
  const publicClient = createPublicClient({
    chain: INTUITION_CHAIN,
    transport: http(INTUITION_MAINNET_RPC),
  });
  const chainId = await publicClient.getChainId();
  if (chainId !== Number(INTUITION_MAINNET_CHAIN_ID)) {
    throw new Error(
      `Expected Intuition chain ${INTUITION_MAINNET_CHAIN_ID}, got ${chainId}.`,
    );
  }
  const state = await readMainnetSeedState(publicClient, plan);
  console.log(options.title);
  console.log(
    `Plan: ${plan.atoms.length} atoms, ${plan.triples.length} triples`,
  );
  console.log(
    `Missing: ${state.missingAtoms.length} atoms, ${state.missingTriples.length} triples`,
  );
  console.log(`MultiVault: ${INTUITION_MAINNET_MULTIVAULT}`);
  const [atomCost, tripleCost] = (await Promise.all([
    publicClient.readContract({
      address: INTUITION_MAINNET_MULTIVAULT,
      abi: MultiVaultAbi,
      functionName: "getAtomCost",
    }),
    publicClient.readContract({
      address: INTUITION_MAINNET_MULTIVAULT,
      abi: MultiVaultAbi,
      functionName: "getTripleCost",
    }),
  ])) as [bigint, bigint];
  const requiredDeposits =
    atomCost * BigInt(state.missingAtoms.length) +
    tripleCost * BigInt(state.missingTriples.length);
  console.log(
    `Per-term cost: ${formatEther(atomCost)} TRUST/atom, ${formatEther(tripleCost)} TRUST/triple`,
  );
  console.log(
    `Required deposits: ${formatEther(requiredDeposits)} TRUST (plus gas)`,
  );
  if (!parsed.execute) {
    console.log("DRY RUN: no transactions were broadcast.");
    return state;
  }

  const rawKey = process.env.INTUITION_SEED_PRIVATE_KEY?.trim();
  if (!rawKey || !/^0x[0-9a-f]{64}$/i.test(rawKey)) {
    throw new Error(
      "INTUITION_SEED_PRIVATE_KEY must be a 32-byte 0x-prefixed secret.",
    );
  }
  const account = privateKeyToAccount(rawKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: INTUITION_CHAIN,
    transport: http(INTUITION_MAINNET_RPC),
  });
  console.log(`Execution wallet: ${account.address}`);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Wallet balance: ${formatEther(balance)} TRUST`);
  if (balance <= requiredDeposits) {
    throw new Error(
      `Wallet ${account.address} needs more than ${formatEther(requiredDeposits)} TRUST plus gas.`,
    );
  }

  const atomBatches = chunks(state.missingAtoms, parsed.batchSize);
  const atomRequests = atomBatches.map((batch, index) => ({
    request: encodeCreateAtoms(
      batch.map((atom) => atom.data),
      batch.map(() => atomCost),
      {
        address: INTUITION_MAINNET_MULTIVAULT,
        value: (atomCost * BigInt(batch.length)).toString(),
      },
    ),
    label: `Atom batch ${index + 1}/${atomBatches.length}`,
  }));
  await preflightRequests(publicClient, account.address, atomRequests);
  for (const item of atomRequests) {
    await sendAndConfirm(
      publicClient,
      walletClient,
      account,
      item.request,
      item.label,
    );
  }
  const afterAtoms = await readMainnetSeedState(publicClient, plan);
  if (afterAtoms.missingAtoms.length) {
    throw new Error(`${afterAtoms.missingAtoms.length} atoms remain missing.`);
  }
  const tripleBatches = chunks(afterAtoms.missingTriples, parsed.batchSize);
  const tripleRequests = tripleBatches.map((batch, index) => ({
    request: encodeCreateTriples(
      batch.map((triple) => triple.subjectId),
      batch.map((triple) => triple.predicateId),
      batch.map((triple) => triple.objectId),
      batch.map(() => tripleCost),
      {
        address: INTUITION_MAINNET_MULTIVAULT,
        value: (tripleCost * BigInt(batch.length)).toString(),
      },
    ),
    label: `Triple batch ${index + 1}/${tripleBatches.length}`,
  }));
  await preflightRequests(publicClient, account.address, tripleRequests);
  for (const item of tripleRequests) {
    await sendAndConfirm(
      publicClient,
      walletClient,
      account,
      item.request,
      item.label,
    );
  }
  const finalState = await readMainnetSeedState(publicClient, plan);
  if (finalState.missingAtoms.length || finalState.missingTriples.length) {
    throw new Error(
      `Onchain verification incomplete: ${finalState.missingAtoms.length} atoms and ${finalState.missingTriples.length} triples remain missing.`,
    );
  }
  console.log(
    "Onchain verification: every planned atom and triple is confirmed.",
  );
  return finalState;
}
