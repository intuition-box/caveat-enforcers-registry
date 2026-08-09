import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { encodeAbiParameters, encodeFunctionResult, stringToHex } from "viem";
import {
  buildCaip10,
  buildSubmissionPlan,
  canonicalJson,
  createOntologyManifest,
  createSubmissionSession,
  createViemSubmissionWriteAdapter,
  executeCurationDeposit,
  prepareCurationDeposit,
  RegistryBackend,
  buildSubmissionWriteBatch,
  encodeCreateAtoms,
  encodeCreateTriples,
  executeSubmissionWriteBatch,
  filterRegistryEntries,
  loadComposabilityClaims,
  loadDeploymentClaims,
  loadRegistryPage,
  normalizeEvmAddress,
  pollRegistryForDeployment,
  LEGACY_GENERIC_DEPLOYMENT_CLASS_ID,
  PROPOSED_DEPLOYMENT_CLASS_ID,
  PROPOSED_DEPLOYMENT_CLASS_LABEL,
  PROPOSED_ONTOLOGY_MANIFEST,
  readOntologyManifestFromEnv,
  readIntuitionVault,
  intuitionAtomIdFromText,
  intuitionAtomIdFromData,
  intuitionTripleIdFromComponents,
  recordIndexing,
  recordReceipt,
  recordSimulation,
  recordSubmission,
  resolveSubmissionWorkflow,
  simulateSubmissionPlan,
  summarizeDeploymentClaims,
  sumNumericStrings,
  validateOntologyManifest,
  validateSubmission,
  verifyRpcChainId,
  verifyContractCode,
  verifyIntuitionTerm,
  verifyIntuitionTriple,
  verifyTransactionReceipt,
  verifyTermsDecoder,
  verifySubmissionWriteBatchOnchain,
  type RegistryEntry,
  type RegistryFetcher,
  type SubmissionInput,
  type TermsSchema,
} from "../src/index.js";

const address = "0x1111111111111111111111111111111111111111";
const secondAddress = "0x2222222222222222222222222222222222222222";
const termId = (character: string) => `0x${character.repeat(64)}`;

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
      decoded: {
        target: address,
        limit: "0",
      },
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
};

function fakeFetcher(payload: unknown, status = 200): RegistryFetcher {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
}

function registryConfig(
  fetcher: RegistryFetcher,
): Parameters<typeof loadRegistryPage>[0] {
  return {
    endpoint: "https://mainnet.intuition.sh/v1/graphql",
    membershipPredicateId: "predicate-membership",
    deploymentClassId: "class-deployment",
    fetcher,
  };
}

test("ontology manifests fail closed until reviewed IDs exist", () => {
  const manifest = createOntologyManifest({ version: "unreviewed" });
  const issues = validateOntologyManifest(manifest);
  assert.deepEqual(
    issues.map((issue) => issue.path),
    ["deploymentClassId", "predicates.membership"],
  );
});

test("ontology manifests reject non-canonical term IDs", () => {
  const issues = validateOntologyManifest(
    createOntologyManifest({
      version: "1.0.0",
      deploymentClassId: "class",
      predicates: { membership: "predicate", implements: "other" },
    }),
  );
  assert.deepEqual(
    issues.map((issue) => issue.path),
    ["deploymentClassId", "predicates.membership", "predicates.implements"],
  );
});

test("ontology manifests reject the legacy generic deployment boundary", () => {
  const issues = validateOntologyManifest(
    createOntologyManifest({
      version: "1.0.0",
      deploymentClassId: LEGACY_GENERIC_DEPLOYMENT_CLASS_ID,
      predicates: { membership: termId("a") },
    }),
  );
  assert.deepEqual(issues, [
    {
      path: "deploymentClassId",
      message:
        "The generic deployment atom is not a safe registry boundary; use the ERC-7710 caveat enforcer deployment class.",
    },
  ]);
});

test("empty runtime configuration uses the explicit permissionless ontology proposal", () => {
  const manifest = readOntologyManifestFromEnv({});
  assert.equal(manifest.version, PROPOSED_ONTOLOGY_MANIFEST.version);
  assert.equal(manifest.chainId, PROPOSED_ONTOLOGY_MANIFEST.chainId);
  assert.equal(
    manifest.deploymentClassId,
    PROPOSED_ONTOLOGY_MANIFEST.deploymentClassId,
  );
  assert.equal(
    manifest.predicates.membership,
    PROPOSED_ONTOLOGY_MANIFEST.predicates.membership,
  );
  assert.equal(
    manifest.predicates.deployedOn,
    PROPOSED_ONTOLOGY_MANIFEST.predicates.deployedOn,
  );
  assert.equal(
    manifest.predicates.conflictsWith,
    PROPOSED_ONTOLOGY_MANIFEST.predicates.conflictsWith,
  );
  assert.equal(validateOntologyManifest(manifest).length, 0);
});

test("blank optional predicate variables preserve registry defaults", () => {
  const manifest = readOntologyManifestFromEnv({
    REGISTRY_PREDICATE_IMPLEMENTS: "",
    REGISTRY_PREDICATE_SOURCE_AT: "   ",
  });
  assert.equal(
    manifest.predicates.implements,
    PROPOSED_ONTOLOGY_MANIFEST.predicates.implements,
  );
  assert.equal(
    manifest.predicates.sourceAt,
    PROPOSED_ONTOLOGY_MANIFEST.predicates.sourceAt,
  );
});

test("runtime ontology values remain overridable without a central approval gate", () => {
  const manifest = readOntologyManifestFromEnv({
    REGISTRY_ONTOLOGY_VERSION: "proposal-local",
    REGISTRY_DEPLOYMENT_CLASS_ID: termId("a"),
    REGISTRY_MEMBERSHIP_PREDICATE_ID: termId("b"),
  });
  assert.equal(manifest.version, "proposal-local");
  assert.equal(manifest.deploymentClassId, termId("a"));
  assert.equal(manifest.predicates.membership, termId("b"));
  assert.equal(
    manifest.predicates.deployedOn,
    PROPOSED_ONTOLOGY_MANIFEST.predicates.deployedOn,
  );
});

test("Intuition IDs use the deployed MultiVault domain-separated formulas", () => {
  // This is the live mainnet atom for the text value "caveat". It guards
  // against accidentally reverting to keccak256(raw bytes), which is not
  // how MultiVault derives atom IDs.
  assert.equal(
    intuitionAtomIdFromText("caveat"),
    "0xbb3cb722cc36501e797cc95a2d8681e67bae955de48939fa144f5f7b8699cfe1",
  );

  const subject = termId("1");
  const predicate = termId("2");
  const object = termId("3");
  const triple = intuitionTripleIdFromComponents(subject, predicate, object);
  assert.match(triple, /^0x[0-9a-f]{64}$/);
  assert.notEqual(triple, `0x${"1".repeat(64)}`);
});

test("registry reader sends canonical IDs and parses signals", async () => {
  let requestBody = "";
  const fetcher: RegistryFetcher = async (_input, init) => {
    requestBody = init.body;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          triples: [
            {
              term_id: "membership-1",
              subject_id: address,
              created_at: "2026-08-02T00:00:00Z",
              transaction_hash: termId("a"),
              block_number: "1234",
              subject: { term_id: address, label: "Example Enforcer" },
              term: {
                vaults: [
                  { total_assets: "19", total_shares: "17", position_count: 2 },
                ],
              },
              counter_term: {
                vaults: [
                  { total_assets: "4", total_shares: "3", position_count: 1 },
                ],
              },
            },
          ],
        },
      }),
    };
  };

  const result = await loadRegistryPage(registryConfig(fetcher), { limit: 10 });
  assert.equal(result.kind, "ready");
  if (result.kind !== "ready") return;
  assert.equal(result.entries[0].label, "Example Enforcer");
  assert.equal(result.entries[0].supportSignal.value, "19");
  assert.equal(result.entries[0].oppositionSignal.value, "4");
  assert.equal(result.entries[0].transactionHash, termId("a"));
  assert.equal(result.entries[0].blockNumber, "1234");

  const body = JSON.parse(requestBody) as {
    variables: Record<string, unknown>;
  };
  assert.deepEqual(body.variables, {
    membershipPredicateId: "predicate-membership",
    deploymentClassId: "class-deployment",
    limit: 10,
    offset: 0,
  });
});

test("registry pagination normalizes non-finite controls", async () => {
  let variables: Record<string, unknown> = {};
  const result = await loadRegistryPage(
    registryConfig(async (_input, init) => {
      variables = JSON.parse(init.body).variables;
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { triples: [] } }),
      };
    }),
    { limit: Number.NaN, offset: Number.NaN },
  );
  assert.equal(result.kind, "ready");
  assert.equal(variables.limit, 100);
  assert.equal(variables.offset, 0);
});

test("registry reader aggregates signal vaults", async () => {
  const result = await loadRegistryPage(
    registryConfig(
      fakeFetcher({
        data: {
          triples: [
            {
              term_id: "membership-1",
              subject_id: address,
              subject: { term_id: address, label: "Example Enforcer" },
              term: {
                vaults: [
                  { total_shares: "7", position_count: 1 },
                  { total_shares: "5", position_count: 2 },
                ],
              },
              counter_term: { vaults: [{ total_shares: "2" }] },
            },
          ],
        },
      }),
    ),
  );
  assert.equal(result.kind, "ready");
  if (result.kind !== "ready") return;
  assert.equal(result.entries[0].supportSignal.value, "12");
  assert.equal(result.entries[0].supportSignal.positionCount, "3");
});

