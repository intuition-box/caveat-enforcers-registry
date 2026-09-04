import {
  type RegistryConfig,
  loadDeploymentClaims,
  loadRegistryPage,
  summarizeDeploymentClaims,
} from "./registry.js";
import {
  loadAllComposabilityClaims,
  loadComposabilityClaims,
  type ComposabilityIndexState,
  type ComposabilityState,
} from "./composability.js";
import {
  createOntologyManifest,
  validateOntologyManifest,
  type OntologyManifest,
} from "./ontology.js";
import {
  buildSubmissionPlan,
  collectClaimFirstSubmissionThings,
  collectSubmissionThings,
  type SubmissionIpfsContent,
  type SubmissionPlan,
} from "./submission.js";
import { pinAtomDocument, type AtomThing, type Pinner } from "./pin.js";

/** Cap on JSON evidence items pinned per submission; beyond this we fall back
 * to raw JSON rather than fan out unbounded pinning-service calls. */
const MAX_SUBMISSION_PINS = 32;
/** Concurrent pins in flight at once. */
const PIN_CONCURRENCY = 5;

/** Pin Things preserving input order, with a bounded concurrency pool. */
async function pinThingsBounded(
  things: AtomThing[],
  pin: Pinner,
): Promise<string[]> {
  const uris = new Array<string>(things.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < things.length) {
      const index = cursor++;
      const { uri } = await pinAtomDocument(things[index]!, pin);
      uris[index] = uri;
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(PIN_CONCURRENCY, things.length) }, worker),
  );
  return uris;
}
import {
  buildSubmissionWriteBatch,
  executeSubmissionWriteBatch,
  resolveSubmissionWorkflow,
  verifySubmissionWriteBatchOnchain,
  type SubmissionResolution,
  type SubmissionOnchainVerification,
  type SubmissionWriteAdapter,
  type SubmissionWriteExecution,
  type SubmissionWriteBatch,
  type SubmissionWriteOptions,
} from "./write-workflow.js";
import {
  pollRegistryForDeployment,
  type IndexingPollOptions,
  type IndexingStatus,
} from "./indexing.js";
import {
  normalizeEvmAddress,
  isNormalizedClaimFirstSubmission,
  validateSubmission,
  verifyContractCode,
  type ContractCodeCheck,
  type NormalizedSubmission,
  type RpcFetcher,
  type SubmissionInput,
  type ValidationIssue,
} from "./validation.js";
import {
  verifyRpcChainId,
  verifyTransactionReceipt,
  type RpcChainCheck,
  type TransactionReceiptCheck,
} from "./chain.js";
import type { IntuitionPublicClient } from "./intuition.js";
import { verifyTermsDecoder, type TermsDecoderCheck } from "./terms-decoder.js";
import type { Claim } from "./types.js";
import { preferIpfsBackedClaims } from "./claims-ipfs.js";
import { filterRegistryEntries, type RegistryFilters } from "./filter.js";
import {
  executeCurationDeposit,
  prepareCurationDeposit,
  type CurationExecution,
  type CurationInput,
  type CurationPlan,
  type CurationWriteAdapter,
} from "./curation.js";

export type BackendConfig = {
  endpoint: string;
  /** Intuition RPC used for MultiVault reads, writes, and receipts. */
  rpcEndpoint?: string;
  /** Target-chain RPCs used only to verify submitted deployment code. */
  verificationRpcEndpoints?: Record<string, string | undefined>;
  ontology?: OntologyManifest;
  registry?: Omit<RegistryConfig, "endpoint" | "ontology">;
  publicClient?: IntuitionPublicClient;
  rpcFetcher?: RpcFetcher;
  /** Superseded raw atom ID → ipfs replacement atom ID (both lowercased). */
  supersededReplacements?: ReadonlyMap<string, string>;
  /** Pins a submission's JSON evidence to IPFS. Absent → raw JSON atoms. */
  pinner?: Pinner;
};

export type BackendRegistryListOptions = {
  limit?: number;
  offset?: number;
  hydrate?: boolean;
} & RegistryFilters;

