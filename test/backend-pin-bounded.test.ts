import assert from "node:assert/strict";
import test from "node:test";
import { RegistryBackend } from "../src/index.ts";
import { prepareAtomDocument } from "../src/pin.ts";

const ADDRESS = "0x1111111111111111111111111111111111111111";
const WALLET = "0x2222222222222222222222222222222222222222";

// A pinner that returns the deterministic CID (so pinAtomDocument accepts it)
// while tracking how many pins ran and the peak concurrency.
function trackingPinner() {
  let active = 0;
  let peak = 0;
  let calls = 0;
  const pin = async (thing: Parameters<typeof prepareAtomDocument>[0]) => {
    calls += 1;
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return prepareAtomDocument(thing).uri;
  };
  return { pin, stats: () => ({ calls, peak }) };
}

// Verifies deployed bytecode and chain id 1155 (0x483).
const rpcFetcher = async (
  _input: string,
  init: { body: string },
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> => {
  const request = JSON.parse(init.body) as { method: string };
  const result = request.method === "eth_chainId" ? "0x483" : "0x6001600055";
  return { ok: true, status: 200, json: async () => ({ result }) };
};

function claimFirstWith(count: number) {
  return {
    version: "2" as const,
    identity: { chainId: "1155", contractAddress: ADDRESS, displayName: "Enf" },
    claims: Array.from({ length: count }, (_, i) => ({
      subject: { kind: "deployment" as const },
      predicate: { kind: "value" as const, value: `has property ${i}` },
      object: { kind: "value" as const, value: `{"index":${i}}` },
    })),
    submitterWallet: WALLET,
  };
}

function backendWith(pinner: ReturnType<typeof trackingPinner>) {
  return new RegistryBackend({
    endpoint: "https://graph.example",
    rpcEndpoint: "https://rpc.example",
    rpcFetcher,
    pinner: pinner.pin,
  });
}

test("pinning is bounded in concurrency and pins every JSON claim", async () => {
  const pinner = trackingPinner();
  const prepared = await backendWith(pinner).prepareSubmission(
    claimFirstWith(8),
  );
  assert.equal(prepared.status, "ready");
  if (prepared.status !== "ready") return;

  const { calls, peak } = pinner.stats();
  assert.equal(calls, 8); // one per JSON claim
  assert.ok(peak <= 5, `peak concurrency ${peak} exceeded the pool of 5`);

  const ipfsAtoms = prepared.plan.operations.filter(
    (op) => op.kind === "ensure-atom" && op.content.startsWith("ipfs://"),
  );
  assert.equal(ipfsAtoms.length, 8);
});

test("the concurrency pool holds at the 20-claim validation ceiling", async () => {
  // Validation caps a submission at 20 claims, so the pin fan-out is already
  // bounded before the backstop cap; the pool must still cap peak concurrency.
  const pinner = trackingPinner();
  const prepared = await backendWith(pinner).prepareSubmission(
    claimFirstWith(20),
  );
  assert.equal(prepared.status, "ready");
  if (prepared.status !== "ready") return;

  const { calls, peak } = pinner.stats();
  assert.equal(calls, 20);
  assert.ok(peak <= 5, `peak concurrency ${peak} exceeded the pool of 5`);
  const ipfsAtoms = prepared.plan.operations.filter(
    (op) => op.kind === "ensure-atom" && op.content.startsWith("ipfs://"),
  );
  assert.equal(ipfsAtoms.length, 20);
});
