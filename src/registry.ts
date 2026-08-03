import type { Claim, EnforcerRecord, RegistrySignal } from "./types.js";
import type { OntologyManifest } from "./ontology.js";
import { sumNumericStrings } from "./signals.js";

export type RegistryEntry = EnforcerRecord & {
  image?: string | null;
  termId: string;
  supportSignal: RegistrySignal;
  oppositionSignal: RegistrySignal;
};

export type RegistryState =
  | { kind: "ready"; entries: RegistryEntry[]; hasMore: boolean }
  | { kind: "unconfigured"; missing: string[] }
  | { kind: "error"; message: string };

export type RegistryConfig = {
  endpoint: string;
  membershipPredicateId?: string;
  deploymentClassId?: string;
  ontology?: OntologyManifest;
  fetcher?: RegistryFetcher;
};

export type RegistryPageOptions = {
  limit?: number;
  offset?: number;
};

export type DeploymentClaimSummary = {
  deploymentId: string;
  label: string | null;
  description: string | null;
  chain: string | null;
  source: string | null;
  terms: string | null;
  audit: string | null;
  domain: string | null;
  operation: string | null;
  usage: string[];
  implementation: string | null;
  claims: Claim[];
};

export type RegistryFetcher = (
  input: string,
  init: {
    method: "POST";
    headers: { "content-type": "application/json" };
    body: string;
  },
) => Promise<RegistryResponse>;

export type RegistryResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

type Vault = {
  total_assets?: string | number | null;
  total_shares?: string | number | null;
  market_cap?: string | number | null;
  position_count?: string | number | null;
};

type RawTerm = {
  term_id?: string | null;
  label?: string | null;
  data?: string | null;
  image?: string | null;
  value?: string | null;
  type?: string | null;
};

type RawTriple = {
  term_id?: string | null;
  subject_id?: string | null;
  created_at?: string | null;
  subject?: RawTerm | null;
  predicate?: RawTerm | null;
  object?: RawTerm | null;
  term?: { vaults?: Vault[] | null } | null;
  counter_term_id?: string | null;
  counter_term?: { vaults?: Vault[] | null } | null;
};

type GraphResponse = {
  data?: { triples?: RawTriple[] | null };
  errors?: Array<{ message?: string | null }>;
};

const defaultFetcher: RegistryFetcher = (input, init) => {
  const fetcher = (globalThis as { fetch?: RegistryFetcher }).fetch;
  if (!fetcher) {
    return Promise.reject(new Error("A fetch implementation is required."));
  }
  return fetcher(input, init);
};

export const registryDeploymentsQuery = `
  query RegistryDeployments(
    $membershipPredicateId: String!
    $deploymentClassId: String!
    $limit: Int!
    $offset: Int!
  ) {
    triples(
      where: {
        predicate_id: { _eq: $membershipPredicateId }
        object_id: { _eq: $deploymentClassId }
      }
      order_by: { created_at: desc }
      limit: $limit
      offset: $offset
    ) {
      term_id
      subject_id
      created_at
      subject {
        term_id
        label
        data
        image
        type
      }
      term {
        vaults {
          curve_id
          total_assets
          total_shares
          market_cap
          position_count
        }
      }
      counter_term {
        vaults {
          curve_id
          total_assets
          total_shares
          market_cap
          position_count
        }
      }
    }
  }
`;

export const deploymentClaimsQuery = `
  query DeploymentClaims($deploymentId: String!, $limit: Int!, $offset: Int!) {
    triples(
      where: { subject_id: { _eq: $deploymentId } }
      order_by: { created_at: asc }
      limit: $limit
      offset: $offset
    ) {
      term_id
      created_at
      subject { term_id label data image type }
      predicate { term_id label data type }
      object { term_id label data type }
      term {
        vaults {
          curve_id
          total_assets
          total_shares
          market_cap
          position_count
        }
      }
      counter_term_id
      counter_term {
        vaults {
          curve_id
          total_assets
          total_shares
          market_cap
          position_count
        }
      }
    }
  }
`;

