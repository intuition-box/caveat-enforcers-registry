# MetaMask reference collection

`data/metamask-v1.3.0.json` is the initial reference collection for the open registry (the
filename is retained for compatibility with the first board-item draft). It records the 32
enforcer names and deterministic deployment addresses returned by
`getSmartAccountsEnvironment(1155).caveatEnforcers` from
`@metamask/smart-accounts-kit@1.7.0`.

The file is deliberately separate from Intuition membership. A reference record is not an
Intuition triple, does not imply support, and is not a closed allowlist. A contributor can
submit another enforcer through the same submission schema without changing this file.

The dataset also records the observed Intuition mainnet code status from the
`eth_getCode` audit against `https://rpc.intuition.systems`: all 32 kit addresses returned
non-empty bytecode on chain `1155`.

Run the integrity check with:

```bash
pnpm check:reference-enforcers
```

Regenerate from the kit and re-run the chain audit with:

```bash
pnpm generate:reference-enforcers
```

The source package, resolved version, environment accessor, RPC endpoint, and observation time
are recorded in the JSON itself. When a new kit release is adopted, add a new versioned dataset
rather than overwriting this one; retain the old file so the provenance of any registry
submission remains reproducible.
