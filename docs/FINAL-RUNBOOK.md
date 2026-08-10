# Final Mission 13 runbook

> Executed 2026-08-10. Direct MultiVault verification now reports zero missing enrichment and
> composability terms. The opposition receipt and exact `43.000000000718 TRUST` protocol-value
> total are recorded in [`PROOF.md`](./PROOF.md). This document remains the reproducible procedure.

This runbook closes the remaining permanent acceptance gates. It must be run only after the
funded-wallet owner explicitly confirms the mainnet scope and deposit cap. Never paste a private
key into chat, a command argument, a committed file, or a frontend environment variable.

## Authorized scope

The reviewed actions are:

1. create the missing atoms and triples in the 32-record reference enrichment plan;
2. create the seven composability relationships and their context, ordering, and evidence triples;
3. deposit `0.1 TRUST` into the counter vault for the incorrect audit claim on the open entry.

At the 2026-08-09 read-only state, the maximum protocol deposits before shared-atom savings are:

- enrichment: `38.600000000651 TRUST`;
- composability: `4.300000000067 TRUST`;
- opposition proof: `0.1 TRUST`;
- maximum total: `43.000000000718 TRUST`, plus gas.

The composability plan must be recalculated after enrichment. Shared atoms can reduce its live
cost. Stop if any command reports a larger total, a different chain, a different MultiVault, or
an unexpected number of missing records.

## 1. Local and production preflight

```bash
git status --short --branch
pnpm check
pnpm test
pnpm check:reference-metadata
pnpm check:composability-seed
pnpm format:check
pnpm build
pnpm check:production
```

Expected production baseline: public frontend, security headers, API health, CORS, at least 33
unique records, and a readable `AllowedCalldataEnforcer` detail.

Refresh both read-only plans immediately before loading a key:

```bash
pnpm seed:reference-enrichment -- --dry-run
pnpm seed:composability -- --dry-run
pnpm curate:claim -- \
  --claim-id 0x55ae5374e58d54e10124bfc39273a7297bce98ab3b68ef010b8d1da57128cb04 \
  --action oppose \
  --amount 0.1 \
  --receiver 0x31314ae55653e10dc9a656fbe4cf843ab58fc9a4 \
  --dry-run
```

Dry runs never broadcast.

## 2. Load the dedicated key without shell-history exposure

In Bash or Zsh:

```bash
read -r -s INTUITION_SEED_PRIVATE_KEY
export INTUITION_SEED_PRIVATE_KEY
printf '\n'
```

Type the `0x`-prefixed key at the silent prompt and press Enter. The scripts derive and print the
execution address only after their read-only planning phase. Confirm that it is the intended
funded address before allowing the first transaction.

## 3. Enrich the 32 reference records

```bash
pnpm seed:reference-enrichment -- --execute --confirm-mainnet
```

The runner uses legacy fee transactions, preflights every atom batch before the first atom write,
preflights every triple batch before the first triple write, waits for every receipt, and re-reads
every planned atom and triple from MultiVault. Save every printed transaction hash. Oversized
terms documents use compact content-addressed records so every atom stays within MultiVault's
1,000-byte limit. The production run used four terms per transaction.

Re-run the dry-run. It must report zero missing atoms and triples:

```bash
pnpm seed:reference-enrichment -- --dry-run
```

## 4. Recalculate and write composability

Enrichment may create atoms shared by the composability plan, so recalculate before execution:

```bash
pnpm seed:composability -- --dry-run
```

If the live amount is within the remaining approved cap:

```bash
pnpm seed:composability -- --execute --confirm-mainnet
pnpm seed:composability -- --dry-run
```

The final dry-run must report zero missing relationship and dependent triples. Save every hash.

## 5. Create the support/dispute proof

The target is the immutable incorrect audit claim on the open contribution. Opposition preserves
the original claim while making the correction visible through its canonical counter vault.

```bash
pnpm curate:claim -- \
  --claim-id 0x55ae5374e58d54e10124bfc39273a7297bce98ab3b68ef010b8d1da57128cb04 \
  --action oppose \
  --amount 0.1 \
  --execute \
  --confirm-mainnet
```

The command simulates the deposit, confirms the receipt, and requires the counter-vault assets to
increase before reporting success. Save the hash and before/after balances.

## 6. Remove the key immediately

```bash
unset INTUITION_SEED_PRIVATE_KEY
```

If a temporary key file was used outside this runbook, remove it securely after the run and sweep
any remaining funds according to the wallet owner's policy.

## 7. Indexing and production verification

The write runners verify MultiVault state immediately. GraphQL indexing is asynchronous, so wait
until the canonical queries return every new triple. Then manually deploy the latest `main` commit
on Render and run:

```bash
pnpm check:production:final
```

Strict production verification must pass all eight checks, including enriched fields, all 24
planned composability triples, and a material opposition balance in the target counter vault.

## 8. Evidence and community publication

Add all transaction hashes and verified balances to `PROOF.md` and update
`REVIEWER-EVIDENCE.md` from pending to live. Publish `COMMUNITY-PROPOSAL.md` to the Intuition
forum's Ecosystem Development category only after the owner separately approves that external
publication. Record the public forum URL in both documents.

Run the complete repository quality gate, commit only the intended evidence changes, push to
`main`, and confirm GitHub CI is green.
