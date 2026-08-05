import { readFile } from "node:fs/promises";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  stringToHex,
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
import {
  buildComposabilitySeedPlan,
  type ComposabilitySeedDocument,
  type ComposabilitySeedPlan,
  type SeedAtom,
  type SeedTriple,
} from "../src/composability-seed.js";

const DEFAULT_BATCH_SIZE = 24;
const SEED_DATA_URL = new URL(
  "../data/composability-seed.json",
  import.meta.url,
);

const INTUITION_CHAIN = {
  id: Number(INTUITION_MAINNET_CHAIN_ID),
  name: "Intuition Mainnet",
  nativeCurrency: { name: "TRUST", symbol: "TRUST", decimals: 18 },
  rpcUrls: { default: { http: [INTUITION_MAINNET_RPC] } },
} as const;

type Options = { execute: boolean; batchSize: number };

function parseOptions(argv: string[]): Options {
  if (argv[0] === "--") argv = argv.slice(1);
  if (argv.includes("--help")) {
    console.log(`Usage:
  pnpm seed:composability -- --dry-run
  INTUITION_SEED_PRIVATE_KEY=<secret> pnpm seed:composability -- --execute --confirm-mainnet

Options:
  --dry-run                    Read and plan only (default)
  --execute --confirm-mainnet  Broadcast the reviewed composability seed
  --batch-size <n>             Atoms/triples per transaction (default ${DEFAULT_BATCH_SIZE})`);
    process.exit(0);
  }
  const execute = argv.includes("--execute");
  const dryRun = argv.includes("--dry-run");
  if (execute && dryRun)
    throw new Error("Choose either --dry-run or --execute.");
  if (execute && !argv.includes("--confirm-mainnet")) {
    throw new Error(
      "Mainnet execution requires both --execute and --confirm-mainnet.",
    );
  }
  let batchSize = DEFAULT_BATCH_SIZE;
  const flagIndex = argv.indexOf("--batch-size");
  if (flagIndex !== -1) {
    const value = argv[flagIndex + 1];
    if (!value || !/^\d+$/.test(value)) {
      throw new Error("--batch-size must be a positive integer.");
    }
    batchSize = Number(value);
  }
  return { execute, batchSize };
}

function seedAddress(value: string): Address {
  if (!/^0x[a-f0-9]{40}$/i.test(value.trim())) {
    throw new Error("Transaction target must be a valid EVM address.");
  }
  return value.trim().toLowerCase() as Address;
}

function seedHex(value: string): Hex {
  return value as Hex;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function loadDocument(): Promise<ComposabilitySeedDocument> {
  return JSON.parse(
    await readFile(SEED_DATA_URL, "utf8"),
  ) as ComposabilitySeedDocument;
}

type Client = ReturnType<typeof createPublicClient>;

async function missingAtoms(
  publicClient: Client,
  atoms: SeedAtom[],
): Promise<SeedAtom[]> {
  const missing: SeedAtom[] = [];
  for (const atom of atoms) {
    const result = await verifyIntuitionTerm(
      publicClient as unknown as IntuitionPublicClient,
      atom.id,
      INTUITION_MAINNET_MULTIVAULT,
    );
    if (result.status === "error") throw new Error(result.message);
    if (result.status === "missing") missing.push(atom);
  }
  return missing;
}

async function missingTriples(
  publicClient: Client,
  triples: SeedTriple[],
): Promise<SeedTriple[]> {
  const missing: SeedTriple[] = [];
  for (const triple of triples) {
    const created = await publicClient.readContract({
      address: INTUITION_MAINNET_MULTIVAULT,
      abi: MultiVaultAbi,
      functionName: "isTermCreated",
      args: [seedHex(triple.tripleId)],
    });
    if (created === true) {
      const result = await verifyIntuitionTriple(
        publicClient as unknown as IntuitionPublicClient,
        triple.tripleId,
        INTUITION_MAINNET_MULTIVAULT,
      );
      if (result.status === "error") throw new Error(result.message);
      if (result.status === "verified") continue;
    }
    missing.push(triple);
  }
  return missing;
}

async function assertRequiredExisting(
  publicClient: Client,
  ids: string[],
): Promise<void> {
  for (const id of ids) {
    const result = await verifyIntuitionTerm(
      publicClient as unknown as IntuitionPublicClient,
      id,
      INTUITION_MAINNET_MULTIVAULT,
    );
    if (result.status !== "verified") {
      throw new Error(
        `A required predicate atom is missing on Intuition: ${id}. Seed the reference set first.`,
      );
    }
  }
}

async function sendAndConfirm(
  publicClient: Client,
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
  request: { to: string; data: string; value?: string },
  label: string,
): Promise<void> {
  const to = seedAddress(request.to);
  const data = seedHex(request.data);
  const value = request.value === undefined ? 0n : BigInt(request.value);
  await publicClient.call({ account: account.address, to, data, value });
  const hash = await walletClient.sendTransaction({
    account,
    chain: INTUITION_CHAIN,
    to,
    data,
    value,
  });
  console.log(`${label}: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${hash}`);
  }
}

