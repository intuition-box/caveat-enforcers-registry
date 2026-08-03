# Composability Guide

Composability is a contextual claim about a set of caveat enforcers. It answers whether the set reinforces the intended permission, conflicts with it, or repeats a restriction that is already present.

The registry does not treat compatibility as a hardcoded application list. Each relationship is an Intuition triple with its use-case context, ordering notes, and supporting evidence. Community members can support or dispute the exact relationship.

## Three starting presets

### 1. Time-gated token transfer

`TimestampEnforcer` + `ERC20TransferAmountEnforcer`

These restrictions are complementary when the delegation should be usable only during a time window and should cap the amount transferred. The time condition and amount condition are independent. The preset must record the token, amount units, and time window that were reviewed.

### 2. Scoped agent action

`AllowedTargetsEnforcer` + `AllowedMethodsEnforcer` + `LimitedCallsEnforcer`

Target and method restrictions define the action surface. The call limit bounds repetition. The set is complementary when every allowed method is valid on every allowed target and the call counter is scoped to the same delegation. A target and method mismatch is a conflict, not a safe default.

### 3. Exact batch execution

`ExactExecutionBatchEnforcer` + `AllowedTargetsEnforcer`

Exact execution defines the expected batch. Target allowlisting adds a separate boundary around where those calls may land. The relationship is contextual and must include the batch format and target set. A changed batch or target list requires a new relationship claim.

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

Use `conflicts with` when both restrictions cannot satisfy the stated context. Use `redundant with` when one adds no meaningful restriction in that context. Do not infer either relationship from a label or from stake alone.

## For end users

Start with the job you want to permit. Read the plain-language reason for each preset, then inspect the exact terms schema and context before using it.

## For protocol developers

Treat the preset as an orientation layer, not an execution guarantee. Resolve canonical term IDs, inspect opposing claims, load every terms codec, and simulate the intended delegation before signing.