export type BackendReadiness = {
  ready: boolean;
  chainId: string;
  endpoint: string;
  ontologyIssues: ReturnType<typeof validateOntologyManifest>;
};

export type PreparedSubmission =
  | {
      status: "ready";
      submission: NormalizedSubmission;
      codeCheck: ContractCodeCheck;
      chainCheck: RpcChainCheck;
      decoderChecks: TermsDecoderCheck[];
      plan: SubmissionPlan;
    }
  | { status: "invalid"; issues: ValidationIssue[] }
  | { status: "blocked"; message: string };

export type ResolvedSubmission =
  | {
      status: "ready";
      prepared: Extract<PreparedSubmission, { status: "ready" }>;
      resolution: SubmissionResolution;
      batch: Extract<SubmissionWriteBatch, { status: "ready" }>;
    }
  | { status: "invalid"; issues: ValidationIssue[] }
  | {
      status: "blocked";
      message: string;
      prepared?: Extract<PreparedSubmission, { status: "ready" }>;
      resolution?: SubmissionResolution;
      batch?: Extract<SubmissionWriteBatch, { status: "blocked" }>;
    };

export type VerifiedSubmission =
  | {
      status: "verified" | "pending" | "error";
      resolved: Extract<ResolvedSubmission, { status: "ready" }>;
      verification: SubmissionOnchainVerification;
    }
  | Extract<ResolvedSubmission, { status: "invalid" | "blocked" }>;

export type BackendReceiptResult =
  TransactionReceiptCheck | { status: "blocked"; message: string };

export type SubmissionExecutionResult =
  | {
      status:
        | "indexed"
        | "confirmed-onchain"
        | "submitted"
        | "pending"
        | "failed"
        | "error"
        | "blocked";
      resolved: Extract<ResolvedSubmission, { status: "ready" }>;
      execution: SubmissionWriteExecution;
      receipts: TransactionReceiptCheck[];
      verification?: SubmissionOnchainVerification;
      indexing?: IndexingStatus;
      message: string;
    }
  | Extract<ResolvedSubmission, { status: "invalid" | "blocked" }>;

function unreviewedOntology(): OntologyManifest {
  return createOntologyManifest({ version: "unreviewed" });
}

function boundedPositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  const normalized =
    value !== undefined && Number.isFinite(value)
      ? Math.floor(value)
      : fallback;
  return Math.min(Math.max(normalized, 1), maximum);
}

function submissionBatchFingerprint(
  batch: Extract<SubmissionWriteBatch, { status: "ready" }>,
): string {
  return JSON.stringify({
    finalTripleIds: batch.finalTripleIds,
    transactions: batch.transactions.map((transaction) => ({
      kind: transaction.kind,
      to: transaction.request.to.toLowerCase(),
      data: transaction.request.data.toLowerCase(),
      value: transaction.request.value ?? "0",
      atomIds: transaction.atomIds ?? [],
      tripleIds: transaction.tripleIds ?? [],
      dependsOn: transaction.dependsOn ?? null,
    })),
  });
}

export class RegistryBackend {
  private readonly config: BackendConfig;
  private readonly ontology: OntologyManifest;
  private readonly supersededReplacements: ReadonlyMap<string, string>;

  constructor(config: BackendConfig) {
    this.config = config;
    this.ontology = config.ontology ?? unreviewedOntology();
    this.supersededReplacements = config.supersededReplacements ?? new Map();
  }

  readiness(): BackendReadiness {
    const ontologyIssues = validateOntologyManifest(this.ontology);
    return {
      ready:
        Boolean(this.config.endpoint.trim()) && ontologyIssues.length === 0,
      chainId: this.ontology.chainId,
      endpoint: this.config.endpoint,
      ontologyIssues: this.config.endpoint.trim()
        ? ontologyIssues
        : [
            ...ontologyIssues,
            { path: "endpoint", message: "A GraphQL endpoint is required." },
          ],
    };
  }

  private registryConfig(): RegistryConfig {
    return {
      endpoint: this.config.endpoint,
      ontology: this.ontology,
      ...this.config.registry,
    };
  }

