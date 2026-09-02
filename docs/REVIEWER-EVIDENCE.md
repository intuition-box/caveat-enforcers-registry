# Reviewer evidence matrix

Last verified: 2026-08-10. Chain: Intuition mainnet `1155`.

Public application: <https://caveats-registry.intuition.box>

Public read API: <https://caveats-registry-api.intuition.box>

The table separates implemented code, live evidence, and the remaining external-publication
step.

| Board requirement                                        | Implementation and evidence                                                                                                                             | Status                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Intuition ontology                                       | [`SCHEMA.md`](./SCHEMA.md), versioned IDs in `src/ontology.ts`, deterministic atom/triple derivation tests                                              | Implemented                                                                      |
| 32 official MetaMask enforcers                           | Six verified mainnet membership batches in [`PROOF.md`](./PROOF.md); canonical query returns all 32 plus one open contribution                          | Live                                                                             |
| Restriction, operation, terms, release, usage enrichment | Reproducible 32-record metadata generator; zero-missing direct MultiVault verification; transaction range in [`PROOF.md`](./PROOF.md)                   | Live on Intuition mainnet                                                        |
| Audit status and auditor                                 | 31 exact official report scopes plus one deliberate absence in [`AUDIT-EVIDENCE.md`](./AUDIT-EVIDENCE.md); graph claims verified by the enrichment run  | Live on Intuition mainnet                                                        |
| Browse controls                                          | Search; domain, chain, audit, and minimum-TRUST filters; TRUST/name/newest sorting; CAIP-10, chain, domain, audit state, and signal display             | Implemented in production frontend                                               |
| Detail evidence                                          | Deployment and type claims, support/opposition per claim, terms JSON, usage, source, registry transaction, and block                                    | Live graph and production API                                                    |
| Permissionless submit                                    | Browser-wallet atom/triple flow with preview, simulation, receipts, direct MultiVault verification, and indexing states                                 | Live proof: `AllowedTimeOfDayEnforcer`, transactions in [`PROOF.md`](./PROOF.md) |
| Support/dispute any claim                                | Direct controls plus verified opposition transaction `0x5cfe…b6e23`; counter-vault assets increased to `0.098750000001 TRUST`                           | Live                                                                             |
| Three composability presets                              | Three enforcer-to-enforcer presets plus two scope conflicts, backed by seven relationships and 17 contextual triples                                    | Live                                                                             |
| Composability is graph-backed                            | UI asks the API for exact relationship IDs; strict production query returns all 24 planned relationship/context/ordering/evidence triples               | Live                                                                             |
| Canonical GraphQL query                                  | Runnable membership/detail queries and direct-GraphQL wallet-picker example in [`INTEGRATION.md`](./INTEGRATION.md); latest run returned all 33 records | Live and independently runnable                                                  |
| Contributor-readable schema                              | Ontology, CAIP-10 identity, submission JSON Schema, example, transaction order, and verification sequence                                               | Implemented                                                                      |
| Community publication                                    | Forum-ready text, portable example, and selected Ecosystem Development target in [`COMMUNITY-PROPOSAL.md`](./COMMUNITY-PROPOSAL.md)                     | Awaiting Intuition admin review; public URL pending                              |
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

The public release can be checked independently with `pnpm check:production`. On 2026-08-10,
`pnpm check:production:final` passed all eight checks against the public Vercel frontend, Render
API, Intuition GraphQL indexer, and MultiVault. The strict gate proves enriched ontology fields,
all 24 planned composability relationship/context/ordering/evidence triples, and the material
claim-opposition counter-vault signal.

## Remaining release gates

1. Obtain Intuition admin review, then publish the approved integration proposal and record its
   public forum URL here.
