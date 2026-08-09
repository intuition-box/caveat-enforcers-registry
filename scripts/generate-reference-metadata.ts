import { readFile, writeFile } from "node:fs/promises";
import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";
import {
  createCaveatBuilder,
  decodeCaveat,
} from "@metamask/smart-accounts-kit/utils";
import { format } from "prettier";
import type { Hex } from "viem";
import { deriveEnforcerPresentation } from "../src/enforcer-presentation.js";
import type { TermsField, TermsSchema } from "../src/validation.js";

const REFERENCE_URL = new URL("../data/metamask-v1.3.0.json", import.meta.url);
const OUTPUT_URL = new URL(
  "../data/metamask-v1.7.0.metadata.json",
  import.meta.url,
);

const SOURCE_REPOSITORY = "https://github.com/MetaMask/smart-accounts-kit";
const DELEGATION_CORE_VERSION = "2.2.1";
const DELEGATION_CORE_COMMIT = "d3f1dd8b1682ec5b2c961e450d9847d54eb72268";
const SMART_ACCOUNTS_KIT_VERSION = "1.7.0";

const ADDRESS_A = "0x1111111111111111111111111111111111111111";
const ADDRESS_B = "0x2222222222222222222222222222222222222222";
const ADDRESS_C = "0x3333333333333333333333333333333333333333";
const CALLDATA = "0x11223344";
const NONCE = `0x${"00".repeat(31)}01`;
const SALT = `0x${"00".repeat(31)}02`;

type ReferenceDocument = {
  source: Record<string, unknown>;
  enforcers: Array<{ name: string; address: string }>;
};

type EncodingDefinition = {
  kind: TermsSchema["encoding"]["kind"];
  fields: TermsField[] | ((terms: Hex) => TermsField[]);
  fixedLength?: boolean;
};

type Definition = {
  builder: string;
  config: Record<string, unknown>;
  sourceFile: string;
  domains: string[];
  encoding: EncodingDefinition;
  constraints?: string[];
  decodedFixture?: (terms: Hex) => Record<string, unknown>;
};

const field = (
  name: string,
  type: string,
  offset: number,
  bytes: number,
): TermsField => ({ name, type, offset, bytes });

const single = (name: string, type: string): EncodingDefinition => ({
  kind: "packed",
  fields: [field(name, type, 0, 32)],
  fixedLength: true,
});