test("signal totals preserve decimal asset precision", () => {
  assert.equal(sumNumericStrings(["1.25", "0.75", "2"]), "4");
  assert.equal(
    sumNumericStrings(["0.000000000000000001", "0.1"]),
    "0.100000000000000001",
  );
});

test("deployment claims preserve canonical predicate and object IDs", async () => {
  const result = await loadDeploymentClaims(
    {
      endpoint: "https://mainnet.intuition.sh/v1/graphql",
      fetcher: fakeFetcher({
        data: {
          triples: [
            {
              term_id: "claim-1",
              created_at: "2026-08-02T00:00:00Z",
              transaction_hash: termId("b"),
              block_number: 5678,
              subject: { term_id: address, label: "Example Deployment" },
              predicate: { term_id: "predicate-source", label: "source at" },
              object: {
                term_id: "atom-source",
                label: "Example repository",
                data: "https://github.com/example/repo",
                type: "url",
              },
              term: { vaults: [{ total_shares: "5" }] },
              counter_term: { vaults: [{ total_shares: "1" }] },
            },
          ],
        },
      }),
    },
    address,
  );

  assert.equal(result.kind, "ready");
  if (result.kind !== "ready") return;
  assert.equal(result.label, "Example Deployment");
  assert.equal(result.claims[0].predicateId, "predicate-source");
  assert.equal(result.claims[0].objectId, "atom-source");
  assert.equal(result.claims[0].oppositionStake, "1");
  assert.equal(result.claims[0].transactionHash, termId("b"));
  assert.equal(result.claims[0].blockNumber, "5678");
});

test("backend detail hydrates bounded claim pages without silent truncation", async () => {
  const offsets: number[] = [];
  const backend = new RegistryBackend({
    endpoint: "https://graph.example",
    registry: {
      fetcher: async (_input, init) => {
        const variables = JSON.parse(init.body).variables as {
          offset: number;
          limit: number;
        };
        offsets.push(variables.offset);
        const start = variables.offset;
        const end = start === 0 ? 2 : 3;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              triples: Array.from({ length: end - start }, (_, index) => ({
                term_id: `claim-${start + index + 1}`,
                created_at: "2026-08-02T00:00:00Z",
                subject: { term_id: address, label: "Example Deployment" },
                predicate: {
                  term_id: `predicate-${start + index + 1}`,
                  label: "evidence",
                },
                object: {
                  term_id: `object-${start + index + 1}`,
                  label: `Evidence ${start + index + 1}`,
                },
              })),
            },
          }),
        };
      },
    },
  });
  const result = await backend.detail(address, { pageSize: 2, maxPages: 3 });
  assert.equal(result.kind, "ready");
  if (result.kind !== "ready") return;
  assert.equal(result.claims.length, 3);
  assert.equal(result.hasMore, false);
  assert.deepEqual(offsets, [0, 2]);
  assert.equal(result.summary.claims.length, 3);
});

test("backend detail follows implementation claims to hydrate type semantics", async () => {
  const deploymentId = termId("1");
  const implementationId = termId("2");
  const ontology = createOntologyManifest({
    version: "1.0.0",
    deploymentClassId: termId("3"),
    predicates: {
      membership: termId("4"),
      implements: termId("5"),
      restricts: termId("6"),
      affectsOperation: termId("7"),
    },
  });
  const requestedSubjects: string[] = [];
  const backend = new RegistryBackend({
    endpoint: "https://graph.example",
    ontology,
    registry: {
      fetcher: async (_input, init) => {
        const variables = JSON.parse(init.body).variables as {
          deploymentId: string;
        };
        requestedSubjects.push(variables.deploymentId);
        const triples =
          variables.deploymentId === deploymentId
            ? [
                {
                  term_id: termId("8"),
                  subject: {
                    term_id: deploymentId,
                    label: "Example deployment",
                  },
                  predicate: {
                    term_id: ontology.predicates.implements,
                    label: "implements",
                  },
                  object: {
                    term_id: implementationId,
                    label: "ExampleEnforcer",
                  },
                },
              ]
            : [
                {
                  term_id: termId("9"),
                  subject: {
                    term_id: implementationId,
                    label: "ExampleEnforcer",
                  },
                  predicate: {
                    term_id: ontology.predicates.restricts,
                    label: "restricts",
                  },
                  object: { term_id: termId("a"), label: "time window" },
                },
                {
                  term_id: termId("b"),
                  subject: {
                    term_id: implementationId,
                    label: "ExampleEnforcer",
                  },
                  predicate: {
                    term_id: ontology.predicates.affectsOperation,
                    label: "affects operation",
                  },
                  object: { term_id: termId("c"), label: "contract call" },
                },
              ];
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { triples } }),
        };
      },
    },
  });

  const result = await backend.detail(deploymentId);
  assert.equal(result.kind, "ready");
  if (result.kind !== "ready") return;
  assert.deepEqual(requestedSubjects, [deploymentId, implementationId]);
  assert.equal(result.claims.length, 3);
  assert.equal(result.summary.implementation, "ExampleEnforcer");
  assert.equal(result.summary.domain, "time window");
  assert.equal(result.summary.operation, "contract call");
  assert.equal(result.claims[1]?.subjectId, implementationId);
});

test("deployment summaries map fields only through reviewed predicate IDs", () => {
  const ontology = createOntologyManifest({
    version: "1.0.0",
    deploymentClassId: "class-deployment",
    predicates: {
      deployedOn: "predicate-chain",
      sourceAt: "predicate-source",
      hasTermsSchema: "predicate-terms",
      restricts: "predicate-domain",
      affectsOperation: "predicate-operation",
      describedBy: "predicate-description",
      implements: "predicate-implements",
      usedBy: "predicate-used-by",
      coveredByAudit: "predicate-audit",
    },
  });
  const summary = summarizeDeploymentClaims(
    address,
    [
      {
        id: "claim-chain",
        predicate: "deployed on",
        object: "Intuition",
        stake: "0",
        side: "support",
        predicateId: "predicate-chain",
        objectLabel: "eip155:1155",
      },
      {
        id: "claim-description",
        predicate: "described by",
        object: "A bounded transfer enforcer.",
        stake: "0",
        side: "support",
        predicateId: "predicate-description",
        objectLabel: "A bounded transfer enforcer.",
      },
      {
        id: "claim-wrong",
        predicate: "deployed on",
        object: "Not used",
        stake: "0",
        side: "support",
        predicateId: "unreviewed-label-match",
        objectLabel: "wrong value",
      },
    ],
    ontology,
  );
  assert.equal(summary.chain, "eip155:1155");
  assert.equal(summary.description, "A bounded transfer enforcer.");
  assert.equal(summary.source, null);
});

test("submission validation normalizes identity and rejects incomplete codec evidence", () => {
  const valid = validateSubmission(submission);
  assert.equal(valid.valid, true);
  if (valid.valid) {
    assert.equal(valid.value.contractAddress, address);
    assert.equal(valid.value.caip10, buildCaip10("1155", address));
  }

  const invalid = validateSubmission({
    ...submission,
    contractAddress: "0x123",
    initialSignal: "not-a-number",
    termsSchema: {
      ...termsSchema,
      enforcer: "DifferentEnforcer",
      fixtures: [],
    },
  });
  assert.equal(invalid.valid, false);
  if (!invalid.valid) {
    assert.ok(invalid.issues.some((issue) => issue.path === "contractAddress"));
    assert.ok(
      invalid.issues.some((issue) => issue.path === "termsSchema.fixtures"),
    );
    assert.ok(
      invalid.issues.some((issue) => issue.path === "termsSchema.enforcer"),
    );
    assert.ok(invalid.issues.some((issue) => issue.path === "initialSignal"));
  }
  assert.equal(normalizeEvmAddress(address.toUpperCase()), address);
});

test("published JSON submission example is accepted by the runtime validator", async () => {
  const example = JSON.parse(
    await readFile(
      new URL("../schema/submission.example.json", import.meta.url),
      "utf8",
    ),
  ) as SubmissionInput;
  const result = validateSubmission(example);
  assert.equal(result.valid, true);
});

test("terms-schema atoms are stable when JSON object keys are reordered", () => {
  const reordered = Object.fromEntries(
    Object.entries(termsSchema).reverse(),
  ) as TermsSchema;
  assert.equal(canonicalJson(termsSchema), canonicalJson(reordered));

  const first = validateSubmission({ ...submission, termsSchema });
  const second = validateSubmission({
    ...submission,
    termsSchema: reordered,
  });
  assert.equal(first.valid, true);
  assert.equal(second.valid, true);
  if (!first.valid || !second.valid) return;
  const ontology = createOntologyManifest({ version: "1.0.0" });
  const firstPlan = buildSubmissionPlan(first.value, ontology, {
    status: "missing",
    address,
  });
  const secondPlan = buildSubmissionPlan(second.value, ontology, {
    status: "missing",
    address,
  });
  const termsAtom = (plan: ReturnType<typeof buildSubmissionPlan>) =>
    plan.operations.find((operation) => operation.key === "terms-schema");
  assert.equal(termsAtom(firstPlan)?.content, termsAtom(secondPlan)?.content);
});

