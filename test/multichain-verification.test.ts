import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { RegistryBackend } from "../src/backend.js";
import { PROPOSED_ONTOLOGY_MANIFEST } from "../src/ontology.js";

const example = JSON.parse(
  readFileSync(
    new URL("../schema/submission.example.json", import.meta.url),
    "utf8",
  ),
);

test("submission verification reads deployment code from the selected chain RPC", async () => {
  const calls: string[] = [];
  const backend = new RegistryBackend({
    endpoint: "https://graph.example",
    rpcEndpoint: "https://intuition.example",
    verificationRpcEndpoints: { "8453": "https://base.example" },
    ontology: PROPOSED_ONTOLOGY_MANIFEST,
    rpcFetcher: async (input, init) => {
      calls.push(input);
      const method = (JSON.parse(init.body) as { method: string }).method;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: "2.0",
          id: 1,
          result: method === "eth_chainId" ? "0x2105" : "0x6000",
        }),
      };
    },
  });

  const result = await backend.prepareSubmission({ ...example, chainId: 8453 });
  assert.equal(result.status, "ready");
  assert.deepEqual(calls, ["https://base.example", "https://base.example"]);
});

test("unconfigured target chains fail before any Intuition write is planned", async () => {
  const backend = new RegistryBackend({
    endpoint: "https://graph.example",
    rpcEndpoint: "https://intuition.example",
    ontology: PROPOSED_ONTOLOGY_MANIFEST,
  });
  const result = await backend.prepareSubmission({ ...example, chainId: 8453 });
  assert.deepEqual(result, {
    status: "blocked",
    message:
      "A target-chain RPC endpoint is required to verify deployment code on EIP-155 chain 8453.",
  });
});
