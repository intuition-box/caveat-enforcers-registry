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

## Live open-registry proof still required

The operator must supply a funded browser wallet and submit a genuinely new enforcer through the
public contribution flow. The canonical environment sequence is:

1. Submit a genuinely unlisted enforcer.
2. Verify the receipt and direct MultiVault state.
3. Poll the canonical GraphQL membership query.
4. Capture the returned deployment as the open-registry proof.

No local fixture or candidate atom is promoted into the production ontology automatically. The
submission receipt, direct MultiVault verification result, and canonical GraphQL response should
be recorded with the final handoff.