test("terms validation rejects overlapping fields and mismatched fixture bytes", () => {
  const invalid = validateSubmission({
    ...submission,
    termsSchema: {
      ...termsSchema,
      encoding: {
        ...termsSchema.encoding,
        fields: [
          { name: "target", type: "address", offset: 0, bytes: 20 },
          { name: "limit", type: "uint256", offset: 10, bytes: 32 },
        ],
      },
      fixtures: [{ terms: "0x00" }],
    },
  });
  assert.equal(invalid.valid, false);
  if (!invalid.valid) {
    assert.ok(
      invalid.issues.some((issue) => issue.message.includes("overlaps")),
    );
    assert.ok(
      invalid.issues.some((issue) => issue.message.includes("byte length")),
    );
  }
});

test("terms validation executes ABI fixtures instead of trusting declared decoded values", () => {
  const abiSchema: TermsSchema = {
    ...termsSchema,
    encoding: {
      kind: "abi",
      totalBytes: 64,
      fields: [
        { name: "target", type: "address", offset: 0, bytes: 32 },
        { name: "limit", type: "uint256", offset: 32, bytes: 32 },
      ],
    },
    fixtures: [
      {
        terms: `0x${"00".repeat(12)}${"11".repeat(20)}${"00".repeat(32)}`,
        decoded: { target: address, limit: "0" },
      },
    ],
  };
  const valid = validateSubmission({ ...submission, termsSchema: abiSchema });
  assert.equal(valid.valid, true);

  const mismatch = validateSubmission({
    ...submission,
    termsSchema: {
      ...abiSchema,
      fixtures: [
        { ...abiSchema.fixtures[0], decoded: { target: address, limit: "1" } },
      ],
    },
  });
  assert.equal(mismatch.valid, false);
  if (!mismatch.valid) {
    assert.ok(
      mismatch.issues.some((issue) => issue.message.includes("ABI fixture")),
    );
  }
});

test("terms validation checks optional decoder metadata when supplied", () => {
  const result = validateSubmission({
    ...submission,
    termsSchema: {
      ...termsSchema,
      decoderFunction: {
        name: "decodeTerms",
        inputs: [{ name: "terms", type: "bytes" }],
        outputs: [{ name: "target", type: "address" }],
      },
    },
  });
  assert.equal(result.valid, true);

  const invalid = validateSubmission({
    ...submission,
    termsSchema: {
      ...termsSchema,
      decoderFunction: {
        name: "",
        inputs: [{ name: "", type: "" }],
        outputs: [],
      },
    },
  });
  assert.equal(invalid.valid, false);
  if (!invalid.valid) {
    assert.ok(
      invalid.issues.some((issue) => issue.path.includes("decoderFunction")),
    );
  }
});

test("terms decoder verification compares eth_call output with a fixture", async () => {
  const decoderAbi = {
    type: "function" as const,
    name: "decodeTerms",
    stateMutability: "view" as const,
    inputs: [{ name: "terms", type: "bytes" }],
    outputs: [
      { name: "target", type: "address" },
      { name: "limit", type: "uint256" },
    ],
  };
  const terms = encodeAbiParameters(
    [
      { name: "target", type: "address" },
      { name: "limit", type: "uint256" },
    ],
    [address, 7n],
  );
  const schema: TermsSchema = {
    ...termsSchema,
    encoding: {
      kind: "abi",
      totalBytes: 64,
      fields: [
        { name: "target", type: "address", offset: 0, bytes: 32 },
        { name: "limit", type: "uint256", offset: 32, bytes: 32 },
      ],
    },
    decoderFunction: {
      name: "decodeTerms",
      inputs: [{ name: "terms", type: "bytes" }],
      outputs: [
        { name: "target", type: "address" },
        { name: "limit", type: "uint256" },
      ],
    },
    fixtures: [
      {
        terms,
        decoded: { target: address, limit: "7" },
      },
    ],
  };
  const encodedOutput = encodeFunctionResult({
    abi: [decoderAbi],
    functionName: "decodeTerms",
    result: [address, 7n],
  });
  const result = await verifyTermsDecoder(
    "https://rpc.example",
    address,
    schema,
    0,
    async (_input, init) => {
      const request = JSON.parse(init.body) as {
        method: string;
        params: Array<{ to: string; data: string }>;
      };
      assert.equal(request.method, "eth_call");
      assert.equal(request.params[0]?.to, address);
      assert.match(request.params[0]?.data ?? "", /^0x[0-9a-f]+$/i);
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: encodedOutput }),
      };
    },
  );
  assert.equal(result.status, "verified");

  const mismatch = await verifyTermsDecoder(
    "https://rpc.example",
    address,
    schema,
    0,
    async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        result: encodeFunctionResult({
          abi: [decoderAbi],
          functionName: "decodeTerms",
          result: [secondAddress, 7n],
        }),
      }),
    }),
  );
  assert.equal(mismatch.status, "error");
  if (mismatch.status === "error") {
    assert.match(mismatch.message, /does not match/);
  }
});

test("backend preparation requires declared decoder fixtures to pass eth_call", async () => {
  const decoderAbi = {
    type: "function" as const,
    name: "decodeTerms" as const,
    stateMutability: "view" as const,
    inputs: [{ name: "terms", type: "bytes" }],
    outputs: [{ name: "limit", type: "uint256" }],
  };
  const terms = encodeAbiParameters([{ name: "limit", type: "uint256" }], [7n]);
  const decoderSubmission: SubmissionInput = {
    ...submission,
    termsSchema: {
      ...termsSchema,
      encoding: {
        kind: "abi",
        totalBytes: 32,
        fields: [{ name: "limit", type: "uint256", offset: 0, bytes: 32 }],
      },
      decoderFunction: {
        name: "decodeTerms",
        inputs: [{ name: "terms", type: "bytes" }],
        outputs: [{ name: "limit", type: "uint256" }],
      },
      fixtures: [{ terms, decoded: { limit: "7" } }],
    },
  };
  const output = encodeFunctionResult({
    abi: [decoderAbi],
    functionName: "decodeTerms",
    result: [7n],
  });
  const backend = new RegistryBackend({
    endpoint: "https://graph.example",
    rpcEndpoint: "https://rpc.example",
    rpcFetcher: async (_input, init) => {
      const request = JSON.parse(init.body) as { method: string };
      if (request.method === "eth_chainId") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: "0x483" }),
        };
      }
      if (request.method === "eth_call") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ result: output }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ result: "0x6001600055" }),
      };
    },
  });
  const prepared = await backend.prepareSubmission(decoderSubmission);
  assert.equal(prepared.status, "ready");
  if (prepared.status !== "ready") return;
  assert.equal(prepared.decoderChecks[0]?.status, "verified");

  const mismatchBackend = new RegistryBackend({
    endpoint: "https://graph.example",
    rpcEndpoint: "https://rpc.example",
    rpcFetcher: async (_input, init) => {
      const request = JSON.parse(init.body) as { method: string };
      if (request.method === "eth_call") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: encodeFunctionResult({
              abi: [decoderAbi],
              functionName: "decodeTerms",
              result: [8n],
            }),
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () =>
          request.method === "eth_chainId"
            ? { result: "0x483" }
            : { result: "0x6001600055" },
      };
    },
  });
  const mismatch = await mismatchBackend.prepareSubmission(decoderSubmission);
  assert.equal(mismatch.status, "invalid");
  if (mismatch.status === "invalid") {
    assert.ok(mismatch.issues.some((issue) => issue.path.includes("fixtures")));
  }
});

test("contract verification distinguishes deployed code from an empty address", async () => {
  const verified = await verifyContractCode(
    "https://rpc.example",
    address,
    fakeFetcher({ result: "0x6001600055" }) as never,
  );
  assert.equal(verified.status, "verified");

  const missing = await verifyContractCode(
    "https://rpc.example",
    address,
    fakeFetcher({ result: "0x" }) as never,
  );
  assert.equal(missing.status, "missing");
});

test("Intuition adapter verifies terms, triples, vaults, and encodes writes", async () => {
  const atomData = "0x1234";
  const termId = intuitionAtomIdFromData(atomData);
  const predicateId = `0x${"22".repeat(32)}`;
  const objectId = `0x${"33".repeat(32)}`;
  const tripleId = intuitionTripleIdFromComponents(
    termId,
    predicateId,
    objectId,
  );
  const calls: string[] = [];
  const publicClient = {
    readContract: async (request: { functionName: string }) => {
      calls.push(request.functionName);
      if (request.functionName === "isTermCreated") return true;
      if (request.functionName === "getAtom") return atomData;
      if (request.functionName === "getTriple") {
        return [termId, predicateId, objectId];
      }
      return [100n, 50n];
    },
  };

  const term = await verifyIntuitionTerm(publicClient, termId);
  assert.equal(term.status, "verified");
  if (term.status === "verified") assert.equal(term.data, "0x1234");
  const triple = await verifyIntuitionTriple(publicClient, tripleId);
  assert.equal(triple.status, "verified");
  const vault = await readIntuitionVault(publicClient, termId, 0);
  assert.equal(vault.status, "verified");
  if (vault.status === "verified") {
    assert.equal(vault.totalAssets, "100");
    assert.equal(vault.totalShares, "50");
  }
  assert.deepEqual(calls, [
    "isTermCreated",
    "getAtom",
    "getTriple",
    "getVault",
  ]);

  const atomTx = encodeCreateAtoms(["0x1234"], [0n], { value: "0" });
  assert.match(atomTx.data, /^0x[0-9a-f]+$/i);
  const tripleTx = encodeCreateTriples(
    [termId],
    [predicateId],
    [objectId],
    [0n],
  );
  assert.match(tripleTx.data, /^0x[0-9a-f]+$/i);
  assert.throws(
    () => encodeCreateAtoms(["0x1234"], [0n], { address: "not-an-address" }),
    /MultiVault address/i,
  );
});

