# Mainnet reference seed

The open-registry proof and the launch seed are separate operations:

- The proof is one genuinely unlisted enforcer submitted through `/submit`.
- The launch seed is the 32-entry MetaMask Smart Accounts Kit reference collection.

`scripts/seed-reference-enforcers.ts` reads `data/metamask-v1.3.0.json`, verifies all 32
deployment contracts still contain bytecode on Intuition mainnet, derives the collision-safe
atom and triple IDs, checks `isTermCreated`/`getTriple`, and writes only missing records.

The same runner can prepare chain-qualified deployment records for additional EVM chains. It
checks every selected address with `eth_getCode` and requires the runtime bytecode hash to match
across the selected chains before it plans an Intuition claim. The deployment atoms remain
distinct (`caip10:eip155:<chain>:<address>`) even when CREATE2 produced the same address.

The seed writes the minimal launch graph for each deployment:

- deployment identity atom;
- enforcer type atom;
- Intuition chain atom;
- MetaMask source atom;
- the proposed deployment-class atom and proposed predicate atoms when missing;
- membership, implementation, deployed-on, and source-at triples.

The launch seed deliberately did not invent terms schemas or audit claims that were absent from
the deployment dataset. The reviewed enrichment is a second, idempotent operation. It derives
codec fixtures through the pinned MetaMask package builders and decoders, applies the conservative
implementation taxonomy in `docs/ENFORCER-TAXONOMY-REVIEW.md`, and adds:

- type definitions and restriction-domain claims;
- affected-operation claims;
- versioned terms-schema documents with executable fixtures;
- immutable package-release provenance; and
- official Smart Accounts Kit usage evidence;
- exact official MetaMask audit artifacts for 31 named source contracts; and
- auditor identity linked through the `audited by` predicate.

MultiVault atom payloads are limited to 1,000 bytes. Terms-schema documents at
or below that limit are stored verbatim. Larger schemas retain their complete
encoding shape on the graph and include a Keccak-256 digest plus an immutable
GitHub source pointer to the canonical fixture-rich document. Clients can show
the compact schema immediately and independently verify the complete document.

Audit scope is attached to the enforcer type, not automatically to a deployment.
Each structured audit atom records the report, auditor, full reviewed commit,
exact contract path, and an explicit qualification that the claim is neither
deployed-bytecode equivalence nor a safety guarantee. No exact scoped artifact
was found for `NativeTokenPeriodTransferEnforcer`, so it intentionally receives
no audit claim. The reviewed mapping is documented in
[`AUDIT-EVIDENCE.md`](./AUDIT-EVIDENCE.md).

## Dry run

```bash
pnpm seed:reference -- --dry-run
```

The dry run is read-only and prints the planned totals and currently missing totals.

For the review-call multi-chain set, verify Ethereum mainnet, Base, Sepolia, and Intuition and
prepare the idempotent missing-record report with:

```bash
pnpm seed:reference -- --dry-run --chains 1,8453,11155111,1155
```

The script has public read-only defaults for these four networks. Operators can override them
with `EVM_RPC_URL_1`, `EVM_RPC_URL_8453`, `EVM_RPC_URL_11155111`, and
`EVM_RPC_URL_1155`. An unknown chain has no fallback and fails closed until its RPC is supplied.
No additional deployment identity should be written from a chain list alone.

Run the reviewed enrichment independently:

```bash
pnpm generate:reference-metadata
pnpm check:reference-metadata
pnpm seed:reference-enrichment -- --dry-run
```

`data/metamask-v1.7.0.metadata.json` is reproducible from
`@metamask/smart-accounts-kit@1.7.0` and `@metamask/delegation-core@2.2.1` at commit
`d3f1dd8b1682ec5b2c961e450d9847d54eb72268`. CI fails when the committed document differs from
the package-generated result.

The enrichment plan contains 202 atoms and 265 triples. The 2026-08-10 execution is complete:
the idempotent dry run now reports zero missing atoms and zero missing triples. Transaction and
deposit evidence is recorded in [`PROOF.md`](./PROOF.md). Dry run never broadcasts.

## Controlled execution

Use a dedicated funded EOA or a secure secret-manager injection. Never commit the key, put it in
the frontend, or paste it into chat. The script defaults to dry-run and requires both
`--execute` and `--confirm-mainnet` before it can broadcast.

```bash
read -r -s INTUITION_SEED_PRIVATE_KEY
export INTUITION_SEED_PRIVATE_KEY
printf '\n'
pnpm seed:reference -- --execute --confirm-mainnet
```

Adding the reviewed multi-chain deployment identities uses the same explicit execution gate:

```bash
pnpm seed:reference -- --execute --confirm-mainnet --chains 1,8453,11155111,1155
```

For the enrichment plan, use the same controlled key injection and explicit gate:

```bash
read -r -s INTUITION_SEED_PRIVATE_KEY
export INTUITION_SEED_PRIVATE_KEY
printf '\n'
pnpm seed:reference-enrichment -- --execute --confirm-mainnet
unset INTUITION_SEED_PRIVATE_KEY
```

Both commands are idempotent. The enrichment runner also pins legacy fee mode for Intuition and
prints the live atom/triple deposit requirement before any broadcast.

The runner confirms every receipt and re-reads every atom and triple directly from MultiVault.
GraphQL indexing is asynchronous and must be verified separately after the writes. Re-running
the idempotent dry-run is safe. The complete execution and production-verification sequence is
in [`FINAL-RUNBOOK.md`](./FINAL-RUNBOOK.md).
