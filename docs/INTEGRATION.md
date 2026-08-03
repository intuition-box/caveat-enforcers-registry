# Integration Rules

## Canonical registry environment

- Intuition chain ID: `1155`
- Mainnet GraphQL endpoint: `https://mainnet.intuition.sh/v1/graphql`
- MultiVault: `0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e`

Mainnet is the canonical data environment for registry reads and release validation. Do not write disposable records to it.

## Directory configuration

The registry client requires these reviewed values:

- `REGISTRY_MEMBERSHIP_PREDICATE_ID`
- `REGISTRY_DEPLOYMENT_CLASS_ID`

The values belong in the application's environment configuration and must match the versioned ontology manifest. They identify the query boundary; they are not an access-control list. Intuition permits any wallet to propose a new term or claim. Team review is a curation and payout concern, not a prerequisite encoded by this client.

## Query boundary

The application must define its membership predicate and deployment-class object IDs in a versioned ontology manifest. It must query those IDs to discover deployments.

Do not use a display label as the membership boundary. Labels can change or collide.

### Membership query

This is the canonical read used by the registry. The predicate and object IDs are variables so a
contributor can propose an ontology without changing the query or shipping a new app release.

```graphql
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
    subject {
      term_id
      label
      data
      image
      type
    }
    term {
      vaults {
        curve_id
        total_assets
        total_shares
        market_cap
        position_count
      }
    }
    counter_term {
      vaults {
        curve_id
        total_assets
        total_shares
        market_cap
        position_count
      }
    }
  }
}
```

Variables:

```json
{
  "membershipPredicateId": "0x...32-byte-term-id...",
  "deploymentClassId": "0x...32-byte-term-id...",
  "limit": 100,
  "offset": 0
}
```

`data.triples` is the membership page. `subject.term_id` is the deployment term to use for
detail lookup. `term.vaults` and `counter_term.vaults` are separate support and opposition
signals; a missing vault is not a zero-confidence guarantee.

### Deployment detail query

After selecting a deployment, fetch every claim where that deployment is the subject. Resolve
meaning from predicate IDs in the ontology manifest, not from labels alone.

```graphql
query DeploymentClaims($deploymentId: String!, $limit: Int!, $offset: Int!) {
  triples(
    where: { subject_id: { _eq: $deploymentId } }
    order_by: { created_at: asc }
    limit: $limit
    offset: $offset
  ) {
    term_id
    created_at
    subject {
      term_id
      label
      data
      image
      type
    }
    predicate {
      term_id
      label
      data
      type
    }
    object {
      term_id
      label
      data
      type
    }
    term {
      vaults {
        curve_id
        total_assets
        total_shares
        market_cap
        position_count
      }
    }
    counter_term_id
    counter_term {
      vaults {
        curve_id
        total_assets
        total_shares
        market_cap
        position_count
      }
    }
  }
}
```

### Runnable read-only runner

The repository includes a dependency-free runner. It performs only `POST` GraphQL reads and
never signs or writes a transaction:

```bash
REGISTRY_MEMBERSHIP_PREDICATE_ID=0x... \
REGISTRY_DEPLOYMENT_CLASS_ID=0x... \
pnpm query:registry
```

To read one deployment's claims:

```bash
pnpm query:registry -- --detail 0x...deployment-term-id...
```

The runner prints the raw GraphQL response so clients can preserve fields they do not yet map.

For a deployment detail view, query all claims where the deployment is the subject, then resolve source, terms-schema, audit, chain, and type claims from their canonical predicate IDs.

## Submission and indexing

After a write transaction:

1. verify the transaction receipt;
2. verify the affected term or vault directly onchain;
3. poll GraphQL with bounded retries;
4. show `confirmed onchain, indexing` while the indexer catches up;
5. treat the entry as discoverable only when the registry query returns it.

## Wallet-facing use

A wallet integration should fetch registry membership, resolve the linked claims, filter for the wallet's supported chain and intended use case, and load the associated terms schema.

It must present support and opposition separately. Registry membership, usage claims, and support are not execution guarantees. The wallet must simulate an intended delegation before it executes it.

## Open-registry proof

The open model is demonstrated when a previously unlisted enforcer is submitted through the standard flow, verified onchain, indexed, and displayed by the same query pattern as the initial reference collection. No application release may be required for that result.
