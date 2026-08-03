import type { RegistryEntry, RegistryState } from "../src/registry";

const configuredBase = (
  import.meta.env.VITE_REGISTRY_API_BASE_URL ?? ""
).trim();
const apiBase = configuredBase.replace(/\/$/, "");

export type RegistryApiState = RegistryState;

function apiUrl(path: string): string {
  return `${apiBase}${path}`;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: { accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Registry service returned HTTP ${response.status}.`);
  }
  return (await response.json()) as T;
}

export type RegistryListOptions = {
  query?: string;
  chain?: string;
  domain?: string;
  operation?: string;
  signal?: AbortSignal;
};

export async function fetchRegistry(
  options: RegistryListOptions = {},
): Promise<RegistryApiState> {
  const params = new URLSearchParams({ limit: "100", offset: "0" });
  if (options.query?.trim()) params.set("query", options.query.trim());
  if (options.chain?.trim()) params.set("chain", options.chain.trim());
  if (options.domain?.trim()) params.set("domain", options.domain.trim());
  if (options.operation?.trim())
    params.set("operation", options.operation.trim());
  params.set("hydrate", "true");
  return getJson<RegistryApiState>(`/api/registry?${params}`, options.signal);
}

export type RegistryDetailResponse =
  | {
      kind: "ready";
      deploymentId: string;
      label: string | null;
      claims: RegistryEntry["claims"];
      hasMore: boolean;
      summary: {
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
        claims: RegistryEntry["claims"];
      };
    }
  | { kind: "unconfigured"; missing: string[] }
  | { kind: "error"; message: string };

export async function fetchRegistryDetail(
  deploymentId: string,
  signal?: AbortSignal,
): Promise<RegistryDetailResponse> {
  return getJson<RegistryDetailResponse>(
    `/api/registry/${encodeURIComponent(deploymentId)}?pageSize=100&maxPages=100`,
    signal,
  );
}

export async function validateSubmission(input: unknown, signal?: AbortSignal) {
  const response = await fetch(apiUrl("/api/submissions/validate"), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  return (await response.json()) as {
    valid: boolean;
    issues?: Array<{ path: string; message: string }>;
  };
}