test("Intuition adapter treats MultiVault's missing-triple revert as missing", async () => {
  const tripleId = intuitionTripleIdFromComponents(
    intuitionAtomIdFromText("missing triple subject"),
    intuitionAtomIdFromText("missing triple predicate"),
    intuitionAtomIdFromText("missing triple object"),
  );
  const result = await verifyIntuitionTriple(
    {
      readContract: async () => {
        throw new Error(
          'The contract function "getTriple" reverted. Error: MultiVaultCore_TripleDoesNotExist(bytes32 termId)',
        );
      },
    },
    tripleId,
  );

  assert.deepEqual(result, { status: "missing", tripleId });
});

test("Intuition adapter rejects RPC data whose IDs do not match", async () => {
  const expectedAtom = intuitionAtomIdFromText("expected");
  const wrongAtom = intuitionAtomIdFromText("wrong");
  const atomResult = await verifyIntuitionTerm(
    {
      readContract: async (request: { functionName: string }) =>
        request.functionName === "isTermCreated" ? true : stringToHex("wrong"),
    },
    expectedAtom,
  );
  assert.equal(atomResult.status, "error");
  if (atomResult.status === "error") {
    assert.match(atomResult.message, /does not match/);
  }

  const subjectId = intuitionAtomIdFromText("subject");
  const predicateId = intuitionAtomIdFromText("predicate");
  const objectId = intuitionAtomIdFromText("object");
  const expectedTriple = intuitionTripleIdFromComponents(
    subjectId,
    predicateId,
    objectId,
  );
  const wrongTriple = intuitionTripleIdFromComponents(
    subjectId,
    predicateId,
    wrongAtom,
  );
  const tripleResult = await verifyIntuitionTriple(
    {
      readContract: async () => [subjectId, predicateId, wrongAtom],
    },
    expectedTriple,
  );
  assert.equal(tripleResult.status, "error");
  if (tripleResult.status === "error") {
    assert.match(tripleResult.message, /do not match/);
  }
  assert.notEqual(expectedTriple, wrongTriple);
});

test("RPC chain and receipt checks fail closed", async () => {
  const chain = await verifyRpcChainId(
    "https://rpc.example",
    1155,
    fakeFetcher({ result: "0x483" }) as never,
  );
  assert.equal(chain.status, "verified");

  const mismatch = await verifyRpcChainId(
    "https://rpc.example",
    1155,
    fakeFetcher({ result: "0x1" }) as never,
  );
  assert.equal(mismatch.status, "mismatch");

  const pending = await verifyTransactionReceipt(
    "https://rpc.example",
    `0x${"11".repeat(32)}`,
    fakeFetcher({ result: null }) as never,
  );
  assert.equal(pending.status, "pending");

  const confirmed = await verifyTransactionReceipt(
    "https://rpc.example",
    `0x${"11".repeat(32)}`,
    fakeFetcher({ result: { status: "0x1", blockNumber: "0x10" } }) as never,
  );
  assert.equal(confirmed.status, "confirmed");
});

test("submission plans are previewable but blocked without reviewed ontology", () => {
  const validated = validateSubmission(submission);
  assert.equal(validated.valid, true);
  if (!validated.valid) return;

  const codeCheck = { status: "verified", address, codeLength: 5 } as const;
  const blocked = buildSubmissionPlan(
    validated.value,
    createOntologyManifest({ version: "unreviewed" }),
    codeCheck,
  );
  assert.equal(blocked.status, "blocked-by-configuration");
  assert.ok(blocked.missingOntologyKeys.includes("deploymentClassId"));
  assert.ok(
    blocked.operations.some((operation) => operation.kind === "create-triple"),
  );

  const ontology = createOntologyManifest({
    version: "1.0.0",
    deploymentClassId: termId("a"),
    predicates: {
      membership: termId("b"),
      implements: termId("c"),
      deployedOn: termId("d"),
      sourceAt: termId("e"),
      hasTermsSchema: termId("f"),
      restricts: termId("1"),
      affectsOperation: termId("2"),
    },
  });
  const ready = buildSubmissionPlan(validated.value, ontology, codeCheck);
  assert.equal(ready.status, "ready-for-simulation");
  assert.match(ready.warning, /not a signed transaction/);
});

test("the permissionless proposal bootstraps missing standard predicate atoms", () => {
  const validated = validateSubmission(submission);
  assert.equal(validated.valid, true);
  if (!validated.valid) return;

  const bootstrapManifest = createOntologyManifest({
    version: PROPOSED_ONTOLOGY_MANIFEST.version,
    chainId: PROPOSED_ONTOLOGY_MANIFEST.chainId,
    deploymentClassId: PROPOSED_ONTOLOGY_MANIFEST.deploymentClassId,
    predicates: {
      membership: PROPOSED_ONTOLOGY_MANIFEST.predicates.membership,
      deployedOn: PROPOSED_ONTOLOGY_MANIFEST.predicates.deployedOn,
      conflictsWith: PROPOSED_ONTOLOGY_MANIFEST.predicates.conflictsWith,
    },
  });
  const plan = buildSubmissionPlan(
    validated.value,
    bootstrapManifest,
    { status: "verified", address, codeLength: 5 },
    { status: "verified", chainId: "1155" },
  );
  assert.equal(plan.status, "ready-for-simulation");
  assert.deepEqual(plan.missingOntologyKeys, []);
  assert.equal(
    PROPOSED_ONTOLOGY_MANIFEST.deploymentClassId,
    PROPOSED_DEPLOYMENT_CLASS_ID,
  );
  assert.equal(
    intuitionAtomIdFromText(PROPOSED_DEPLOYMENT_CLASS_LABEL),
    PROPOSED_DEPLOYMENT_CLASS_ID,
  );
  assert.deepEqual(
    plan.operations.find(
      (operation) => operation.key === "ontology-class:deployment",
    ),
    {
      kind: "ensure-atom",
      key: "ontology-class:deployment",
      content: PROPOSED_DEPLOYMENT_CLASS_LABEL,
      note: "Create the collision-safe ERC-7710 deployment class before membership triples.",
    },
  );
  assert.ok(
    plan.operations.findIndex(
      (operation) => operation.key === "ontology-class:deployment",
    ) <
      plan.operations.findIndex((operation) => operation.key === "membership"),
  );
  assert.deepEqual(
    plan.operations
      .filter(
        (operation) =>
          operation.kind === "ensure-atom" &&
          operation.key.startsWith("ontology-predicate:"),
      )
      .map((operation) => operation.key),
    [
      "ontology-predicate:implements",
      "ontology-predicate:sourceAt",
      "ontology-predicate:hasTermsSchema",
      "ontology-predicate:restricts",
      "ontology-predicate:affectsOperation",
    ],
  );
  const triples = plan.operations.filter(
    (operation) => operation.kind === "create-triple",
  );
  assert.ok(
    triples.every((operation) =>
      /^0x[0-9a-f]{64}$/i.test(operation.predicateId),
    ),
  );
  assert.equal(
    triples.find((operation) => operation.key === "implements")?.predicateId,
    intuitionAtomIdFromText("implements"),
  );
});

