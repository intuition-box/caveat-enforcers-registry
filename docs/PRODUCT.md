# Product Requirements

## Product goal

Create a public, extensible source of truth for ERC-7710 caveat enforcers on Intuition.

The product must let people discover existing enforcers and submit new ones without requiring an application release for every listing.

## Problem

Enforcer information is fragmented across source repositories, deployments, documentation, and wallet integrations. A fixed frontend list becomes stale and excludes useful new enforcers.

## MVP capabilities

1. Browse listed enforcer deployments and filter by chain, restriction domain, and operation.
2. Open a deployment detail page with source, release, terms schema, deployment availability, and evidence claims.
3. Submit an unlisted enforcer using the published schema.
4. Validate a submission before it is written: normalize the address, verify code on the selected chain, validate metadata, and show the exact transaction plan.
5. Read the registry from canonical Intuition term IDs, not display labels.
6. Show support and opposition as separate signals.

## Acceptance condition

The MVP is proven open when an independently submitted, previously unlisted enforcer can be discovered through the same registry query pattern as the initial reference entries, with no application code change or redeployment.

## Non-goals

- Declaring an enforcer safe based only on registry membership, stake, or an audit label.
- Treating the initial MetaMask reference collection as a closed catalogue.
- Creating disposable records on the canonical registry environment.
- Replacing wallet-level simulation before a delegation is used.

## Environment policy

Intuition mainnet is the canonical environment for registry reads and release validation. Test environments may be used for isolated mechanics when available. Before the first registry write, the team must confirm the production write policy, funding source, and record-ownership process.