function resolveConfig(config: RegistryConfig) {
  return {
    endpoint: config.endpoint,
    membershipPredicateId:
      config.membershipPredicateId ?? config.ontology?.predicates.membership,
    deploymentClassId:
      config.deploymentClassId ?? config.ontology?.deploymentClassId,
    fetcher: config.fetcher ?? defaultFetcher,
  };
}

function missingConfig(config: ReturnType<typeof resolveConfig>): string[] {
  return [
    ["endpoint", config.endpoint],
    ["membershipPredicateId", config.membershipPredicateId],
    ["deploymentClassId", config.deploymentClassId],
  ]
    .filter(([, value]) => !value?.trim())
    .map(([key]) => key)
    .filter((key): key is string => Boolean(key));
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

function boundedOffset(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value)
    ? Math.max(Math.floor(value), 0)
    : 0;
}

function signalFromVaults(vaults: Vault[] | null | undefined): RegistrySignal {
  const values = (vaults ?? [])
    .map((vault) => vault.total_assets ?? vault.total_shares)
    .filter(
      (value): value is string | number =>
        value !== undefined && value !== null,
    )
    .map(String);
  const first = vaults?.[0];
  const value = values.length ? sumNumericStrings(values) : "0";
  const positionValues = (vaults ?? [])
    .map((vault) => vault.position_count)
    .filter(
      (value): value is string | number =>
        value !== undefined && value !== null,
    )
    .map(String);
  const positionCount = positionValues.length
    ? positionValues.every((item) => /^\d+$/.test(item))
      ? positionValues.reduce((sum, item) => sum + BigInt(item), 0n).toString()
      : positionValues[0]
    : first?.position_count;
  return {
    value,
    label: value === "0" ? "No signal" : value,
    positionCount:
      positionCount === undefined || positionCount === null
        ? undefined
        : String(positionCount),
  };
}

function claimFromTriple(triple: RawTriple): Claim {
  const predicate =
    triple.predicate?.label ?? triple.predicate?.term_id ?? "Unknown predicate";
  const object =
    triple.object?.label ?? triple.object?.term_id ?? "Unknown object";
  const support = signalFromVaults(triple.term?.vaults);
  const opposition = signalFromVaults(triple.counter_term?.vaults);

  return {
    id: triple.term_id ?? "",
    predicate,
    object,
    stake: support.value,
    side: "support",
    predicateId: triple.predicate?.term_id ?? undefined,
    predicateLabel: triple.predicate?.label ?? undefined,
    objectId: triple.object?.term_id ?? undefined,
    objectLabel: triple.object?.label ?? undefined,
    objectData: triple.object?.data ?? undefined,
    objectValue: triple.object?.value ?? undefined,
    objectType: triple.object?.type ?? undefined,
    createdAt: triple.created_at ?? undefined,
    oppositionStake: opposition.value,
  };
}

function entryFromMembership(triple: RawTriple): RegistryEntry {
  const subjectId = triple.subject?.term_id ?? triple.subject_id ?? "";
  const supportSignal = signalFromVaults(triple.term?.vaults);
  const oppositionSignal = signalFromVaults(triple.counter_term?.vaults);

  return {
    id: subjectId,
    termId: subjectId,
    label: triple.subject?.label ?? "Unnamed deployment",
    description:
      "Onchain registry deployment. Open the detail view to inspect its claims.",
    domain: "Unclassified",
    operation: "Claim pending",
    chain: "Chain claim pending",
    audit: "No audit claim",
    stake: Number(supportSignal.value) || 0,
    stakeLabel: supportSignal.label,
    state: "live",
    image: triple.subject?.image ?? null,
    createdAt: triple.created_at ?? "",
    deployment: subjectId,
    source: "Source claim pending",
    terms: "Terms schema claim pending.",
    claims: [],
    usage: [],
    supportSignal,
    oppositionSignal,
  };
}

