# Zet-aligned Submit overhaul

## Status

Approved direction. This specification supersedes the Submit section of
`2026-08-30-claim-first-submit-and-registry-design.md`. It does not alter the accepted Registry
design.

## Source of truth

The design follows Zet's review-call sequence without adding a fixed semantic schema:

1. Find or create the chain-qualified identity of the caveat enforcer.
2. Choose a claim to make about that identity.
3. Select the predicate, create or select the object, and repeat for every additional claim.

The connected wallet signs the contribution. It is not inferred to be the contract deployer,
author, or auditor.

## Selected approach

Rebuild both the Submit interface and submission plan around an identity plus an ordered list of
explicit claims. The fixed purpose, source, restriction, operation, and terms questionnaire is
removed. Those concepts remain available as starter predicates, but none is mandatory merely
because the application anticipated it.

Two alternatives are rejected:

- **Reorder the existing form:** rejected because the same five mandatory claims would remain and
  the modular builder would still be an appendix.
- **Expose a raw triple editor:** rejected because requiring atom and triple IDs would make the
  registry technically flexible but unusable for ordinary contributors.

## Visitor and job

The visitor is a protocol contributor who already has a deployed caveat enforcer or knows the
identity of one. They may sign with a wallet unrelated to the deployer. Their job is to establish
the deployment identity, make one or more explicit claims about it, understand the exact Intuition
writes and cost, and approve those writes.

Success means that every semantic statement in the transaction plan corresponds to a claim the
contributor deliberately added or to clearly labelled registry infrastructure.

## Flow

### Step 1 — Enforcer identity

Required inputs:

- EIP-155 chain.
- Deployed contract address.

Optional presentation input:

- Display name.

The application verifies deployed bytecode, derives the CAIP-10 identity, and checks whether the
identity is already known. The connected signing wallet is displayed separately. No deployer,
author, or auditor value is populated from it.

After successful identity verification, Step 1 becomes a compact summary that can be reopened for
editing. Advancing opens Step 2; the entire form is not shown at once.

### Step 2 — Claims

The claims stage is the primary contribution workspace. It starts with an empty ordered list and a
visible **Add claim** action. A contribution must contain at least one contributor-selected claim.

Each claim contains:

- **Subject:** this chain deployment, the chain-independent enforcer type, or an existing
  Intuition term/claim.
- **Predicate:** a readable selection from the reviewed mission ontology, or an advanced custom
  predicate.
- **Object:** a readable value, URL, address, chain, enforcer, or existing Intuition term as
  appropriate to the selected predicate.

The contributor can add, edit, reorder, and remove claims. Creating another claim repeats the same
composer; no separate “extra evidence” section exists.

Starter predicates reflect only the written mission ontology and existing reviewed terms:

- implements / enforcer type;
- deployed on / chain;
- source at / source release;
- described by / purpose;
- has terms schema;
- restricts / domain;
- affects operation;
- authored by;
- deployed by;
- covered by audit;
- used by / usage context;
- composability relationships already supported by the ontology.

Templates preselect a predicate and the appropriate subject/object editor. They do not silently add
claims and do not imply evidence.

For a reviewed predicate, the interface stores its canonical term ID while showing its readable
label. The advanced custom path accepts a readable predicate label, derives or resolves its atom,
shows that this may create a new public predicate, and includes that atom creation in the review.
Raw term IDs remain available only inside advanced controls.

### Step 3 — Review and sign

The review stage lists two categories explicitly:

1. **Registry infrastructure:** the minimum atom and membership relation required to make the
   chain-qualified deployment discoverable.
2. **Your claims:** exactly the ordered claims selected in Step 2.

For every planned write, show the subject, readable predicate, object, canonical IDs when resolved,
whether an atom or triple already exists, and the required TRUST deposit. Also show the connected
signer and total TRUST plus gas.

Preparing the plan performs validation and read-only resolution. Approval remains separate. Every
write is simulated immediately before its wallet prompt. Confirmed transactions, indexing progress,
success, partial completion, rejection, and retry guidance remain visible on the page.

