# Claim-first Submit and Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make claim-level evidence visible in Registry and make claims, rather than a fixed questionnaire, the primary Submit workflow.

**Architecture:** Preserve the current `SubmissionInput` contract and browser-wallet writer. Add a small presentation module for supported claim templates and core-claim counts; consume it in `Pages.tsx` to render continuous claim ledgers. Registry continues to load canonical details but expands the selected record inline before the existing full drawer.

**Tech Stack:** React 19, TypeScript, Intuition API client, Node test runner, CSS.

---

### Task 1: Test and define contribution presentation data

**Files:**

- Create: `web/contribution-presentation.ts`
- Create: `test/contribution-presentation.test.ts`

- [ ] **Step 1: Write a failing test.**

```ts
test("listing summary separates deployment identity from five core claims", () => {
  assert.deepEqual(listingClaimSummary(validListing), {
    identity: "eip155:1155:0x1111111111111111111111111111111111111111",
    claimCount: 5,
  });
});
```

- [ ] **Step 2: Run `pnpm test -- test/contribution-presentation.test.ts`; verify it fails because the module is absent.**
- [ ] **Step 3: Implement `listingClaimSummary` and `LISTING_CLAIM_TEMPLATES` with source, purpose, restriction, operation, terms, audit, usage, composability, deployer, and author labels. Do not define a signer template.**
- [ ] **Step 4: Run the focused test; verify it passes.**
- [ ] **Step 5: Commit:** `git add web/contribution-presentation.ts test/contribution-presentation.test.ts && git commit -m "Add claim-first contribution presentation data"`

### Task 2: Make Registry claims visibly inspectable

**Files:**

- Modify: `web/Pages.tsx:1041-1434`
- Modify: `web/styles.css:6840-7110`
- Test: `test/contribution-presentation.test.ts`

- [ ] **Step 1: Add a failing test asserting the summary count remains five before optional evidence.**
- [ ] **Step 2: Run the focused test and verify it fails for the missing stable count contract.**
- [ ] **Step 3: Add `expandedDeploymentId` to Registry. A selected row must use `aria-expanded` and render an inline ruled ledger with claim predicate/object, separate support and opposition, TRUST distribution, and exact Portal link. Keep the drawer behind a separate “Open full record” control.**
- [ ] **Step 4: Style `table__expanded` and `registry-inline-ledger` as a row continuation: one rule, no shadow/card, a one-column mobile layout, and Signal Orange keyboard focus.**
- [ ] **Step 5: Run `pnpm test -- test/contribution-presentation.test.ts && pnpm check`; verify both pass.**
- [ ] **Step 6: Commit:** `git add web/Pages.tsx web/styles.css test/contribution-presentation.test.ts && git commit -m "Expose registry claims inline"`

### Task 3: Recompose Submit around identity then claims

**Files:**

- Modify: `web/Pages.tsx:1734-2740`
- Modify: `web/styles.css:7440-7715`
- Test: `test/contribution-presentation.test.ts`

- [ ] **Step 1: Add a failing test that optional templates are excluded from the five core listing claims.**
- [ ] **Step 2: Run the focused test and verify it fails before implementation.**
- [ ] **Step 3: Move chain and deployed address into an Identity stage; display name is optional and a live CAIP-10 preview appears beneath it. Put the connected wallet in a distinct Signing actor section.**
- [ ] **Step 4: Make Claims the next primary stage: show a ruled core-claims sequence with purpose, source, restriction, operation, and terms controls in those claim rows. Add template buttons which create editable additional claims for source, audit, usage, composability, deployer, and author. Wallet data must never populate an author/deployer claim.**
- [ ] **Step 5: Update the preflight outline to show Identity, Core claims, Additional claims, and Signing actor separately.**
- [ ] **Step 6: Style the form as one continuous `submission-claim-ledger` with square controls and a mobile stack at 42rem; retain existing notice/error/success feedback.**
- [ ] **Step 7: Run `pnpm check && pnpm test && pnpm build && pnpm format:check`; verify all pass.**
- [ ] **Step 8: Commit:** `git add web/Pages.tsx web/styles.css web/contribution-presentation.ts test/contribution-presentation.test.ts && git commit -m "Make submission identity and claims explicit"`

### Task 4: Verify the rendered product

**Files:**

- Modify: `web/styles.css` only if browser verification identifies a real issue.

- [ ] **Step 1: Run `node /Users/gadgetplug/.agents/skills/impeccable/scripts/detect.mjs --json web/Pages.tsx web/styles.css` and record any pre-existing advisories separately.**
- [ ] **Step 2: Inspect local Registry and Submit at desktop and 390px. Verify identity precedes claims, the signing actor remains separate, a selected Registry row expands in place, and there is no horizontal overflow.**
- [ ] **Step 3: Run `pnpm check && pnpm test && pnpm build && pnpm format:check`; verify all pass.**
- [ ] **Step 4: Commit any final CSS correction with `git add web/styles.css && git commit -m "Polish claim-first registry flows"`.**

## Self-review

- Registry has claim-level support/opposition and portal links in context.
- Submit separates identity, arbitrary claims, and signing actor without changing the existing on-chain writer contract.
- All code changes are test-first and finish with browser and build verification.
