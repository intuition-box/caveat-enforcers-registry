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

## Live proof still required

The operator must supply a write policy, signer, and funding source. The proposed ontology can be used immediately; then the same sequence must run against the canonical environment:

1. Submit a genuinely unlisted enforcer.
2. Verify the receipt and direct MultiVault state.
3. Poll the canonical GraphQL membership query.
4. Capture the returned deployment as the open-registry proof.

No local fixture or candidate atom is promoted into the production ontology automatically.
