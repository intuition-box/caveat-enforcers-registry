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
Intuition mainnet. The six controlled membership batches were:

- [`0x221233482f0da954e6117d64fe987216fb53677c557b5be5128c2461a5769391`](https://explorer.intuition.systems/tx/0x221233482f0da954e6117d64fe987216fb53677c557b5be5128c2461a5769391)
- [`0x81828c41a6117593e0dace8781fde792246bd9713abfa00ba164d83804c6078e`](https://explorer.intuition.systems/tx/0x81828c41a6117593e0dace8781fde792246bd9713abfa00ba164d83804c6078e)
- [`0x55e80fa1a6fa5445b0214a9407dadc67301e145b50cb4c54689bbe3caa4d9d08`](https://explorer.intuition.systems/tx/0x55e80fa1a6fa5445b0214a9407dadc67301e145b50cb4c54689bbe3caa4d9d08)
- [`0x9b6bde3c95f922231afb8d40c99ad9f318661ff6d4262c08d0321bcc02df1006`](https://explorer.intuition.systems/tx/0x9b6bde3c95f922231afb8d40c99ad9f318661ff6d4262c08d0321bcc02df1006)
- [`0xf53b592557c6ed0acb668727c1bf36d27a87bee282e38dd8d5d7c795aa2b1303`](https://explorer.intuition.systems/tx/0xf53b592557c6ed0acb668727c1bf36d27a87bee282e38dd8d5d7c795aa2b1303)
- [`0x77b7727800126c6a81105d1abb31449f1a1d7aebb2c940634f18412e16340c66`](https://explorer.intuition.systems/tx/0x77b7727800126c6a81105d1abb31449f1a1d7aebb2c940634f18412e16340c66)

The canonical GraphQL query currently returns 33 unique membership records: the
32-reference launch set plus the open contribution. Each seeded record has independent
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

## Proofs still requiring an approved mainnet action

The direct claim-level support/opposition UI and the three composability presets are
implemented and tested. Their permanent proof transactions are intentionally not claimed
here until a funded wallet explicitly approves them. The reviewed enrichment and audit
mapping are also dry-run only until that approval. See
[`REVIEWER-EVIDENCE.md`](./REVIEWER-EVIDENCE.md) for the exact remaining gates.

The curation proof target can be checked without broadcasting:

```bash
pnpm curate:claim -- \
  --claim-id 0x55ae5374e58d54e10124bfc39273a7297bce98ab3b68ef010b8d1da57128cb04 \
  --action oppose --amount 0.1 --receiver 0x... --dry-run
```

It resolves the canonical counter vault and prints its current balance. Execution
requires the separate `--execute --confirm-mainnet` gate and verifies that the
receipt succeeds and the target vault increases.
