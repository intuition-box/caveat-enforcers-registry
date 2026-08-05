# Mainnet reference seed

The open-registry proof and the launch seed are separate operations:

- The proof is one genuinely unlisted enforcer submitted through `/submit`.
- The launch seed is the 32-entry MetaMask Smart Accounts Kit reference collection.

`scripts/seed-reference-enforcers.ts` reads `data/metamask-v1.3.0.json`, verifies all 32
deployment contracts still contain bytecode on Intuition mainnet, derives the collision-safe
atom and triple IDs, checks `isTermCreated`/`getTriple`, and writes only missing records.

The seed writes the minimal launch graph for each deployment:

- deployment identity atom;
- enforcer type atom;
- Intuition chain atom;
- MetaMask source atom;
- the proposed deployment-class atom and proposed predicate atoms when missing;
- membership, implementation, deployed-on, and source-at triples.

It does not invent terms schemas or audit claims that are not present in the reference dataset.
Those richer claims should be added through reviewed submissions later.

## Dry run

```bash
pnpm seed:reference -- --dry-run
```

The dry run is read-only and prints the planned totals and currently missing totals.

## Controlled execution

Use a dedicated funded EOA or a secure secret-manager injection. Never commit the key, put it in
the frontend, or paste it into chat. The script defaults to dry-run and requires both
`--execute` and `--confirm-mainnet` before it can broadcast.

```bash
export INTUITION_SEED_PRIVATE_KEY='0x…'
pnpm seed:reference -- --execute --confirm-mainnet
```

The runner confirms every receipt, re-reads every atom and triple, and then waits up to two
minutes for the 32 membership records to appear in the canonical GraphQL index. If indexing is
still pending, it exits after reporting the confirmed-onchain count; re-running is safe.
