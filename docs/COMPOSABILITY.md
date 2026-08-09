# Composability Guide

Composability is a contextual claim about a set of caveat enforcers. It answers whether the set reinforces the intended permission, conflicts with it, or repeats a restriction that is already present.

The registry does not treat compatibility as a hardcoded application list. Each relationship is an Intuition triple with its use-case context, ordering notes, and supporting evidence. Community members can support or dispute the exact relationship.

The portable seed in `data/composability-seed.json` contains the source-backed starting
relationships. `data/composability-seed.triples.json` is generated from it with the deployed
salted atom and triple formulas, so the relationship and context claims have explicit canonical
IDs before a wallet writes them. Run `pnpm check:composability-seed` to verify the generated IDs.
These are not presented as live claims until the browser-wallet flow submits and verifies them.

## Three starting presets

### 1. Time-gated token transfer

`TimestampEnforcer` + `ERC20TransferAmountEnforcer`

These restrictions are complementary when the delegation should be usable only during a time window and should cap the amount transferred. The time condition and amount condition are independent. The preset must record the token, amount units, and time window that were reviewed.

### 2. Scoped agent action

`AllowedTargetsEnforcer` + `AllowedMethodsEnforcer` + `LimitedCallsEnforcer` + `TimestampEnforcer`

These four enforcers compose cleanly as a scoped-agent-action set when target, method, call-count, and time-window terms all refer to the same delegation. A target and method mismatch is a conflict, not a safe default.

### 3. Exact batch with a redemption cap

`ExactExecutionBatchEnforcer` + `LimitedCallsEnforcer`

Exact execution defines every target, value, and calldata item in the expected batch.
`LimitedCallsEnforcer` adds an independent bound on how many times that exact delegation may be
redeemed. The combination is complementary only when both caveats apply to the same delegation.

## Additional conflict boundaries

These are chain-verified conflict rules from the Intuition `1155` deployment in
`intuition-box/delegation`:

- `ScopeType.FunctionCall` pins `ValueLteEnforcer` to `0` and silently ignores `maxValue`, so it conflicts with any payable call.
- `ScopeType.NativeTokenTransferAmount` defaults `ExactCalldataEnforcer` to `0x` and blocks all calldata; `AllowedCalldataEnforcer` replaces that default.
- `AllowedCalldataEnforcer` is only safe for static 32-byte arguments. Dynamic or variable-length calldata needs a different review.

These are conflicts and constraints, not safety badges. The exact scope type and terms must be visible beside the relationship claim.

## Relationship triples

The base relationship should be represented as a triple equivalent to:

```text
[enforcer A] -> complements -> [enforcer B]
```

The relationship triple then receives context and evidence claims:

```text
[relationship triple] -> applies in context -> [use-case preset]
[relationship triple] -> requires ordering -> [ordering description]
[relationship triple] -> supported by -> [source or test artifact]
```

The backend resolves these secondary claims by their configured predicate IDs and keeps their
support and opposition signals separate. If the context predicates are not configured yet, the
base relationship remains readable and its contextual list is empty rather than inferred from
labels.

The additional conflict rules were verified against the Intuition chain 1155 deployment in
[`intuition-box/delegation`](https://github.com/intuition-box/delegation). Keep that source
attached to any submitted relationship triple; do not restate the behavior from memory or from a
display label.

Use `conflicts with` when both restrictions cannot satisfy the stated context. Use `redundant with` when one adds no meaningful restriction in that context. Do not infer either relationship from a label or from stake alone.

## For end users

Start with the job you want to permit. Read the plain-language reason for each preset, then inspect the exact terms schema and context before using it.

## For protocol developers

Treat the preset as an orientation layer, not an execution guarantee. Resolve canonical term IDs, inspect opposing claims, load every terms codec, and simulate the intended delegation before signing.