const definitions: Record<string, Definition> = {
  AllowedCalldataEnforcer: {
    builder: "allowedCalldata",
    config: { startIndex: 4, value: CALLDATA },
    sourceFile: "allowedCalldata.ts",
    domains: ["calldata"],
    encoding: {
      kind: "custom",
      fields: (terms) => [
        field("startIndex", "uint256", 0, 32),
        field("value", "bytes", 32, byteLength(terms) - 32),
      ],
    },
  },
  AllowedMethodsEnforcer: {
    builder: "allowedMethods",
    config: {
      selectors: ["transfer(address,uint256)", "approve(address,uint256)"],
    },
    sourceFile: "allowedMethods.ts",
    domains: ["method"],
    encoding: {
      kind: "custom",
      fields: (terms) => [field("selectors", "bytes4[]", 0, byteLength(terms))],
    },
  },
  AllowedTargetsEnforcer: {
    builder: "allowedTargets",
    config: { targets: [ADDRESS_A, ADDRESS_B] },
    sourceFile: "allowedTargets.ts",
    domains: ["target"],
    encoding: {
      kind: "custom",
      fields: (terms) => [field("targets", "address[]", 0, byteLength(terms))],
    },
  },
  ApprovalRevocationEnforcer: {
    builder: "approvalRevocation",
    config: {
      erc20Approve: true,
      erc721Approve: true,
      erc721SetApprovalForAll: true,
      permit2Approve: true,
      permit2Lockdown: true,
      permit2InvalidateNonces: true,
    },
    sourceFile: "approvalRevocationEnforcer.ts",
    domains: ["approval"],
    encoding: {
      kind: "packed",
      fields: [field("revocationFlags", "uint8", 0, 1)],
      fixedLength: true,
    },
    constraints: [
      "One-byte bitmask: bits 0-5 enable ERC-20 approve, ERC-721 approve, setApprovalForAll, Permit2 approve, Permit2 lockdown, and Permit2 nonce invalidation.",
    ],
    decodedFixture: (terms) => ({
      revocationFlags: BigInt(terms).toString(),
    }),
  },
  ArgsEqualityCheckEnforcer: {
    builder: "argsEqualityCheck",
    config: { args: CALLDATA },
    sourceFile: "argsEqualityCheck.ts",
    domains: ["arguments"],
    encoding: {
      kind: "raw",
      fields: (terms) => [field("args", "bytes", 0, byteLength(terms))],
    },
  },
  BlockNumberEnforcer: {
    builder: "blockNumber",
    config: { afterThreshold: 100n, beforeThreshold: 200n },
    sourceFile: "blockNumber.ts",
    domains: ["block"],
    encoding: {
      kind: "packed",
      fields: [
        field("afterThreshold", "uint128", 0, 16),
        field("beforeThreshold", "uint128", 16, 16),
      ],
      fixedLength: true,
    },
  },
  DeployedEnforcer: {
    builder: "deployed",
    config: { contractAddress: ADDRESS_A, salt: SALT, bytecode: "0x60006000" },
    sourceFile: "deployed.ts",
    domains: ["deployment"],
    encoding: {
      kind: "custom",
      fields: (terms) => [
        field("contractAddress", "address", 0, 20),
        field("salt", "bytes32", 20, 32),
        field("bytecode", "bytes", 52, byteLength(terms) - 52),
      ],
    },
  },
  ERC1155BalanceChangeEnforcer: {
    builder: "erc1155BalanceChange",
    config: {
      tokenAddress: ADDRESS_A,
      recipient: ADDRESS_B,
      tokenId: 7n,
      balance: 10n,
      changeType: 0,
    },
    sourceFile: "erc1155BalanceChange.ts",
    domains: ["balance"],
    encoding: {
      kind: "packed",
      fields: [
        field("changeType", "uint8", 0, 1),
        field("tokenAddress", "address", 1, 20),
        field("recipient", "address", 21, 20),
        field("tokenId", "uint256", 41, 32),
        field("balance", "uint256", 73, 32),
      ],
      fixedLength: true,
    },
  },
  ERC20BalanceChangeEnforcer: {
    builder: "erc20BalanceChange",
    config: {
      tokenAddress: ADDRESS_A,
      recipient: ADDRESS_B,
      balance: 10n,
      changeType: 0,
    },
    sourceFile: "erc20BalanceChange.ts",
    domains: ["balance"],
    encoding: {
      kind: "packed",
      fields: [
        field("changeType", "uint8", 0, 1),
        field("tokenAddress", "address", 1, 20),
        field("recipient", "address", 21, 20),
        field("balance", "uint256", 41, 32),
      ],
      fixedLength: true,
    },
  },
  ERC20PeriodTransferEnforcer: {
    builder: "erc20PeriodTransfer",
    config: {
      tokenAddress: ADDRESS_A,
      periodAmount: 1_000n,
      periodDuration: 86_400,
      startDate: 1_700_000_000,
    },
    sourceFile: "erc20TokenPeriodTransfer.ts",
    domains: ["amount", "time"],
    encoding: {
      kind: "packed",
      fields: [
        field("tokenAddress", "address", 0, 20),
        field("periodAmount", "uint256", 20, 32),
        field("periodDuration", "uint256", 52, 32),
        field("startDate", "uint256", 84, 32),
      ],
      fixedLength: true,
    },
  },
  ERC20StreamingEnforcer: {
    builder: "erc20Streaming",
    config: {
      tokenAddress: ADDRESS_A,
      initialAmount: 10n,
      maxAmount: 1_000n,
      amountPerSecond: 1n,
      startTime: 1_700_000_000,
    },
    sourceFile: "erc20Streaming.ts",
    domains: ["amount", "rate", "time"],
    encoding: {
      kind: "packed",
      fields: [
        field("tokenAddress", "address", 0, 20),
        field("initialAmount", "uint256", 20, 32),
        field("maxAmount", "uint256", 52, 32),
        field("amountPerSecond", "uint256", 84, 32),
        field("startTime", "uint256", 116, 32),
      ],
      fixedLength: true,
    },
  },
  ERC20TransferAmountEnforcer: {
    builder: "erc20TransferAmount",
    config: { tokenAddress: ADDRESS_A, maxAmount: 1_000n },
    sourceFile: "erc20TransferAmount.ts",
    domains: ["amount", "target"],
    encoding: {
      kind: "packed",
      fields: [
        field("tokenAddress", "address", 0, 20),
        field("maxAmount", "uint256", 20, 32),
      ],
      fixedLength: true,
    },
  },
  ERC721BalanceChangeEnforcer: {
    builder: "erc721BalanceChange",
    config: {
      tokenAddress: ADDRESS_A,
      recipient: ADDRESS_B,
      amount: 1n,
      changeType: 0,
    },
    sourceFile: "erc721BalanceChange.ts",
    domains: ["balance"],
    encoding: {
      kind: "packed",
      fields: [
        field("changeType", "uint8", 0, 1),
        field("tokenAddress", "address", 1, 20),
        field("recipient", "address", 21, 20),
        field("amount", "uint256", 41, 32),
      ],
      fixedLength: true,
    },
  },
  ERC721TransferEnforcer: {
    builder: "erc721Transfer",
    config: { tokenAddress: ADDRESS_A, tokenId: 7n },
    sourceFile: "erc721Transfer.ts",
    domains: ["target"],
    encoding: {
      kind: "packed",
      fields: [
        field("tokenAddress", "address", 0, 20),
        field("tokenId", "uint256", 20, 32),
      ],
      fixedLength: true,
    },
  },
  ExactCalldataBatchEnforcer: {
    builder: "exactCalldataBatch",
    config: {
      executions: [{ target: ADDRESS_A, value: 0n, callData: CALLDATA }],
    },
    sourceFile: "exactCalldataBatch.ts",
    domains: ["calldata"],
    encoding: {
      kind: "custom",
      fields: (terms) => [
        field("executions", "(address,uint256,bytes)[]", 0, byteLength(terms)),
      ],
    },
    constraints: [
      "Terms use ABI encoding for an array of (address target, uint256 value, bytes callData) tuples.",
    ],
  },
  ExactCalldataEnforcer: {
    builder: "exactCalldata",
    config: { calldata: CALLDATA },
    sourceFile: "exactCalldata.ts",
    domains: ["calldata"],
    encoding: {
      kind: "raw",
      fields: (terms) => [field("calldata", "bytes", 0, byteLength(terms))],
    },
  },
  ExactExecutionBatchEnforcer: {
    builder: "exactExecutionBatch",
    config: {
      executions: [{ target: ADDRESS_A, value: 0n, callData: CALLDATA }],
    },
    sourceFile: "exactExecutionBatch.ts",
    domains: ["execution"],
    encoding: {
      kind: "custom",
      fields: (terms) => [
        field("executions", "(address,uint256,bytes)[]", 0, byteLength(terms)),
      ],
    },
    constraints: [
      "Terms use ABI encoding for an array of (address target, uint256 value, bytes callData) tuples.",
    ],
  },
  ExactExecutionEnforcer: {
    builder: "exactExecution",
    config: { execution: { target: ADDRESS_A, value: 0n, callData: CALLDATA } },
    sourceFile: "exactExecution.ts",
    domains: ["execution"],
    encoding: {
      kind: "custom",
      fields: (terms) => [
        field(
          "execution",
          "(address,uint256,bytes packed)",
          0,
          byteLength(terms),
        ),
      ],
    },
  },
  IdEnforcer: {
    builder: "id",
    config: { id: 7n },
    sourceFile: "id.ts",
    domains: ["single-use identifier"],
    encoding: single("id", "uint256"),
  },
  LimitedCallsEnforcer: {
    builder: "limitedCalls",
    config: { limit: 5 },
    sourceFile: "limitedCalls.ts",
    domains: ["count"],
    encoding: single("limit", "uint256"),
  },
  MultiTokenPeriodEnforcer: {
    builder: "multiTokenPeriod",
    config: {
      tokenConfigs: [
        {
          token: ADDRESS_A,
          periodAmount: 1_000n,
          periodDuration: 86_400,
          startDate: 1_700_000_000,
        },
      ],
    },
    sourceFile: "multiTokenPeriod.ts",
    domains: ["amount", "time"],
    encoding: {
      kind: "custom",
      fields: (terms) => [
        field(
          "tokenConfigs",
          "(address,uint256,uint256,uint256)[] packed",
          0,
          byteLength(terms),
        ),
      ],
    },
  },
  NativeBalanceChangeEnforcer: {
    builder: "nativeBalanceChange",
    config: { recipient: ADDRESS_B, balance: 10n, changeType: 0 },
    sourceFile: "nativeBalanceChange.ts",
    domains: ["balance"],
    encoding: {
      kind: "packed",
      fields: [
        field("changeType", "uint8", 0, 1),
        field("recipient", "address", 1, 20),
        field("balance", "uint256", 21, 32),
      ],
      fixedLength: true,
    },
  },
  NativeTokenPaymentEnforcer: {
    builder: "nativeTokenPayment",
    config: { recipient: ADDRESS_B, amount: 100n },
    sourceFile: "nativeTokenPayment.ts",
    domains: ["amount", "payment recipient"],
    encoding: {
      kind: "packed",
      fields: [
        field("recipient", "address", 0, 20),
        field("amount", "uint256", 20, 32),
      ],
      fixedLength: true,
    },
  },
  NativeTokenPeriodTransferEnforcer: {
    builder: "nativeTokenPeriodTransfer",
    config: {
      periodAmount: 1_000n,
      periodDuration: 86_400,
      startDate: 1_700_000_000,
    },
    sourceFile: "nativeTokenPeriodTransfer.ts",
    domains: ["amount", "time"],
    encoding: {
      kind: "packed",
      fields: [
        field("periodAmount", "uint256", 0, 32),
        field("periodDuration", "uint256", 32, 32),
        field("startDate", "uint256", 64, 32),
      ],
      fixedLength: true,
    },
  },
  NativeTokenStreamingEnforcer: {
    builder: "nativeTokenStreaming",
    config: {
      initialAmount: 10n,
      maxAmount: 1_000n,
      amountPerSecond: 1n,
      startTime: 1_700_000_000,
    },
    sourceFile: "nativeTokenStreaming.ts",
    domains: ["amount", "rate", "time"],
    encoding: {
      kind: "packed",
      fields: [
        field("initialAmount", "uint256", 0, 32),
        field("maxAmount", "uint256", 32, 32),
        field("amountPerSecond", "uint256", 64, 32),
        field("startTime", "uint256", 96, 32),
      ],
      fixedLength: true,
    },
  },
  NativeTokenTransferAmountEnforcer: {
    builder: "nativeTokenTransferAmount",
    config: { maxAmount: 1_000n },
    sourceFile: "nativeTokenTransferAmount.ts",
    domains: ["amount"],
    encoding: single("maxAmount", "uint256"),
  },
  NonceEnforcer: {
    builder: "nonce",
    config: { nonce: NONCE },
    sourceFile: "nonce.ts",
    domains: ["nonce"],
    encoding: {
      kind: "packed",
      fields: [field("nonce", "bytes32", 0, 32)],
      fixedLength: true,
    },
  },
  OwnershipTransferEnforcer: {
    builder: "ownershipTransfer",
    config: { contractAddress: ADDRESS_A },
    sourceFile: "ownershipTransfer.ts",
    domains: ["ownership", "target"],
    encoding: {
      kind: "packed",
      fields: [field("contractAddress", "address", 0, 20)],
      fixedLength: true,
    },
  },
  RedeemerEnforcer: {
    builder: "redeemer",
    config: { redeemers: [ADDRESS_B, ADDRESS_C] },
    sourceFile: "redeemer.ts",
    domains: ["actor access"],
    encoding: {
      kind: "custom",
      fields: (terms) => [
        field("redeemers", "address[]", 0, byteLength(terms)),
      ],
    },
  },
  SpecificActionERC20TransferBatchEnforcer: {
    builder: "specificActionERC20TransferBatch",
    config: {
      tokenAddress: ADDRESS_A,
      recipient: ADDRESS_B,
      amount: 100n,
      target: ADDRESS_C,
      calldata: CALLDATA,
    },
    sourceFile: "specificActionERC20TransferBatch.ts",
    domains: ["execution", "amount"],
    encoding: {
      kind: "custom",
      fields: (terms) => [
        field("tokenAddress", "address", 0, 20),
        field("recipient", "address", 20, 20),
        field("amount", "uint256", 40, 32),
        field("target", "address", 72, 20),
        field("calldata", "bytes", 92, byteLength(terms) - 92),
      ],
    },
  },
  TimestampEnforcer: {
    builder: "timestamp",
    config: { afterThreshold: 1_700_000_000, beforeThreshold: 1_800_000_000 },
    sourceFile: "timestamp.ts",
    domains: ["time"],
    encoding: {
      kind: "packed",
      fields: [
        field("afterThreshold", "uint128", 0, 16),
        field("beforeThreshold", "uint128", 16, 16),
      ],
      fixedLength: true,
    },
  },
  ValueLteEnforcer: {
    builder: "valueLte",
    config: { maxValue: 100n },
    sourceFile: "valueLte.ts",
    domains: ["native execution value"],
    encoding: single("maxValue", "uint256"),
  },
};

