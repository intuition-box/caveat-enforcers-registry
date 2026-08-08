import assert from "node:assert/strict";
import test from "node:test";
import { intuitionMainnet } from "@0xintuition/protocol";
import { encodeCreateAtoms } from "../src/intuition.js";
import {
  INTUITION_MAINNET_MULTIVAULT,
  INTUITION_MAINNET_RPC,
} from "../src/ontology.js";
import {
  createBrowserSubmissionWriteAdapter,
  type BrowserWallet,
} from "../web/wallet.js";

test("browser writes use Intuition's canonical RPC configuration", () => {
  assert.equal(INTUITION_MAINNET_RPC, intuitionMainnet.rpcUrls.default.http[0]);
  assert.equal(INTUITION_MAINNET_RPC, "https://rpc.intuition.systems/http");
});

test("browser writes sign the exact simulated call in legacy fee mode", async () => {
  const account = "0x1111111111111111111111111111111111111111";
  const hash = `0x${"22".repeat(32)}` as const;
  const calls: string[] = [];
  const wallet = {
    address: account,
    chainId: 1155,
    provider: {
      request: async ({ method }: { method: string }) => {
        calls.push(`provider:${method}`);
        if (method === "eth_chainId") return "0x483";
        throw new Error(`Unexpected provider request: ${method}`);
      },
    },
    publicClient: {
      simulateContract: async (request: { functionName: string }) => {
        calls.push(`simulate:${request.functionName}`);
        return { request };
      },
      getGasPrice: async () => 10n,
      estimateGas: async (request: { type?: string }) => {
        calls.push(`estimate:${request.type}`);
        return 100n;
      },
      waitForTransactionReceipt: async () => ({
        status: "success",
        blockNumber: 42n,
      }),
    },
    walletClient: {
      sendTransaction: async (request: {
        type?: string;
        gas?: bigint;
        gasPrice?: bigint;
      }) => {
        calls.push(`send:${request.type}`);
        assert.equal(request.type, "legacy");
        assert.equal(request.gas, 120n);
        assert.equal(request.gasPrice, 10n);
        return hash;
      },
    },
  } as unknown as BrowserWallet;
  const adapter = createBrowserSubmissionWriteAdapter(wallet);
  const transaction = encodeCreateAtoms(["0x1234"], [1n], {
    address: INTUITION_MAINNET_MULTIVAULT,
    value: "1",
  });

  await adapter.simulate(transaction);
  assert.equal(await adapter.send(transaction), hash);
  assert.deepEqual(calls, [
    "provider:eth_chainId",
    "simulate:createAtoms",
    "estimate:legacy",
    "provider:eth_chainId",
    "send:legacy",
  ]);

  await assert.rejects(
    () => adapter.send(transaction),
    /changed after simulation/i,
  );
});
