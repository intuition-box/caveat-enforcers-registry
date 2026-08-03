import type { RegistryConfig, RegistryState } from "./registry.js";
import { loadRegistryPage } from "./registry.js";

export type IndexingStatus =
  | {
      phase: "confirmed-onchain-indexing";
      attempts: number;
      message: string;
    }
  | { phase: "indexed"; attempts: number; message: string }
  | { phase: "timeout"; attempts: number; message: string }
  | { phase: "unconfigured"; attempts: number; message: string }
  | { phase: "error"; attempts: number; message: string };

export type IndexingPollOptions = {
  maxAttempts?: number;
  delayMs?: number;
  sleep?: (delayMs: number) => Promise<void>;
  pageSize?: number;
  maxPages?: number;
};

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

const defaultSleep = (delayMs: number) =>
  new Promise<void>((resolve) => {
    const timer = (
      globalThis as unknown as {
        setTimeout: (callback: () => void, delay: number) => unknown;
      }
    ).setTimeout;
    timer(resolve, delayMs);
  });

function foundDeployment(state: RegistryState, deploymentId: string): boolean {
  return state.kind === "ready"
    ? state.entries.some(
        (entry) => entry.id.toLowerCase() === deploymentId.toLowerCase(),
      )
    : false;
}

export async function pollRegistryForDeployment(
  config: RegistryConfig,
  deploymentId: string,
  options: IndexingPollOptions = {},
): Promise<IndexingStatus> {
  const maxAttempts = boundedPositiveInteger(options.maxAttempts, 5, 100);
  const delayMs = Math.min(
    Math.max(
      options.delayMs !== undefined && Number.isFinite(options.delayMs)
        ? options.delayMs
        : 1000,
      0,
    ),
    60_000,
  );
  const pageSize = boundedPositiveInteger(options.pageSize, 100, 100);
  const maxPages = boundedPositiveInteger(options.maxPages, 10, 100);
  const sleep = options.sleep ?? defaultSleep;
  let lastState: RegistryState = { kind: "unconfigured", missing: [] };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    for (let page = 0; page < maxPages; page += 1) {
      lastState = await loadRegistryPage(config, {
        limit: pageSize,
        offset: page * pageSize,
      });

      if (lastState.kind === "unconfigured") {
        return {
          phase: "unconfigured",
          attempts: attempt,
          message: `Indexing cannot be checked until ${lastState.missing.join(", ")} is configured.`,
        };
      }

      if (lastState.kind === "error") {
        if (attempt === maxAttempts) {
          return {
            phase: "error",
            attempts: attempt,
            message: lastState.message,
          };
        }
        break;
      }

      if (foundDeployment(lastState, deploymentId)) {
        return {
          phase: "indexed",
          attempts: attempt,
          message:
            "The deployment is discoverable through the canonical registry query.",
        };
      }
      if (!lastState.hasMore) break;
    }

    if (attempt < maxAttempts) await sleep(delayMs);
  }

  return {
    phase: "timeout",
    attempts: maxAttempts,
    message:
      "The transaction may be confirmed onchain, but the deployment is not indexed yet.",
  };
}

export function confirmedOnchainIndexingMessage(): IndexingStatus {
  return {
    phase: "confirmed-onchain-indexing",
    attempts: 0,
    message: "Confirmed onchain. Waiting for the Intuition indexer.",
  };
}