  async list(options: BackendRegistryListOptions = {}) {
    const result = await loadRegistryPage(this.registryConfig(), options);
    if (result.kind !== "ready") return result;
    const hydrate =
      options.hydrate === true ||
      Boolean(
        options.chain?.trim() ||
        options.domain?.trim() ||
        options.operation?.trim(),
      );
    let entries = result.entries;
    if (hydrate && entries.length) {
      try {
        entries = await Promise.all(
          entries.map(async (entry) => {
            const detail = await this.detail(entry.id, {
              pageSize: 100,
              maxPages: 100,
            });
            if (detail.kind !== "ready") {
              throw new Error(
                detail.kind === "error"
                  ? detail.message
                  : `Deployment ${entry.id} is not configured for detail reads.`,
              );
            }
            if (detail.hasMore) {
              throw new Error(
                `Deployment ${entry.id} has more claims than the bounded hydration limit.`,
              );
            }
            return {
              ...entry,
              label: detail.label ?? entry.label,
              description: detail.summary.description ?? entry.description,
              chain: detail.summary.chain ?? entry.chain,
              source: detail.summary.source ?? entry.source,
              terms: detail.summary.terms ?? entry.terms,
              audit: detail.summary.audit ?? entry.audit,
              domain: detail.summary.domain ?? entry.domain,
              operation: detail.summary.operation ?? entry.operation,
              implementation:
                detail.summary.implementation ?? entry.implementation,
              claims: detail.summary.claims,
              usage: detail.summary.usage,
            };
          }),
        );
      } catch (error) {
        return {
          kind: "error" as const,
          message:
            error instanceof Error
              ? `Registry detail hydration failed: ${error.message}`
              : "Registry detail hydration failed.",
        };
      }
    }
    return {
      ...result,
      entries: filterRegistryEntries(entries, options),
    };
  }

  async detail(
    deploymentId: string,
    options: { pageSize?: number; maxPages?: number } = {},
  ) {
    const pageSize = boundedPositiveInteger(options.pageSize, 100, 100);
    const maxPages = boundedPositiveInteger(options.maxPages, 10, 100);
    const claims: Claim[] = [];
    let label: string | null = null;
    let hasMore = false;

    for (let page = 0; page < maxPages; page += 1) {
      const result = await loadDeploymentClaims(
        this.registryConfig(),
        deploymentId,
        { limit: pageSize, offset: page * pageSize },
      );
      if (result.kind !== "ready") return result;
      label ??= result.label;
      claims.push(...result.claims);
      hasMore = result.hasMore;
      if (!result.hasMore) break;
    }

    const implementationId = claims.find(
      (claim) =>
        claim.predicateId === this.ontology.predicates.implements &&
        Boolean(claim.objectId),
    )?.objectId;

    if (implementationId && !hasMore) {
      for (let page = 0; page < maxPages; page += 1) {
        const result = await loadDeploymentClaims(
          this.registryConfig(),
          implementationId,
          { limit: pageSize, offset: page * pageSize },
        );
        if (result.kind !== "ready") return result;
        claims.push(...result.claims);
        hasMore = result.hasMore;
        if (!result.hasMore) break;
      }
    }

    // Hide a raw-JSON object atom when its exact ipfs replacement is present,
    // so migrated records never show "json object" beside the readable claim.
    const visibleClaims = preferIpfsBackedClaims(
      claims,
      this.supersededReplacements,
    );

    return {
      kind: "ready" as const,
      deploymentId,
      label,
      claims: visibleClaims,
      hasMore,
      summary: summarizeDeploymentClaims(
        deploymentId,
        visibleClaims,
        this.ontology,
        label,
      ),
    };
  }

