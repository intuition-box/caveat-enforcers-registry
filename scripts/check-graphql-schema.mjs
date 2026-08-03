const endpoint =
  process.env.INTUITION_GRAPHQL_URL ??
  "https://mainnet.intuition.sh/v1/graphql";

const query = `
  query RegistryFieldSmoke {
    triples(limit: 1) {
      term_id
      subject_id
      created_at
      subject { term_id label data image type }
      predicate { term_id label data type }
      object { term_id label data type }
      term { vaults { curve_id total_assets total_shares market_cap position_count } }
      counter_term { vaults { curve_id total_assets total_shares market_cap position_count } }
    }
  }
`;

const detailQuery = `
  query DeploymentClaimsSmoke($deploymentId: String!) {
    triples(
      where: { subject_id: { _eq: $deploymentId } }
      limit: 1
    ) {
      term_id
      created_at
      subject { term_id label data image type }
      predicate { term_id label data type }
      object { term_id label data type }
      term { vaults { curve_id total_assets total_shares market_cap position_count } }
      counter_term_id
      counter_term { vaults { curve_id total_assets total_shares market_cap position_count } }
    }
  }
`;

const composabilityContextQuery = `
  query ComposabilityContextSmoke(
    $subjectIds: [String!]!
    $predicateIds: [String!]!
  ) {
    triples(
      where: {
        subject_id: { _in: $subjectIds }
        predicate_id: { _in: $predicateIds }
      }
      limit: 1
    ) {
      term_id
      subject_id
      predicate { term_id label }
      object { term_id label }
      term { vaults { total_assets total_shares position_count } }
      counter_term { vaults { total_assets total_shares position_count } }
    }
  }
`;

async function run(query, variables = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL schema smoke failed (${response.status}).`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
}

await run(query);
await run(detailQuery, {
  deploymentId: `0x${"00".repeat(32)}`,
});
await run(composabilityContextQuery, {
  subjectIds: [`0x${"00".repeat(32)}`],
  predicateIds: [`0x${"00".repeat(32)}`],
});

/* Keep this check read-only. It intentionally uses an empty subject ID. */
/* eslint-disable no-console */
console.log(`Intuition GraphQL schema smoke passed: ${endpoint}`);
