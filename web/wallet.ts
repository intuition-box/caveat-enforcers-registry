import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  type Address,
  type EIP1193Provider,
  type Hex,
} from "viem";
import { MultiVaultAbi } from "@0xintuition/protocol";
import {
  RegistryBackend,
  type ResolvedSubmission,
  type SubmissionExecutionResult,
} from "../src/backend";
import {
  PROPOSED_ONTOLOGY_MANIFEST,
  INTUITION_MAINNET_GRAPHQL,
  INTUITION_MAINNET_MULTIVAULT,
  INTUITION_MAINNET_RPC,
} from "../src/ontology";
import type { IntuitionPublicClient } from "../src/intuition";
import { createViemSubmissionWriteAdapter } from "../src/viem-adapter";
import type { CurationExecution, CurationInput } from "../src/curation";
import type { RpcFetcher, SubmissionInput } from "../src/validation";
import type { SubmissionWriteOptions } from "../src/write-workflow";

const INTUITION_MAINNET_HEX = "0x483";

export const INTUITION_MAINNET_WALLET_CONFIG = {
  chainId: INTUITION_MAINNET_HEX,
  chainName: "Intuition Mainnet",
  nativeCurrency: { name: "Trust", symbol: "TRUST", decimals: 18 },
  rpcUrls: [INTUITION_MAINNET_RPC],
  blockExplorerUrls: ["https://explorer.intuition.systems"],
} as const;

const intuitionMainnet = defineChain({
  id: 1155,
  name: "Intuition",
  nativeCurrency: { name: "Trust", symbol: "TRUST", decimals: 18 },
  rpcUrls: {
    default: { http: [INTUITION_MAINNET_RPC] },
  },
});

type BrowserProvider = EIP1193Provider & {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

export type BrowserWalletConnectionState = {
  available: boolean;
  chainId?: number;
  onIntuition: boolean;
};

export type BrowserWallet = {
  address: Address;
  chainId: number;
  provider: BrowserProvider;
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: ReturnType<typeof createWalletClient>;
};

function providerOrThrow(): BrowserProvider {
  const provider = window.ethereum as BrowserProvider | undefined;
  if (!provider) {
    throw new Error(
      "No browser wallet was detected. Install or unlock a wallet such as MetaMask, then try again.",
    );
  }
  return provider;
}

function addressFromAccount(value: unknown): Address {
  if (typeof value !== "string" || !/^0x[a-f0-9]{40}$/i.test(value)) {
    throw new Error("The wallet returned an invalid account address.");
  }
  return value.toLowerCase() as Address;
}

function providerErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("code" in error))
    return undefined;
  const value = (error as { code?: unknown }).code;
  return typeof value === "number" ? value : undefined;
}

function providerErrorMessage(error: unknown, fallback: string): string {
  if (providerErrorCode(error) === 4001) {
    return "The wallet request was cancelled. Reopen your wallet and approve the request to continue.";
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

async function addIntuitionMainnet(provider: BrowserProvider): Promise<void> {
  try {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [INTUITION_MAINNET_WALLET_CONFIG],
    });
  } catch (error) {
    throw new Error(
      providerErrorMessage(
        error,
        "Your wallet could not add Intuition mainnet. Add chain 1155 manually, then try again.",
      ),
    );
  }
}

async function ensureMainnet(provider: BrowserProvider): Promise<number> {
  let chainId = String(await provider.request({ method: "eth_chainId" }));
  if (chainId.toLowerCase() !== INTUITION_MAINNET_HEX) {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: INTUITION_MAINNET_HEX }],
      });
    } catch (error) {
      if (providerErrorCode(error) === 4902) {
        await addIntuitionMainnet(provider);
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: INTUITION_MAINNET_HEX }],
          });
        } catch (switchError) {
          throw new Error(
            providerErrorMessage(
              switchError,
              "Intuition mainnet was added, but the wallet did not switch to it.",
            ),
          );
        }
      } else {
        throw new Error(
          providerErrorMessage(
            error,
            "Switch your wallet to Intuition mainnet (chain 1155) before writing.",
          ),
        );
      }
    }
    chainId = String(await provider.request({ method: "eth_chainId" }));
    if (chainId.toLowerCase() !== INTUITION_MAINNET_HEX) {
      throw new Error(
        "Your wallet did not switch to Intuition mainnet (chain 1155).",
      );
    }
  }
  return 1155;
}

