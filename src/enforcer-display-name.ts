/**
 * Deterministic presentation names for enforcer types.
 *
 * These labels are derived UI metadata. They are not canonical identities and
 * do not need their own Intuition atoms or submission fields.
 */
export const ENFORCER_DISPLAY_NAME_VERSION = "1";
export const ENFORCER_DISPLAY_NAME_MAX_LENGTH = 18;

const DIRECT_NAMES: Readonly<Record<string, string>> = {
  ApprovalRevocation: "Approval Revoke",
  ArgsEqualityCheck: "Args Match",
  BlockNumber: "Block Window",
  Deployed: "Deployment",
  ExactCalldata: "Exact Calldata",
  ExactCalldataBatch: "Exact Data Batch",
  ExactExecution: "Exact Exec",
  ExactExecutionBatch: "Exact Exec Batch",
  Id: "Single-Use ID",
  LimitedCalls: "Call Limit",
  LogicalOrWrapper: "Logical OR",
  MultiTokenPeriod: "Multi-Token Period",
  NativeTokenPayment: "Native Payment",
  Nonce: "Nonce Epoch",
  OwnershipTransfer: "Ownership Transfer",
  Redeemer: "Redeemer Access",
  SpecificActionERC20TransferBatch: "Action Transfer",
  Timestamp: "Time Window",
  ValueLte: "Native Value Cap",
};

const ASSET_LABELS: Readonly<Record<string, string>> = {
  ERC20: "ERC-20",
  ERC721: "ERC-721",
  ERC1155: "ERC-1155",
  Native: "Native",
  NativeToken: "Native",
};

const BEHAVIOR_LABELS: Readonly<Record<string, string>> = {
  BalanceChange: "Balance",
  PeriodTransfer: "Period",
  Streaming: "Stream",
  TransferAmount: "Cap",
  Transfer: "Transfer",
};

const ALLOWED_LABELS: Readonly<Record<string, string>> = {
  Calldata: "Calldata Allow",
  Methods: "Method Allow",
  Targets: "Target Allow",
};

function canonicalStem(typeName: string): string {
  const trimmed = typeName.trim();
  return trimmed.replace(/Enforcer$/, "") || "Enforcer";
}

function humanize(stem: string): string {
  return stem
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d+)/g, "$1-$2")
    .replace(/(\d+)([A-Za-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function fitDisplayName(value: string): string {
  if (value.length <= ENFORCER_DISPLAY_NAME_MAX_LENGTH) return value;

  const compact = value
    .replace(/Execution/g, "Exec")
    .replace(/Calldata/g, "Data")
    .replace(/Transfer/g, "Xfer")
    .replace(/Equality/g, "Equal")
    .replace(/Revocation/g, "Revoke")
    .replace(/Allowance/g, "Limit");
  if (compact.length <= ENFORCER_DISPLAY_NAME_MAX_LENGTH) return compact;

  return `${compact.slice(0, ENFORCER_DISPLAY_NAME_MAX_LENGTH - 1).trimEnd()}…`;
}

/** Generate the base display name for one canonical enforcer type. */
export function enforcerDisplayName(typeName: string): string {
  const stem = canonicalStem(typeName);
  const direct = DIRECT_NAMES[stem];
  if (direct) return direct;

  const allowed = /^Allowed(Calldata|Methods|Targets)$/.exec(stem);
  if (allowed) return ALLOWED_LABELS[allowed[1]];

  const assetBehavior =
    /^(ERC20|ERC721|ERC1155|NativeToken|Native)(BalanceChange|PeriodTransfer|Streaming|TransferAmount|Transfer)$/.exec(
      stem,
    );
  if (assetBehavior) {
    return `${ASSET_LABELS[assetBehavior[1]]} ${BEHAVIOR_LABELS[assetBehavior[2]]}`;
  }

  return fitDisplayName(humanize(stem));
}

function stableSuffix(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(-3).padStart(3, "0");
}

function appendSuffix(base: string, suffix: string): string {
  const available = ENFORCER_DISPLAY_NAME_MAX_LENGTH - suffix.length - 1;
  return `${base.slice(0, available).trimEnd()}-${suffix}`;
}

/**
 * Generate unique labels for a collection. A stable suffix is only added when
 * two different canonical types collapse to the same compact presentation.
 */
export function buildEnforcerDisplayNameMap(
  typeNames: readonly string[],
): ReadonlyMap<string, string> {
  const uniqueNames = [...new Set(typeNames.map((name) => name.trim()))].sort();
  const baseNames = new Map(
    uniqueNames.map((name) => [name, enforcerDisplayName(name)]),
  );
  const groups = new Map<string, string[]>();

  for (const [name, base] of baseNames) {
    const key = base.toLocaleLowerCase("en-US");
    groups.set(key, [...(groups.get(key) ?? []), name]);
  }

  const result = new Map<string, string>();
  for (const names of groups.values()) {
    if (names.length === 1) {
      const name = names[0];
      result.set(name, baseNames.get(name) ?? "Enforcer");
      continue;
    }

    for (const name of names) {
      result.set(
        name,
        appendSuffix(baseNames.get(name) ?? "Enforcer", stableSuffix(name)),
      );
    }
  }

  return result;
}

/** Preserve unresolved IDs and CAIP labels instead of prettifying them. */
export function enforcerTypeDisplayName(value: string): string {
  return /^[A-Za-z][A-Za-z0-9]*Enforcer$/.test(value)
    ? enforcerDisplayName(value)
    : value;
}
