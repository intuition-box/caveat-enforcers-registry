import { readFile } from "node:fs/promises";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  keccak256,
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
  INTUITION_MAINNET_GRAPHQL,
  INTUITION_MAINNET_MULTIVAULT,
  INTUITION_MAINNET_RPC,
  PROPOSED_ONTOLOGY_MANIFEST,
} from "../src/ontology.js";
import {
  buildReferenceSeedPlan,
  type ReferenceSeedDocument,
  type ReferenceSeedPlan,
  type ReferenceSeedAtom,
  type ReferenceSeedTriple,
} from "../src/reference-seed.js";

const DEFAULT_BATCH_SIZE = 24;
const DEFAULT_INDEX_TIMEOUT_SECONDS = 120;
const REFERENCE_DATA_URL = new URL(
  "../data/metamask-v1.3.0.json",
  import.meta.url,
);

type Options = {
  execute: boolean;
  confirmMainnet: boolean;
  batchSize: number;
  indexTimeoutSeconds: number;
  chainIds: string[];
};

type SeedState = {
  missingAtoms: ReferenceSeedAtom[];
  missingTriples: ReferenceSeedTriple[];
};

const INTUITION_CHAIN = {
  id: Number(INTUITION_MAINNET_CHAIN_ID),
  name: "Intuition Mainnet",
  nativeCurrency: { name: "TRUST", symbol: "TRUST", decimals: 18 },
  rpcUrls: { default: { http: [INTUITION_MAINNET_RPC] } },
} as const;

function usage(): void {
  console.log(`Usage:
  pnpm seed:reference -- --dry-run
  INTUITION_SEED_PRIVATE_KEY=<secret> pnpm seed:reference -- --execute --confirm-mainnet

Options:
  --dry-run                         Read and plan only (default)
  --execute --confirm-mainnet       Broadcast the reviewed mainnet seed
  --batch-size <n>                  Atoms/triples per transaction (default ${DEFAULT_BATCH_SIZE})
  --index-timeout-seconds <n>       GraphQL indexing wait (default ${DEFAULT_INDEX_TIMEOUT_SECONDS})
  --chains <ids>                    Verified deployment chains, comma-separated (default 1155)
`);
}

function positiveInteger(value: string, flag: string): number {
  if (!/^\d+$/.test(value))
    throw new Error(`${flag} must be a positive integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }
  return parsed;
}

function parseOptions(argv: string[]): Options {
  if (argv[0] === "--") argv = argv.slice(1);
  if (argv.includes("--help")) {
    usage();
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
  let indexTimeoutSeconds = DEFAULT_INDEX_TIMEOUT_SECONDS;
  let chainIds = [INTUITION_MAINNET_CHAIN_ID];
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (
      flag === "--batch-size" ||
      flag === "--index-timeout-seconds" ||
      flag === "--chains"
    ) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${flag} requires a value.`);
      if (flag === "--chains") {
        chainIds = [...new Set(value.split(",").map((item) => item.trim()))];
        if (
          !chainIds.length ||
          chainIds.some((chainId) => !/^\d+$/.test(chainId))
        ) {
          throw new Error(
            "--chains must be a comma-separated list of EIP-155 chain IDs.",
          );
        }
      } else {
        const parsed = positiveInteger(value, flag);
        if (flag === "--batch-size") batchSize = parsed;
        else indexTimeoutSeconds = parsed;
      }
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
  return {
    execute,
    confirmMainnet: argv.includes("--confirm-mainnet"),
    batchSize,
    indexTimeoutSeconds,
    chainIds,
  };
}

