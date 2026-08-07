import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { pathToFileURL } from "node:url";
import { createPublicClient, http } from "viem";
import {
  INTUITION_MAINNET_GRAPHQL,
  INTUITION_MAINNET_RPC,
  REFERENCE_SEED_PREDICATES,
  readOntologyManifestFromEnv,
} from "./ontology.js";
import { RegistryBackend } from "./backend.js";
import { validateSubmission, type SubmissionInput } from "./validation.js";
import type { CurationInput } from "./curation.js";
import type { IntuitionPublicClient } from "./intuition.js";
import type { IndexingPollOptions } from "./indexing.js";
import type {
  SubmissionWriteAdapter,
  SubmissionWriteOptions,
} from "./write-workflow.js";

const maxBodyBytes = 2 * 1024 * 1024;

class RequestBodyError extends Error {}

function envValue(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function createBackend(): RegistryBackend {
  const rpcEndpoint = envValue("INTUITION_RPC_URL", INTUITION_MAINNET_RPC);
  const publicClient = rpcEndpoint
    ? (createPublicClient({
        transport: http(rpcEndpoint),
      }) as unknown as IntuitionPublicClient)
    : undefined;
  const configuredOntology = readOntologyManifestFromEnv(process.env);
  const ontology = {
    ...configuredOntology,
    predicates: {
      ...configuredOntology.predicates,
      implements:
        configuredOntology.predicates.implements ??
        REFERENCE_SEED_PREDICATES.implements,
      sourceAt:
        configuredOntology.predicates.sourceAt ??
        REFERENCE_SEED_PREDICATES.sourceAt,
    },
  };
  return new RegistryBackend({
    endpoint: envValue(
      "REGISTRY_GRAPHQL_ENDPOINT",
      envValue("INTUITION_GRAPHQL_URL", INTUITION_MAINNET_GRAPHQL),
    ),
    rpcEndpoint,
    ontology,
    publicClient,
  });
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBodyBytes) {
      throw new RequestBodyError("Request body is too large.");
    }
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text.trim()) {
    throw new RequestBodyError("Request body must contain JSON.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestBodyError("Request body must be valid JSON.");
  }
}

function isSubmissionObject(value: unknown): value is SubmissionInput {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function invalidSubmissionBody(response: ServerResponse): void {
  json(response, 422, {
    valid: false,
    issues: [
      {
        path: "submission",
        message:
          "Provide a JSON object matching the published submission schema.",
      },
    ],
  });
}

function json(
  response: ServerResponse,
  status: number,
  payload: unknown,
): void {
  const body = JSON.stringify(payload);
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(body);
}

function methodNotAllowed(response: ServerResponse): void {
  json(response, 405, { error: "Method not allowed." });
}

function routePath(request: IncomingMessage): { pathname: string; url: URL } {
  const url = new URL(request.url ?? "/", "http://localhost");
  return { pathname: url.pathname, url };
}

function applyCors(
  request: IncomingMessage,
  response: ServerResponse,
): boolean {
  const configured = envValue("CORS_ORIGIN");
  const requestOrigin = request.headers.origin;
  if (configured && requestOrigin) {
    const allowed = configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (allowed.includes("*") || allowed.includes(requestOrigin)) {
      response.setHeader("access-control-allow-origin", requestOrigin);
      response.setHeader("vary", "origin");
      response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
      response.setHeader("access-control-allow-headers", "content-type,accept");
    }
  }
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return true;
  }
  return false;
}