function byteLength(value: Hex): number {
  return (value.length - 2) / 2;
}

function jsonValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toString();
  }
  if (Array.isArray(value)) return value.map(jsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, jsonValue(nested)]),
    );
  }
  return value;
}

function decodedFixture(
  definition: Definition,
  terms: Hex,
  decoded: Record<string, unknown>,
): Record<string, unknown> {
  if (definition.decodedFixture) return definition.decodedFixture(terms);
  const { type: _type, ...values } = decoded;
  return jsonValue(values) as Record<string, unknown>;
}

function buildTermsSchema(
  enforcer: string,
  definition: Definition,
  terms: Hex,
  decoded: Record<string, unknown>,
): TermsSchema {
  const fields =
    typeof definition.encoding.fields === "function"
      ? definition.encoding.fields(terms)
      : definition.encoding.fields;
  return {
    schemaVersion: "1.0.0",
    enforcer,
    source: {
      repository: SOURCE_REPOSITORY,
      commit: DELEGATION_CORE_COMMIT,
      path: `packages/delegation-core/src/caveats/${definition.sourceFile}`,
    },
    encoding: {
      kind: definition.encoding.kind,
      ...(definition.encoding.fixedLength
        ? { totalBytes: byteLength(terms) }
        : {}),
      fields,
    },
    constraints: [
      `Fixture encoded and decoded with @metamask/delegation-core@${DELEGATION_CORE_VERSION}.`,
      ...(definition.constraints ?? []),
    ],
    malformedInputBehavior:
      "Exact rejection behavior is defined by the pinned implementation; malformed or semantically invalid terms may revert.",
    fixtures: [
      {
        terms,
        decoded: decodedFixture(definition, terms, decoded),
      },
    ],
  };
}

