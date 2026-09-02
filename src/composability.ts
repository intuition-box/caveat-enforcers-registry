import type { RegistryFetcher } from "./registry.js";
import type { RegistrySignal } from "./types.js";
import { sumNumericStrings } from "./signals.js";

export type ComposabilityKind = "complements" | "conflicts" | "redundant";
export type ComposabilityContextKind =
  "applies-in-context" | "requires-ordering" | "supported-by";

export type ComposabilityContextClaim = {
  id: string;
  kind: ComposabilityContextKind | "unknown";
  predicateId: string;
  predicateLabel: string | null;
  objectId: string;
  objectLabel: string | null;
  support: RegistrySignal;
  opposition: RegistrySignal;
  createdAt: string;
};

export type ComposabilityClaim = {
  id: string;
  subjectId: string;
  subjectLabel: string | null;
  kind: ComposabilityKind | "unknown";
  predicateId: string;
  predicateLabel: string | null;
  relatedId: string;
  relatedLabel: string | null;
  support: RegistrySignal;
  opposition: RegistrySignal;
  createdAt: string;
  context: ComposabilityContextClaim[];
};

export type ComposabilityState =
  | { kind: "ready"; subjectId: string; claims: ComposabilityClaim[] }
  | { kind: "unconfigured"; missing: string[] }
  | { kind: "error"; message: string };

export type ComposabilityIndexState =
  | { kind: "ready"; claims: ComposabilityClaim[] }
  | { kind: "unconfigured"; missing: string[] }
  | { kind: "error"; message: string };

type Vault = {
  total_assets?: string | number | null;
  total_shares?: string | number | null;
  position_count?: string | number | null;
};

type RawTriple = {
  term_id?: string | null;
  subject_id?: string | null;
  created_at?: string | null;
  subject?: { term_id?: string | null; label?: string | null } | null;
  predicate?: { term_id?: string | null; label?: string | null } | null;
  object?: { term_id?: string | null; label?: string | null } | null;
  term?: { vaults?: Vault[] | null } | null;
  counter_term?: { vaults?: Vault[] | null } | null;
};

type GraphResponse = {
  data?: { triples?: RawTriple[] | null };
  errors?: Array<{ message?: string | null }>;
};

export const composabilityClaimsQuery = `
  query ComposabilityClaims(
    $subjectId: String!
    $predicateIds: [String!]!
    $limit: Int!
  ) {
    triples(
      where: {
        subject_id: { _eq: $subjectId }
        predicate_id: { _in: $predicateIds }
      }
      order_by: { created_at: desc }
      limit: $limit
    ) {
      term_id
      created_at
      subject { term_id label }
      predicate { term_id label }
      object { term_id label }
      term { vaults { total_assets total_shares position_count } }
      counter_term { vaults { total_assets total_shares position_count } }
    }
  }
`;

export const allComposabilityClaimsQuery = `
  query AllComposabilityClaims(
    $predicateIds: [String!]!
    $limit: Int!
  ) {
    triples(
      where: { predicate_id: { _in: $predicateIds } }
      order_by: { created_at: desc }
      limit: $limit
    ) {
      term_id
      created_at
      subject { term_id label }
      predicate { term_id label }
      object { term_id label }
      term { vaults { total_assets total_shares position_count } }
      counter_term { vaults { total_assets total_shares position_count } }
    }
  }
`;

export const composabilityContextQuery = `
  query ComposabilityContexts(
    $subjectIds: [String!]!
    $predicateIds: [String!]!
    $limit: Int!
  ) {
    triples(
      where: {
        subject_id: { _in: $subjectIds }
        predicate_id: { _in: $predicateIds }
      }
      order_by: { created_at: desc }
      limit: $limit
    ) {
      term_id
      subject_id
      created_at
      predicate { term_id label }
      object { term_id label }
      term { vaults { total_assets total_shares position_count } }
      counter_term { vaults { total_assets total_shares position_count } }
    }
  }
`;

