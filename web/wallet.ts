import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  type Address,
  type EIP1193Provider,
  type Hex,
} from "viem";
import {
  RegistryBackend,
  type ResolvedSubmission,
  type SubmissionExecutionResult,
} from "../src/backend";
import {
  PROPOSED_ONTOLOGY_MANIFEST,
  INTUITION_MAINNET_GRAPHQL,
  INTUITION_MAINNET_RPC,
} from "../src/ontology";
import type { IntuitionPublicClient } from "../src/intuition";
import { createViemSubmissionWriteAdapter } from "../src/viem-adapter";
import type { CurationExecution, CurationInput } from "../src/curation";
import type { RpcFetcher, SubmissionInput } from "../src/validation";

const INTUITION_MAINNET_HEX = "0x483";

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

async function ensureMainnet(provider: BrowserProvider): Promise<number> {
  let chainId = String(await provider.request({ method: "eth_chainId" }));
  if (chainId.toLowerCase() !== INTUITION_MAINNET_HEX) {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: INTUITION_MAINNET_HEX }],
      });
    } catch {
      throw new Error(
        "Switch your wallet to Intuition mainnet (chain 1155) before writing.",
      );
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

export async function connectBrowserWallet(): Promise<BrowserWallet> {
  const provider = providerOrThrow();
  await provider.request({ method: "eth_requestAccounts" });
  const chainId = await ensureMainnet(provider);
  const accounts = await provider.request({ method: "eth_accounts" });
  const first = Array.isArray(accounts) ? accounts[0] : undefined;
  const address = addressFromAccount(first);
  const transport = custom(provider);
  return {
    address,
    chainId,
    provider,
    publicClient: createPublicClient({ chain: intuitionMainnet, transport }),
    walletClient: createWalletClient({
      account: address,
      chain: intuitionMainnet,
      transport,
    }),
  };
}

function browserRpcFetcher(provider: BrowserProvider): RpcFetcher {
  return async (_input, init) => {
    const body = JSON.parse(init.body) as {
      id?: number;
      method?: string;
      params?: unknown[];
    };
    if (!body.method) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "RPC method is required." } }),
      };
    }
    try {
      const result = await provider.request({
        method: body.method,
        params: body.params,
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: body.id ?? 1, result }),
      };
    } catch (error) {
      return {
        ok: false,
        status: 502,
        json: async () => ({
          error: {
            message:
              error instanceof Error ? error.message : "Wallet RPC failed.",
          },
        }),
      };
    }
  };
}

function backendForWallet(wallet: BrowserWallet): RegistryBackend {
  return new RegistryBackend({
    endpoint: INTUITION_MAINNET_GRAPHQL,
    rpcEndpoint: "browser-wallet-provider",
    ontology: PROPOSED_ONTOLOGY_MANIFEST,
    publicClient: wallet.publicClient as unknown as IntuitionPublicClient,
    rpcFetcher: browserRpcFetcher(wallet.provider),
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
): Promise<ResolvedSubmission> {
  return backendForWallet(wallet).resolveSubmission(input);
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
): Promise<SubmissionExecutionResult> {
  return backendForWallet(wallet).executeSubmission(
    input,
    writeAdapterForWallet(wallet),
    {
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