async function loadReferenceDocument(): Promise<ReferenceSeedDocument> {
  const raw = await readFile(REFERENCE_DATA_URL, "utf8");
  return JSON.parse(raw) as ReferenceSeedDocument;
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

function seedAddress(value: string): Address {
  return value as Address;
}

function seedHex(value: string): Hex {
  return value as Hex;
}

async function readSeedState(
  publicClient: ReturnType<typeof createPublicClient>,
  plan: ReferenceSeedPlan,
): Promise<SeedState> {
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
  const missingAtoms = atomResults.filter(
    (atom): atom is ReferenceSeedAtom => atom !== null,
  );

  const tripleResults = await mapWithConcurrency(
    plan.triples,
    async (triple) => {
      const created = await publicClient.readContract({
        address: INTUITION_MAINNET_MULTIVAULT,
        abi: MultiVaultAbi,
        functionName: "isTermCreated",
        args: [seedHex(triple.tripleId)],
      });
      const result =
        created === true
          ? await verifyIntuitionTriple(
              publicClient as unknown as IntuitionPublicClient,
              triple.tripleId,
              INTUITION_MAINNET_MULTIVAULT,
            )
          : { status: "missing" as const, tripleId: triple.tripleId };
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
  const missingTriples = tripleResults.filter(
    (triple): triple is ReferenceSeedTriple => triple !== null,
  );
  return { missingAtoms, missingTriples };
}

const PUBLIC_VERIFICATION_RPCS: Record<string, string> = {
  "1": "https://ethereum-rpc.publicnode.com",
  "8453": "https://base-rpc.publicnode.com",
  "11155111": "https://ethereum-sepolia-rpc.publicnode.com",
  [INTUITION_MAINNET_CHAIN_ID]: INTUITION_MAINNET_RPC,
};

function verificationRpc(chainId: string): string {
  const endpoint =
    process.env[`EVM_RPC_URL_${chainId}`]?.trim() ||
    PUBLIC_VERIFICATION_RPCS[chainId];
  if (!endpoint) {
    throw new Error(
      `Set EVM_RPC_URL_${chainId} to verify deployments on EIP-155 chain ${chainId}.`,
    );
  }
  return endpoint;
}

async function assertSourceDeployments(
  document: ReferenceSeedDocument,
  chainIds: string[],
): Promise<void> {
  const hashes = new Map<string, Map<string, string>>();
  for (const chainId of chainIds) {
    const client = createPublicClient({
      transport: http(verificationRpc(chainId)),
    });
    await mapWithConcurrency(document.enforcers, async (entry) => {
      const address = seedAddress(entry.address.toLowerCase());
      const bytecode = await client.getBytecode({ address });
      if (!bytecode || bytecode === "0x") {
        throw new Error(
          `No bytecode found for ${entry.name} at ${address} on EIP-155 chain ${chainId}.`,
        );
      }
      const byChain = hashes.get(entry.name) ?? new Map<string, string>();
      byChain.set(chainId, keccak256(bytecode));
      hashes.set(entry.name, byChain);
      return null;
    });
  }
  for (const [name, byChain] of hashes) {
    if (new Set(byChain.values()).size !== 1) {
      throw new Error(
        `Runtime bytecode differs across selected chains for ${name}; review before writing deployment claims.`,
      );
    }
  }
}

async function assertConfiguredPredicates(
  publicClient: ReturnType<typeof createPublicClient>,
): Promise<void> {
  const predicateIds = [
    PROPOSED_ONTOLOGY_MANIFEST.predicates.membership,
    PROPOSED_ONTOLOGY_MANIFEST.predicates.deployedOn,
  ];
  for (const predicateId of predicateIds) {
    if (!predicateId) {
      throw new Error(
        "A required seed predicate is missing from the ontology.",
      );
    }
    const result = await verifyIntuitionTerm(
      publicClient as unknown as IntuitionPublicClient,
      predicateId,
      INTUITION_MAINNET_MULTIVAULT,
    );
    if (result.status === "error") throw new Error(result.message);
    if (result.status === "missing") {
      throw new Error(
        `Configured seed predicate is missing on Intuition: ${predicateId}`,
      );
    }
  }
}

async function sendAndConfirm(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
  request: { to: string; data: string; value?: string },
  label: string,
): Promise<string> {
  const to = seedAddress(request.to.toLowerCase());
  const data = seedHex(request.data);
  const value = request.value === undefined ? 0n : BigInt(request.value);
  await publicClient.call({ account: account.address, to, data, value });
  const transactionHash = await walletClient.sendTransaction({
    account,
    chain: INTUITION_CHAIN,
    to,
    data,
    value,
  });
  console.log(`${label}: ${transactionHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
  });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${transactionHash}`);
  }
  return transactionHash;
}

async function executeSeed(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof privateKeyToAccount>,
  plan: ReferenceSeedPlan,
  state: SeedState,
  batchSize: number,
  atomCost: bigint,
  tripleCost: bigint,
): Promise<void> {
  for (const [index, batch] of chunks(
    state.missingAtoms,
    batchSize,
  ).entries()) {
    // createAtoms is payable: each atom needs at least getAtomCost, and
    // msg.value must cover the sum of the per-atom deposits.
    const request = encodeCreateAtoms(
      batch.map((atom) => atom.data),
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
      `Atom batch ${index + 1}/${Math.ceil(state.missingAtoms.length / batchSize)}`,
    );
  }

  const afterAtoms = await readSeedState(publicClient, plan);
  if (afterAtoms.missingAtoms.length) {
    throw new Error(
      `${afterAtoms.missingAtoms.length} atoms are still missing after confirmation.`,
    );
  }

  for (const [index, batch] of chunks(
    afterAtoms.missingTriples,
    batchSize,
  ).entries()) {
    // createTriples is payable on the same terms; the deposit on each
    // membership triple doubles as its initial $TRUST confidence signal.
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
      `Triple batch ${index + 1}/${Math.ceil(afterAtoms.missingTriples.length / batchSize)}`,
    );
  }
}

const membershipQuery = `
  query SeedMemberships($predicate: String!, $object: String!, $limit: Int!) {
    triples(
      where: { predicate_id: { _eq: $predicate }, object_id: { _eq: $object } }
      limit: $limit
    ) { subject_id }
  }
`;

async function waitForIndexing(
  plan: ReferenceSeedPlan,
  timeoutSeconds: number,
): Promise<number> {
  const wanted = new Set(
    plan.triples
      .filter((triple) => triple.key === "membership")
      .map((triple) => triple.subjectId.toLowerCase()),
  );
  const deadline = Date.now() + timeoutSeconds * 1000;
  let indexed = 0;
  while (Date.now() < deadline) {
    const response = await fetch(INTUITION_MAINNET_GRAPHQL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: membershipQuery,
        variables: {
          predicate: PROPOSED_ONTOLOGY_MANIFEST.predicates.membership!,
          object: plan.classId,
          limit: Math.max(wanted.size + 32, 100),
        },
      }),
    });
    if (!response.ok)
      throw new Error(`GraphQL indexing request failed (${response.status}).`);
    const payload = (await response.json()) as {
      data?: { triples?: Array<{ subject_id?: string | null }> };
      errors?: Array<{ message?: string }>;
    };
    if (payload.errors?.length) {
      throw new Error(
        payload.errors[0]?.message ?? "GraphQL indexing query failed.",
      );
    }
    const found = new Set(
      (payload.data?.triples ?? [])
        .map((triple) => triple.subject_id?.toLowerCase())
        .filter((value): value is string => Boolean(value)),
    );
    indexed = [...wanted].filter((id) => found.has(id)).length;
    console.log(`Indexer: ${indexed}/${wanted.size} seed memberships visible`);
    if (indexed === wanted.size) return indexed;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  return indexed;
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const document = await loadReferenceDocument();
  const plan = buildReferenceSeedPlan(document, { chainIds: options.chainIds });
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
  await assertConfiguredPredicates(publicClient);
  await assertSourceDeployments(document, options.chainIds);
  const state = await readSeedState(publicClient, plan);

  console.log(
    `Reference seed: ${document.enforcers.length} MetaMask enforcers`,
  );
  console.log(`Verified chains: ${options.chainIds.join(", ")}`);
  console.log(
    `Plan: ${plan.atoms.length} atoms, ${plan.triples.length} triples`,
  );
  console.log(
    `Missing: ${state.missingAtoms.length} atoms, ${state.missingTriples.length} triples`,
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

  // createAtoms/createTriples are payable. Read the live protocol cost so the
  // seed funds each term instead of reverting at simulation.
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
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(
    `Per-term cost: ${formatEther(atomCost)} TRUST/atom, ${formatEther(tripleCost)} TRUST/triple`,
  );
  console.log(
    `Required deposits: ${formatEther(requiredDeposits)} TRUST (plus gas)`,
  );
  console.log(`Wallet balance: ${formatEther(balance)} TRUST`);
  if (balance <= requiredDeposits) {
    throw new Error(
      `Wallet ${account.address} holds ${formatEther(balance)} TRUST but the seed needs more than ${formatEther(requiredDeposits)} TRUST plus gas. Fund the wallet and retry.`,
    );
  }

  await executeSeed(
    publicClient,
    walletClient,
    account,
    plan,
    state,
    options.batchSize,
    atomCost,
    tripleCost,
  );
  const finalState = await readSeedState(publicClient, plan);
  if (finalState.missingAtoms.length || finalState.missingTriples.length) {
    throw new Error(
      `Onchain verification incomplete: ${finalState.missingAtoms.length} atoms and ${finalState.missingTriples.length} triples remain missing.`,
    );
  }
  console.log("Onchain verification: all seed atoms and triples confirmed.");
  const indexed = await waitForIndexing(plan, options.indexTimeoutSeconds);
  const membershipCount = plan.triples.filter(
    (triple) => triple.key === "membership",
  ).length;
  if (indexed === membershipCount) {
    console.log(
      `Registry indexing: all ${membershipCount} seed memberships are discoverable.`,
    );
  } else {
    console.log(
      `Registry indexing pending: ${indexed}/${membershipCount} visible; re-run the read-only check later.`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Reference seed failed.",
  );
  process.exitCode = 1;
});