function signal(vaults: Vault[] | null | undefined): RegistrySignal {
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

function kindFromLabel(
  label: string | null | undefined,
): ComposabilityClaim["kind"] {
  const normalized = label?.toLowerCase() ?? "";
  if (normalized.includes("complement")) return "complements";
  if (normalized.includes("conflict")) return "conflicts";
  if (normalized.includes("redundan")) return "redundant";
  return "unknown";
}

function contextKind(
  predicateId: string,
  label: string | null | undefined,
  ids: Partial<
    Record<"appliesInContext" | "requiresOrdering" | "supportedBy", string>
  >,
): ComposabilityContextClaim["kind"] {
  if (predicateId && predicateId === ids.appliesInContext)
    return "applies-in-context";
  if (predicateId && predicateId === ids.requiresOrdering)
    return "requires-ordering";
  if (predicateId && predicateId === ids.supportedBy) return "supported-by";
  const normalized = label?.toLowerCase() ?? "";
  if (normalized.includes("context")) return "applies-in-context";
  if (normalized.includes("order")) return "requires-ordering";
  if (normalized.includes("support")) return "supported-by";
  return "unknown";
}

function contextClaimFromTriple(
  triple: RawTriple,
  ids: Partial<
    Record<"appliesInContext" | "requiresOrdering" | "supportedBy", string>
  >,
): ComposabilityContextClaim {
  return {
    id: triple.term_id ?? "",
    kind: contextKind(
      triple.predicate?.term_id ?? "",
      triple.predicate?.label,
      ids,
    ),
    predicateId: triple.predicate?.term_id ?? "",
    predicateLabel: triple.predicate?.label ?? null,
    objectId: triple.object?.term_id ?? "",
    objectLabel: triple.object?.label ?? null,
    support: signal(triple.term?.vaults),
    opposition: signal(triple.counter_term?.vaults),
    createdAt: triple.created_at ?? "",
  };
}

function composabilityClaimFromTriple(
  triple: RawTriple,
  fallbackSubjectId = "",
): ComposabilityClaim {
  return {
    id: triple.term_id ?? "",
    subjectId: triple.subject?.term_id ?? fallbackSubjectId,
    subjectLabel: triple.subject?.label ?? null,
    kind: kindFromLabel(triple.predicate?.label),
    predicateId: triple.predicate?.term_id ?? "",
    predicateLabel: triple.predicate?.label ?? null,
    relatedId: triple.object?.term_id ?? "",
    relatedLabel: triple.object?.label ?? null,
    support: signal(triple.term?.vaults),
    opposition: signal(triple.counter_term?.vaults),
    createdAt: triple.created_at ?? "",
    context: [],
  };
}

async function loadContexts(
  directClaims: ComposabilityClaim[],
  endpoint: string,
  contextPredicateIds: Partial<
    Record<"appliesInContext" | "requiresOrdering" | "supportedBy", string>
  >,
  limit: number,
  fetcher: RegistryFetcher,
): Promise<string | null> {
  const contextIds = Object.values(contextPredicateIds).filter(
    (value): value is string => Boolean(value?.trim()),
  );
  if (!contextIds.length || !directClaims.length) return null;
  const contextResponse = await fetcher(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: composabilityContextQuery,
      variables: {
        subjectIds: directClaims.map((claim) => claim.id),
        predicateIds: contextIds,
        limit,
      },
    }),
  });
  if (!contextResponse.ok) {
    return `Registry context request failed (${contextResponse.status}).`;
  }
  const contextPayload = (await contextResponse.json()) as GraphResponse;
  if (contextPayload.errors?.length) {
    return (
      contextPayload.errors[0]?.message ??
      "The registry returned a context error."
    );
  }
  const claimsById = new Map(directClaims.map((claim) => [claim.id, claim]));
  for (const triple of contextPayload.data?.triples ?? []) {
    const parent = claimsById.get(triple.subject_id ?? "");
    if (parent)
      parent.context.push(contextClaimFromTriple(triple, contextPredicateIds));
  }
  return null;
}

