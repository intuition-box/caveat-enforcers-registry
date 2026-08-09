const ENDPOINT = "https://mainnet.intuition.sh/v1/graphql";
const MEMBERSHIP_PREDICATE =
  "0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1";
const DEPLOYMENT_CLASS =
  "0x6b417110d95173e05bb927254249126617efb6410824afe0e8d029245252f21c";
const IMPLEMENTS_PREDICATE =
  "0xb8adf8a79c30ae6a224ac8a76a738258114da42a3799387648f0fde2caeb2bba";

const membershipQuery = `
  query RegistryDeployments($predicate: String!, $object: String!, $limit: Int!) {
    triples(
      where: {
        predicate_id: { _eq: $predicate }
        object_id: { _eq: $object }
      }
      order_by: { created_at: desc }
      limit: $limit
    ) {
      term_id
      subject_id
      created_at
      subject { label }
      term { vaults { total_assets position_count } }
      counter_term { vaults { total_assets position_count } }
    }
  }
`;

const implementationQuery = `
  query DeploymentImplementations($predicate: String!, $subjects: [String!]!) {
    triples(
      where: {
        predicate_id: { _eq: $predicate }
        subject_id: { _in: $subjects }
      }
    ) {
      subject_id
      object_id
      object { label }
    }
  }
`;

async function graph(query, variables) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`GraphQL request failed with HTTP ${response.status}.`);
  }
  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  return payload.data;
}

function sumAssets(vaults) {
  return (vaults ?? []).reduce((total, vault) => {
    const value = vault?.total_assets;
    return (
      total +
      (typeof value === "string" && /^\d+$/.test(value) ? BigInt(value) : 0n)
    );
  }, 0n);
}

function formatTrust(wei) {
  const padded = wei.toString().padStart(19, "0");
  const integer = padded.slice(0, -18);
  const fraction = padded.slice(-18).slice(0, 4).replace(/0+$/, "");
  if (wei > 0n && integer === "0" && !fraction) return "<0.0001 TRUST";
  return `${integer}${fraction ? `.${fraction}` : ""} TRUST`;
}

function parseCaip10(label) {
  const match = /^caip10:eip155:(\d+):(0x[0-9a-f]{40})$/i.exec(label ?? "");
  if (!match) return null;
  return { chainId: match[1], address: match[2].toLowerCase() };
}

async function main() {
  const membership = await graph(membershipQuery, {
    predicate: MEMBERSHIP_PREDICATE,
    object: DEPLOYMENT_CLASS,
    limit: 100,
  });
  const triples = membership.triples ?? [];
  const subjects = [...new Set(triples.map((triple) => triple.subject_id))];
  const implementation = await graph(implementationQuery, {
    predicate: IMPLEMENTS_PREDICATE,
    subjects,
  });
  const implementations = new Map(
    (implementation.triples ?? []).map((triple) => [
      triple.subject_id,
      { id: triple.object_id, name: triple.object?.label ?? null },
    ]),
  );

  const entries = triples
    .map((triple) => {
      const identity = parseCaip10(triple.subject?.label);
      if (!identity) return null;
      const supportWei = sumAssets(triple.term?.vaults);
      const oppositionWei = sumAssets(triple.counter_term?.vaults);
      return {
        deploymentTermId: triple.subject_id,
        membershipClaimId: triple.term_id,
        canonicalType: implementations.get(triple.subject_id)?.name ?? null,
        implementationTermId:
          implementations.get(triple.subject_id)?.id ?? null,
        chainId: identity.chainId,
        address: identity.address,
        supportWei: supportWei.toString(),
        support: formatTrust(supportWei),
        oppositionWei: oppositionWei.toString(),
        opposition: formatTrust(oppositionWei),
        createdAt: triple.created_at,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const supportOrder = BigInt(right.supportWei) - BigInt(left.supportWei);
      if (supportOrder !== 0n) return supportOrder > 0n ? 1 : -1;
      return (left.canonicalType ?? left.address).localeCompare(
        right.canonicalType ?? right.address,
      );
    });

  console.log(
    JSON.stringify(
      {
        endpoint: ENDPOINT,
        registryBoundary: {
          membershipPredicateId: MEMBERSHIP_PREDICATE,
          deploymentClassId: DEPLOYMENT_CLASS,
        },
        count: entries.length,
        entries,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Wallet picker query failed.",
  );
  process.exitCode = 1;
});
