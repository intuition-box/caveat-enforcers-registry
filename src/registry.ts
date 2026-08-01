import type { EnforcerRecord } from "./types";

export type RegistryEntry = EnforcerRecord & { image?: string | null };

export type RegistryState =
  | { kind: "ready"; entries: RegistryEntry[] }
  | { kind: "unconfigured" }
  | { kind: "error"; message: string };

const endpoint =
  import.meta.env.VITE_INTUITION_GRAPHQL_URL ??
  "https://mainnet.intuition.sh/v1/graphql";
const membershipPredicateId = import.meta.env
  .VITE_REGISTRY_MEMBERSHIP_PREDICATE_ID;
const deploymentClassId = import.meta.env.VITE_REGISTRY_DEPLOYMENT_CLASS_ID;

const registryQuery = `
  query RegistryDeployments($predicateId: String!, $classId: String!) {
    triples(
      where: {
        predicate_id: { _eq: $predicateId }
        object_id: { _eq: $classId }
      }
      order_by: { created_at: desc }
      limit: 100
    ) {
      subject_id
      created_at
      subject {
        term_id
        label
        image
      }
    }
  }
`;

type GraphResponse = {
  data?: {
    triples: Array<{
      subject_id: string;
      created_at: string;
      subject: {
        term_id: string;
        label: string | null;
        image: string | null;
      } | null;
    }>;
  };
  errors?: Array<{ message: string }>;
};

export async function loadRegistry(): Promise<RegistryState> {
  if (!membershipPredicateId || !deploymentClassId) {
    return { kind: "unconfigured" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: registryQuery,
        variables: {
          predicateId: membershipPredicateId,
          classId: deploymentClassId,
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
      return { kind: "error", message: payload.errors[0].message };
    }

    return {
      kind: "ready",
      entries:
        payload.data?.triples.map((triple) => ({
          id: triple.subject?.term_id ?? triple.subject_id,
          label: triple.subject?.label ?? "Unnamed deployment",
          description:
            "Onchain registry deployment. Open the detail view to inspect its claims.",
          domain: "Unclassified",
          operation: "Claim pending",
          chain: "Chain claim pending",
          audit: "No audit claim",
          stake: 0,
          stakeLabel: "Awaiting signal",
          state: "live" as const,
          image: triple.subject?.image,
          createdAt: triple.created_at,
          deployment: triple.subject_id,
          source: "Source claim pending",
          terms: "Terms schema claim pending.",
          claims: [],
          usage: [],
        })) ?? [],
    };
  } catch {
    return {
      kind: "error",
      message:
        "The registry could not be reached. Check the network and try again.",
    };
  }
}