async function readGraph(
  fetcher: RegistryFetcher,
  endpoint: string,
  query: string,
  variables: Record<string, string | number>,
): Promise<RawTriple[]> {
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Registry request failed (${response.status}).`);
  }

  const payload = (await response.json()) as GraphResponse;
  if (payload.errors?.length) {
    throw new Error(
      payload.errors[0]?.message ?? "The registry returned an error.",
    );
  }

  return payload.data?.triples ?? [];
}

export async function loadRegistryPage(
  config: RegistryConfig,
  options: RegistryPageOptions = {},
): Promise<RegistryState> {
  const resolved = resolveConfig(config);
  const missing = missingConfig(resolved);

  if (missing.length) {
    return { kind: "unconfigured", missing };
  }

  const limit = boundedPositiveInteger(options.limit, 100, 100);
  const offset = boundedOffset(options.offset);

  try {
    const triples = await readGraph(
      resolved.fetcher,
      resolved.endpoint,
      registryDeploymentsQuery,
      {
        membershipPredicateId: resolved.membershipPredicateId!,
        deploymentClassId: resolved.deploymentClassId!,
        limit,
        offset,
      },
    );

    return {
      kind: "ready",
      entries: triples.map(entryFromMembership),
      hasMore: triples.length === limit,
    };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "The registry could not be reached.",
    };
  }
}

export async function loadRegistry(
  config: RegistryConfig,
): Promise<RegistryState> {
  return loadRegistryPage(config);
}

export async function loadDeploymentClaims(
  config: RegistryConfig,
  deploymentId: string,
  options: RegistryPageOptions = {},
): Promise<
  | {
      kind: "ready";
      deploymentId: string;
      label: string | null;
      claims: Claim[];
      hasMore: boolean;
    }
  | { kind: "unconfigured"; missing: string[] }
  | { kind: "error"; message: string }
> {
  const resolved = resolveConfig(config);
  const missing = [
    ...(!resolved.endpoint.trim() ? ["endpoint"] : []),
    ...(!deploymentId.trim() ? ["deploymentId"] : []),
  ];
  if (missing.length) {
    return { kind: "unconfigured", missing };
  }

  const limit = boundedPositiveInteger(options.limit, 100, 100);
  const offset = boundedOffset(options.offset);

  try {
    const triples = await readGraph(
      resolved.fetcher,
      resolved.endpoint,
      deploymentClaimsQuery,
      { deploymentId, limit, offset },
    );
    return {
      kind: "ready",
      deploymentId,
      label: triples[0]?.subject?.label ?? null,
      claims: triples.map(claimFromTriple),
      hasMore: triples.length === limit,
    };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "The deployment claims could not be reached.",
    };
  }
}

function claimValue(claim: Claim): string | null {
  return (
    claim.objectLabel ??
    claim.objectData ??
    claim.objectValue ??
    claim.objectId ??
    null
  );
}

function firstClaimValue(claims: Claim[], predicateId?: string): string | null {
  if (!predicateId) return null;
  const match = claims.find((claim) => claim.predicateId === predicateId);
  return match ? claimValue(match) : null;
}

export function summarizeDeploymentClaims(
  deploymentId: string,
  claims: Claim[],
  ontology: OntologyManifest,
  label: string | null = null,
): DeploymentClaimSummary {
  const usage = claims
    .filter((claim) => claim.predicateId === ontology.predicates.usedBy)
    .map(claimValue)
    .filter((value): value is string => Boolean(value));

  return {
    deploymentId,
    label,
    description: firstClaimValue(claims, ontology.predicates.describedBy),
    chain: firstClaimValue(claims, ontology.predicates.deployedOn),
    source: firstClaimValue(claims, ontology.predicates.sourceAt),
    terms: firstClaimValue(claims, ontology.predicates.hasTermsSchema),
    audit: firstClaimValue(claims, ontology.predicates.coveredByAudit),
    domain: firstClaimValue(claims, ontology.predicates.restricts),
    operation: firstClaimValue(claims, ontology.predicates.affectsOperation),
    usage,
    implementation: firstClaimValue(claims, ontology.predicates.implements),
    claims,
  };
}
