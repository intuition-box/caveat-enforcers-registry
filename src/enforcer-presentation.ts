export type EnforcerPresentation = {
  domain: string;
  operation: string;
  purpose: string;
};

const PRESENTATION_BY_TYPE: Record<string, EnforcerPresentation> = {
  AllowedCalldataEnforcer: {
    domain: "Calldata shape",
    operation: "Contract call",
    purpose: "Pins the calldata a delegation may pass.",
  },
  AllowedMethodsEnforcer: {
    domain: "Callable method",
    operation: "Contract call",
    purpose: "Limits execution to approved function selectors.",
  },
  AllowedTargetsEnforcer: {
    domain: "Target address",
    operation: "Contract call",
    purpose: "Restricts calls to approved contract addresses.",
  },
  ApprovalRevocationEnforcer: {
    domain: "Approval revocation",
    operation: "Token approval",
    purpose: "Requires token approvals to be revoked after delegated use.",
  },
  BlockNumberEnforcer: {
    domain: "Block window",
    operation: "Execution eligibility",
    purpose: "Constrains execution to a block range.",
  },
  DeployedEnforcer: {
    domain: "Deployment proof",
    operation: "Contract call",
    purpose: "Checks that an enforcer is deployed at a target address.",
  },
  ERC20BalanceChangeEnforcer: {
    domain: "Balance change",
    operation: "ERC-20 transfer",
    purpose: "Constrains the change in an ERC-20 balance.",
  },
  ERC20TransferAmountEnforcer: {
    domain: "Amount limit",
    operation: "ERC-20 transfer",
    purpose: "Limits cumulative ERC-20 transfer value.",
  },
  ERC20PeriodTransferEnforcer: {
    domain: "Periodic amount",
    operation: "ERC-20 transfer",
    purpose: "Limits ERC-20 transfers inside a recurring period.",
  },
  ERC20StreamingEnforcer: {
    domain: "Streaming amount",
    operation: "ERC-20 transfer",
    purpose: "Controls the rate of an ERC-20 stream.",
  },
  ERC721BalanceChangeEnforcer: {
    domain: "NFT balance",
    operation: "ERC-721 transfer",
    purpose: "Constrains ERC-721 balance changes.",
  },
  ERC721TransferEnforcer: {
    domain: "NFT transfer",
    operation: "ERC-721 transfer",
    purpose: "Constrains ERC-721 transfers.",
  },
  ERC1155BalanceChangeEnforcer: {
    domain: "Multi-token balance",
    operation: "ERC-1155 transfer",
    purpose: "Constrains ERC-1155 balance changes.",
  },
  ExactCalldataBatchEnforcer: {
    domain: "Batch calldata",
    operation: "Batch contract call",
    purpose: "Pins a batch of calldata values.",
  },
  ExactCalldataEnforcer: {
    domain: "Exact calldata",
    operation: "Contract call",
    purpose: "Pins the calldata for an execution.",
  },
  ExactExecutionBatchEnforcer: {
    domain: "Batch execution",
    operation: "Batch contract call",
    purpose: "Constrains a batch of exact executions.",
  },
  ExactExecutionEnforcer: {
    domain: "Exact execution",
    operation: "Contract call",
    purpose: "Constrains the target, value, and calldata of an execution.",
  },
  IdEnforcer: {
    domain: "Delegation identity",
    operation: "Delegation redemption",
    purpose: "Binds a caveat to a specific delegation identity.",
  },
  LogicalOrWrapperEnforcer: {
    domain: "Alternative rule",
    operation: "Composed execution",
    purpose: "Allows one of several wrapped enforcers to pass.",
  },
  LimitedCallsEnforcer: {
    domain: "Call count",
    operation: "Delegation redemption",
    purpose: "Limits how many calls a delegation may make.",
  },
  MultiTokenPeriodEnforcer: {
    domain: "Periodic multi-token",
    operation: "Token transfer",
    purpose: "Limits multi-token movement inside a recurring period.",
  },
  NativeBalanceChangeEnforcer: {
    domain: "Native balance",
    operation: "Native token transfer",
    purpose: "Constrains native-token balance changes.",
  },
  ArgsEqualityCheckEnforcer: {
    domain: "Argument equality",
    operation: "Contract call",
    purpose: "Checks equality between call arguments.",
  },
  NativeTokenPaymentEnforcer: {
    domain: "Native payment",
    operation: "Native token payment",
    purpose: "Requires a native-token payment under the delegation.",
  },
  NativeTokenTransferAmountEnforcer: {
    domain: "Amount limit",
    operation: "Native token transfer",
    purpose: "Caps native-token transfers.",
  },
  NativeTokenStreamingEnforcer: {
    domain: "Streaming amount",
    operation: "Native token transfer",
    purpose: "Controls the rate of a native-token stream.",
  },
  NativeTokenPeriodTransferEnforcer: {
    domain: "Periodic amount",
    operation: "Native token transfer",
    purpose: "Limits native-token transfers inside a recurring period.",
  },
  NonceEnforcer: {
    domain: "Nonce",
    operation: "Delegation redemption",
    purpose: "Constrains reuse of a delegation nonce.",
  },
  OwnershipTransferEnforcer: {
    domain: "Ownership",
    operation: "Ownership transfer",
    purpose: "Controls an ownership transfer path.",
  },
  RedeemerEnforcer: {
    domain: "Redeemer",
    operation: "Delegation redemption",
    purpose: "Restricts who may redeem a delegation.",
  },
  SpecificActionERC20TransferBatchEnforcer: {
    domain: "Specific action",
    operation: "ERC-20 batch transfer",
    purpose: "Constrains a specific ERC-20 transfer batch.",
  },
  TimestampEnforcer: {
    domain: "Time window",
    operation: "Execution eligibility",
    purpose: "Sets a valid time window for execution.",
  },
  ValueLteEnforcer: {
    domain: "Value limit",
    operation: "Contract call",
    purpose: "Caps the native value attached to an execution.",
  },
};

function humanizeType(typeName: string): string {
  return typeName
    .replace(/Enforcer$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/ERC\s?(20|721|1155)/g, "ERC-$1")
    .trim();
}

/**
 * Produce search and display metadata from the canonical implementation type.
 * These values are presentation aids, not persisted Intuition claims.
 */
export function deriveEnforcerPresentation(
  typeName: string,
): EnforcerPresentation {
  const known = PRESENTATION_BY_TYPE[typeName];
  if (known) return known;

  const readable = humanizeType(typeName) || "Caveat";
  const lower = typeName.toLowerCase();
  const operation = lower.includes("transfer")
    ? "Token transfer"
    : lower.includes("payment")
      ? "Token payment"
      : lower.includes("redeem") || lower.includes("nonce")
        ? "Delegation redemption"
        : lower.includes("batch")
          ? "Batch contract call"
          : "Contract call";

  return {
    domain: "Other boundary",
    operation,
    purpose: `${readable} caveat applied to delegated execution.`,
  };
}