## Submission model

The canonical browser/API input becomes:

- `identity`: chain ID, contract address, and optional display name;
- `claims`: an ordered array of subject, predicate, and object specifications;
- `submitterWallet`: the connected signing address;
- `initialSignal`: optional deposit configuration.

Legacy JSON using purpose, source, restriction, operation, terms, evidence, or `additionalClaims`
remains importable. Import converts every supplied semantic field into an explicit claim row before
the user reviews it. Legacy fields are not invisibly written.

The planner automatically creates only registry infrastructure needed for discoverability. It does
not synthesize source, purpose, terms, restriction, operation, authorship, deployment provenance,
audit, usage, or composability claims that are absent from the contributor's claim list.

Custom claim objects and custom predicate labels may create atoms in the same ordered batch. Claims
using an existing Intuition term retain its canonical ID and are verified before planning the
dependent triple.

## Interface and layout

This is an Operate surface inside the current Caveat visual system. Preserve the black route hero,
paper workspace, typography, Signal Orange actions, rounded wallet/Web3 controls, and existing
success/error notices.

On desktop, the active step occupies the main column and a compact contribution summary remains
visible beside it. Completed steps collapse into editable summaries. On mobile, the steps form one
column; the summary appears inside Step 3 rather than duplicating the form below it.

The primary action is singular at each stage:

- Step 1: **Verify identity**.
- Step 2: **Review contribution**.
- Step 3: **Prepare transaction plan**, followed by **Approve writes** only after successful
  resolution.

## States and boundaries

- Identity: empty, verifying, existing, new, no bytecode, RPC unavailable, and editable-complete.
- Claims: empty guidance, populated list, invalid claim, unresolved existing term, custom predicate
  warning, and reordered list.
- Review: resolving, blocked, ready, awaiting wallet, submitted, partially confirmed, indexed, and
  retryable failure.
- Wallet: disconnected, wrong network, connected signer, account changed, and user rejection.
- Typical contribution: three to seven claims. The layout must remain usable with one claim and at
  least twenty claims.

## Accessibility and responsive requirements

- Every step, claim, error, and status message has a programmatic heading or live region.
- Claim reordering works with explicit Move up/Move down controls; drag-and-drop is optional and
  never the only mechanism.
- Focus moves to the first invalid field after validation and to the next stage heading after a
  successful transition.
- All controls remain keyboard accessible with visible focus.
- Desktop and 390px layouts must have no horizontal overflow or clipped transaction data.
- Reduced-motion users receive immediate state changes without animated dependency.

## Anti-goals

- Do not recreate a mandatory five-claim questionnaire.
- Do not call some semantic claims “core” and others “extra.”
- Do not infer provenance or trust from the signer, repository, or deployed code.
- Do not require raw Intuition IDs in the primary flow.
- Do not create semantic triples the contributor did not review.
- Do not change Registry, Composability, Home, Learn, or Developers as part of this overhaul.

## Verification contract

- Unit tests prove the planner writes only selected claims plus labelled registry infrastructure.
- Unit tests prove legacy JSON imports become visible editable claims.
- Unit tests cover add, remove, reorder, reviewed predicate, custom predicate, and existing-term
  resolution behavior.
- Component/browser checks cover identity verification, one-claim and twenty-claim contributions,
  signer/deployer separation, validation focus, wallet/network states, successful submission, and
  partial failure recovery.
- Run `pnpm check`, `pnpm test`, `pnpm build`, and `pnpm format:check`.
- Inspect `/submit` once at desktop and 390px, fix the complete defect batch, then perform one final
  confirmation pass.

## Self-review

- No placeholder, TODO, or unresolved product choice remains.
- Identity, claims, and signing actor are independent throughout the data model and interface.
- The planner no longer depends on application-imposed semantic claims.
- The design remains permissionless without turning the normal interface into a raw graph editor.
- Scope is limited to the Submit surface and its submission model.