export function browserWalletAvailable(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export async function inspectBrowserWallet(): Promise<BrowserWalletConnectionState> {
  if (!browserWalletAvailable()) {
    return { available: false, onIntuition: false };
  }
  try {
    const chainId = Number.parseInt(
      String(await providerOrThrow().request({ method: "eth_chainId" })),
      16,
    );
    return {
      available: true,
      ...(Number.isFinite(chainId) ? { chainId } : {}),
      onIntuition: chainId === 1155,
    };
  } catch {
    return { available: true, onIntuition: false };
  }
}

export async function connectBrowserWallet(): Promise<BrowserWallet> {
  const provider = providerOrThrow();
  try {
    await provider.request({ method: "eth_requestAccounts" });
  } catch (error) {
    throw new Error(
      providerErrorMessage(
        error,
        "Your wallet did not provide an account. Unlock it and try again.",
      ),
    );
  }
  const chainId = await ensureMainnet(provider);
  const accounts = await provider.request({ method: "eth_accounts" });
  const first = Array.isArray(accounts) ? accounts[0] : undefined;
  const address = addressFromAccount(first);
  const walletTransport = custom(provider);
  return {
    address,
    chainId,
    provider,
    // Keep reads and simulations on the canonical Intuition RPC. Some injected
    // wallet providers proxy eth_call through their own transaction encoder,
    // which can corrupt the simulation before a wallet signature is requested.
    publicClient: createPublicClient({
      chain: intuitionMainnet,
      transport: http(INTUITION_MAINNET_RPC),
    }),
    walletClient: createWalletClient({
      account: address,
      chain: intuitionMainnet,
      transport: walletTransport,
    }),
  };
}

const directIntuitionRpcFetcher: RpcFetcher = (_input, init) =>
  fetch(INTUITION_MAINNET_RPC, init);

function backendForWallet(wallet: BrowserWallet): RegistryBackend {
  return new RegistryBackend({
    endpoint: INTUITION_MAINNET_GRAPHQL,
    rpcEndpoint: INTUITION_MAINNET_RPC,
    ontology: PROPOSED_ONTOLOGY_MANIFEST,
    publicClient: wallet.publicClient as unknown as IntuitionPublicClient,
    rpcFetcher: directIntuitionRpcFetcher,
  });
}

function writeAdapterForWallet(wallet: BrowserWallet) {
  return createViemSubmissionWriteAdapter({
    publicClient: {
      call: async ({ to, data, value }) =>
        wallet.publicClient.call({
          to,
          data,
          value,
          account: wallet.address,
        }),
      waitForTransactionReceipt: ({ hash }) =>
        wallet.publicClient.waitForTransactionReceipt({ hash }),
    },
    walletClient: {
      account: wallet.address,
      sendTransaction: ({ to, data, value }) =>
        wallet.walletClient.sendTransaction({
          account: wallet.address,
          chain: intuitionMainnet,
          to,
          data,
          value,
        }),
    },
    account: wallet.address,
  });
}

/**
 * Resolve the exact Intuition write batch and complete its read-only preflight
 * without requesting a signature. Each request is simulated immediately
 * before execution after the user approves the displayed plan.
 */
export async function previewWithBrowserWallet(
  input: SubmissionInput,
  wallet: BrowserWallet,
): Promise<{
  result: ResolvedSubmission;
  write?: SubmissionWriteOptions;
}> {
  const backend = backendForWallet(wallet);
  // Resolve once to learn the exact number of missing records. MultiVault
  // creation is payable, so a zero-value preview is only an accounting pass;
  // no simulation or signature is requested here.
  const unpriced = await backend.resolveSubmission(input);
  if (unpriced.status !== "ready") return { result: unpriced };

  const [atomCost, tripleCost] = await Promise.all([
    wallet.publicClient.readContract({
      address: INTUITION_MAINNET_MULTIVAULT,
      abi: MultiVaultAbi,
      functionName: "getAtomCost",
    }),
    wallet.publicClient.readContract({
      address: INTUITION_MAINNET_MULTIVAULT,
      abi: MultiVaultAbi,
      functionName: "getTripleCost",
    }),
  ]);
  if (typeof atomCost !== "bigint" || typeof tripleCost !== "bigint") {
    throw new Error("Intuition returned invalid live creation costs.");
  }

  const atomCount =
    unpriced.batch.transactions.find(
      (transaction) => transaction.kind === "create-atoms",
    )?.atomIds?.length ?? 0;
  const tripleCount =
    unpriced.batch.transactions.find(
      (transaction) => transaction.kind === "create-triples",
    )?.tripleIds?.length ?? 0;
  const write: SubmissionWriteOptions = {
    atomAsset: atomCost,
    atomValue: (atomCost * BigInt(atomCount)).toString(),
    tripleAsset: tripleCost,
    tripleValue: (tripleCost * BigInt(tripleCount)).toString(),
  };
  return { result: await backend.resolveSubmission(input, { write }), write };
}

/**
 * Execute the same validation, simulation, write, receipt, and indexer
 * verification pipeline as the backend, but keep the signing key in the
 * user's injected browser wallet. No server signer is involved.
 */
export async function submitWithBrowserWallet(
  input: SubmissionInput,
  wallet: BrowserWallet,
  expectedBatch?: Extract<ResolvedSubmission, { status: "ready" }>["batch"],
  write?: SubmissionWriteOptions,
): Promise<SubmissionExecutionResult> {
  return backendForWallet(wallet).executeSubmission(
    input,
    writeAdapterForWallet(wallet),
    {
      write,
      expectedBatch,
      indexing: {
        maxAttempts: 5,
        delayMs: 1500,
        pageSize: 100,
        maxPages: 10,
      },
    },
  );
}

export async function curateWithBrowserWallet(
  input: CurationInput,
  wallet: BrowserWallet,
): Promise<CurationExecution> {
  return backendForWallet(wallet).executeCuration(
    input,
    writeAdapterForWallet(wallet),
  );
}

export type BrowserWalletStatus = {
  available: boolean;
  connected: boolean;
  address?: Address;
  chainId?: number;
};

export function walletStatus(
  wallet: BrowserWallet | null,
): BrowserWalletStatus {
  return wallet
    ? {
        available: true,
        connected: true,
        address: wallet.address,
        chainId: wallet.chainId,
      }
    : { available: browserWalletAvailable(), connected: false };
}

export type { Hex };
