import type { EnforcerRecord } from "./types";

const referenceNames = [
  "AllowedCalldataEnforcer",
  "AllowedMethodsEnforcer",
  "AllowedTargetsEnforcer",
  "ApprovalRevocationEnforcer",
  "ArgsEqualityCheckEnforcer",
  "BlockNumberEnforcer",
  "DeployedEnforcer",
  "ERC1155BalanceChangeEnforcer",
  "ERC20BalanceChangeEnforcer",
  "ERC20PeriodTransferEnforcer",
  "ERC20StreamingEnforcer",
  "ERC20TransferAmountEnforcer",
  "ERC721BalanceChangeEnforcer",
  "ERC721TransferEnforcer",
  "ExactCalldataEnforcer",
  "ExactCalldataBatchEnforcer",
  "ExactExecutionEnforcer",
  "ExactExecutionBatchEnforcer",
  "IdEnforcer",
  "LimitedCallsEnforcer",
  "MultiTokenPeriodEnforcer",
  "NativeBalanceChangeEnforcer",
  "NativeTokenPaymentEnforcer",
  "NativeTokenPeriodTransferEnforcer",
  "NativeTokenStreamingEnforcer",
  "NativeTokenTransferAmountEnforcer",
  "NonceEnforcer",
  "OwnershipTransferEnforcer",
  "RedeemerEnforcer",
  "SpecificActionERC20TransferBatchEnforcer",
  "TimestampEnforcer",
  "ValueLteEnforcer",
] as const;

function getDomain(name: string) {
  if (
    name.includes("ERC20") ||
    name.includes("ERC721") ||
    name.includes("ERC1155") ||
    name.includes("Token")
  )
    return "Assets";
  if (
    name.includes("Calldata") ||
    name.includes("Execution") ||
    name.includes("Target") ||
    name.includes("Method") ||
    name.includes("Args") ||
    name.includes("Action")
  )
    return "Calls";
  if (
    name.includes("Block") ||
    name.includes("Period") ||
    name.includes("Streaming") ||
    name.includes("Timestamp") ||
    name.includes("Limited") ||
    name.includes("Nonce")
  )
    return "Timing & limits";
  return "Identity & state";
}

function getOperation(name: string) {
  if (
    name.includes("Calldata") ||
    name.includes("Execution") ||
    name.includes("Target") ||
    name.includes("Method") ||
    name.includes("Action")
  )
    return "Contract calls";
  if (
    name.includes("ERC20") ||
    name.includes("ERC721") ||
    name.includes("ERC1155") ||
    name.includes("Token")
  )
    return "Token movement";
  return "Delegation state";
}

export const referenceEntries: EnforcerRecord[] = referenceNames.map(
  (name, index) => ({
    id: `reference:${name}`,
    label: name,
    description: `Reference enforcer for ${getOperation(name).toLowerCase()}.`,
    domain: getDomain(name),
    operation: getOperation(name),
    chain: "Multi-chain reference",
    audit: "Source linked",
    stake: 0,
    stakeLabel: "Awaiting signal",
    state: "reference",
    createdAt: `2026-08-${String(1 + (index % 9)).padStart(2, "0")}`,
    deployment: "CAIP-10 deployment record pending mainnet registry seed",
    source: "MetaMask Delegation Framework reference collection",
    terms:
      "Terms codec document pending source-by-source extraction and review.",
    claims: [
      {
        predicate: "is",
        object: "ERC-7710 caveat enforcer",
        stake: "Awaiting signal",
        side: "support",
      },
      {
        predicate: "source at",
        object: "MetaMask Delegation Framework",
        stake: "Awaiting signal",
        side: "support",
      },
      {
        predicate: "has terms schema",
        object: "Codec review required",
        stake: "Awaiting signal",
        side: "support",
      },
    ],
    usage: ["Reference collection entry", "Wallet integration mapping pending"],
  }),
);
