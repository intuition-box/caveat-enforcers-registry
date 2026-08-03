const endpoint =
  process.env.REGISTRY_GRAPHQL_ENDPOINT ??
  process.env.INTUITION_GRAPHQL_URL ??
  "https://mainnet.intuition.sh/v1/graphql";
const membershipPredicateId =
  process.env.REGISTRY_MEMBERSHIP_PREDICATE_ID?.trim();
const deploymentClassId = process.env.REGISTRY_DEPLOYMENT_CLASS_ID?.trim();
const detailIndex = process.argv.indexOf("--detail");
const detailId =
  detailIndex >= 0 ? process.argv[detailIndex + 1]?.trim() : undefined;

const membershipQuery = `
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
      subject { term_id label data image type }
      term { vaults { curve_id total_assets total_shares market_cap position_count } }
      counter_term { vaults { curve_id total_assets total_shares market_cap position_count } }
    }
  }
`;

const detailQuery = `
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
      term { vaults { curve_id total_assets total_shares market_cap position_count } }
      counter_term_id
      counter_term { vaults { curve_id total_assets total_shares market_cap position_count } }
    }
  }
`;

const query = detailId ? detailQuery : membershipQuery;
const variables = detailId
  ? { deploymentId: detailId, limit: 100, offset: 0 }
  : {
      membershipPredicateId,
      deploymentClassId,
      limit: 100,
      offset: 0,
    };

if (!detailId && (!membershipPredicateId || !deploymentClassId)) {
  throw new Error(
    "Set REGISTRY_MEMBERSHIP_PREDICATE_ID and REGISTRY_DEPLOYMENT_CLASS_ID, or pass --detail <term-id>.",
  );
}
if (detailIndex >= 0 && !detailId)
  throw new Error("--detail requires a deployment term ID.");

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ query, variables }),
});
if (!response.ok)
  throw new Error(`GraphQL request failed (${response.status}).`);
const payload = await response.json();
if (payload.errors?.length)
  throw new Error(payload.errors.map((error) => error.message).join("; "));
console.log(
  JSON.stringify({ endpoint, variables, data: payload.data }, null, 2),
);
