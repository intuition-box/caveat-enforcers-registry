# Enforcer taxonomy review

Status: proposed only. This review does not create atoms or triples.

The 32 MetaMask deployment records are already seeded with membership,
implementation, chain, and source claims. The attribute taxonomy is a separate
write. As of 2026-08-07, the 32 seeded deployment subjects have zero `restricts`
triples on Intuition mainnet.

The review below is based on the enforcer implementations in the [MetaMask
delegation framework](https://github.com/MetaMask/delegation-framework), not on
the contract names alone.

## Review decisions

| Enforcer | Proposed | Review | Conservative classification |
| --- | --- | --- | --- |
| AllowedCalldataEnforcer | calldata | Keep | calldata |
| AllowedMethodsEnforcer | method | Keep | method |
| AllowedTargetsEnforcer | target | Keep | target |
| ApprovalRevocationEnforcer | method, approval | Revise | approval |
| ArgsEqualityCheckEnforcer | calldata | Revise | arguments |
| BlockNumberEnforcer | time | Revise | block |
| DeployedEnforcer | identity | Revise | deployment |
| ERC1155BalanceChangeEnforcer | balance | Keep | balance |
| ERC20BalanceChangeEnforcer | balance | Keep | balance |
| ERC20PeriodTransferEnforcer | amount, rate | Revise | amount, time |
| ERC20StreamingEnforcer | amount, rate | Expand | amount, rate, time |
| ERC20TransferAmountEnforcer | amount | Expand | amount, target |
| ERC721BalanceChangeEnforcer | balance | Keep | balance |
| ERC721TransferEnforcer | target | Keep | target |
| ExactCalldataBatchEnforcer | calldata, execution | Narrow | calldata |
| ExactCalldataEnforcer | calldata | Keep | calldata |
| ExactExecutionBatchEnforcer | execution | Keep | execution |
| ExactExecutionEnforcer | execution | Keep | execution |
| IdEnforcer | identity | Keep | identity |
| LimitedCallsEnforcer | time | Revise | count |
| MultiTokenPeriodEnforcer | amount, rate | Revise | amount, time |
| NativeBalanceChangeEnforcer | balance | Keep | balance |
| NativeTokenPaymentEnforcer | amount | Expand | amount, target |
| NativeTokenPeriodTransferEnforcer | amount, rate | Revise | amount, time |
| NativeTokenStreamingEnforcer | amount, rate | Expand | amount, rate, time |
| NativeTokenTransferAmountEnforcer | amount | Keep | amount |
| NonceEnforcer | identity | Revise | nonce |
| OwnershipTransferEnforcer | method | Revise | ownership, target |
| RedeemerEnforcer | identity | Keep | identity |
| SpecificActionERC20TransferBatchEnforcer | execution, amount | Keep | execution, amount |
| TimestampEnforcer | time | Keep | time |
| ValueLteEnforcer | amount | Keep | amount |

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
- `DeployedEnforcer` checks code at an expected CREATE2 deployment address. That
  is deployment evidence, not an identity claim.
- `OwnershipTransferEnforcer` restricts an ownership-transfer operation against
  a target contract. `method` alone loses the ownership meaning.
- `ApprovalRevocationEnforcer` needs an `approval` hub. The original proposal
  referenced that hub but did not include it in the hub list.

## Hub decision required before seeding

The original “eight” hub list actually contains nine values and also references
`approval` without defining it. The conservative table requires these additional
semantic hubs:

`arguments`, `approval`, `block`, `count`, `deployment`, `nonce`, and `ownership`.

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

Until those decisions are approved, only the reviewed JSON proposal should exist;
the funded taxonomy seed must remain dry-run only.
