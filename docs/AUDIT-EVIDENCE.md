# MetaMask audit evidence review

Status: reviewed enrichment input; no claim in this document is a safety verdict.

The reference enrichment maps official reports in MetaMask's
[`delegation-framework/audits`](https://github.com/MetaMask/delegation-framework/tree/main/audits)
directory to an enforcer only when the report's scope names that exact Solidity
contract. Each graph record preserves the auditor, report URL, full source
commit, and scoped path.

## Source reports

| Auditor | Official report                                                                                                           | Reviewed commit                            | Exact named enforcers used by this registry                                                                                                                                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cyfrin  | [`cyfrin-3-25.pdf`](https://github.com/MetaMask/delegation-framework/blob/main/audits/cyfrin/cyfrin-3-25.pdf)             | `d522a38b0b0f1c27d896790262302a52c3720e06` | AllowedCalldata, AllowedMethods, AllowedTargets, ArgsEqualityCheck, BlockNumber, Deployed, ERC20TransferAmount, ERC721Transfer, Id, LimitedCalls, NativeTokenPayment, NativeTokenTransferAmount, Nonce, OwnershipTransfer, Redeemer, Timestamp, ValueLte |
| Cyfrin  | [`cyfrin-4-25.pdf`](https://github.com/MetaMask/delegation-framework/blob/main/audits/cyfrin/cyfrin-4-25.pdf)             | `cdd39c62d65436da0d97bff53a7a5714a3505453` | ERC20PeriodTransfer, ERC20Streaming, NativeTokenStreaming, SpecificActionERC20TransferBatch, ExactCalldata, ExactCalldataBatch, ExactExecution, ExactExecutionBatch                                                                                      |
| Cyfrin  | [`cyfrin-5-25-part1.pdf`](https://github.com/MetaMask/delegation-framework/blob/main/audits/cyfrin/cyfrin-5-25-part1.pdf) | `0f8e128adebc45f81c7c3d5e35124450767a454d` | MultiTokenPeriod                                                                                                                                                                                                                                         |
| Cyfrin  | [`cyfrin-5-25-part2.pdf`](https://github.com/MetaMask/delegation-framework/blob/main/audits/cyfrin/cyfrin-5-25-part2.pdf) | `42a2cb4c1d07465d70c050c337656a9a0c1eed33` | ERC20BalanceChange, ERC721BalanceChange, ERC1155BalanceChange, NativeBalanceChange                                                                                                                                                                       |
| Cyfrin  | [`cyfrin-5-26.pdf`](https://github.com/MetaMask/delegation-framework/blob/main/audits/cyfrin/cyfrin-5-26.pdf)             | `be5c72fb3eea8f04026d5e43dddda8243120c0c2` | ApprovalRevocation                                                                                                                                                                                                                                       |

The generated names above omit the `Enforcer` suffix for readability; every
stored scope uses the exact path `src/enforcers/{CanonicalName}.sol`.

## Deliberate exception

`NativeTokenPeriodTransferEnforcer` receives no audit claim. It is discussed in
the April 2025 Consensys Diligence report, but that report's exact files-in-scope
appendix lists `MultiTokenPeriodEnforcer.sol` and
`DelegationMetaSwapAdapter.sol`, not `NativeTokenPeriodTransferEnforcer.sol`.
Discussion is not treated as scope.

## Graph semantics

For every exact mapping, enrichment proposes:

```text
enforcer type --covered by audit--> structured audit evidence
structured audit evidence --audited by--> Cyfrin
```

The first edge means only that the named source contract appeared in the
report's scope at the recorded commit. It does not establish runtime-bytecode
equivalence for a deployment. Community support and opposition remain separate
vault positions on each claim.

The mapping is generated deterministically by
`scripts/generate-reference-metadata.ts` and tested for 31 exact claims plus the
one deliberate absence. Mainnet execution remains gated behind the explicit
`--execute --confirm-mainnet` flags.
