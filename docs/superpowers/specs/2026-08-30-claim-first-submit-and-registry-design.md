# Claim-first Submit and Registry design

## Decision

Replace the current fixed listing form with an identity-first contribution flow and make claim-level
evidence obvious in Registry. This follows the review call: a caveat enforcer is a chain-qualified
deployment identity; contributors can then add any supported claims about it.

## Submit

1. **Identity** contains only the deployed contract address and EIP-155 chain as required values.
   The display name is optional presentation metadata. The connected wallet is shown separately as
   the signing actor and is never inferred as the deployer, author, or auditor.
2. **Claims** is the primary part of the form. It starts with an empty, visible claim ledger and an
   add-claim composer: subject (deployment, type, or existing term), reviewed predicate or exact
   predicate ID, and object. Claims can be added and removed repeatedly.
3. A small set of evidence templates (source, description, restriction, operation, terms schema,
   audit, usage, composability, deployer, author) only prefill the predicate/object composer. They
   do not impose a fixed listing schema or write unsupported claims.
4. The transaction review remains the place that validates required data and explains every planned
   atom and triple before the connected wallet signs.

## Registry

1. Each live row exposes a visible claim count and a short evidence/position summary.
2. Selecting a row expands its claim ledger inline beneath that row. Every claim shows separate
   support/opposition, the TRUST distribution, support/dispute actions, and its exact Intuition
   Portal link.
3. The existing drawer stays available for the full deployment record, terms schema, source and
   receipt metadata. It is not the only way to discover that claims exist.

## Constraints

- Do not infer deployer, author, audit, or safety status from the connected wallet or source URL.
- Keep unknown predicates explicit as exact Intuition term IDs.
- Preserve existing submission schema compatibility and browser-wallet validation.
- Preserve mobile responsiveness and keyboard-accessible row expansion.

## Verification

- Unit coverage for generated claim templates and claim count presentation.
- `pnpm check`, `pnpm test`, `pnpm build`, `pnpm format:check`.
- Desktop and 390px browser checks for Submit and Registry, including an inline live claim expansion.