test("optional audit and usage evidence becomes reviewed write operations", async () => {
  const evidenceSubmission = {
    ...submission,
    evidence: {
      audit: {
        sourceUrl: "https://example.com/audit.pdf",
        scope: "ExampleEnforcer source at abc123",
        sourceVersion: "abc123",
      },
      usage: [
        {
          name: "Example Wallet",
          sourceUrl: "https://example.com/integration",
        },
      ],
      compositions: [
        {
          relation: "complements",
          relatedType: "TimeWindowEnforcer",
          context: "Time-gated token transfer",
          ordering: "Apply the time window before the transfer amount check.",
          supportedBy: "https://example.com/composability-test",
        },
      ],
    },
  };
  const validated = validateSubmission(evidenceSubmission);
  assert.equal(validated.valid, true);
  if (!validated.valid) return;
  const basePredicates = {
    membership: termId("b"),
    implements: termId("c"),
    deployedOn: termId("d"),
    sourceAt: termId("e"),
    hasTermsSchema: termId("f"),
    restricts: termId("1"),
    affectsOperation: termId("2"),
  } as const;
  const withoutEvidencePredicates = buildSubmissionPlan(
    validated.value,
    createOntologyManifest({
      version: "1.0.0",
      deploymentClassId: termId("a"),
      predicates: basePredicates,
    }),
    { status: "verified", address, codeLength: 5 },
  );
  assert.equal(withoutEvidencePredicates.status, "blocked-by-configuration");
  assert.ok(
    withoutEvidencePredicates.missingOntologyKeys.includes(
      "predicates.coveredByAudit",
    ),
  );
  assert.ok(
    withoutEvidencePredicates.missingOntologyKeys.includes("predicates.usedBy"),
  );
  assert.ok(
    withoutEvidencePredicates.missingOntologyKeys.includes(
      "predicates.complements",
    ),
  );
  assert.ok(
    withoutEvidencePredicates.missingOntologyKeys.includes(
      "predicates.appliesInContext",
    ),
  );

  const ready = buildSubmissionPlan(
    validated.value,
    createOntologyManifest({
      version: "1.0.0",
      deploymentClassId: termId("a"),
      predicates: {
        ...basePredicates,
        coveredByAudit: termId("3"),
        usedBy: termId("4"),
        complements: termId("5"),
        appliesInContext: termId("6"),
        requiresOrdering: termId("7"),
        supportedBy: termId("8"),
      },
    }),
    { status: "verified", address, codeLength: 5 },
  );
  assert.equal(ready.status, "ready-for-simulation");
  assert.deepEqual(
    ready.operations
      .filter((operation) => operation.kind === "create-triple")
      .map((operation) => operation.key)
      .slice(-6),
    [
      "covered-by-audit",
      "used-by:0",
      "composability:0",
      "composability:0:context",
      "composability:0:ordering",
      "composability:0:evidence",
    ],
  );

  const resolution = await resolveSubmissionWorkflow(
    ready,
    createOntologyManifest({
      version: "1.0.0",
      deploymentClassId: termId("a"),
      predicates: {
        ...basePredicates,
        coveredByAudit: termId("3"),
        usedBy: termId("4"),
        complements: termId("5"),
        appliesInContext: termId("6"),
        requiresOrdering: termId("7"),
        supportedBy: termId("8"),
      },
    }),
    {
      readContract: async (request: { functionName: string }) =>
        request.functionName === "isTermCreated"
          ? false
          : [
              `0x${"00".repeat(32)}`,
              `0x${"00".repeat(32)}`,
              `0x${"00".repeat(32)}`,
            ],
    },
  );
  assert.equal(resolution.status, "ready");
  if (resolution.status !== "ready") return;
  const relation = resolution.triples.find(
    (triple) => triple.key === "composability:0",
  );
  const context = resolution.triples.find(
    (triple) => triple.key === "composability:0:context",
  );
  assert.equal(context?.subjectId, relation?.tripleId);
});

test("simulation stays blocked when no wallet simulator is connected", async () => {
  const validated = validateSubmission(submission);
  assert.equal(validated.valid, true);
  if (!validated.valid) return;
  const ontology = createOntologyManifest({
    version: "1.0.0",
    deploymentClassId: termId("a"),
    predicates: {
      membership: termId("b"),
      implements: termId("c"),
      deployedOn: termId("d"),
      sourceAt: termId("e"),
      hasTermsSchema: termId("f"),
      restricts: termId("1"),
      affectsOperation: termId("2"),
    },
  });
  const plan = buildSubmissionPlan(validated.value, ontology, {
    status: "verified",
    address,
    codeLength: 5,
  });
  const result = await simulateSubmissionPlan(plan);
  assert.equal(result.status, "blocked");
});

test("submission lifecycle cannot skip simulation, receipt, or indexing", () => {
  const validated = validateSubmission(submission);
  assert.equal(validated.valid, true);
  if (!validated.valid) return;
  const ontology = createOntologyManifest({
    version: "1.0.0",
    deploymentClassId: termId("a"),
    predicates: {
      membership: termId("b"),
      implements: termId("c"),
      deployedOn: termId("d"),
      sourceAt: termId("e"),
      hasTermsSchema: termId("f"),
      restricts: termId("1"),
      affectsOperation: termId("2"),
    },
  });
  const plan = buildSubmissionPlan(validated.value, ontology, {
    status: "verified",
    address,
    codeLength: 5,
  });
  let session = createSubmissionSession(plan);
  session = recordSubmission(session, `0x${"11".repeat(32)}`);
  assert.equal(session.state, "plan-ready");
  session = recordSimulation(session, { status: "passed", message: "ok" });
  session = recordSubmission(session, `0x${"11".repeat(32)}`);
  assert.equal(session.state, "submitted");
  session = recordReceipt(session, {
    status: "confirmed",
    transactionHash: `0x${"11".repeat(32)}`,
    blockNumber: "0x10",
  });
  assert.equal(session.state, "confirmed-onchain");
  session = recordIndexing(session, {
    phase: "indexed",
    attempts: 2,
    message: "indexed",
  });
  assert.equal(session.state, "indexed");
});

test("submission workflow resolves atom IDs and orders MultiVault writes", async () => {
  const ontologyAtom = (label: string) => intuitionAtomIdFromText(label);
  const ontology = createOntologyManifest({
    version: "1.0.0",
    deploymentClassId: ontologyAtom("deployment-class"),
    predicates: {
      membership: ontologyAtom("membership"),
      implements: ontologyAtom("implements"),
      deployedOn: ontologyAtom("deployed-on"),
      sourceAt: ontologyAtom("source-at"),
      hasTermsSchema: ontologyAtom("has-terms-schema"),
      restricts: ontologyAtom("restricts"),
      affectsOperation: ontologyAtom("affects-operation"),
      partOfRelease: ontologyAtom("part-of-release"),
      describedBy: ontologyAtom("described-by"),
    },
  });
  const validated = validateSubmission(submission);
  assert.equal(validated.valid, true);
  if (!validated.valid) return;
  const plan = buildSubmissionPlan(validated.value, ontology, {
    status: "verified",
    address,
    codeLength: 5,
  });
  const reviewedIds = new Set([
    ontology.deploymentClassId,
    ...Object.values(ontology.predicates),
  ]);
  const reviewedData = new Map(
    [
      [ontology.deploymentClassId, "deployment-class"],
      [ontology.predicates.membership, "membership"],
      [ontology.predicates.implements, "implements"],
      [ontology.predicates.deployedOn, "deployed-on"],
      [ontology.predicates.sourceAt, "source-at"],
      [ontology.predicates.hasTermsSchema, "has-terms-schema"],
      [ontology.predicates.restricts, "restricts"],
      [ontology.predicates.affectsOperation, "affects-operation"],
      [ontology.predicates.partOfRelease, "part-of-release"],
      [ontology.predicates.describedBy, "described-by"],
    ].filter((entry): entry is [string, string] => Boolean(entry[0])),
  );
  const plannedData = new Map(
    plan.operations
      .filter(
        (
          operation,
        ): operation is Extract<
          (typeof plan.operations)[number],
          { kind: "ensure-atom" }
        > => operation.kind === "ensure-atom",
      )
      .map(
        (operation) =>
          [
            intuitionAtomIdFromText(operation.content),
            operation.content,
          ] as const,
      ),
  );
  const publicClient = {
    readContract: async (request: {
      functionName: string;
      args: readonly unknown[];
    }) => {
      if (request.functionName === "isTermCreated") {
        return reviewedIds.has(String(request.args[0]));
      }
      if (request.functionName === "getAtom") {
        const content =
          reviewedData.get(String(request.args[0])) ??
          plannedData.get(String(request.args[0])) ??
          "unknown";
        return stringToHex(content);
      }
      if (request.functionName === "getTriple") {
        return [
          `0x${"00".repeat(32)}`,
          `0x${"00".repeat(32)}`,
          `0x${"00".repeat(32)}`,
        ];
      }
      throw new Error(`Unexpected read ${request.functionName}`);
    },
  };
  const resolution = await resolveSubmissionWorkflow(
    plan,
    ontology,
    publicClient,
  );
  assert.equal(resolution.status, "ready");
  if (resolution.status !== "ready") return;
  assert.equal(resolution.missingConfiguredTermIds.length, 0);
  assert.equal(resolution.initialSignal, "1");
  assert.equal(resolution.atoms.length, 9);
  assert.equal(resolution.triples.length, 9);

  const batch = buildSubmissionWriteBatch(resolution, {
    atomAsset: 0n,
    tripleAsset: 0n,
    atomValue: "0",
    tripleValue: "0",
  });
  assert.equal(batch.status, "ready");
  if (batch.status !== "ready") return;
  assert.deepEqual(
    batch.transactions.map((transaction) => transaction.kind),
    ["create-atoms", "create-triples"],
  );
  assert.equal(batch.transactions[1].dependsOn, "create-atoms");
  assert.equal(batch.finalTripleIds.length, 9);

  const duplicatedBatch = buildSubmissionWriteBatch(
    {
      ...resolution,
      atoms: [...resolution.atoms, resolution.atoms[0]!],
      triples: [...resolution.triples, resolution.triples[0]!],
    },
    { atomValue: "0", tripleValue: "0" },
  );
  assert.equal(duplicatedBatch.status, "ready");
  if (duplicatedBatch.status === "ready") {
    assert.equal(duplicatedBatch.transactions[0]?.atomIds?.length, 9);
    assert.equal(duplicatedBatch.transactions[1]?.tripleIds?.length, 9);
  }

  const invalidValue = buildSubmissionWriteBatch(resolution, {
    tripleValue: "0x10",
  });
  assert.equal(invalidValue.status, "blocked");
  if (invalidValue.status === "blocked") {
    assert.match(invalidValue.message, /decimal integer/i);
  }
  const invalidAddress = buildSubmissionWriteBatch(resolution, {
    multivaultAddress: "not-an-address",
  });
  assert.equal(invalidAddress.status, "blocked");
  const malformedResolution = buildSubmissionWriteBatch(
    {
      ...resolution,
      atoms: [{ ...resolution.atoms[0]!, data: "0x1", exists: false }],
    },
    {},
  );
  assert.equal(malformedResolution.status, "blocked");
  if (malformedResolution.status === "blocked") {
    assert.match(malformedResolution.message, /calldata/i);
  }

  const verifiedOnchain = await verifySubmissionWriteBatchOnchain(resolution, {
    readContract: async (request: {
      functionName: string;
      args: readonly unknown[];
    }) => {
      if (request.functionName === "isTermCreated") return true;
      if (request.functionName === "getAtom") {
        return resolution.atoms.find(
          (atom) => atom.id === String(request.args[0]),
        )?.data;
      }
      const triple = resolution.triples.find(
        (item) => item.tripleId === String(request.args[0]),
      );
      return triple
        ? [triple.subjectId, triple.predicateId, triple.objectId]
        : [
            `0x${"00".repeat(32)}`,
            `0x${"00".repeat(32)}`,
            `0x${"00".repeat(32)}`,
          ];
    },
  });
  assert.equal(verifiedOnchain.status, "verified");

  const pendingOnchain = await verifySubmissionWriteBatchOnchain(resolution, {
    readContract: async (request: { functionName: string }) =>
      request.functionName === "isTermCreated" ? false : undefined,
  });
  assert.equal(pendingOnchain.status, "pending");
  if (pendingOnchain.status === "pending") {
    assert.equal(pendingOnchain.missingAtomIds.length, resolution.atoms.length);
  }

  let simulated = 0;
  let sent = 0;
  const execution = await executeSubmissionWriteBatch(batch, {
    simulate: async () => {
      simulated += 1;
    },
    send: async () => {
      sent += 1;
      return `0x${String(sent).padStart(64, "0")}`;
    },
    waitForConfirmation: async () => ({
      status: "confirmed",
      transactionHash: `0x${"1".repeat(64)}`,
      blockNumber: "0x10",
    }),
  });
  assert.equal(execution.status, "submitted");
  assert.equal(simulated, 2);
  assert.equal(sent, 2);

  const resumed = await executeSubmissionWriteBatch(
    batch,
    {
      simulate: async () => undefined,
      send: async () => `0x${"2".repeat(64)}`,
    },
    1,
    `0x${"1".repeat(64)}`,
    true,
  );
  assert.equal(resumed.status, "submitted");
  assert.equal(resumed.transactionHashes.length, 1);

  const receiptBlocked = await executeSubmissionWriteBatch(batch, {
    simulate: async () => undefined,
    send: async () => `0x${"3".repeat(64)}`,
    waitForConfirmation: async () => {
      throw new Error("receipt RPC unavailable");
    },
  });
  assert.equal(receiptBlocked.status, "blocked");
  assert.match(receiptBlocked.message, /receipt RPC unavailable/);

  let indexerCalls = 0;
  const indexed = await pollRegistryForDeployment(
    registryConfig(async () => {
      indexerCalls += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            triples:
              indexerCalls === 1
                ? []
                : [
                    {
                      subject_id: plan.deployment,
                      subject: {
                        term_id: plan.deployment,
                        label: "Independent submission",
                      },
                    },
                  ],
          },
        }),
      };
    }),
    plan.deployment,
    { maxAttempts: 2, delayMs: 0, sleep: async () => undefined },
  );
  assert.equal(indexed.phase, "indexed");
});