async function buildOutput(): Promise<string> {
  const reference = JSON.parse(
    await readFile(REFERENCE_URL, "utf8"),
  ) as ReferenceDocument;
  const environment = getSmartAccountsEnvironment(1155);
  const entries = reference.enforcers.map((entry) => {
    const definition = definitions[entry.name];
    if (!definition) throw new Error(`Missing metadata for ${entry.name}.`);
    const builder = createCaveatBuilder(environment) as unknown as {
      addCaveat: (
        name: string,
        config: Record<string, unknown>,
      ) => {
        build: () => Array<{ enforcer: Hex; terms: Hex; args: Hex }>;
      };
    };
    const [caveat] = builder
      .addCaveat(definition.builder, definition.config)
      .build();
    if (!caveat)
      throw new Error(`Builder produced no caveat for ${entry.name}.`);
    const decoded = decodeCaveat({ caveat, environment }) as unknown as Record<
      string,
      unknown
    >;
    const presentation = deriveEnforcerPresentation(entry.name);
    return {
      name: entry.name,
      address: entry.address.toLowerCase(),
      restrictionDomains: definition.domains,
      operation: presentation.operation,
      purpose: presentation.purpose,
      termsSchema: buildTermsSchema(
        entry.name,
        definition,
        caveat.terms,
        decoded,
      ),
      usage: [
        {
          name: `MetaMask Smart Accounts Kit ${SMART_ACCOUNTS_KIT_VERSION}`,
          sourceUrl: `${SOURCE_REPOSITORY}/tree/@metamask/smart-accounts-kit@${SMART_ACCOUNTS_KIT_VERSION}`,
        },
      ],
    };
  });
  if (entries.length !== 32 || Object.keys(definitions).length !== 32) {
    throw new Error("Reference metadata must cover exactly 32 enforcers.");
  }
  const output = {
    source: {
      project: "MetaMask Smart Accounts Kit",
      smartAccountsKitVersion: SMART_ACCOUNTS_KIT_VERSION,
      delegationCoreVersion: DELEGATION_CORE_VERSION,
      delegationCoreCommit: DELEGATION_CORE_COMMIT,
      repository: SOURCE_REPOSITORY,
      referenceDataset: "data/metamask-v1.3.0.json",
      generationMethod:
        "Fixtures are produced through the package builders and decoded through the package decoder; semantic domains are the conservative implementation review in docs/ENFORCER-TAXONOMY-REVIEW.md.",
      status: "reviewed-enrichment-proposal",
    },
    enforcers: entries,
  };
  return format(JSON.stringify(output), { parser: "json" });
}

const generated = await buildOutput();
if (process.argv.includes("--check")) {
  const existing = await readFile(OUTPUT_URL, "utf8").catch(() => "");
  if (existing !== generated) {
    throw new Error(
      "Reference metadata is stale. Run pnpm generate:reference-metadata.",
    );
  }
  console.log("Reference metadata is current.");
} else {
  await writeFile(OUTPUT_URL, generated, "utf8");
  console.log(
    `Wrote ${definitions ? 32 : 0} records to ${OUTPUT_URL.pathname}.`,
  );
}
