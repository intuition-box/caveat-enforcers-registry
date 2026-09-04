import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSubmissionPlan,
  collectSubmissionThings,
  createOntologyManifest,
  validateSubmission,
  type SubmissionInput,
  type TermsSchema,
} from "../src/index.ts";
import { prepareAtomDocument } from "../src/pin.ts";

const address = "0x1111111111111111111111111111111111111111";
const secondAddress = "0x2222222222222222222222222222222222222222";

const termsSchema: TermsSchema = {
  schemaVersion: "1.0.0",
  enforcer: "ExampleEnforcer",
  source: {
    repository: "https://github.com/example/repo",
    commit: "abc123",
    path: "src/ExampleEnforcer.sol",
  },
  encoding: {
    kind: "packed",
    totalBytes: 52,
    fields: [
      { name: "target", type: "address", offset: 0, bytes: 20 },
      { name: "limit", type: "uint256", offset: 20, bytes: 32 },
    ],
  },
  malformedInputBehavior: "revert",
  fixtures: [
    {
      terms: `0x${"11".repeat(20)}${"00".repeat(32)}`,
      decoded: { target: address, limit: "0" },
    },
  ],
};

const submission: SubmissionInput = {
  chainId: 1155,
  contractAddress: address.toUpperCase(),
  enforcerName: "Example Enforcer",
  description: "Limits a delegated transfer to a fixed amount.",
  type: "ExampleEnforcer",
  restrictionDomain: "ERC20 transfer",
  operation: "transfer",
  sourceUrl: "https://github.com/example/repo",
  sourceVersion: "abc123",
  termsSchema,
  submitterWallet: secondAddress,
  initialSignal: "1",
  evidence: {
    usage: [
      { name: "Example agent flow", sourceUrl: "https://example.com/usage" },
    ],
  },
};

function legacyValue() {
  const validated = validateSubmission(submission);
  assert.equal(validated.valid, true);
  if (!validated.valid) throw new Error("fixture invalid");
  const value = validated.value;
  if ("version" in value) throw new Error("expected a legacy submission");
  return value;
}

test("collectSubmissionThings builds terms and usage Things via the authority", () => {
  const things = collectSubmissionThings(legacyValue());
  assert.equal(things.termsSchema.name, "ExampleEnforcer — terms schema");
  assert.equal(things.audit, null);
  assert.equal(things.usage.length, 1);
  assert.equal(things.usage[0]!.name, "Example agent flow");
});

test("buildSubmissionPlan writes ipfs:// atoms when pointers are supplied", () => {
  const value = legacyValue();
  const things = collectSubmissionThings(value);
  const ipfsContent = {
    termsSchema: prepareAtomDocument(things.termsSchema).uri,
    usage: things.usage.map((thing) => prepareAtomDocument(thing).uri),
  };
  const codeCheck = { status: "verified" as const, address, codeLength: 100 };

  const raw = buildSubmissionPlan(
    value,
    createOntologyManifest({ version: "1.0.0" }),
    codeCheck,
  );
  const pinned = buildSubmissionPlan(
    value,
    createOntologyManifest({ version: "1.0.0" }),
    codeCheck,
    undefined,
    ipfsContent,
  );

  const termsAtom = (plan: typeof raw) =>
    plan.operations.find(
      (op) => op.kind === "ensure-atom" && op.key === "terms-schema",
    );
  const termsRaw = termsAtom(raw);
  const termsPinned = termsAtom(pinned);
  assert.ok(termsRaw && termsPinned);
  assert.equal(termsRaw!.kind, "ensure-atom");
  assert.equal(termsPinned!.kind, "ensure-atom");
  if (termsRaw!.kind !== "ensure-atom" || termsPinned!.kind !== "ensure-atom") {
    throw new Error("unreachable");
  }
  assert.match(termsRaw!.content, /^\{/); // raw JSON
  assert.equal(termsPinned!.content, ipfsContent.termsSchema);
  assert.match(termsPinned!.content, /^ipfs:\/\/bafkrei/);

  // The usage evidence atom is pinned too.
  const usagePinned = pinned.operations.find(
    (op) => op.kind === "ensure-atom" && op.key === "usage-evidence:0",
  );
  assert.ok(usagePinned && usagePinned.kind === "ensure-atom");
  assert.match(usagePinned.content, /^ipfs:\/\/bafkrei/);
});
