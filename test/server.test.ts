import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { RegistryBackend } from "../src/backend.js";
import { createOntologyManifest } from "../src/ontology.js";
import { startBackendServer } from "../src/server.js";

test("backend server exposes honest health when ontology is incomplete", async () => {
  const server = startBackendServer(0, {
    backend: new RegistryBackend({
      endpoint: "https://mainnet.intuition.sh/v1/graphql",
      ontology: createOntologyManifest({ version: "unconfigured" }),
    }),
  });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      ready: boolean;
      ontologyIssues: Array<{ path: string }>;
    };
    assert.equal(payload.ready, false);
    assert.ok(
      payload.ontologyIssues.some(
        (issue) => issue.path === "deploymentClassId",
      ),
    );

    const composability = await fetch(
      `http://127.0.0.1:${address.port}/api/registry/0x${"11".repeat(32)}/composability`,
    );
    assert.equal(composability.status, 200);
    const composabilityPayload = (await composability.json()) as {
      kind: string;
    };
    assert.equal(composabilityPayload.kind, "unconfigured");

    const composabilityIndex = await fetch(
      `http://127.0.0.1:${address.port}/api/composability`,
    );
    assert.equal(composabilityIndex.status, 200);
    const composabilityIndexPayload = (await composabilityIndex.json()) as {
      kind: string;
    };
    assert.equal(composabilityIndexPayload.kind, "unconfigured");

    const execute = await fetch(
      `http://127.0.0.1:${address.port}/api/submissions/execute`,
      { method: "POST", body: "{}" },
    );
    assert.equal(execute.status, 409);
    const executePayload = (await execute.json()) as {
      status: string;
      message: string;
    };
    assert.equal(executePayload.status, "blocked");
    assert.match(executePayload.message, /injected wallet adapter/i);

    const curation = await fetch(
      `http://127.0.0.1:${address.port}/api/curation/prepare`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: {
            claimId: `0x${"11".repeat(32)}`,
            action: "support",
            receiver: "0x1111111111111111111111111111111111111111",
            amount: "1",
            curveId: "1",
          },
        }),
      },
    );
    assert.equal(curation.status, 409);
    const curationPayload = (await curation.json()) as {
      status: string;
      message: string;
    };
    assert.equal(curationPayload.status, "blocked");
    assert.match(curationPayload.message, /public Intuition client/i);

    const curationExecute = await fetch(
      `http://127.0.0.1:${address.port}/api/curation/execute`,
      { method: "POST", body: "{}" },
    );
    assert.equal(curationExecute.status, 409);
    const curationExecutePayload = (await curationExecute.json()) as {
      status: string;
      message: string;
    };
    assert.equal(curationExecutePayload.status, "blocked");
    assert.match(curationExecutePayload.message, /injected wallet adapter/i);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("backend HTTP registry route forwards browse filters", async () => {
  const backend = new RegistryBackend({
    endpoint: "https://graph.example",
    registry: {
      membershipPredicateId: "predicate-membership",
      deploymentClassId: "class-deployment",
      fetcher: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            triples: [
              {
                term_id: "membership-alpha",
                subject_id: "0x1111111111111111111111111111111111111111",
                subject: {
                  term_id: "0x1111111111111111111111111111111111111111",
                  label: "Alpha Enforcer",
                },
              },
              {
                term_id: "membership-beta",
                subject_id: "0x2222222222222222222222222222222222222222",
                subject: {
                  term_id: "0x2222222222222222222222222222222222222222",
                  label: "Beta Enforcer",
                },
              },
            ],
          },
        }),
      }),
    },
  });
  const server = startBackendServer(0, { backend });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  try {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/registry?query=alpha`,
    );
    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      kind: string;
      entries: Array<{ label: string }>;
    };
    assert.equal(payload.kind, "ready");
    assert.deepEqual(
      payload.entries.map((entry) => entry.label),
      ["Alpha Enforcer"],
    );
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("backend CORS allows first-party Intuition Box surfaces and configured origins", async () => {
  const previous = process.env.CORS_ORIGIN;
  process.env.CORS_ORIGIN = "https://registry.example";
  const server = startBackendServer(0, {
    backend: new RegistryBackend({
      endpoint: "https://mainnet.intuition.sh/v1/graphql",
      ontology: createOntologyManifest({ version: "unconfigured" }),
    }),
  });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  try {
    const preflight = await fetch(
      `http://127.0.0.1:${address.port}/api/registry`,
      {
        method: "OPTIONS",
        headers: { origin: "https://registry.example" },
      },
    );
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("access-control-allow-origin"),
      "https://registry.example",
    );
    const health = await fetch(`http://127.0.0.1:${address.port}/health`, {
      headers: { origin: "https://registry.example" },
    });
    assert.equal(
      health.headers.get("access-control-allow-origin"),
      "https://registry.example",
    );

    const production = await fetch(
      `http://127.0.0.1:${address.port}/api/registry`,
      {
        method: "OPTIONS",
        headers: { origin: "https://caveats-registry.intuition.box" },
      },
    );
    assert.equal(
      production.headers.get("access-control-allow-origin"),
      "https://caveats-registry.intuition.box",
    );

    const preview = await fetch(
      `http://127.0.0.1:${address.port}/api/registry`,
      {
        method: "OPTIONS",
        headers: { origin: "https://4.caveats-registry.intuition.box" },
      },
    );
    assert.equal(
      preview.headers.get("access-control-allow-origin"),
      "https://4.caveats-registry.intuition.box",
    );

    const lookalike = await fetch(
      `http://127.0.0.1:${address.port}/api/registry`,
      {
        method: "OPTIONS",
        headers: {
          origin: "https://4.caveats-registry.intuition.box.evil.example",
        },
      },
    );
    assert.equal(lookalike.headers.get("access-control-allow-origin"), null);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    if (previous === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = previous;
  }
});

test("submission validation returns structured errors for malformed bodies", async () => {
  const server = startBackendServer(0, {
    backend: new RegistryBackend({
      endpoint: "https://mainnet.intuition.sh/v1/graphql",
      ontology: createOntologyManifest({ version: "unconfigured" }),
    }),
  });
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address() as AddressInfo;
  try {
    const malformed = await fetch(
      `http://127.0.0.1:${address.port}/api/submissions/validate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"chainId":',
      },
    );
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), {
      error: "Request body must be valid JSON.",
    });

    const incomplete = await fetch(
      `http://127.0.0.1:${address.port}/api/submissions/validate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chainId: "not-a-chain" }),
      },
    );
    assert.equal(incomplete.status, 422);
    assert.deepEqual(await incomplete.json(), {
      valid: false,
      issues: [
        {
          path: "submission",
          message:
            "Provide a JSON object matching the published submission schema.",
        },
      ],
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