test("viem write adapter simulates, sends, and confirms without hidden wallet state", async () => {
  const calls: string[] = [];
  const adapter = createViemSubmissionWriteAdapter({
    publicClient: {
      call: async (request) => {
        calls.push(`call:${request.to}:${request.data}:${request.value ?? 0n}`);
      },
      waitForTransactionReceipt: async ({ hash }) => {
        calls.push(`receipt:${hash}`);
        return { status: "success", blockNumber: 17n };
      },
    },
    walletClient: {
      account: address as `0x${string}`,
      sendTransaction: async (request) => {
        calls.push(`send:${request.to}:${request.data}:${request.value ?? 0n}`);
        return `0x${"a".repeat(64)}` as `0x${string}`;
      },
    },
  });
  const request = {
    to: address,
    data: "0x1234",
    value: "5",
  };
  await adapter.simulate(request);
  const hash = await adapter.send(request);
  const receipt = await adapter.waitForConfirmation?.(hash);
  assert.equal(receipt?.status, "confirmed");
  assert.deepEqual(calls, [
    `call:${address}:0x1234:5`,
    `send:${address}:0x1234:5`,
    `receipt:${`0x${"a".repeat(64)}`}`,
  ]);
  assert.throws(
    () =>
      createViemSubmissionWriteAdapter({
        publicClient: {
          call: async () => undefined,
          waitForTransactionReceipt: async () => ({
            status: "success",
            blockNumber: 1n,
          }),
        },
        walletClient: {
          sendTransaction: async () => `0x${"b".repeat(64)}` as `0x${string}`,
        },
      }),
    /wallet account is required/i,
  );
});

test("backend service boundary keeps reads, validation, and write preparation together", async () => {
  const ontologyAtom = (label: string) => intuitionAtomIdFromText(label);
  const ontology = createOntologyManifest({
    version: "1.0.0",
    deploymentClassId: ontologyAtom("deployment-class"),
    predicates: {
      membership: ontologyAtom("membership"),
      implements: ontologyAtom("implements"),
      deployedOn: ontologyAtom("deployed-on"),
      sourceAt: ontologyAtom("source-at"),
      hasTermsSchema: ontologyAtom("has-terms-schema"),
      restricts: ontologyAtom("restricts"),
      affectsOperation: ontologyAtom("affects-operation"),
      partOfRelease: ontologyAtom("part-of-release"),
      describedBy: ontologyAtom("described-by"),
    },
  });
  const reviewedIds = new Set([
    ontology.deploymentClassId,
    ...Object.values(ontology.predicates),
  ]);
  const backend = new RegistryBackend({
    endpoint: "https://graph.example",
    rpcEndpoint: "https://rpc.example",
    ontology,
    registry: {
      fetcher: fakeFetcher({ data: { triples: [] } }),
    },
    rpcFetcher: async (_input, init) => ({
      ok: true,
      status: 200,
      json: async () =>
        JSON.parse(init.body).method === "eth_chainId"
          ? { result: "0x483" }
          : { result: "0x6001600055" },
    }),
    publicClient: {
      readContract: async (request: {
        functionName: string;
        args: readonly unknown[];
      }) => {
        if (request.functionName === "isTermCreated") {
          return reviewedIds.has(String(request.args[0]));
        }
        if (request.functionName === "getAtom") {
          const labels = new Map([
            [ontology.deploymentClassId, "deployment-class"],
            [ontology.predicates.membership, "membership"],
            [ontology.predicates.implements, "implements"],
            [ontology.predicates.deployedOn, "deployed-on"],
            [ontology.predicates.sourceAt, "source-at"],
            [ontology.predicates.hasTermsSchema, "has-terms-schema"],
            [ontology.predicates.restricts, "restricts"],
            [ontology.predicates.affectsOperation, "affects-operation"],
            [ontology.predicates.partOfRelease, "part-of-release"],
            [ontology.predicates.describedBy, "described-by"],
          ]);
          return stringToHex(labels.get(String(request.args[0])) ?? "unknown");
        }
        if (request.functionName === "getTriple") {
          return [
            `0x${"00".repeat(32)}`,
            `0x${"00".repeat(32)}`,
            `0x${"00".repeat(32)}`,
          ];
        }
        throw new Error(`Unexpected read ${request.functionName}`);
      },
    },
  });
  assert.equal(backend.readiness().ready, true);
  const list = await backend.list();
  assert.equal(list.kind, "ready");

  const prepared = await backend.prepareSubmission(submission);
  assert.equal(prepared.status, "ready");
  if (prepared.status !== "ready") return;
  assert.equal(prepared.plan.status, "ready-for-simulation");
  assert.equal(prepared.chainCheck.status, "verified");

  const resolved = await backend.resolveSubmission(submission, {
    write: { atomValue: "0", tripleValue: "0" },
  });
  assert.equal(resolved.status, "ready");
  if (resolved.status !== "ready") return;
  assert.equal(resolved.batch.status, "ready");

  const verification = await backend.verifySubmission(submission, {
    write: { atomValue: "0", tripleValue: "0" },
  });
  assert.equal(verification.status, "pending");
  if (verification.status === "pending") {
    assert.equal(verification.verification.status, "pending");
  }
});

