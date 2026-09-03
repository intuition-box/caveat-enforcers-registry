/**
 * One-atom IPFS pin proof.
 *
 * Phase A (default, no TRUST): pin one schema.org Thing via the configured
 * service and confirm the returned CID matches the CID this repo derives
 * offline. This settles the only empirical unknown — whether the service
 * returns the raw `bafkrei…` CID our atom IDs assume — for zero cost. It also
 * prints an IPFS gateway URL so the pinned document can be eyeballed.
 *
 * Phase B (`--write`, ~0.1 TRUST): create exactly one atom on Intuition
 * mainnet whose data is `ipfs://<CID>`, then poll the indexer until the atom
 * resolves to the Thing's `name` instead of "json object". Run this once to
 * validate the whole path before the funded reference-set migration.
 *
 * Run in an interactive terminal — the script prompts for each secret with the
 * typed characters masked, so keys never reach a command line, shell history,
 * a file, or the agent. (Env vars PINATA_JWT / CAVEAT_DEPLOYER_PRIVATE_KEY are
 * still honoured if already set.)
 *   pnpm pin:proof            # phase A, no TRUST  (prompts: Pinata JWT)
 *   pnpm pin:proof -- --write # phase B, ~0.1 TRUST (prompts: JWT + deployer key)
 */
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  stringToHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { MultiVaultAbi } from "@0xintuition/protocol";
import {
  encodeCreateAtoms,
  intuitionAtomIdFromText,
} from "../src/intuition.js";
import {
  INTUITION_MAINNET_CHAIN_ID,
  INTUITION_MAINNET_GRAPHQL,
  INTUITION_MAINNET_MULTIVAULT,
  INTUITION_MAINNET_RPC,
} from "../src/ontology.js";
import { createInterface } from "node:readline";
import {
  pinAtomDocument,
  pinataPinner,
  prepareAtomDocument,
  type AtomThing,
} from "../src/pin.js";

const INTUITION_CHAIN = {
  id: Number(INTUITION_MAINNET_CHAIN_ID),
  name: "Intuition Mainnet",
  nativeCurrency: { name: "TRUST", symbol: "TRUST", decimals: 18 },
  rpcUrls: { default: { http: [INTUITION_MAINNET_RPC] } },
} as const;

// A representative JSON-valued atom: a named Thing that also carries a
// structured payload (as terms-schema atoms will), so the proof exercises the
// exact shape the migration writes.
const PROOF_THING: AtomThing = {
  name: "IPFS pin proof · Caveat Registry",
  description:
    "Deterministic pin-path proof for JSON-valued caveat enforcer atoms.",
  termsSchema: {
    fields: [
      { name: "start", type: "uint32" },
      { name: "end", type: "uint32" },
    ],
  },
};

/**
 * Read a secret from the environment, or — when run in an interactive terminal
 * and the env var is unset — prompt for it with the typed characters masked, so
 * the value never reaches a command line, shell history, a file, or this agent.
 */