export async function handleBackendRequest(
  request: IncomingMessage,
  response: ServerResponse,
  backend = createBackend(),
  writeAdapter?: SubmissionWriteAdapter,
): Promise<void> {
  if (applyCors(request, response)) return;
  const { pathname, url } = routePath(request);
  try {
    if (pathname === "/health") {
      json(response, 200, backend.readiness());
      return;
    }

    if (pathname === "/api/registry" && request.method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? "100");
      const offset = Number(url.searchParams.get("offset") ?? "0");
      const hydrateParam = url.searchParams.get("hydrate");
      json(
        response,
        200,
        await backend.list({
          limit,
          offset,
          query: url.searchParams.get("query") ?? undefined,
          chain: url.searchParams.get("chain") ?? undefined,
          domain: url.searchParams.get("domain") ?? undefined,
          operation: url.searchParams.get("operation") ?? undefined,
          hydrate:
            hydrateParam === "true" ||
            hydrateParam === "1" ||
            Boolean(
              url.searchParams.get("chain")?.trim() ||
              url.searchParams.get("domain")?.trim() ||
              url.searchParams.get("operation")?.trim(),
            ),
        }),
      );
      return;
    }

    const detailMatch = pathname.match(/^\/api\/registry\/([^/]+)$/);
    if (detailMatch && request.method === "GET") {
      const pageSize = Number(url.searchParams.get("pageSize") ?? "100");
      const maxPages = Number(url.searchParams.get("maxPages") ?? "10");
      json(
        response,
        200,
        await backend.detail(decodeURIComponent(detailMatch[1]), {
          pageSize,
          maxPages,
        }),
      );
      return;
    }

    const composabilityMatch = pathname.match(
      /^\/api\/registry\/([^/]+)\/composability$/,
    );
    if (composabilityMatch && request.method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? "100");
      json(
        response,
        200,
        await backend.composability(decodeURIComponent(composabilityMatch[1]), {
          limit,
        }),
      );
      return;
    }

    if (pathname === "/api/submissions/validate" && request.method === "POST") {
      const body = await readBody(request);
      if (!isSubmissionObject(body)) {
        invalidSubmissionBody(response);
        return;
      }
      let result;
      try {
        result = validateSubmission(body);
      } catch {
        invalidSubmissionBody(response);
        return;
      }
      json(response, result.valid ? 200 : 422, result);
      return;
    }

    if (pathname === "/api/curation/prepare" && request.method === "POST") {
      const body = (await readBody(request)) as {
        input: CurationInput;
        multivaultAddress?: string;
      };
      const result = await backend.prepareCuration(body.input, {
        multivaultAddress: body.multivaultAddress,
      });
      json(
        response,
        result.status === "error"
          ? 422
          : result.status === "blocked"
            ? 409
            : 200,
        result,
      );
      return;
    }

    if (pathname === "/api/curation/execute" && request.method === "POST") {
      if (!writeAdapter) {
        json(response, 409, {
          status: "blocked",
          message:
            "Curation execution requires an explicitly injected wallet adapter. The HTTP server does not load signer state.",
        });
        return;
      }
      const body = (await readBody(request)) as {
        input: CurationInput;
        multivaultAddress?: string;
      };
      const result = await backend.executeCuration(body.input, writeAdapter, {
        multivaultAddress: body.multivaultAddress,
      });
      json(
        response,
        result.status === "blocked"
          ? 409
          : result.status === "confirmed"
            ? 200
            : result.status === "submitted" || result.status === "pending"
              ? 202
              : result.status === "error" && "plan" in result
                ? 502
                : result.status === "error"
                  ? 422
                  : 502,
        result,
      );
      return;
    }

    if (pathname === "/api/submissions/prepare" && request.method === "POST") {
      const body = await readBody(request);
      if (!isSubmissionObject(body)) {
        invalidSubmissionBody(response);
        return;
      }
      const result = await backend.prepareSubmission(body);
      json(
        response,
        result.status === "invalid"
          ? 422
          : result.status === "blocked"
            ? 409
            : 200,
        result,
      );
      return;
    }

    if (pathname === "/api/submissions/resolve" && request.method === "POST") {
      const body = (await readBody(request)) as {
        input: SubmissionInput;
        write?: Record<string, string>;
      };
      const result = await backend.resolveSubmission(body.input, {
        write: body.write,
      });
      json(
        response,
        result.status === "invalid"
          ? 422
          : result.status === "blocked"
            ? 409
            : 200,
        result,
      );
      return;
    }

    if (pathname === "/api/submissions/verify" && request.method === "POST") {
      const body = (await readBody(request)) as {
        input: SubmissionInput;
        write?: Record<string, string>;
      };
      const result = await backend.verifySubmission(body.input, {
        write: body.write,
      });
      json(
        response,
        result.status === "invalid"
          ? 422
          : result.status === "blocked"
            ? 409
            : result.status === "pending"
              ? 202
              : result.status === "error"
                ? 502
                : 200,
        result,
      );
      return;
    }

    if (pathname === "/api/submissions/execute" && request.method === "POST") {
      if (!writeAdapter) {
        json(response, 409, {
          status: "blocked",
          message:
            "Execution requires an explicitly injected wallet adapter. The HTTP server does not load signer state.",
        });
        return;
      }
      const body = (await readBody(request)) as {
        input: SubmissionInput;
        write?: SubmissionWriteOptions;
        startAt?: number;
        priorTransactionHash?: string;
        priorReceiptConfirmed?: boolean;
        indexing?: IndexingPollOptions;
      };
      const result = await backend.executeSubmission(body.input, writeAdapter, {
        write: body.write,
        startAt: body.startAt,
        priorTransactionHash: body.priorTransactionHash,
        priorReceiptConfirmed: body.priorReceiptConfirmed,
        indexing: body.indexing,
      });
      json(
        response,
        result.status === "invalid"
          ? 422
          : result.status === "blocked"
            ? 409
            : result.status === "indexed"
              ? 200
              : result.status === "submitted" ||
                  result.status === "pending" ||
                  result.status === "confirmed-onchain"
                ? 202
                : 502,
        result,
      );
      return;
    }

    if (pathname === "/api/submissions/receipt" && request.method === "POST") {
      const body = (await readBody(request)) as { transactionHash: string };
      const result = await backend.verifyReceipt(body.transactionHash);
      json(
        response,
        result.status === "blocked"
          ? 409
          : result.status === "pending"
            ? 202
            : result.status === "failed" || result.status === "error"
              ? 502
              : 200,
        result,
      );
      return;
    }

    if (pathname.startsWith("/api/") || pathname === "/health") {
      json(response, 404, { error: "Route not found." });
      return;
    }
    methodNotAllowed(response);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      json(response, 400, { error: error.message });
      return;
    }
    json(response, 500, { error: "Request could not be processed." });
  }
}

export type BackendServerOptions = {
  backend?: RegistryBackend;
  writeAdapter?: SubmissionWriteAdapter;
};

export function startBackendServer(
  port = Number(envValue("PORT", "8787")),
  options: BackendServerOptions = {},
) {
  const server = createServer((request, response) => {
    void handleBackendRequest(
      request,
      response,
      options.backend,
      options.writeAdapter,
    );
  });
  server.listen(port, envValue("HOST", "127.0.0.1"));
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const port = Number(envValue("PORT", "8787"));
  startBackendServer(port);
  console.log(`Registry backend listening on http://127.0.0.1:${port}`);
}
