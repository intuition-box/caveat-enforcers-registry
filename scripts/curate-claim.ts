import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  prepareCurationDeposit,
  type CurationAction,
} from "../src/curation.js";
import {
  readIntuitionVault,
  type IntuitionPublicClient,
} from "../src/intuition.js";
import {
  INTUITION_MAINNET_CHAIN_ID,
  INTUITION_MAINNET_MULTIVAULT,
  INTUITION_MAINNET_RPC,
} from "../src/ontology.js";

const INTUITION_CHAIN = {
  id: Number(INTUITION_MAINNET_CHAIN_ID),
  name: "Intuition Mainnet",
  nativeCurrency: { name: "TRUST", symbol: "TRUST", decimals: 18 },
  rpcUrls: { default: { http: [INTUITION_MAINNET_RPC] } },
} as const;

type Options = {
  claimId: string;
  action: CurationAction;
  amountTrust: string;
  receiver?: Address;
  execute: boolean;
};

function valueAfter(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
}

function options(argv: string[]): Options {
  if (argv[0] === "--") argv = argv.slice(1);
  if (argv.includes("--help")) {
    console.log(`Usage:
  pnpm curate:claim -- --claim-id 0x... --action oppose --amount 0.1 --receiver 0x... --dry-run
  INTUITION_SEED_PRIVATE_KEY=<secret> pnpm curate:claim -- --claim-id 0x... --action oppose --amount 0.1 --execute --confirm-mainnet

Options:
  --claim-id <bytes32>           Existing Intuition triple ID
  --action <support|oppose>      Deposit target
  --amount <TRUST>               Human-readable positive TRUST amount
  --receiver <address>           Required for dry-run; execution uses the signer
  --execute --confirm-mainnet    Broadcast after simulation (default is dry-run)`);
    process.exit(0);
  }
  const claimId = valueAfter(argv, "--claim-id") ?? "";
  if (!/^0x[0-9a-f]{64}$/i.test(claimId)) {
    throw new Error("--claim-id must be a 32-byte hex value.");
  }
  const action = valueAfter(argv, "--action");
  if (action !== "support" && action !== "oppose") {
    throw new Error("--action must be support or oppose.");
  }
  const amountTrust = valueAfter(argv, "--amount") ?? "";
  let amount: bigint;
  try {
    amount = parseEther(amountTrust);
  } catch {
    throw new Error("--amount must be a positive TRUST amount.");
  }
  if (amount <= 0n) throw new Error("--amount must be greater than zero.");
  const execute = argv.includes("--execute");
  if (execute && argv.includes("--dry-run")) {
    throw new Error("Choose either --dry-run or --execute.");
  }
  if (execute && !argv.includes("--confirm-mainnet")) {
    throw new Error("Execution requires --execute --confirm-mainnet.");
  }
  const receiverValue = valueAfter(argv, "--receiver");
  const receiver = receiverValue?.toLowerCase() as Address | undefined;
  if (receiver && !/^0x[0-9a-f]{40}$/i.test(receiver)) {
    throw new Error("--receiver must be an EVM address.");
  }
  if (!execute && !receiver) {
    throw new Error("Dry-run requires --receiver for exact calldata.");
  }
  return {
    claimId: claimId.toLowerCase(),
    action,
    amountTrust,
    receiver,
    execute,
  };
}

async function main(): Promise<void> {
  const parsed = options(process.argv.slice(2));
  const publicClient = createPublicClient({
    chain: INTUITION_CHAIN,
    transport: http(INTUITION_MAINNET_RPC),
  });
  if (
    (await publicClient.getChainId()) !== Number(INTUITION_MAINNET_CHAIN_ID)
  ) {
    throw new Error(`Expected Intuition chain ${INTUITION_MAINNET_CHAIN_ID}.`);
  }

  let account: ReturnType<typeof privateKeyToAccount> | undefined;
  if (parsed.execute) {
    const rawKey = process.env.INTUITION_SEED_PRIVATE_KEY?.trim();
    if (!rawKey || !/^0x[0-9a-f]{64}$/i.test(rawKey)) {
      throw new Error(
        "INTUITION_SEED_PRIVATE_KEY must be a 32-byte 0x-prefixed secret.",
      );
    }
    account = privateKeyToAccount(rawKey as Hex);
  }
  const receiver = account?.address ?? parsed.receiver!;
  const amount = parseEther(parsed.amountTrust);
  const plan = await prepareCurationDeposit(
    {
      claimId: parsed.claimId,
      action: parsed.action,
      receiver,
      amount: amount.toString(),
      curveId: "1",
    },
    publicClient as unknown as IntuitionPublicClient,
  );
  if (plan.status !== "ready") throw new Error(plan.message);
  const before = await readIntuitionVault(
    publicClient as unknown as IntuitionPublicClient,
    plan.targetTermId,
    plan.curveId,
    INTUITION_MAINNET_MULTIVAULT,
  );
  if (before.status !== "verified") throw new Error(before.message);

  console.log(`Claim: ${plan.claimId}`);
  console.log(`Action: ${plan.action}`);
  console.log(`Target vault: ${plan.targetTermId}`);
  console.log(`Receiver: ${receiver}`);
  console.log(`Amount: ${formatEther(BigInt(plan.amount))} TRUST`);
  console.log(`Vault before: ${formatEther(BigInt(before.totalAssets))} TRUST`);
  if (!parsed.execute) {
    console.log("DRY RUN: no transaction was broadcast.");
    return;
  }

  const balance = await publicClient.getBalance({ address: receiver });
  if (balance <= amount) {
    throw new Error(
      `Wallet needs more than ${formatEther(amount)} TRUST plus gas.`,
    );
  }
  await publicClient.call({
    account: receiver,
    to: plan.request.to as Address,
    data: plan.request.data as Hex,
    value: BigInt(plan.request.value ?? "0"),
  });
  const walletClient = createWalletClient({
    account: account!,
    chain: INTUITION_CHAIN,
    transport: http(INTUITION_MAINNET_RPC),
  });
  const hash = await walletClient.sendTransaction({
    account: account!,
    chain: INTUITION_CHAIN,
    to: plan.request.to as Address,
    data: plan.request.data as Hex,
    value: BigInt(plan.request.value ?? "0"),
    gasPrice: await publicClient.getGasPrice(),
    type: "legacy",
  });
  console.log(`Transaction: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success")
    throw new Error(`Transaction reverted: ${hash}`);
  const after = await readIntuitionVault(
    publicClient as unknown as IntuitionPublicClient,
    plan.targetTermId,
    plan.curveId,
    INTUITION_MAINNET_MULTIVAULT,
  );
  if (after.status !== "verified") throw new Error(after.message);
  if (BigInt(after.totalAssets) <= BigInt(before.totalAssets)) {
    throw new Error(
      "Receipt confirmed, but target-vault assets did not increase.",
    );
  }
  console.log(`Vault after: ${formatEther(BigInt(after.totalAssets))} TRUST`);
  console.log("Curation proof: receipt and target-vault increase verified.");
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Curation command failed.",
  );
  process.exitCode = 1;
});
