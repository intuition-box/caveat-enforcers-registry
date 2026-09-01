# Dynamic Submit Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed five-field listing form with Zet's identity-first dynamic claim wizard
and make the onchain planner write only registry infrastructure plus claims the contributor chose.

**Architecture:** Add a versioned claim-first submission shape beside the legacy schema so deployed
clients remain compatible. The backend validator and planner branch on that shape; the new planner
creates the deployment membership relation automatically and resolves each explicit claim from
readable/new or canonical/existing term references. A pure wizard state module drives a focused React
panel sequence in `Pages.tsx` while the existing wallet review, simulation, receipt, and indexing
pipeline remains unchanged.

**Tech Stack:** TypeScript 7, React 19, Vite 8, viem, Intuition MultiVault, Node test runner, CSS.

---

### Task 1: Define and validate the claim-first submission contract

**Files:**

- Modify: `src/validation.ts`
- Modify: `src/index.ts`
- Create: `test/claim-first-submission.test.ts`

- [ ] **Step 1: Write failing validation tests**

```ts
test("claim-first submissions require identity and at least one explicit claim", () => {
  const result = validateSubmission({
    version: "2",
    identity: { chainId: "1155", contractAddress: ADDRESS },
    claims: [],
    submitterWallet: WALLET,
  });
  assert.equal(result.valid, false);
  if (!result.valid) assert.equal(result.issues[0]?.path, "claims");
});

test("claim-first submissions accept reviewed and readable custom predicates", () => {
  const result = validateSubmission(claimFirstExample);
  assert.equal(result.valid, true);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec tsx --test test/claim-first-submission.test.ts`

Expected: FAIL because `SubmissionInput` and `validateSubmission` do not recognize version 2.

- [ ] **Step 3: Add the versioned types and validator**

```ts
export type SubmissionTermReference =
  | { kind: "value"; value: string }
  | { kind: "term"; termId: string; label?: string };

export type SubmissionClaim = {
  subject:
    { kind: "deployment" } | { kind: "term"; termId: string; label?: string };
  predicate:
    | { kind: "term"; termId: string; label: string }
    | { kind: "value"; value: string };
  object: SubmissionTermReference;
};

export type ClaimFirstSubmissionInput = {
  version: "2";
  identity: {
    chainId: string | number;
    contractAddress: string;
    displayName?: string;
  };
  claims: SubmissionClaim[];
  submitterWallet: string;
  initialSignal?: string;
};

export type SubmissionInput = LegacySubmissionInput | ClaimFirstSubmissionInput;
```

Add a discriminated validator that normalizes chain, address, wallet, term IDs, labels, and values;
requires one to twenty claims; and never validates absent legacy fields on version 2.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm exec tsx --test test/claim-first-submission.test.ts`

Expected: PASS.

- [ ] **Step 5: Run legacy validation tests**

Run: `pnpm exec tsx --test test/backend.test.ts test/additional-claims.test.ts`

Expected: all existing legacy tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/validation.ts src/index.ts test/claim-first-submission.test.ts
git commit -m "Add claim-first submission contract"
```

### Task 2: Plan only selected claims plus registry membership

**Files:**

- Modify: `src/submission.ts`
- Modify: `src/write-workflow.ts`
- Test: `test/claim-first-submission.test.ts`

- [ ] **Step 1: Add a failing planner test**

```ts
test("claim-first plans contain membership and only contributor-selected semantic claims", () => {
  const plan = buildSubmissionPlan(
    validated.value,
    PROPOSED_ONTOLOGY_MANIFEST,
    verifiedCode,
    verifiedChain,
  );
  const triples = plan.operations.filter(
    (operation) => operation.kind === "create-triple",
  );
  assert.deepEqual(
    triples.map((triple) => triple.key),
    ["membership", "claim:0", "claim:1"],
  );
  assert.equal(
    triples.some((triple) => triple.key === "source-at"),
    false,
  );
  assert.equal(
    triples.some((triple) => triple.key === "has-terms-schema"),
    false,
  );
});
```