  async composability(
    subjectId: string,
    options: { limit?: number } = {},
  ): Promise<ComposabilityState> {
    const predicateIds = [
      this.ontology.predicates.complements,
      this.ontology.predicates.conflictsWith,
      this.ontology.predicates.redundantWith,
    ].filter((id): id is string => Boolean(id?.trim()));
    return loadComposabilityClaims({
      endpoint: this.config.endpoint,
      subjectId,
      predicateIds,
      contextPredicateIds: {
        appliesInContext: this.ontology.predicates.appliesInContext,
        requiresOrdering: this.ontology.predicates.requiresOrdering,
        supportedBy: this.ontology.predicates.supportedBy,
      },
      limit: options.limit,
      fetcher: this.config.registry?.fetcher,
    });
  }

  async composabilityIndex(
    options: { limit?: number } = {},
  ): Promise<ComposabilityIndexState> {
    const predicateIds = [
      this.ontology.predicates.complements,
      this.ontology.predicates.conflictsWith,
      this.ontology.predicates.redundantWith,
    ].filter((id): id is string => Boolean(id?.trim()));
    return loadAllComposabilityClaims({
      endpoint: this.config.endpoint,
      predicateIds,
      contextPredicateIds: {
        appliesInContext: this.ontology.predicates.appliesInContext,
        requiresOrdering: this.ontology.predicates.requiresOrdering,
        supportedBy: this.ontology.predicates.supportedBy,
      },
      limit: options.limit,
      fetcher: this.config.registry?.fetcher,
    });
  }

  async prepareCuration(
    input: CurationInput,
    options: { multivaultAddress?: string } = {},
  ): Promise<CurationPlan> {
    if (!this.config.publicClient) {
      return {
        status: "blocked",
        message:
          "A public Intuition client is required to verify the claim before preparing a curation deposit.",
      };
    }
    return prepareCurationDeposit(input, this.config.publicClient, options);
  }

  async executeCuration(
    input: CurationInput,
    adapter: CurationWriteAdapter,
    options: { multivaultAddress?: string } = {},
  ): Promise<CurationExecution> {
    if (!this.config.publicClient) {
      return {
        status: "blocked",
        message:
          "A public Intuition client is required to verify the claim and target vault.",
      };
    }
    return executeCurationDeposit(
      input,
      this.config.publicClient,
      adapter,
      options,
    );
  }

  async prepareSubmission(input: SubmissionInput): Promise<PreparedSubmission> {
    const validated = validateSubmission(input);
    if (!validated.valid)
      return { status: "invalid", issues: validated.issues };
    const verificationRpcEndpoint =
      this.config.verificationRpcEndpoints?.[validated.value.chainId]?.trim() ||
      (validated.value.chainId === this.ontology.chainId
        ? this.config.rpcEndpoint?.trim()
        : undefined);
    if (!verificationRpcEndpoint) {
      return {
        status: "blocked",
        message: `A target-chain RPC endpoint is required to verify deployment code on EIP-155 chain ${validated.value.chainId}.`,
      };
    }
    const address = normalizeEvmAddress(validated.value.contractAddress);
    if (!address) {
      return {
        status: "invalid",
        issues: [
          {
            path: "contractAddress",
            message: "Enter a valid submitter contract address.",
          },
        ],
      };
    }
    const codeCheck = await verifyContractCode(
      verificationRpcEndpoint,
      address,
      this.config.rpcFetcher,
    );
    const chainCheck = await verifyRpcChainId(
      verificationRpcEndpoint,
      validated.value.chainId,
      this.config.rpcFetcher,
    );
    const legacySubmission = isNormalizedClaimFirstSubmission(validated.value)
      ? null
      : validated.value;
    const decoderChecks = legacySubmission?.termsSchema.decoderFunction
      ? await Promise.all(
          legacySubmission.termsSchema.fixtures.map((_, fixtureIndex) =>
            verifyTermsDecoder(
              verificationRpcEndpoint,
              address,
              legacySubmission.termsSchema,
              fixtureIndex,
              this.config.rpcFetcher,
            ),
          ),
        )
      : [];
    const decoderIssues = decoderChecks
      .filter(
        (check): check is Extract<TermsDecoderCheck, { status: "error" }> =>
          check.status === "error",
      )
      .map((check, index) => ({
        path: `termsSchema.fixtures[${index}]`,
        message: check.message,
      }));
    if (decoderIssues.length) {
      return { status: "invalid", issues: decoderIssues };
    }
    const ipfsContent = await this.pinSubmissionEvidence(validated.value);
    return {
      status: "ready",
      submission: validated.value,
      codeCheck,
      chainCheck,
      decoderChecks,
      plan: buildSubmissionPlan(
        validated.value,
        this.ontology,
        codeCheck,
        chainCheck,
        ipfsContent,
      ),
    };
  }

