# Reviewer evidence matrix

Last verified: 2026-08-09. Chain: Intuition mainnet `1155`.

Public application: <https://caveat-enforcers-registry.vercel.app>

Public read API: <https://caveat-enforcers-registry.onrender.com>

The table separates implemented code, live evidence, and actions that still need
an explicit funded-wallet or external-publication approval.

| Board requirement                                        | Implementation and evidence                                                                                                                             | Status                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Intuition ontology                                       | [`SCHEMA.md`](./SCHEMA.md), versioned IDs in `src/ontology.ts`, deterministic atom/triple derivation tests                                              | Implemented                                                                      |
| 32 official MetaMask enforcers                           | Six verified mainnet membership batches in [`PROOF.md`](./PROOF.md); canonical query returns all 32 plus one open contribution                          | Live                                                                             |
| Restriction, operation, terms, release, usage enrichment | Reproducible 32-record metadata generator and idempotent enrichment runner                                                                              | Dry-run reviewed; mainnet write pending approval                                 |
| Audit status and auditor                                 | 31 exact official report scopes plus one deliberate absence in [`AUDIT-EVIDENCE.md`](./AUDIT-EVIDENCE.md); `covered by audit` and `audited by` ontology | Dry-run reviewed; mainnet write pending approval                                 |
| Browse controls                                          | Search; domain, chain, audit, and minimum-TRUST filters; TRUST/name/newest sorting; CAIP-10, chain, domain, audit state, and signal display             | Implemented in production frontend                                               |
| Detail evidence                                          | Deployment and type claims, support/opposition per claim, terms JSON, usage, source, registry transaction, and block                                    | Implemented; enriched fields appear after enrichment write and API redeploy      |
| Permissionless submit                                    | Browser-wallet atom/triple flow with preview, simulation, receipts, direct MultiVault verification, and indexing states                                 | Live proof: `AllowedTimeOfDayEnforcer`, transactions in [`PROOF.md`](./PROOF.md) |
| Support/dispute any claim                                | Direct support and opposition controls, exact counter-vault resolution, explicit TRUST amount, simulation, receipt, and explorer result                 | Implemented; one independent claim-level mainnet proof pending approval          |
| Three composability presets                              | Three enforcer-to-enforcer presets plus two scope conflicts, backed by a deterministic 7-relationship/17-context-triple plan                            | Implemented; live relationship write pending approval                            |
| Composability is graph-backed                            | UI asks the API for exact relationship IDs and labels a relationship Live only after Intuition returns it                                               | Implemented; mainnet seed pending approval                                       |
| Canonical GraphQL query                                  | Runnable membership/detail queries and direct-GraphQL wallet-picker example in [`INTEGRATION.md`](./INTEGRATION.md); latest run returned all 33 records | Live and independently runnable                                                  |
| Contributor-readable schema                              | Ontology, CAIP-10 identity, submission JSON Schema, example, transaction order, and verification sequence                                               | Implemented                                                                      |
| Community publication                                    | Forum-ready text, portable example, and selected Ecosystem Development target in [`COMMUNITY-PROPOSAL.md`](./COMMUNITY-PROPOSAL.md)                     | External publication pending approval                                            |
| Public hosting                                           | Vercel frontend and Render API over HTTPS with restrictive framing/content headers                                                                      | Live; Render free tier may cold-start                                            |

## Independent read verification

Run the canonical mainnet query without a wallet:

```bash
REGISTRY_MEMBERSHIP_PREDICATE_ID=0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1 \
REGISTRY_DEPLOYMENT_CLASS_ID=0x6b417110d95173e05bb927254249126617efb6410824afe0e8d029245252f21c \
pnpm query:registry
```

The 2026-08-09 verification returned 33 unique deployment subjects.

## Reproducible quality gate

```bash
pnpm check
pnpm test
pnpm check:schema
pnpm check:submission-schema
pnpm check:reference-enforcers
pnpm check:reference-metadata
pnpm check:composability-seed
pnpm format:check
pnpm build
```

The public release can be checked independently with `pnpm check:production`. After the final
approved writes and API redeploy, `pnpm check:production:final` additionally proves enriched
ontology fields, every planned composability triple, and the claim-opposition counter-vault
signal.

## Remaining irreversible gates

1. Broadcast the reviewed 32-record enrichment plan. Current read-only estimate:
   `38.600000000651 TRUST` plus gas.
2. Broadcast the composability plan. Last read-only estimate:
   `4.300000000067 TRUST` plus gas; re-run after enrichment because shared atoms
   can reduce the amount.
3. Deposit a small opposition signal against the incorrect audit claim on the
   open contribution, then verify both vault balances and capture the receipt.
4. Publish the integration proposal to the agreed ERC-7710 community surface.
5. Redeploy the Render service after the final backend commit and verify enriched
   production responses.

No script executes any of the first three actions without both an injected key
and explicit mainnet confirmation flags. The browser flow requires a connected
wallet and user approval for every transaction.