Also test that a readable custom predicate becomes an `ensure-atom` operation and that canonical term
references are not recreated as text atoms.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec tsx --test test/claim-first-submission.test.ts`

Expected: FAIL because the legacy planner still synthesizes five semantic claims.

- [ ] **Step 3: Add the claim-first planner branch**

```ts
function buildClaimFirstSubmissionPlan(
  submission: NormalizedClaimFirstSubmission,
  ontology: OntologyManifest,
  codeCheck: ContractCodeCheck,
  chainCheck?: RpcChainCheck,
): SubmissionPlan {
  // ensure deployment/class/custom predicate/custom object atoms
  // create membership
  // create one triple per submission.claims entry, preserving order
}
```

Use the existing resolver convention: atom content is referenced by content string; existing terms are
referenced by canonical `0x` term ID. Only `predicates.membership` is required automatically. A custom
predicate's deterministic atom ID becomes the triple predicate and its label is included in the atom
batch.

- [ ] **Step 4: Remove the duplicate subject comparison in triple verification**

Keep one `result.subjectId !== subjectId.toLowerCase()` check in `src/write-workflow.ts` while this
path is covered by the new resolver tests.

- [ ] **Step 5: Run focused and workflow tests**

Run: `pnpm exec tsx --test test/claim-first-submission.test.ts test/backend.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/submission.ts src/write-workflow.ts test/claim-first-submission.test.ts
git commit -m "Plan explicit claim-first registry writes"
```

### Task 3: Model the dynamic wizard as pure state

**Files:**

- Create: `web/submit-wizard.ts`
- Create: `test/submit-wizard.test.ts`
- Modify: `web/contribution-presentation.ts`

- [ ] **Step 1: Write failing state tests**

```ts
test("the wizard advances identity through a repeatable claim loop to review", () => {
  let state = initialSubmitWizardState();
  state = submitWizardReducer(state, { type: "identity-verified", identity });
  state = submitWizardReducer(state, {
    type: "choose-predicate",
    predicate: SOURCE,
  });
  state = submitWizardReducer(state, {
    type: "update-draft",
    patch: { objectValue: URL },
  });
  state = submitWizardReducer(state, { type: "confirm-claim" });
  assert.equal(state.panel, "claim-saved");
  assert.equal(state.claims.length, 1);
  state = submitWizardReducer(state, { type: "review" });
  assert.equal(state.panel, "review");
});
```

Add tests for Back, Edit, Remove, Move up/down, custom predicate labels, legacy import conversion, and
the twenty-claim ceiling.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec tsx --test test/submit-wizard.test.ts`

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement the reducer and presentation catalogue**

```ts
export type SubmitWizardPanel =
  | "identity"
  | "claim-choice"
  | "claim-details"
  | "claim-confirm"
  | "claim-saved"
  | "review";

export function submitWizardReducer(
  state: SubmitWizardState,
  action: SubmitWizardAction,
): SubmitWizardState {
  /* deterministic transitions only */
}

export function claimFirstInputFromWizard(
  state: SubmitWizardState,
  submitterWallet: string,
): ClaimFirstSubmissionInput {
  /* visible claims only */
}
```

`LISTING_CLAIM_TEMPLATES` becomes the reviewed predicate catalogue. Each template owns its subject
default and editor kind (`text`, `url`, `chain`, `address`, `enforcer`, `terms`). No template is
mandatory and none references the signing wallet.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `pnpm exec tsx --test test/submit-wizard.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/submit-wizard.ts web/contribution-presentation.ts test/submit-wizard.test.ts
git commit -m "Model dynamic submit wizard"
```

### Task 4: Replace the listing form with focused wizard panels

**Files:**

- Create: `web/SubmitListingWizard.tsx`
- Modify: `web/Pages.tsx`
- Test: `test/submit-wizard.test.ts`

- [ ] **Step 1: Add a failing presentation assertion**