  /**
   * Pin a submission's JSON evidence to IPFS so new listings carry ipfs://
   * atoms like the migrated reference set. Returns undefined — a raw-JSON
   * fallback — when no pinner is configured or the submission carries more
   * pinnable evidence than MAX_SUBMISSION_PINS, so a submission can never fan
   * out into unbounded pinning-service calls. Pinning is bounded to a small
   * concurrency pool. It runs at prepare time because the plan must show the
   * exact ipfs:// atoms; the evidence is user-authored data destined for
   * public on-chain publication.
   */
  private async pinSubmissionEvidence(
    submission: NormalizedSubmission,
  ): Promise<SubmissionIpfsContent | undefined> {
    if (!this.config.pinner) return undefined;
    const pin = this.config.pinner;

    // Claim-first (v2): pin any claim object that is a JSON object/array.
    if (isNormalizedClaimFirstSubmission(submission)) {
      const collected = collectClaimFirstSubmissionThings(submission);
      if (collected.length === 0 || collected.length > MAX_SUBMISSION_PINS) {
        return undefined;
      }
      const uris = await pinThingsBounded(
        collected.map((entry) => entry.thing),
        pin,
      );
      const claimObjects = new Map<number, string>();
      collected.forEach((entry, i) => claimObjects.set(entry.index, uris[i]!));
      return { claimObjects };
    }

    // Legacy: structured terms/audit/usage evidence.
    const things = collectSubmissionThings(submission);
    const ordered = [
      things.termsSchema,
      ...(things.audit ? [things.audit] : []),
      ...things.usage,
    ];
    if (ordered.length > MAX_SUBMISSION_PINS) return undefined;
    const uris = await pinThingsBounded(ordered, pin);
    let cursor = 0;
    const termsSchema = uris[cursor++]!;
    const audit = things.audit ? uris[cursor++]! : undefined;
    const usage = things.usage.map(() => uris[cursor++]!);
    return { termsSchema, audit, usage };
  }

  async resolveSubmission(
    input: SubmissionInput,
    options: { write?: SubmissionWriteOptions } = {},
  ): Promise<ResolvedSubmission> {
    const prepared = await this.prepareSubmission(input);
    if (prepared.status !== "ready") return prepared;
    if (prepared.plan.status !== "ready-for-simulation") {
      return {
        status: "blocked",
        message: prepared.plan.warning,
      };
    }
    if (!this.config.publicClient) {
      return {
        status: "blocked",
        message:
          "A public Intuition client is required to resolve atom and triple IDs.",
      };
    }
    const resolution = await resolveSubmissionWorkflow(
      prepared.plan,
      this.ontology,
      this.config.publicClient,
      { multivaultAddress: options.write?.multivaultAddress },
    );
    const batch = buildSubmissionWriteBatch(resolution, options.write);
    if (batch.status !== "ready") {
      return {
        status: "blocked",
        message: batch.message,
        prepared,
        resolution,
        batch,
      };
    }
    return { status: "ready", prepared, resolution, batch };
  }

  async verifySubmission(
    input: SubmissionInput,
    options: { write?: SubmissionWriteOptions } = {},
  ): Promise<VerifiedSubmission> {
    const resolved = await this.resolveSubmission(input, options);
    if (resolved.status !== "ready") return resolved;
    if (!this.config.publicClient) {
      return {
        status: "blocked",
        message:
          "A public Intuition client is required for direct onchain verification.",
      };
    }
    const verification = await verifySubmissionWriteBatchOnchain(
      resolved.resolution,
      this.config.publicClient,
      { multivaultAddress: options.write?.multivaultAddress },
    );
    return {
      status: verification.status,
      resolved,
      verification,
    };
  }

