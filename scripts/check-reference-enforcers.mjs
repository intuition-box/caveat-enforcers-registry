import { readFile } from "node:fs/promises";

const path = new URL("../data/metamask-v1.3.0.json", import.meta.url);
const document = JSON.parse(await readFile(path, "utf8"));
const enforcers = document.enforcers;
const errors = [];

if (document.source?.tag !== "v1.3.0") errors.push("source tag must be v1.3.0");
if (document.source?.deploymentChainId !== "1155")
  errors.push("deployment chain must be Intuition mainnet chain 1155");
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
if (
  missing.length !== 1 ||
  missing[0]?.name !== "SpecificActionERC20TransferBatchEnforcer"
)
  errors.push(
    "the known Intuition 1155 gap must be SpecificActionERC20TransferBatchEnforcer only",
  );
if (
  (enforcers ?? []).filter((enforcer) => enforcer.codeStatus === "observed")
    .length !== 31
)
  errors.push("expected 31 observed Intuition 1155 deployments");

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    "MetaMask v1.3.0 reference dataset passed: 32 enforcers, 31 observed, 1 missing.",
  );
}