test("backend execution coordinator confirms and indexes an injected submission", async () => {
  const ontologyAtom = (label: string) => intuitionAtomIdFromText(label);
  const ontology = createOntologyManifest({
    version: "1.0.0",
    deploymentClassId: ontologyAtom("deployment-class"),
    predicates: {
      membership: ontologyAtom("membership"),
      implements: ontologyAtom("implements"),
      deployedOn: ontologyAtom("deployed-on"),
      sourceAt: ontologyAtom("source-at"),
      hasTermsSchema: ontologyAtom("has-terms-schema"),
      restricts: ontologyAtom("restricts"),
      affectsOperation: ontologyAtom("affects-operation"),
    },
  });
  const validated = validateSubmission(submission);
  assert.equal(validated.valid, true);
  if (!validated.valid) return;
  const plan = buildSubmissionPlan(validated.value, ontology, {
    status: "verified",
    address,
    codeLength: 5,
  });
  const reviewedData = new Map(
    [
      [ontology.deploymentClassId, "deployment-class"],
      ...Object.entries(ontology.predicates).map(
        ([key, id]) =>
          [
            id,
            key.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`),
          ] as const,
      ),
    ].filter((entry): entry is [string, string] => Boolean(entry[0])),
  );
  const plannedAtoms = plan.operations
    .filter((operation) => operation.kind === "ensure-atom")
    .map(
      (operation) =>
        [
          intuitionAtomIdFromText(operation.content),
          operation.content,
        ] as const,
    );
  const plannedData = new Map(plannedAtoms);
  const atomIdByContent = new Map(
    plannedAtoms.map(([id, content]) => [content, id] as const),
  );
  const triples = plan.operations
    .filter((operation) => operation.kind === "create-triple")
    .map((operation) => {
      const subjectId =
        atomIdByContent.get(operation.subject) ?? operation.subject;
      const objectId =
        atomIdByContent.get(operation.object) ?? operation.object;
      return {
        tripleId: intuitionTripleIdFromComponents(
          subjectId,
          operation.predicateId,
          objectId,
        ),
        subjectId,
        predicateId: operation.predicateId,
        objectId,
      };
    });
  const tripleById = new Map(
    triples.map((triple) => [triple.tripleId, triple]),
  );
  const reviewedIds = new Set([
    ontology.deploymentClassId,
    ...Object.values(ontology.predicates),
  ]);
  let submitted = false;
  let indexerCalls = 0;
  const publicClient = {
    readContract: async (request: {
      functionName: string;
      args: readonly unknown[];
    }) => {
      const id = String(request.args[0]).toLowerCase();
      if (request.functionName === "isTermCreated") {
        return reviewedIds.has(id) || submitted;
      }
      if (request.functionName === "getAtom") {
        const content = reviewedData.get(id) ?? plannedData.get(id);
        return content === undefined
          ? stringToHex("unknown")
          : stringToHex(content);
      }
      if (request.functionName === "getTriple") {
        const triple = submitted ? tripleById.get(id) : undefined;
        return triple
          ? [triple.subjectId, triple.predicateId, triple.objectId]
          : [
              `0x${"00".repeat(32)}`,
              `0x${"00".repeat(32)}`,
              `0x${"00".repeat(32)}`,
            ];
      }
      throw new Error(`Unexpected read ${request.functionName}`);
    },
  };
  const backend = new RegistryBackend({
    endpoint: "https://graph.example",
    rpcEndpoint: "https://rpc.example",
    ontology,
    publicClient,
    registry: {
      fetcher: async () => {
        indexerCalls += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              triples:
                indexerCalls === 1
                  ? []
                  : [
                      {
                        subject_id: plan.deployment,
                        subject: {
                          term_id: plan.deployment,
                          label: "Indexed submission",
                        },
                      },
                    ],
            },
          }),
        };
      },
    },
    rpcFetcher: async (_input, init) => ({
      ok: true,
      status: 200,
      json: async () =>
        JSON.parse(init.body).method === "eth_chainId"
          ? { result: "0x483" }
          : { result: "0x6001600055" },
    }),
  });
  let simulated = 0;
  let sent = 0;
  let confirmed = 0;
  const reviewed = await backend.resolveSubmission(submission, {
    write: { atomValue: "0", tripleValue: "0" },
  });
  assert.equal(reviewed.status, "ready");
  if (reviewed.status !== "ready") return;
  const result = await backend.executeSubmission(
    submission,
    {
      simulate: async () => {
        simulated += 1;
      },
      send: async () => {
        sent += 1;
        submitted = true;
        return `0x${String(sent).padStart(64, "0")}`;
      },
      waitForConfirmation: async (transactionHash) => {
        confirmed += 1;
        return {
          status: "confirmed",
          transactionHash,
          blockNumber: "0x10",
        };
      },
    },
    {
      write: { atomValue: "0", tripleValue: "0" },
      expectedBatch: reviewed.batch,
      indexing: { maxAttempts: 2, delayMs: 0, sleep: async () => undefined },
    },
  );
  assert.equal(result.status, "indexed");
  if (result.status !== "indexed") return;
  assert.equal(result.execution.transactionHashes.length, 2);
  assert.equal(result.receipts.length, 2);
  assert.equal(result.verification?.status, "verified");
  assert.equal(result.indexing?.phase, "indexed");
  assert.equal(simulated, 2);
  assert.equal(sent, 2);
  assert.equal(confirmed, 3);
});

test("backend receipt verification exposes confirmed and blocked states", async () => {
  const hash = `0x${"11".repeat(32)}`;
  const backend = new RegistryBackend({
    endpoint: "https://graph.example",
    rpcEndpoint: "https://rpc.example",
    rpcFetcher: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        result: { status: "0x1", blockNumber: "0x10" },
      }),
    }),
  });
  const confirmed = await backend.verifyReceipt(hash);
  assert.equal(confirmed.status, "confirmed");

  const blocked = await new RegistryBackend({
    endpoint: "https://graph.example",
  }).verifyReceipt(hash);
  assert.equal(blocked.status, "blocked");
});

function entry(label: string, chain: string, domain: string): RegistryEntry {
  return {
    id: label,
    termId: label,
    label,
    description: `${label} description`,
    domain,
    operation: "transfer",
    chain,
    audit: "No audit claim",
    stake: 0,
    stakeLabel: "No signal",
    state: "live",
    createdAt: "2026-08-02",
    deployment: label,
    source: "Source pending",
    terms: "Terms pending",
    claims: [],
    usage: [],
    supportSignal: { value: "0", label: "No signal" },
    oppositionSignal: { value: "0", label: "No signal" },
  };
}

test("registry filters are deterministic and do not mutate the source list", () => {
  const entries = [
    entry("Token cap", "Intuition", "ERC20"),
    entry("Target guard", "Ethereum", "Calls"),
  ];
  const filtered = filterRegistryEntries(entries, { query: "token" });
  assert.deepEqual(
    filtered.map((item) => item.label),
    ["Token cap"],
  );
  assert.equal(entries.length, 2);
});

test("backend registry list exposes deterministic browse filters", async () => {
  const backend = new RegistryBackend({
    endpoint: "https://graph.example",
    registry: {
      membershipPredicateId: "predicate-membership",
      deploymentClassId: "class-deployment",
      fetcher: fakeFetcher({
        data: {
          triples: [
            {
              term_id: "membership-alpha",
              subject_id: address,
              created_at: "2026-08-03T00:00:00Z",
              subject: {
                term_id: address,
                label: "Alpha Enforcer",
                data: "alpha",
              },
              term: { vaults: [{ total_assets: "2" }] },
            },
            {
              term_id: "membership-beta",
              subject_id: secondAddress,
              created_at: "2026-08-02T00:00:00Z",
              subject: {
                term_id: secondAddress,
                label: "Beta Enforcer",
                data: "beta",
              },
              term: { vaults: [{ total_assets: "1" }] },
            },
          ],
        },
      }),
    },
  });
  const result = await backend.list({ query: "alpha" });
  assert.equal(result.kind, "ready");
  if (result.kind !== "ready") return;
  assert.deepEqual(
    result.entries.map((entry) => entry.label),
    ["Alpha Enforcer"],
  );
});

test("metadata browse filters hydrate canonical deployment claims", async () => {
  const ontology = createOntologyManifest({
    version: "1.0.0",
    deploymentClassId: termId("a"),
    predicates: {
      membership: termId("b"),
      deployedOn: termId("c"),
      restricts: termId("d"),
      affectsOperation: termId("e"),
    },
  });
  let detailCalls = 0;
  const backend = new RegistryBackend({
    endpoint: "https://graph.example",
    ontology,
    registry: {
      fetcher: async (_input, init) => {
        const body = JSON.parse(init.body) as { query: string };
        if (body.query.includes("DeploymentClaims")) {
          detailCalls += 1;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                triples: [
                  {
                    term_id: "claim-chain",
                    created_at: "2026-08-03T00:00:00Z",
                    subject: { term_id: address, label: "Alpha Enforcer" },
                    predicate: {
                      term_id: ontology.predicates.deployedOn,
                      label: "deployed on",
                    },
                    object: { term_id: "chain", label: "eip155:1155" },
                  },
                  {
                    term_id: "claim-domain",
                    created_at: "2026-08-03T00:00:01Z",
                    subject: { term_id: address, label: "Alpha Enforcer" },
                    predicate: {
                      term_id: ontology.predicates.restricts,
                      label: "restricts",
                    },
                    object: { term_id: "domain", label: "ERC20 transfer" },
                  },
                  {
                    term_id: "claim-operation",
                    created_at: "2026-08-03T00:00:02Z",
                    subject: { term_id: address, label: "Alpha Enforcer" },
                    predicate: {
                      term_id: ontology.predicates.affectsOperation,
                      label: "affects operation",
                    },
                    object: { term_id: "operation", label: "transfer" },
                  },
                ],
              },
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              triples: [
                {
                  term_id: "membership-alpha",
                  subject_id: address,
                  subject: { term_id: address, label: "Alpha Enforcer" },
                },
              ],
            },
          }),
        };
      },
    },
  });
  const result = await backend.list({ chain: "eip155:1155" });
  assert.equal(result.kind, "ready");
  if (result.kind !== "ready") return;
  assert.equal(detailCalls, 1);
  assert.equal(result.entries[0]?.domain, "ERC20 transfer");
  assert.equal(result.entries[0]?.operation, "transfer");
});

test("indexing poll reports indexed after bounded retries", async () => {
  let callCount = 0;
  const result = await pollRegistryForDeployment(
    registryConfig(async () => {
      callCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            triples:
              callCount === 1
                ? []
                : [
                    {
                      subject_id: address,
                      subject: { term_id: address, label: "Indexed" },
                    },
                  ],
          },
        }),
      };
    }),
    address,
    { maxAttempts: 3, delayMs: 0, sleep: async () => undefined },
  );

  assert.equal(result.phase, "indexed");
  assert.equal(result.attempts, 2);
});

test("indexing poll searches bounded registry pages before timing out", async () => {
  const offsets: number[] = [];
  const result = await pollRegistryForDeployment(
    registryConfig(async (_input, init) => {
      const body = JSON.parse(init.body) as {
        variables: { offset: number; limit: number };
      };
      offsets.push(body.variables.offset);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            triples:
              body.variables.offset === 0
                ? [
                    {
                      subject_id: secondAddress,
                      subject: { term_id: secondAddress, label: "Other" },
                    },
                  ]
                : [
                    {
                      subject_id: address,
                      subject: { term_id: address, label: "Indexed later" },
                    },
                  ],
          },
        }),
      };
    }),
    address,
    {
      maxAttempts: 1,
      pageSize: 1,
      maxPages: 3,
      delayMs: 0,
    },
  );
  assert.equal(result.phase, "indexed");
  assert.deepEqual(offsets, [0, 1]);
});

test("composability reader keeps support and opposition separate", async () => {
  const result = await loadComposabilityClaims({
    endpoint: "https://mainnet.intuition.sh/v1/graphql",
    subjectId: address,
    predicateIds: ["predicate-complements"],
    fetcher: fakeFetcher({
      data: {
        triples: [
          {
            term_id: "relationship-1",
            predicate: {
              term_id: "predicate-complements",
              label: "complements",
            },
            object: { term_id: secondAddress, label: "Target guard" },
            term: { vaults: [{ total_assets: "9", total_shares: "8" }] },
            counter_term: {
              vaults: [{ total_assets: "3", total_shares: "2" }],
            },
          },
        ],
      },
    }),
  });

  assert.equal(result.kind, "ready");
  if (result.kind !== "ready") return;
  assert.equal(result.claims[0].kind, "complements");
  assert.equal(result.claims[0].support.value, "9");
  assert.equal(result.claims[0].opposition.value, "3");
});

test("composability reader resolves contextual evidence by reviewed predicate ID", async () => {
  let calls = 0;
  const result = await loadComposabilityClaims({
    endpoint: "https://mainnet.intuition.sh/v1/graphql",
    subjectId: address,
    predicateIds: ["predicate-complements"],
    contextPredicateIds: {
      appliesInContext: "predicate-context",
      requiresOrdering: "predicate-ordering",
      supportedBy: "predicate-evidence",
    },
    fetcher: async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        json: async () =>
          calls === 1
            ? {
                data: {
                  triples: [
                    {
                      term_id: "relationship-1",
                      predicate: {
                        term_id: "predicate-complements",
                        label: "complements",
                      },
                      object: {
                        term_id: "enforcer-b",
                        label: "Enforcer B",
                      },
                    },
                  ],
                },
              }
            : {
                data: {
                  triples: [
                    {
                      term_id: "context-1",
                      subject_id: "relationship-1",
                      predicate: {
                        term_id: "predicate-context",
                        label: "applies in context",
                      },
                      object: {
                        term_id: "context-transfer",
                        label: "Token transfer",
                      },
                    },
                    {
                      term_id: "evidence-1",
                      subject_id: "relationship-1",
                      predicate: {
                        term_id: "predicate-evidence",
                        label: "supported by",
                      },
                      object: {
                        term_id: "source-1",
                        label: "Codec test",
                      },
                    },
                  ],
                },
              },
      };
    },
  });

  assert.equal(result.kind, "ready");
  if (result.kind !== "ready") return;
  assert.equal(calls, 2);
  assert.equal(result.claims[0].context.length, 2);
  assert.deepEqual(
    result.claims[0].context.map((claim) => claim.kind),
    ["applies-in-context", "supported-by"],
  );
});

test("backend exposes reviewed composability claims through its service boundary", async () => {
  const ontology = createOntologyManifest({
    version: "1.0.0",
    deploymentClassId: termId("a"),
    predicates: {
      membership: termId("b"),
      complements: termId("c"),
      conflictsWith: termId("d"),
      redundantWith: termId("e"),
    },
  });
  const backend = new RegistryBackend({
    endpoint: "https://graph.example",
    ontology,
    registry: {
      fetcher: fakeFetcher({
        data: {
          triples: [
            {
              term_id: "relationship-1",
              predicate: {
                term_id: ontology.predicates.complements,
                label: "complements",
              },
              object: { term_id: secondAddress, label: "Target guard" },
              term: { vaults: [{ total_assets: "4" }] },
              counter_term: { vaults: [{ total_assets: "1" }] },
            },
          ],
        },
      }),
    },
  });
  const result = await backend.composability(address);
  assert.equal(result.kind, "ready");
  if (result.kind !== "ready") return;
  assert.equal(result.claims[0]?.kind, "complements");
  assert.equal(result.claims[0]?.support.value, "4");
  assert.equal(result.claims[0]?.opposition.value, "1");
});

test("curation preparation verifies the claim and encodes support or opposition", async () => {
  const subjectId = termId("1");
  const predicateId = termId("2");
  const objectId = termId("3");
  const claimId = intuitionTripleIdFromComponents(
    subjectId,
    predicateId,
    objectId,
  );
  const counterId = termId("4");
  const multivaultAddress = "0x3333333333333333333333333333333333333333";
  const calls: string[] = [];
  const publicClient = {
    readContract: async (request: {
      functionName: string;
      args: readonly unknown[];
    }) => {
      calls.push(request.functionName);
      if (request.functionName === "getTriple") {
        return [subjectId, predicateId, objectId];
      }
      if (request.functionName === "getCounterIdFromTripleId") {
        assert.equal(request.args[0], claimId);
        return counterId;
      }
      throw new Error(`Unexpected curation read ${request.functionName}`);
    },
  };

  const support = await prepareCurationDeposit(
    {
      claimId,
      action: "support",
      receiver: address,
      amount: "100",
      curveId: 1,
      minShares: "2",
    },
    publicClient,
    { multivaultAddress },
  );
  assert.equal(support.status, "ready");
  if (support.status !== "ready") return;
  assert.equal(support.targetTermId, claimId);
  assert.equal(support.request.to, multivaultAddress);
  assert.equal(support.request.value, "100");
  assert.match(support.request.data, /^0x[0-9a-f]+$/i);

  const oppose = await prepareCurationDeposit(
    {
      claimId,
      action: "oppose",
      receiver: address,
      amount: "200",
      curveId: "1",
    },
    publicClient,
    { multivaultAddress },
  );
  assert.equal(oppose.status, "ready");
  if (oppose.status !== "ready") return;
  assert.equal(oppose.targetTermId, counterId);
  assert.equal(oppose.minShares, "0");
  assert.deepEqual(calls, [
    "getTriple",
    "getTriple",
    "getCounterIdFromTripleId",
  ]);

  const invalid = await prepareCurationDeposit(
    {
      claimId,
      action: "support",
      receiver: "not-an-address",
      amount: "0",
      curveId: 1,
    },
    publicClient,
  );
  assert.equal(invalid.status, "error");

  const invalidMultivault = await prepareCurationDeposit(
    {
      claimId,
      action: "support",
      receiver: address,
      amount: "1",
      curveId: "1",
    },
    publicClient,
    { multivaultAddress: "not-an-address" },
  );
  assert.equal(invalidMultivault.status, "error");
});

test("curation execution confirms the receipt and target vault through an injected adapter", async () => {
  const subjectId = termId("5");
  const predicateId = termId("6");
  const objectId = termId("7");
  const claimId = intuitionTripleIdFromComponents(
    subjectId,
    predicateId,
    objectId,
  );
  const transactionHash = `0x${"a".repeat(64)}`;
  const calls: string[] = [];
  const publicClient = {
    readContract: async (request: { functionName: string }) => {
      calls.push(request.functionName);
      if (request.functionName === "getTriple") {
        return [subjectId, predicateId, objectId];
      }
      if (request.functionName === "getVault") return ["101", "100"];
      throw new Error(`Unexpected execution read ${request.functionName}`);
    },
  };
  let simulated = 0;
  let sent = 0;
  const result = await executeCurationDeposit(
    {
      claimId,
      action: "support",
      receiver: address,
      amount: "1",
      curveId: "1",
    },
    publicClient,
    {
      simulate: async () => {
        simulated += 1;
      },
      send: async () => {
        sent += 1;
        return transactionHash;
      },
      waitForConfirmation: async () => ({
        status: "confirmed",
        transactionHash,
        blockNumber: "0x10",
      }),
    },
  );
  assert.equal(result.status, "confirmed");
  if (result.status !== "confirmed") return;
  assert.equal(result.transactionHash, transactionHash);
  assert.equal(result.vault?.status, "verified");
  assert.equal(simulated, 1);
  assert.equal(sent, 1);
  assert.deepEqual(calls, ["getTriple", "getVault"]);
});