  async executeSubmission(
    input: SubmissionInput,
    adapter: SubmissionWriteAdapter,
    options: {
      write?: SubmissionWriteOptions;
      expectedBatch?: Extract<SubmissionWriteBatch, { status: "ready" }>;
      startAt?: number;
      priorTransactionHash?: string;
      priorReceiptConfirmed?: boolean;
      indexing?: IndexingPollOptions;
    } = {},
  ): Promise<SubmissionExecutionResult> {
    const resolved = await this.resolveSubmission(input, {
      write: options.write,
    });
    if (resolved.status !== "ready") return resolved;
    if (
      options.expectedBatch &&
      submissionBatchFingerprint(options.expectedBatch) !==
        submissionBatchFingerprint(resolved.batch)
    ) {
      return {
        status: "blocked",
        message:
          "Registry state changed after review. Resolve and review a fresh transaction plan before signing.",
      };
    }

    const execution = await executeSubmissionWriteBatch(
      resolved.batch,
      adapter,
      options.startAt,
      options.priorTransactionHash,
      options.priorReceiptConfirmed,
    );
    if (execution.status === "blocked" || execution.status === "failed") {
      return {
        status: execution.status,
        resolved,
        execution,
        receipts: [],
        message: execution.message,
      };
    }

    const receipts: TransactionReceiptCheck[] = [];
    if (execution.transactionHashes.length && !adapter.waitForConfirmation) {
      return {
        status: "submitted",
        resolved,
        execution,
        receipts,
        message:
          "Transactions were submitted. Attach a receipt confirmer before onchain and indexer verification.",
      };
    }

    if (adapter.waitForConfirmation) {
      for (const transactionHash of execution.transactionHashes) {
        let receipt: TransactionReceiptCheck;
        try {
          receipt = await adapter.waitForConfirmation(transactionHash);
        } catch (error) {
          return {
            status: "error",
            resolved,
            execution,
            receipts,
            message:
              error instanceof Error
                ? error.message
                : "Receipt confirmation failed.",
          };
        }
        receipts.push(receipt);
        if (receipt.status !== "confirmed") {
          return {
            status:
              receipt.status === "failed" || receipt.status === "error"
                ? "failed"
                : "pending",
            resolved,
            execution,
            receipts,
            message: receipt.message,
          };
        }
      }
    }

    if (!this.config.publicClient) {
      return {
        status: "error",
        resolved,
        execution,
        receipts,
        message:
          "A public Intuition client is required for direct onchain verification.",
      };
    }

    const verification = await verifySubmissionWriteBatchOnchain(
      resolved.resolution,
      this.config.publicClient,
      { multivaultAddress: options.write?.multivaultAddress },
    );
    if (verification.status === "error") {
      return {
        status: "error",
        resolved,
        execution,
        receipts,
        verification,
        message: verification.message,
      };
    }
    if (verification.status === "pending") {
      return {
        status: "pending",
        resolved,
        execution,
        receipts,
        verification,
        message: verification.message,
      };
    }

    const indexing = await pollRegistryForDeployment(
      this.registryConfig(),
      resolved.prepared.plan.deployment,
      options.indexing,
    );
    if (indexing.phase === "indexed") {
      return {
        status: "indexed",
        resolved,
        execution,
        receipts,
        verification,
        indexing,
        message: indexing.message,
      };
    }
    return {
      status: indexing.phase === "error" ? "error" : "confirmed-onchain",
      resolved,
      execution,
      receipts,
      verification,
      indexing,
      message: indexing.message,
    };
  }

  async verifyReceipt(transactionHash: string): Promise<BackendReceiptResult> {
    if (!this.config.rpcEndpoint?.trim()) {
      return {
        status: "blocked",
        message: "An RPC endpoint is required for receipt verification.",
      };
    }
    return verifyTransactionReceipt(
      this.config.rpcEndpoint,
      transactionHash,
      this.config.rpcFetcher,
    );
  }
}
