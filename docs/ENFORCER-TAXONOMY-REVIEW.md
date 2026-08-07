# Enforcer taxonomy review

Status: proposed only. This review does not create atoms or triples.

The 32 MetaMask deployment records are already seeded with membership,
implementation, chain, and source claims. The attribute taxonomy is a separate
write. Restriction claims belong to the already-seeded enforcer type atoms, not
the CAIP-10 deployment atoms.

The review below is based on the enforcer implementations in the [MetaMask
delegation framework](https://github.com/MetaMask/delegation-framework), not on
the contract names alone.

## Review decisions

| Enforcer                                 | Proposed            | Review | Conservative classification |
| ---------------------------------------- | ------------------- | ------ | --------------------------- |
| AllowedCalldataEnforcer                  | calldata            | Keep   | calldata                    |
| AllowedMethodsEnforcer                   | method              | Keep   | method                      |
| AllowedTargetsEnforcer                   | target              | Keep   | target                      |
| ApprovalRevocationEnforcer               | method, approval    | Revise | approval                    |
| ArgsEqualityCheckEnforcer                | calldata            | Revise | arguments                   |
| BlockNumberEnforcer                      | time                | Revise | block                       |
| DeployedEnforcer                         | identity            | Revise | deployment                  |
| ERC1155BalanceChangeEnforcer             | balance             | Keep   | balance                     |
| ERC20BalanceChangeEnforcer               | balance             | Keep   | balance                     |
| ERC20PeriodTransferEnforcer              | amount, rate        | Revise | amount, time                |
| ERC20StreamingEnforcer                   | amount, rate        | Expand | amount, rate, time          |
| ERC20TransferAmountEnforcer              | amount              | Expand | amount, target              |
| ERC721BalanceChangeEnforcer              | balance             | Keep   | balance                     |
| ERC721TransferEnforcer                   | target              | Keep   | target                      |
| ExactCalldataBatchEnforcer               | calldata, execution | Narrow | calldata                    |
| ExactCalldataEnforcer                    | calldata            | Keep   | calldata                    |
| ExactExecutionBatchEnforcer              | execution           | Keep   | execution                   |
| ExactExecutionEnforcer                   | execution           | Keep   | execution                   |
| IdEnforcer                               | identity            | Revise | single-use identifier       |
| LimitedCallsEnforcer                     | time                | Revise | count                       |
| MultiTokenPeriodEnforcer                 | amount, rate        | Revise | amount, time                |
| NativeBalanceChangeEnforcer              | balance             | Keep   | balance                     |
| NativeTokenPaymentEnforcer               | amount              | Expand | amount, payment recipient   |
| NativeTokenPeriodTransferEnforcer        | amount, rate        | Revise | amount, time                |
| NativeTokenStreamingEnforcer             | amount, rate        | Expand | amount, rate, time          |
| NativeTokenTransferAmountEnforcer        | amount              | Keep   | amount                      |
| NonceEnforcer                            | identity            | Revise | nonce                       |
| OwnershipTransferEnforcer                | method              | Revise | ownership, target           |
| RedeemerEnforcer                         | identity            | Revise | actor access                |
| SpecificActionERC20TransferBatchEnforcer | execution, amount   | Keep   | execution, amount           |
| TimestampEnforcer                        | time                | Keep   | time                        |
| ValueLteEnforcer                         | amount              | Revise | native execution value      |

## Material corrections

- `ArgsEqualityCheckEnforcer` compares delegation `args` with `terms`; it does
  not inspect the executed calldata. It needs an `arguments` hub or an explicit
  decision to fold arguments into a broader execution hub.
- `BlockNumberEnforcer` uses block height, not wall-clock time. A `block` hub
  avoids claiming that the two boundaries are interchangeable.
- `LimitedCallsEnforcer` limits a count. It has no temporal condition. A `count`
  hub is required.
- The period enforcers use an amount plus a duration and start date. They do not
  enforce a rate; reserve `rate` for streaming enforcers with an
  `amountPerSecond` term.
- `NonceEnforcer` protects replay/sequence state, not identity.
- `IdEnforcer` makes an identifier single-use across delegations. It is a
  usage/replay boundary, not an identity claim.
- `DeployedEnforcer` checks code at an expected CREATE2 deployment address. That
  is deployment evidence, not an identity claim.
- `OwnershipTransferEnforcer` restricts an ownership-transfer operation against
  a target contract. `method` alone loses the ownership meaning.
- `ApprovalRevocationEnforcer` needs an `approval` hub. The original proposal
  referenced that hub but did not include it in the hub list.
- `RedeemerEnforcer` restricts who may act. Use `actor access`, not the broader
  and ambiguous `identity` label.
- `NativeTokenPaymentEnforcer` identifies a payment recipient created by its
  nested allowance flow. That recipient is not the target of the original
  delegated execution.
- `ValueLteEnforcer` caps the native value field of an execution. A generic
  `amount` label would conflate it with token transfer amounts.

## Subject and presentation model

Use `enforcer type —restricts→ attribute`, matching the registry schema and the
normal submission planner. The graph may traverse `deployment —implements→
type` to reach those claims, but the taxonomy seed must not attach semantic
type claims directly to deployment addresses.

Compact names are generated deterministically from the canonical type by the
shared presentation-name utility. They are not submission requirements and do
not create `has short name` atoms or triples. The canonical type remains
searchable and visible on every detail record.

## Hub decision required before seeding

The original “eight” hub list actually contains nine values and also references
`approval` without defining it. The conservative table requires these additional
semantic hubs:

`arguments`, `approval`, `block`, `count`, `deployment`, `nonce`, `ownership`,
`actor access`, `payment recipient`, `single-use identifier`, and `native
execution value`.

That is preferable to writing inaccurate edges. If the graph must stay compact,
the safe merges are:

- `block` into a clearly named `temporal boundary` hub;
- `arguments` into `execution inputs`;
- `count` into `usage limit`;
- `deployment` into `target/deployment` only if the label makes the distinction
  explicit.

Do not merge `nonce` into `identity`, or period `rate` into streaming `rate`.
Those would make the graph visually neat at the cost of a false on-chain claim.

## Mainnet gate

Before running `pnpm seed:taxonomy -- --execute --confirm-mainnet`, approve:

1. The conservative classifications above, or a signed-off alternative.
2. The final hub list and display labels.
3. Whether the richer edges for exact execution should include their component
   `target`, `amount/value`, and `calldata` hubs in addition to `execution`.
4. A pinned source commit and runtime-bytecode verification for
   `ApprovalRevocationEnforcer`, which is not present in the Delegation
   Framework `v1.3.0` source tag used by the other reviewed implementations.

Until those decisions are approved, only the reviewed JSON proposal should exist;
the funded taxonomy seed must remain dry-run only.