async function resolveSecret(envName: string, label: string): Promise<string> {
  const fromEnv = process.env[envName]?.trim();
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY) {
    throw new Error(
      `${envName} is not set and there is no interactive terminal to prompt from.`,
    );
  }
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  const masked = rl as unknown as {
    _writeToOutput: (value: string) => void;
    output: NodeJS.WriteStream;
  };
  let prompted = false;
  masked._writeToOutput = (value: string) => {
    if (!prompted) {
      masked.output.write(value);
      prompted = true;
    }
    // Swallow every echoed keystroke after the prompt itself.
  };
  return new Promise<string>((resolve) => {
    rl.question(`${label}: `, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

async function graphqlAtom(
  termId: string,
): Promise<{ term_id: string; label: string | null; data: string } | null> {
  const response = await fetch(INTUITION_MAINNET_GRAPHQL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query:
        "query($id: String!){ atoms(where:{term_id:{_eq:$id}}, limit:1){ term_id label data } }",
      variables: { id: termId.toLowerCase() },
    }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    data?: { atoms?: Array<{ term_id: string; label: string | null; data: string }> };
  };
  return body.data?.atoms?.[0] ?? null;
}

async function main(): Promise<void> {
  const write = process.argv.includes("--write");

  const jwt = await resolveSecret("PINATA_JWT", "Pinata JWT");
  if (!jwt) throw new Error("A Pinata JWT is required.");

  // ---- Phase A: pin and verify the CID (no chain writes) -----------------
  const prepared = prepareAtomDocument(PROOF_THING);
  console.log("Thing bytes:", prepared.json);
  console.log("Derived CID (offline):", prepared.cid);

  const pinned = await pinAtomDocument(PROOF_THING, pinataPinner({ jwt }));
  const codec = pinned.cid.startsWith("bafkrei")
    ? "raw (bafkrei)"
    : pinned.cid.startsWith("bafybei")
      ? "dag-pb (bafybei)"
      : "unknown";
  console.log("Pinned CID (service):", pinned.cid, `[${codec}]`);
  console.log(
    "CID match:",
    pinned.cid === prepared.cid ? "yes (deterministic)" : "no",
  );
  console.log("Atom data URI:", pinned.uri);
  console.log("Gateway (eyeball the name):", `https://ipfs.io/ipfs/${pinned.cid}`);

  const atomId = intuitionAtomIdFromText(pinned.uri);
  console.log("Derived atom ID:", atomId);

  const existing = await graphqlAtom(atomId);
  if (existing) {
    console.log(
      `Atom already indexed: label=${JSON.stringify(existing.label)} data=${existing.data}`,
    );
  } else {
    console.log("Atom not yet on chain.");
  }

  if (!write) {
    console.log(
      "\nPhase A complete (no TRUST spent). Re-run with --write and INTUITION_SEED_PRIVATE_KEY to create the atom.",
    );
    return;
  }

  // ---- Phase B: create one atom on mainnet (~0.1 TRUST) ------------------
  const rawKey = process.env.INTUITION_SEED_PRIVATE_KEY?.trim()
    ? process.env.INTUITION_SEED_PRIVATE_KEY.trim()
    : await resolveSecret(
        "CAVEAT_DEPLOYER_PRIVATE_KEY",
        "Deployer private key (0x…, hidden)",
      );
  if (!/^0x[0-9a-f]{64}$/i.test(rawKey)) {
    throw new Error(
      "The deployer private key must be a 32-byte 0x-prefixed secret.",
    );
  }
  const intuitionRpc =
    process.env.INTUITION_RPC_URL?.trim() || INTUITION_MAINNET_RPC;
  const publicClient = createPublicClient({
    chain: INTUITION_CHAIN,
    transport: http(intuitionRpc),
  });
  const chainId = await publicClient.getChainId();
  if (chainId !== Number(INTUITION_MAINNET_CHAIN_ID)) {
    throw new Error(
      `Expected Intuition chain ${INTUITION_MAINNET_CHAIN_ID}, got ${chainId}.`,
    );
  }

  if (existing) {
    console.log("\nAtom already exists — skipping create; verifying label only.");
  } else {
    const account = privateKeyToAccount(rawKey as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: INTUITION_CHAIN,
      transport: http(intuitionRpc),
    });
    const atomCost = (await publicClient.readContract({
      address: INTUITION_MAINNET_MULTIVAULT,
      abi: MultiVaultAbi,
      functionName: "getAtomCost",
    })) as bigint;
    const balance = await publicClient.getBalance({ address: account.address });
    console.log(
      `\nExecution wallet: ${account.address}\nAtom cost: ${formatEther(atomCost)} TRUST · balance: ${formatEther(balance)} TRUST`,
    );
    if (balance < atomCost) {
      throw new Error("Balance below the atom cost — fund the wallet first.");
    }

    const request = encodeCreateAtoms([stringToHex(pinned.uri)], [atomCost], {
      address: INTUITION_MAINNET_MULTIVAULT,
      value: atomCost.toString(),
    });
    const hash = await walletClient.sendTransaction({
      to: request.to as `0x${string}`,
      data: request.data as `0x${string}`,
      value: BigInt(request.value ?? "0"),
    });
    console.log("createAtoms tx:", hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("Confirmed in block", receipt.blockNumber, "status", receipt.status);
    if (receipt.status !== "success") throw new Error("Atom create reverted.");
  }

  // Poll the indexer until it resolves the name (proves it is not "json object").
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const atom = await graphqlAtom(atomId);
    if (atom?.label) {
      console.log(
        `\nIndexed: label=${JSON.stringify(atom.label)} data=${atom.data}`,
      );
      console.log(
        atom.label === PROOF_THING.name
          ? "SUCCESS: the indexer resolves the Thing name. The pinning path is proven."
          : "Indexed, but the label differs from the Thing name — inspect the gateway document.",
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  console.log(
    "\nAtom created but the indexer has not resolved a label yet. Re-check the portal shortly.",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