Add a source assertion that `SubmitListingWizard.tsx` exposes the required labelled actions:
`Verify identity`, `Confirm claim`, `Add another claim`, `Review contribution`, `Edit`, `Move up`,
`Move down`, and `Remove`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec tsx --test test/submit-wizard.test.ts`

Expected: FAIL because the component is absent.

- [ ] **Step 3: Build the wizard component**

The component owns `SubmitWizardState` and renders exactly one active panel. It receives wallet state,
busy state, and callbacks:

```ts
type SubmitListingWizardProps = {
  wallet: BrowserWallet | null;
  walletLabel: string;
  busy: boolean;
  status: string | null;
  review: SubmissionReview | null;
  outcome: SubmissionOutcome | null;
  onPrepare(input: ClaimFirstSubmissionInput): Promise<void>;
  onApprove(): Promise<void>;
};
```

Identity verification calls the existing target-chain bytecode check before advancing. Claim panels
use predicate-aware object controls. The claim stack supplies keyboard buttons for Edit, Move up,
Move down, and Remove. Stage transitions move focus to the new heading.

- [ ] **Step 4: Integrate it into `SubmitPageContent`**

Keep Support and Dispute modes unchanged. Replace only the `mode === "list"` branch and its fixed
field state. Continue using `submitWithBrowserWallet`, `SubmissionReview`, the exact transaction plan,
outcome notifications, and index verification.

Legacy pasted JSON is converted into visible wizard claims before preparation; it never bypasses
review.

- [ ] **Step 5: Run TypeScript and focused tests**

Run: `pnpm check && pnpm exec tsx --test test/submit-wizard.test.ts test/claim-first-submission.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/SubmitListingWizard.tsx web/Pages.tsx test/submit-wizard.test.ts
git commit -m "Build dynamic submit claim wizard"
```

### Task 5: Apply the panel layout, motion, and responsive behavior

**Files:**

- Modify: `web/styles.css`
- Modify: `web/SubmitListingWizard.tsx`

- [ ] **Step 1: Load the Impeccable craft floor before UI editing**

Read: `/Users/gadgetplug/.agents/skills/impeccable/reference/craft-floor.md`

- [ ] **Step 2: Add the wizard visual system**

Style one paper panel as active, completed identity as a compact ruled summary, and the claim stack as
an ordered ledger. Keep Signal Orange for primary/Web3 actions, minimum 44px control height, visible
focus, and the established route typography. Do not introduce nested cards or a new visual language.

- [ ] **Step 3: Add purposeful motion**

Use CSS classes keyed by panel state for a short opacity/translate transition. Under
`prefers-reduced-motion: reduce`, remove transforms and transition duration.

- [ ] **Step 4: Verify desktop and mobile once as a batch**

At desktop and 390px verify: identity panel, claim choice, predicate-aware details, confirmation,
two-claim stack, Edit, reorder, review, disconnected wallet, and no horizontal overflow.

- [ ] **Step 5: Fix the complete observed defect batch and confirm once**

Do one correction pass, then one final desktop/mobile confirmation. Do not enter an open-ended polish
loop.

- [ ] **Step 6: Run complete verification**

Run:

```bash
node /Users/gadgetplug/.agents/skills/impeccable/scripts/detect.mjs --json web/SubmitListingWizard.tsx web/Pages.tsx
pnpm check
pnpm test
pnpm build
pnpm format:check
```

Expected: detector has no new actionable finding and all commands PASS.

- [ ] **Step 7: Commit**

```bash
git add web/SubmitListingWizard.tsx web/styles.css
git commit -m "Finish responsive submit wizard"
```

## Self-review

- Every semantic write originates from a visible selected claim.
- Registry membership is the only automatic graph relation in the claim-first path.
- Signer and deployer remain independent.
- The normal flow never requires a raw Intuition ID.
- Legacy clients and JSON remain accepted and convert into explicit claims.
- The wizard guides one decision at a time and supports one to twenty claims.
- No work outside Submit and its submission pipeline is included.
