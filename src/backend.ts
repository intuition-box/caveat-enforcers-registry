import {
  type RegistryConfig,
  loadDeploymentClaims,
  loadRegistryPage,
  summarizeDeploymentClaims,
} from "./registry.js";
import {
  loadComposabilityClaims,
  type ComposabilityState,
} from "./composability.js";
import {
  createOntologyManifest,
  validateOntologyManifest,
  type OntologyManifest,
} from "./ontology.js";
import { buildSubmissionPlan, type SubmissionPlan } from "./submission.js";
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
  rpcEndpoint?: string;
  ontology?: OntologyManifest;
  registry?: Omit<RegistryConfig, "endpoint" | "ontology">;
  publicClient?: IntuitionPublicClient;
  rpcFetcher?: RpcFetcher;
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

export class RegistryBackend {
  private readonly config: BackendConfig;
  private readonly ontology: OntologyManifest;

  constructor(config: BackendConfig) {
    this.config = config;
    this.ontology = config.ontology ?? unreviewedOntology();
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

    return {
      kind: "ready" as const,
      deploymentId,
      label,
      claims,
      hasMore,
      summary: summarizeDeploymentClaims(
        deploymentId,
        claims,
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
    if (!this.config.rpcEndpoint?.trim()) {
      return {
        status: "blocked",
        message: "An RPC endpoint is required for contract-code verification.",
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
      this.config.rpcEndpoint,
      address,
      this.config.rpcFetcher,
    );
    const chainCheck = await verifyRpcChainId(
      this.config.rpcEndpoint,
      validated.value.chainId,
      this.config.rpcFetcher,
    );
    const decoderChecks = validated.value.termsSchema.decoderFunction
      ? await Promise.all(
          validated.value.termsSchema.fixtures.map((_, fixtureIndex) =>
            verifyTermsDecoder(
              this.config.rpcEndpoint!,
              address,
              validated.value.termsSchema,
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
      ),
    };
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