export async function loadComposabilityClaims(input: {
  endpoint: string;
  subjectId: string;
  predicateIds?: string[];
  contextPredicateIds?: Partial<
    Record<"appliesInContext" | "requiresOrdering" | "supportedBy", string>
  >;
  limit?: number;
  fetcher?: RegistryFetcher;
}): Promise<ComposabilityState> {
  const predicateIds = input.predicateIds?.filter(Boolean) ?? [];
  if (
    !input.endpoint.trim() ||
    !input.subjectId.trim() ||
    predicateIds.length === 0
  ) {
    return {
      kind: "unconfigured",
      missing: [
        ...(!input.endpoint.trim() ? ["endpoint"] : []),
        ...(!input.subjectId.trim() ? ["subjectId"] : []),
        ...(predicateIds.length === 0 ? ["predicateIds"] : []),
      ],
    };
  }

  const fetcher =
    input.fetcher ??
    ((request: string, init: Parameters<RegistryFetcher>[1]) => {
      const globalFetcher = (globalThis as { fetch?: RegistryFetcher }).fetch;
      if (!globalFetcher)
        return Promise.reject(new Error("A fetch implementation is required."));
      return globalFetcher(request, init);
    });

  try {
    const response = await fetcher(input.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: composabilityClaimsQuery,
        variables: {
          subjectId: input.subjectId,
          predicateIds,
          limit: Math.min(Math.max(input.limit ?? 100, 1), 100),
        },
      }),
    });

    if (!response.ok) {
      return {
        kind: "error",
        message: `Registry request failed (${response.status}).`,
      };
    }

    const payload = (await response.json()) as GraphResponse;
    if (payload.errors?.length) {
      return {
        kind: "error",
        message:
          payload.errors[0]?.message ?? "The registry returned an error.",
      };
    }

    const directClaims = (payload.data?.triples ?? []).map((triple) =>
      composabilityClaimFromTriple(triple, input.subjectId),
    );
    const contextError = await loadContexts(
      directClaims,
      input.endpoint,
      input.contextPredicateIds ?? {},
      Math.min(Math.max(input.limit ?? 100, 1), 100),
      fetcher,
    );
    if (contextError) return { kind: "error", message: contextError };

    return {
      kind: "ready",
      subjectId: input.subjectId,
      claims: directClaims,
    };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "The composability claims could not be reached.",
    };
  }
}

export async function loadAllComposabilityClaims(input: {
  endpoint: string;
  predicateIds?: string[];
  contextPredicateIds?: Partial<
    Record<"appliesInContext" | "requiresOrdering" | "supportedBy", string>
  >;
  limit?: number;
  fetcher?: RegistryFetcher;
}): Promise<ComposabilityIndexState> {
  const predicateIds = input.predicateIds?.filter(Boolean) ?? [];
  if (!input.endpoint.trim() || predicateIds.length === 0) {
    return {
      kind: "unconfigured",
      missing: [
        ...(!input.endpoint.trim() ? ["endpoint"] : []),
        ...(predicateIds.length === 0 ? ["predicateIds"] : []),
      ],
    };
  }
  const fetcher =
    input.fetcher ??
    ((request: string, init: Parameters<RegistryFetcher>[1]) => {
      const globalFetcher = (globalThis as { fetch?: RegistryFetcher }).fetch;
      if (!globalFetcher)
        return Promise.reject(new Error("A fetch implementation is required."));
      return globalFetcher(request, init);
    });
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 100);
  try {
    const response = await fetcher(input.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: allComposabilityClaimsQuery,
        variables: { predicateIds, limit },
      }),
    });
    if (!response.ok) {
      return {
        kind: "error",
        message: `Registry request failed (${response.status}).`,
      };
    }
    const payload = (await response.json()) as GraphResponse;
    if (payload.errors?.length) {
      return {
        kind: "error",
        message:
          payload.errors[0]?.message ?? "The registry returned an error.",
      };
    }
    const claims = (payload.data?.triples ?? []).map((triple) =>
      composabilityClaimFromTriple(triple),
    );
    const contextError = await loadContexts(
      claims,
      input.endpoint,
      input.contextPredicateIds ?? {},
      limit,
      fetcher,
    );
    if (contextError) return { kind: "error", message: contextError };
    return { kind: "ready", claims };
  } catch (error) {
    return {
      kind: "error",
      message:
        error instanceof Error
          ? error.message
          : "The composability claims could not be reached.",
    };
  }
}
