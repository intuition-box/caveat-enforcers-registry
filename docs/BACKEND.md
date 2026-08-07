# Backend implementation status

The backend is a typed, backend-neutral registry client. It reads the canonical Intuition graph directly and prepares a submission plan without hidden signing state. The web client can pass an injected browser wallet through the same adapter boundary for explicit user-approved writes.

## Implemented locally

- Versioned ontology manifest shape with fail-closed validation.
- Canonical membership query using predicate and deployment-class IDs.
- Paginated registry reads with explicit limits and offsets.
- Deployment claim reads with canonical predicate and object IDs preserved, plus bounded multi-page detail hydration.
- Support and opposition signal parsing as separate values, using vault `total_assets` for stake with a `total_shares` compatibility fallback.
- Claim summarization for chain, source, terms schema, audit, domain, operation, usage, and implementation.
- Deterministic search and filter helpers.
- Composability claim reads for complements, conflicts, and redundancy, plus contextual `appliesInContext`, `requiresOrdering`, and `supportedBy` claims when those predicates are configured.
- EVM address normalization and CAIP-10 deployment identity.
- JSON-RPC contract-code verification through `eth_getCode`.
- JSON-RPC selected-chain verification through `eth_chainId`.
- JSON-RPC receipt verification through `eth_getTransactionReceipt`.
- Direct MultiVault term, triple, and vault verification through the official Intuition protocol ABI.
- Direct term and triple verification recomputes the deployed salted ID from the returned data or components, rejecting mismatched RPC responses.
- Real `createAtoms` and `createTriples` calldata encoding with no signer or wallet side effects.
- Optional viem wallet/public-client adapter for simulation, signing, and receipt confirmation when an account is explicitly injected.
- Browser wallet integration using `window.ethereum`, chain-1155 switching, explicit account connection, and the same simulation, write, receipt, MultiVault, and indexer verification pipeline.
- Deterministic atom and triple ID resolution, duplicate detection, and ordered write batches.
- Submission initial signal is carried into the membership vault asset; source-release atoms are only created when a configured release predicate can link them.
- Optional audit and known-usage evidence is validated, canonicalized, and added to the same write plan; the plan fails closed if its predicates are not configured.
- Optional composability evidence creates a direct relationship triple and attaches context, ordering, and supporting-source triples to that relationship ID.
- Unsigned curation preparation verifies an existing claim, derives the official counter-claim ID for opposition, and encodes the MultiVault `deposit` call without choosing a curve or wallet.
- Adapter-backed curation execution simulates and submits that deposit, confirms its receipt, and verifies the target vault directly before reporting a confirmed signal.
- Submission write options validate non-negative decimal assets and transaction values plus any MultiVault override before calldata construction.
- Terms-schema validation for encoding kind, fields, non-overlapping ranges, fixture bytes, source version, and malformed-input behavior.
- Executable ABI and packed fixture decoding that rejects declared values which do not match the submitted terms bytes.
- Read-only `eth_call` verification for declared terms decoder functions, comparing every decoder output with the submitted fixture before a plan is returned.
- Submission transaction-plan generation with explicit atom and triple operations.
- Permissionless proposed ontology workflow that creates missing standard predicate atoms in the ordered atom transaction instead of waiting for a central approval gate; custom manifests still fail closed when required IDs are missing.
- Optional canonical description linking through the configured `describedBy` predicate; the field remains unmapped until that predicate is supplied.
- Guarded submission lifecycle from plan, through simulation, submission, receipt, and indexer discovery.
- Service-level execution coordinator that accepts an explicit write adapter, confirms every submitted receipt, verifies direct MultiVault state, and polls the canonical registry before returning `indexed`.
- Post-receipt MultiVault verification for every planned atom and triple, with explicit pending and mismatch states.
- Simulation and write boundaries that require an injected wallet or chain adapter.
- Runnable JSON backend service with `/health`, registry read, detail, validation, preparation, and write-resolution routes.
- Bounded indexer polling with `confirmed onchain, indexing`, `indexed`, timeout, and error states.
- Deterministic fixture tests for all of the above, including live-formula atom and triple ID regression coverage.
- Published JSON Schema and example for language-neutral contributor submissions.

