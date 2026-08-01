# Integration Rules

## Canonical registry environment

- Intuition chain ID: `1155`
- Mainnet GraphQL endpoint: `https://mainnet.intuition.sh/v1/graphql`
- MultiVault: `0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e`

Mainnet is the canonical data environment for registry reads and release validation. Do not write disposable records to it.

## Directory configuration

The read-only frontend requires these reviewed values:

- `VITE_REGISTRY_MEMBERSHIP_PREDICATE_ID`
- `VITE_REGISTRY_DEPLOYMENT_CLASS_ID`

The values belong in the application's environment configuration and must match the versioned ontology manifest. The directory shows no live registry entries until both values are supplied.

## Query boundary

The application must define its reviewed membership predicate and object term IDs in a versioned ontology manifest. It must query those IDs to discover deployments.

Do not use a display label as the membership boundary. Labels can change or collide.

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
