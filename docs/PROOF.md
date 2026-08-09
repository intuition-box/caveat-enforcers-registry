# Acceptance proof

The open-registry acceptance condition has two separate proofs.

## Deterministic local proof

The backend tests cover both the low-level workflow and the service coordinator. The coordinator
test runs the complete workflow with hermetic adapters:

1. Validate a new submission and its terms fixtures.
2. Build the proposed ontology plan and record its semantic justification.
3. Resolve canonical atom and triple IDs.
4. Build `createAtoms` before dependent `createTriples` calldata.
5. Simulate and submit through an injected adapter.
6. Verify the expected onchain state through the MultiVault read boundary.
7. Discover the new deployment through the same membership query after a bounded retry.

`RegistryBackend.executeSubmission` is the service boundary for that sequence. It requires the
caller to inject the write adapter, so signing remains explicit and no wallet state is hidden in the
backend process.

Run the focused local proof with:

```bash
pnpm check:local-proof
```

This command uses hermetic read, write, receipt, and indexer adapters. It is a repeatable workflow
check, not evidence that a live Intuition entry has been submitted.

Curation uses the same boundary rule. `RegistryBackend.executeCuration` and the curation HTTP route
require an injected adapter, confirm the deposit receipt, and verify the target MultiVault vault
before reporting a support or opposition signal as confirmed.

This proves the local workflow and ordering without claiming that a test double is a live registry entry.

## Live launch seed verified

The 32-entry MetaMask Smart Accounts Kit reference collection is seeded and indexed on
Intuition mainnet. The public registry API returns 32 unique membership records using the
canonical membership predicate and deployment-class atom. Each seeded record has independent
membership, implementation, Intuition-chain, and MetaMask-source claims, with a non-zero support
signal.

This proves that the canonical read path, ontology boundary, and public deployment are live. It
does not replace the open-registry proof below: the initial collection was a controlled launch
seed, not an independently contributed entry.

## Live open-registry proof verified

On 2026-08-09, a browser wallet submitted the previously unlisted
`AllowedTimeOfDayEnforcer` deployment through the public `/submit` workflow. The wallet approved
the ordered atom and triple writes; both transactions succeeded on Intuition mainnet:

- `createAtoms`: [`0xedad7f8b12ed8c7a513b3ea2ce8986032ee199ce12a3ba71ea21bd659e0d8ffe`](https://explorer.intuition.systems/tx/0xedad7f8b12ed8c7a513b3ea2ce8986032ee199ce12a3ba71ea21bd659e0d8ffe)
- `createTriples`: [`0xe1e87a5b0708f6d9321ac2bd6f51f713a792e7dcdf9d9b6862824c3e10ef9305`](https://explorer.intuition.systems/tx/0xe1e87a5b0708f6d9321ac2bd6f51f713a792e7dcdf9d9b6862824c3e10ef9305)

The canonical registry API subsequently returned deployment term
`0x297c2305d1540d4159e1d97aa68d9ee2c266197f0e5a6f766506d50f679209e6` for
`caip10:eip155:1155:0x1bb8824110df8ed603ebb203c19cc2ba8fda8fbe`, including the implementation,
chain, source, terms-schema, operation, restriction-domain, and evidence claims. This proves that
an entry outside the controlled 32-record launch seed can be contributed, confirmed, indexed, and
read through the same public registry path without an application code change or redeployment.
