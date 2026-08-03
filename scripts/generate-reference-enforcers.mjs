import { writeFile } from "node:fs/promises";
import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";

const chainId = 1155;
const rpcEndpoint = "https://rpc.intuition.systems";
const outputPath = new URL("../data/metamask-v1.3.0.json", import.meta.url);

async function rpc(method, params) {
  const response = await fetch(rpcEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) {
    throw new Error(`Intuition RPC returned HTTP ${response.status}.`);
  }
  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message ?? `${method} failed.`);
  }
  return payload.result;
}

const environment = getSmartAccountsEnvironment(chainId);
const entries = await Promise.all(
  Object.entries(environment.caveatEnforcers)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(async ([name, address]) => {
      const code = await rpc("eth_getCode", [address, "latest"]);
      return {
        name,
        address,
        codeStatus: code === "0x" ? "missing" : "observed",
        codeLengthBytes: Math.max((code.length - 2) / 2, 0),
      };
    }),
);

const document = {
  source: {
    project: "MetaMask Smart Accounts Kit",
    package: "@metamask/smart-accounts-kit",
    requestedVersion: "^1.6.0",
    resolvedVersion: "1.7.0",
    environment: "getSmartAccountsEnvironment(1155).caveatEnforcers",
    deploymentChainId: String(chainId),
    repository: "https://github.com/MetaMask/smart-accounts-kit",
    registryStatus: "reference-only",
    registryStatusNote:
      "These records describe the initial reference collection. They are not Intuition membership claims and do not imply approval or support.",
  },
  observations: {
    observedAt: new Date().toISOString(),
    rpcEndpoint,
    observationSource: "eth_getCode audit",
    codeStatusMeaning:
      "observed means non-empty bytecode was reported at the deterministic address on Intuition chain 1155; missing means no bytecode was reported.",
  },
  enforcers: entries,
};

if (entries.length !== 32) {
  throw new Error(`Expected 32 kit enforcers, received ${entries.length}.`);
}
const missing = entries.filter((entry) => entry.codeStatus === "missing");
if (missing.length) {
  throw new Error(
    `Expected all kit enforcers to have code on Intuition 1155; missing: ${missing.map((entry) => entry.name).join(", ")}`,
  );
}

await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`);
console.log(
  `Wrote ${entries.length} kit enforcers; all have non-empty code on chain ${chainId}.`,
);
