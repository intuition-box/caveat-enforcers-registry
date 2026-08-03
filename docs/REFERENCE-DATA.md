# MetaMask reference collection

`data/metamask-v1.3.0.json` is the initial reference collection for the open registry.
It records the 32 enforcer names and deterministic deployment addresses published by the
MetaMask Delegation Framework `v1.3.0` release.

The file is deliberately separate from Intuition membership. A reference record is not an
Intuition triple, does not imply support, and is not a closed allowlist. A contributor can
submit another enforcer through the same submission schema without changing this file.

The dataset also records the observed Intuition mainnet code status from the 2026-08-03 audit:
31 addresses had non-empty bytecode on chain `1155`, while
`SpecificActionERC20TransferBatchEnforcer` was missing. That missing deployment remains visible
instead of being silently dropped or presented as live.

Run the integrity check with:

```bash
pnpm check:reference-enforcers
```

The source is the upstream release tag and deployment document recorded in the JSON itself.
When a new MetaMask release is adopted, add a new versioned dataset rather than overwriting this
one; retain the old file so the provenance of any registry submission remains reproducible.
