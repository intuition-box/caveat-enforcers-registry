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

This repository is in its foundation phase. It defines the public product contract, contribution rules, and schema direction before the application and submission flow are implemented.

- [Product requirements](docs/PRODUCT.md)
- [Registry schema](docs/SCHEMA.md)
- [Composability guide](docs/COMPOSABILITY.md)
- [Integration rules](docs/INTEGRATION.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Development

```bash
pnpm install
pnpm check
pnpm format:check
```

## Frontend configuration

The read-only directory is a Vite application. Copy `.env.example` to `.env` and add the
reviewed registry membership predicate ID and deployment-class term ID. The directory only
loads live entries when both IDs are present.
