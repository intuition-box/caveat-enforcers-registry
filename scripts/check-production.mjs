import { readFileSync } from "node:fs";

const frontendUrl = (
  process.env.REGISTRY_FRONTEND_URL ?? "https://caveats-registry.intuition.box"
).replace(/\/$/, "");
const apiUrl = (
  process.env.REGISTRY_API_URL ?? "https://caveats-registry-api.intuition.box"
).replace(/\/$/, "");
const expectedRecords = Number(process.env.REGISTRY_EXPECTED_RECORDS ?? "33");
const requireFinal = process.argv.includes("--require-final");

const referenceDeploymentId =
  "0x3e4691f7e34ed65e2e4b30c79a1c9b073a58d84c6a9afdd8b68146ec7d98c01c";
const curationClaimId =
  "0x55ae5374e58d54e10124bfc39273a7297bce98ab3b68ef010b8d1da57128cb04";
const minimumCurationProofAssets = 50_000_000_000_000_000n;

const composabilityPlan = JSON.parse(
  readFileSync(
    new URL("../data/composability-seed.triples.json", import.meta.url),
    "utf8",
  ),
);
const composabilityIds = composabilityPlan.triples.flatMap((entry) =>
  [
    entry.relationship?.id,
    entry.context?.id,
    entry.ordering?.id,
    entry.evidence?.id,
  ].filter(Boolean),
);

const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(60_000),
  });
}

async function json(url, options = {}) {
  const response = await request(url, options);
  const body = await response.text();
  assert(response.ok, `${url} returned HTTP ${response.status}`);
  try {
    return { response, body: JSON.parse(body) };
  } catch {
    throw new Error(`${url} did not return JSON`);
  }
}

async function graph(endpoint, query, variables) {
  const { body } = await json(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  assert(
    !body.errors?.length,
    body.errors?.map((item) => item.message).join("; "),
  );
  return body.data;
}

async function check(name, operation) {
  try {
    const detail = await operation();
    results.push({ name, status: "pass", detail });
  } catch (error) {
    results.push({
      name,
      status: "fail",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

await check("frontend and security headers", async () => {
  const response = await request(frontendUrl);
  assert(response.ok, `frontend returned HTTP ${response.status}`);
  assert(
    response.headers.get("x-frame-options")?.toUpperCase() === "DENY",
    "X-Frame-Options is not DENY",
  );
  assert(
    response.headers
      .get("content-security-policy")
      ?.includes("frame-ancestors 'none'"),
    "CSP does not deny framing",
  );
  assert(
    response.headers.get("x-content-type-options") === "nosniff",
    "X-Content-Type-Options is not nosniff",
  );
  return frontendUrl;
});

let health;
await check("API health and ontology", async () => {
  const result = await json(`${apiUrl}/health`);
  health = result.body;
  assert(health.ready === true, "API is not ready");
  assert(
    String(health.chainId) === "1155",
    `unexpected chain ${health.chainId}`,
  );
  assert(
    Array.isArray(health.ontologyIssues) && health.ontologyIssues.length === 0,
    `ontology issues: ${JSON.stringify(health.ontologyIssues)}`,
  );
  return `${apiUrl} on chain 1155`;
});

await check("browser-wallet CORS", async () => {
  const response = await request(`${apiUrl}/api/registry`, {
    method: "OPTIONS",
    headers: {
      origin: frontendUrl,
      "access-control-request-method": "GET",
      "access-control-request-headers": "content-type",
    },
  });
  assert(response.status === 204, `preflight returned HTTP ${response.status}`);
  assert(
    response.headers.get("access-control-allow-origin") === frontendUrl,
    "API did not allow the production frontend origin",
  );
  return `origin ${frontendUrl}`;
});

await check("canonical registry records", async () => {
  assert(
    Number.isInteger(expectedRecords) && expectedRecords > 0,
    "REGISTRY_EXPECTED_RECORDS must be a positive integer",
  );
  const { body } = await json(`${apiUrl}/api/registry?limit=100`);
  assert(body.kind === "ready", `registry state is ${body.kind}`);
  const ids = new Set(body.entries?.map((entry) => entry.id));
  assert(
    ids.size >= expectedRecords,
    `expected at least ${expectedRecords} unique records, received ${ids.size}`,
  );
  return `${ids.size} unique records`;
});

let referenceDetail;
await check("reference deployment detail", async () => {
  const { body } = await json(
    `${apiUrl}/api/registry/${referenceDeploymentId}`,
  );
  referenceDetail = body;
  assert(body.kind === "ready", `detail state is ${body.kind}`);
  assert(
    body.summary?.implementation === "AllowedCalldataEnforcer",
    `unexpected implementation ${body.summary?.implementation}`,
  );
  assert(
    body.claims?.length >= 4,
    "reference detail has fewer than four claims",
  );
  return `${body.claims.length} claims`;
});

if (requireFinal) {
  await check("enriched ontology fields", async () => {
    const summary = referenceDetail?.summary;
    assert(summary, "reference detail was unavailable");
    assert(summary.domain, "restriction domain is missing");
    assert(summary.operation, "affected operation is missing");
    assert(summary.terms, "terms schema is missing");
    assert(summary.audit, "audit evidence is missing");
    assert(summary.usage?.length, "usage evidence is missing");
    return `${summary.domain}; ${summary.operation}; ${summary.audit}`;
  });

  await check("live composability graph", async () => {
    assert(
      health?.endpoint,
      "GraphQL endpoint is missing from health response",
    );
    const data = await graph(
      health.endpoint,
      `query ProductionComposability($ids: [String!]!) {
        triples(where: { term_id: { _in: $ids } }) { term_id }
      }`,
      { ids: composabilityIds },
    );
    const live = new Set(data.triples?.map((triple) => triple.term_id));
    const missing = composabilityIds.filter((id) => !live.has(id));
    assert(
      missing.length === 0,
      `${missing.length}/${composabilityIds.length} composability triples are missing`,
    );
    return `${live.size} relationship/context/ordering/evidence triples`;
  });

  await check("claim-opposition proof", async () => {
    assert(
      health?.endpoint,
      "GraphQL endpoint is missing from health response",
    );
    const data = await graph(
      health.endpoint,
      `query ProductionCuration($claimId: String!) {
        triples(where: { term_id: { _eq: $claimId } }, limit: 1) {
          term_id
          counter_term { vaults { total_assets } }
        }
      }`,
      { claimId: curationClaimId },
    );
    const assets = (data.triples?.[0]?.counter_term?.vaults ?? []).reduce(
      (total, vault) => total + BigInt(vault.total_assets ?? "0"),
      0n,
    );
    assert(
      assets >= minimumCurationProofAssets,
      `counter-vault assets ${assets} are below the proof threshold`,
    );
    return `${assets} wei in the counter vault`;
  });
}

for (const result of results) {
  const marker = result.status === "pass" ? "PASS" : "FAIL";
  console.log(`${marker}  ${result.name}: ${result.detail}`);
}
if (!requireFinal) {
  console.log(
    "INFO  final chain gates skipped; rerun with --require-final after approved writes and API redeploy",
  );
}
if (results.some((result) => result.status === "fail")) process.exitCode = 1;
