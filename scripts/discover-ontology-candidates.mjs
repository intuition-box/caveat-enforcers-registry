const endpoint =
  process.env.INTUITION_GRAPHQL_URL ??
  "https://mainnet.intuition.sh/v1/graphql";
const limit = Number(process.env.ONTOLOGY_SEARCH_LIMIT ?? "25");
const searches = process.argv.slice(2).filter((term) => term !== "--");
const requestedSearches = searches.length
  ? searches
  : ["caveat", "enforcer", "registry", "subset"];

const query = `
  query OntologyCandidates($search: String!, $limit: Int!) {
    atoms(
      where: {
        _or: [
          { label: { _ilike: $search } }
          { data: { _ilike: $search } }
        ]
      }
      order_by: { created_at: asc }
      limit: $limit
    ) {
      term_id
      label
      data
      type
      resolving_status
      created_at
    }
  }
`;

async function searchAtoms(term) {
  const search = term.includes("%") ? term : `%${term}%`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { search, limit } }),
  });
  if (!response.ok) {
    throw new Error(`GraphQL request failed (${response.status}).`);
  }
  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  return {
    search,
    atoms: payload.data?.atoms ?? [],
  };
}

const results = [];
for (const term of requestedSearches) results.push(await searchAtoms(term));

/* Read-only discovery output. This script never selects or writes ontology IDs. */
console.log(
  JSON.stringify(
    {
      endpoint,
      results,
      warning:
        "Candidate IDs require team review before they may enter the production ontology manifest.",
    },
    null,
    2,
  ),
);