The mainnet schema smoke was run on 2026-08-03. It confirmed the `triples`, `atoms`, `terms.vaults`, `total_assets`, and `counter_term` selections used by the reader. Atom `value` is a nested object in the live schema, so the reader intentionally uses the verified scalar `data` field instead of selecting `value` as a scalar.

See [the acceptance proof](./PROOF.md) for the distinction between the hermetic local workflow test and the still-required live registry proof.

Run the same read-only check again with:

```bash
pnpm check:schema
```

Validate the portable submission contract and its example with:

```bash
pnpm check:submission-schema
```

To inspect possible ontology terms without selecting or writing any IDs:

```bash
pnpm discover:ontology -- caveat enforcer registry subset
```

The command only searches the mainnet atom index and prints candidate IDs. It never writes or
silently promotes a candidate.

## Deliberately not implemented

- No private signer, funding wallet, or hidden write authority is committed. The default runtime
  uses the explicitly labeled proposal in `config/ontology.manifest.proposed.json`; operators can
  override it with environment values, and community support or opposition remains independent.
- No funded wallet or transaction owner is configured. The repository does not submit anything automatically; a user must connect a browser wallet and approve each prompt.
- The service does not persist submissions or expose an unauthenticated production write endpoint. Wallet signing remains an explicit client or injected adapter responsibility.
- No production pinning key, funded wallet, or transaction owner is configured.
- The controlled 32-entry MetaMask launch seed is live and indexed on Intuition mainnet. It uses
  the same canonical membership boundary as the public read API.
- No live open-registry proof exists until an independently submitted, previously unlisted entry
  is written through the browser-wallet flow and discovered through the same query.

## Safe sequence for a proposed ontology

1. Inspect or override the proposed ontology IDs and record the semantic justification.
2. Connect a browser wallet on Intuition 1155 and dry-run the transaction preview.
3. Simulate the complete atom and triple plan.
4. Submit one approved genuine entry on the canonical environment.
5. Verify the receipt, direct MultiVault state, and expected term IDs.
6. Poll GraphQL until the entry is returned by the membership query.
7. Capture the result as the open-registry proof.

## Local service

Run the backend boundary with:

```bash
pnpm server
```

It listens on `http://127.0.0.1:8787` by default. The service uses the proposed ontology by default and still fails closed for malformed or incomplete overrides. Set `INTUITION_RPC_URL` to enable direct MultiVault reads and `REGISTRY_*` environment values to override the canonical registry boundary.

Routes:

- `GET /health` reports endpoint, chain, and ontology readiness.
- `GET /api/registry` reads the canonical membership page. Optional `query`, `chain`, `domain`, and `operation` parameters apply deterministic filters to the returned page; metadata filters automatically hydrate bounded deployment claims. `hydrate=true` requests the same claim hydration without a metadata filter.
- `GET /api/registry/{deploymentId}` resolves deployment claims and summaries.
- `GET /api/registry/{deploymentId}/composability` resolves configured complements, conflicts, and redundancy claims with separate signals.

For the permissionless proposed manifest, the write coordinator creates the dedicated
`ERC-7710 caveat enforcer deployment` class atom before predicate atoms and before the
membership triple. It never substitutes the generic `deployment` atom for that class.

- `POST /api/submissions/validate` validates the published submission schema.
- `POST /api/submissions/prepare` verifies chain and contract code and returns the unsigned plan.
- `POST /api/submissions/resolve` resolves existing terms and returns an ordered unsigned write batch.
- `POST /api/submissions/verify` checks the resolved submission directly against MultiVault after a receipt.
- `POST /api/submissions/execute` runs the full workflow only when the host injects an explicit write adapter; the default server returns a blocked response.
- `POST /api/submissions/receipt` verifies a transaction receipt through the configured RPC.
- `POST /api/curation/prepare` verifies a claim and returns an unsigned support or opposition deposit request. It returns a blocked response when no public Intuition client is configured.
- `POST /api/curation/execute` runs curation only with an explicitly injected wallet adapter, then verifies the receipt and target vault. The default server returns a blocked response.

The HTTP boundary intentionally stops at unsigned preparation, resolution, and verification. The
full execution coordinator is exposed as `RegistryBackend.executeSubmission(input, adapter, options)`
for a trusted application process that injects a wallet adapter explicitly. No private key or signer
is read from environment variables.
