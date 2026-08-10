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

## Live enrichment, composability, and curation proof

On 2026-08-10, the funded owner approved a capped final mainnet run. The execution created the
remaining reference-enrichment graph, the reviewed composability graph, and one material
opposition signal. The explorer independently reports 106 successful transactions from block
`7877369` through `7877475`, with exactly `43.000000000718 TRUST` in protocol call value:

- 31 `createAtoms` transactions: `14.00000000014 TRUST`;
- 74 `createTriples` transactions: `28.900000000578 TRUST`;
- one opposition `deposit`: `0.1 TRUST`.

The complete range is visible in the
[execution wallet history](https://explorer.intuition.systems/address/0x31314AE55653E10dc9a656fbE4CF843AB58fc9a4?tab=txs).
Representative phase boundaries are:

- first enrichment atom batch:
  [`0xd2160b7023ab85b56e59ac2e97e357a15bcdc0016edad0cb3640eb5261aefb1a`](https://explorer.intuition.systems/tx/0xd2160b7023ab85b56e59ac2e97e357a15bcdc0016edad0cb3640eb5261aefb1a);
- final enrichment triple batch:
  [`0x9e6614dc38de7cc19d10b721ba9c81b9a59fa94681cbb1b910408af68f2551ed`](https://explorer.intuition.systems/tx/0x9e6614dc38de7cc19d10b721ba9c81b9a59fa94681cbb1b910408af68f2551ed);
- composability relationship batches:
  [`0xf6fb883994639e24f2a0cd35362fb59f0a1ba869259bf7b79c39a10e953867e2`](https://explorer.intuition.systems/tx/0xf6fb883994639e24f2a0cd35362fb59f0a1ba869259bf7b79c39a10e953867e2) and
  [`0xaffec20baece392a7c5afeb023ade32f41429316cd834f76c46e11e4431afaf7`](https://explorer.intuition.systems/tx/0xaffec20baece392a7c5afeb023ade32f41429316cd834f76c46e11e4431afaf7);
- final composability evidence batch:
  [`0xf6eaec6caa940853ef13f9d3cc22864eb4e659fc1697028ce54c94e9f7ec25dc`](https://explorer.intuition.systems/tx/0xf6eaec6caa940853ef13f9d3cc22864eb4e659fc1697028ce54c94e9f7ec25dc);
- opposition deposit:
  [`0x5cfe41fba48ba4f6782cd01c49ad6314d0d9e1ad6e3d5111d83cbd8c734b6e23`](https://explorer.intuition.systems/tx/0x5cfe41fba48ba4f6782cd01c49ad6314d0d9e1ad6e3d5111d83cbd8c734b6e23).

Direct MultiVault verification reports zero missing atoms or triples for both plans. The public
indexer returns all 24 composability relationship/context/ordering/evidence triples. The
opposition command resolved counter-vault
`0x4340821aed6cc0e4191187cb4e5645a371bf4609238dbe7596931ba0629d3563`
and verified its assets increased from `0.000000000001 TRUST` to
`0.098750000001 TRUST` after protocol fees.

The curation proof can be rechecked without broadcasting:

```bash
pnpm curate:claim -- \
  --claim-id 0x55ae5374e58d54e10124bfc39273a7297bce98ab3b68ef010b8d1da57128cb04 \
  --action oppose --amount 0.1 --receiver 0x... --dry-run
```

It resolves the canonical counter vault and prints its current balance. A new execution still
requires the separate `--execute --confirm-mainnet` gate.
