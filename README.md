# Caveat Enforcers Registry

An open registry for ERC-7710 caveat enforcer deployments, their terms schemas, source provenance, and supporting evidence on Intuition.

## Why this exists

A wallet or application needs more than a contract address to use an enforcer safely. It needs to know what the enforcer restricts, how its `terms` bytes are encoded, which deployment is available on a selected chain, and what evidence supports each claim.

This registry makes that information discoverable through Intuition rather than a closed, application-owned list.

MetaMask enforcers are the initial reference collection. They are not an allowlist. Anyone can submit another ERC-7710-compatible enforcer through the same validation and evidence model.

## Registry model

The registry separates a chain-independent enforcer type from a deployment on a specific chain.

```text
enforcer type
  -> deployment on a chain
  -> source and release evidence
  -> terms schema
  -> optional audit and usage evidence
```

Deployment identity uses CAIP-10:

```text
caip10:eip155:{chainId}:{contractAddress}
```

Claims are represented as Intuition atoms and triples. Support and opposition are visible independently. Registry membership and community support are useful signals, not guarantees that a future delegation execution will succeed.

## Current scope

This repository is in active implementation. It defines the public product contract, contribution rules, canonical Intuition read path, validation boundary, runnable backend service, and an unsigned MultiVault submission workflow. Production ontology IDs and wallet write approval remain external gates.

When a submission declares a contract terms decoder, preparation also performs a read-only `eth_call` and compares the returned values with the submitted fixtures before producing the unsigned plan.

- [Product requirements](docs/PRODUCT.md)
- [Registry schema](docs/SCHEMA.md)
- [MetaMask reference collection](docs/REFERENCE-DATA.md)
- [Composability guide](docs/COMPOSABILITY.md)
- [Integration rules](docs/INTEGRATION.md)
- [Backend implementation status](docs/BACKEND.md)
- [Acceptance proof](docs/PROOF.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Development

```bash
pnpm install
pnpm check
pnpm format:check
pnpm build
```

## Registry client configuration

The repository exposes a backend service plus a backend-neutral Intuition reader, claim resolver, validation helpers,
composability reader, indexer poller, and unsigned MultiVault submission workflow. Provide the GraphQL
endpoint, reviewed registry membership predicate ID, and deployment-class term ID to
`loadRegistry` through `RegistryConfig`. The reader returns `unconfigured` until the reviewed
IDs are present and never invents registry records.

```ts
import { loadRegistry } from "./src/index.js";

const state = await loadRegistry({
  endpoint:
    process.env.INTUITION_GRAPHQL_URL ??
    "https://mainnet.intuition.sh/v1/graphql",
  membershipPredicateId: process.env.REGISTRY_MEMBERSHIP_PREDICATE_ID,
  deploymentClassId: process.env.REGISTRY_DEPLOYMENT_CLASS_ID,
});
```
