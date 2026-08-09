# Proposal: an open ERC-7710 caveat enforcer registry on Intuition

Status: publication draft. Publishing it is an external action and requires an
explicit owner confirmation.

## Summary

We built a permissionless registry for ERC-7710 caveat enforcers on Intuition
mainnet. It gives wallets and applications one canonical query for discovering
deployments while keeping every property claim, supporting signal, and opposing
signal independently inspectable.

The registry currently includes the 32 MetaMask Smart Accounts Kit reference
enforcers and one independently submitted community enforcer. MetaMask is the
launch collection, not an allowlist: any contributor can create a CAIP-10 atom,
attach the standard triples, and deposit an initial TRUST signal without an
application release.

## Proposed shared pattern

- Deployment identity: `caip10:eip155:{chainId}:{address}`
- Registry boundary: `deployment --is--> ERC-7710 caveat enforcer deployment`
- Deployment evidence: implementation, chain, source, release, terms schema,
  and known usage
- Type semantics: restriction domain, affected operation, description, and
  exact source-scope audit evidence
- Composability: complementary, conflicting, and redundant relationships with
  context, ordering, and supporting artifacts attached to the relationship
  triple
- Curation: support and counter-vault balances shown separately; no combined
  safety score

## Integration

The canonical GraphQL query, runnable curl example, detail traversal, and a
wallet-picker example are documented in
[`docs/INTEGRATION.md`](./INTEGRATION.md). A client needs only the public
Intuition GraphQL endpoint plus the membership predicate and deployment-class
IDs. It does not need to run this dapp or use an Intuition-specific SDK.

## Request for feedback

We would like review from ERC-7710 wallet, SDK, and enforcer authors on:

1. the minimal portable terms-schema fields;
2. whether additional source/runtime equivalence claims should be standardized;
3. the contextual composability vocabulary; and
4. the most useful upstream home for the integration pattern.

Registry: <https://caveat-enforcers-registry.vercel.app>

Repository: <https://github.com/intuition-box/caveat-enforcers-registry>
