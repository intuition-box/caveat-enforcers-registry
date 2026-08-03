import { readFile } from "node:fs/promises";

const path = new URL("../data/metamask-v1.3.0.json", import.meta.url);
const document = JSON.parse(await readFile(path, "utf8"));
const enforcers = document.enforcers;
const errors = [];

if (document.source?.package !== "@metamask/smart-accounts-kit")
  errors.push("reference source must be @metamask/smart-accounts-kit");
if (
  document.source?.environment !==
  "getSmartAccountsEnvironment(1155).caveatEnforcers"
)
  errors.push("reference source must be the kit environment enforcer map");
if (document.source?.deploymentChainId !== "1155")
  errors.push("deployment chain must be Intuition mainnet chain 1155");
if (document.observations?.rpcEndpoint !== "https://rpc.intuition.systems")
  errors.push(
    "reference observation RPC must be https://rpc.intuition.systems",
  );
if (document.source?.registryStatus !== "reference-only")
  errors.push("reference data must remain marked reference-only");
if (!Array.isArray(enforcers) || enforcers.length !== 32)
  errors.push(
    `expected exactly 32 enforcers, received ${enforcers?.length ?? 0}`,
  );

const names = new Set();
const addresses = new Set();
for (const [index, enforcer] of (enforcers ?? []).entries()) {
  if (!enforcer || typeof enforcer !== "object") {
    errors.push(`enforcers[${index}] must be an object`);
    continue;
  }
  if (!/^[A-Za-z][A-Za-z0-9]*Enforcer$/.test(enforcer.name ?? ""))
    errors.push(`enforcers[${index}] has an invalid enforcer name`);
  if (names.has(enforcer.name))
    errors.push(`duplicate enforcer name: ${enforcer.name}`);
  names.add(enforcer.name);
  if (!/^0x[0-9a-fA-F]{40}$/.test(enforcer.address ?? ""))
    errors.push(`enforcers[${index}] has an invalid EVM address`);
  const normalizedAddress = enforcer.address?.toLowerCase();
  if (addresses.has(normalizedAddress))
    errors.push(`duplicate enforcer address: ${enforcer.address}`);
  addresses.add(normalizedAddress);
  if (!["observed", "missing"].includes(enforcer.codeStatus))
    errors.push(`enforcers[${index}] has an invalid codeStatus`);
}

const missing = (enforcers ?? []).filter(
  (enforcer) => enforcer.codeStatus === "missing",
);
if (missing.length)
  errors.push(
    "all 32 kit enforcers must report non-empty code on Intuition 1155",
  );
if (
  (enforcers ?? []).filter((enforcer) => enforcer.codeStatus === "observed")
    .length !== 32
)
  errors.push("expected 32 observed Intuition 1155 deployments");

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "MetaMask Smart Accounts Kit reference dataset passed: 32 enforcers, all observed.",
  );
}