async function createAtomBatches(
  publicClient: Client,
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
  atoms: SeedAtom[],
  atomCost: bigint,
  batchSize: number,
): Promise<void> {
  const batches = chunks(atoms, batchSize);
  for (const [index, batch] of batches.entries()) {
    const request = encodeCreateAtoms(
      batch.map((atom) => stringToHex(atom.text)),
      batch.map(() => atomCost),
      {
        address: INTUITION_MAINNET_MULTIVAULT,
        value: (atomCost * BigInt(batch.length)).toString(),
      },
    );
    await sendAndConfirm(
      publicClient,
      walletClient,
      account,
      request,
      `Atom batch ${index + 1}/${batches.length}`,
    );
  }
}

async function createTripleBatches(
  publicClient: Client,
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
  triples: SeedTriple[],
  tripleCost: bigint,
  batchSize: number,
  labelPrefix: string,
): Promise<void> {
  const batches = chunks(triples, batchSize);
  for (const [index, batch] of batches.entries()) {
    const request = encodeCreateTriples(
      batch.map((triple) => triple.subjectId),
      batch.map((triple) => triple.predicateId),
      batch.map((triple) => triple.objectId),
      batch.map(() => tripleCost),
      {
        address: INTUITION_MAINNET_MULTIVAULT,
        value: (tripleCost * BigInt(batch.length)).toString(),
      },
    );
    await sendAndConfirm(
      publicClient,
      walletClient,
      account,
      request,
      `${labelPrefix} batch ${index + 1}/${batches.length}`,
    );
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const document = await loadDocument();
  const plan: ComposabilitySeedPlan = buildComposabilitySeedPlan(document);
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
  await assertRequiredExisting(publicClient, plan.requiredExistingAtomIds);

  const atomsToCreate = await missingAtoms(publicClient, plan.atoms);
  const relToCreate = await missingTriples(
    publicClient,
    plan.relationshipTriples,
  );
  const depToCreate = await missingTriples(publicClient, plan.dependentTriples);

  console.log(
    `Composability seed: ${document.relationships.length} relationships`,
  );
  console.log(
    `Plan: ${plan.atoms.length} atoms, ${plan.relationshipTriples.length} relationship triples, ${plan.dependentTriples.length} context/ordering/evidence triples`,
  );
  console.log(
    `Missing: ${atomsToCreate.length} atoms, ${relToCreate.length} relationship triples, ${depToCreate.length} dependent triples`,
  );
  console.log(`MultiVault: ${INTUITION_MAINNET_MULTIVAULT}`);

  if (!options.execute) {
    console.log("DRY RUN: no transactions were broadcast.");
    return;
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

  const required =
    atomCost * BigInt(atomsToCreate.length) +
    tripleCost * BigInt(relToCreate.length + depToCreate.length);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(
    `Required deposits: ${formatEther(required)} TRUST (plus gas); wallet holds ${formatEther(balance)} TRUST`,
  );
  if (balance <= required) {
    throw new Error(
      `Wallet ${account.address} holds ${formatEther(balance)} TRUST but the seed needs more than ${formatEther(required)} TRUST plus gas.`,
    );
  }

  // Phase 1: atoms must exist before any triple references them.
  await createAtomBatches(
    publicClient,
    walletClient,
    account,
    atomsToCreate,
    atomCost,
    options.batchSize,
  );
  if ((await missingAtoms(publicClient, plan.atoms)).length) {
    throw new Error("Atoms are still missing after confirmation.");
  }

  // Phase 2: relationship triples. Their term IDs become the subjects of the
  // context/ordering/evidence triples, so they must confirm first.
  await createTripleBatches(
    publicClient,
    walletClient,
    account,
    relToCreate,
    tripleCost,
    options.batchSize,
    "Relationship",
  );
  if ((await missingTriples(publicClient, plan.relationshipTriples)).length) {
    throw new Error(
      "Relationship triples are still missing after confirmation.",
    );
  }

  // Phase 3: context, ordering, and evidence triples hang off the relationships.
  await createTripleBatches(
    publicClient,
    walletClient,
    account,
    await missingTriples(publicClient, plan.dependentTriples),
    tripleCost,
    options.batchSize,
    "Context/evidence",
  );

  const remainingAtoms = await missingAtoms(publicClient, plan.atoms);
  const remainingTriples = [
    ...(await missingTriples(publicClient, plan.relationshipTriples)),
    ...(await missingTriples(publicClient, plan.dependentTriples)),
  ];
  if (remainingAtoms.length || remainingTriples.length) {
    throw new Error(
      `Onchain verification incomplete: ${remainingAtoms.length} atoms and ${remainingTriples.length} triples remain missing.`,
    );
  }
  console.log(
    "Onchain verification: all composability atoms and triples confirmed.",
  );
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Composability seed failed.",
  );
  process.exitCode = 1;
});
