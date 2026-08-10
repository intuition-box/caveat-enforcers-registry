# Proposal: an open ERC-7710 caveat enforcer registry on Intuition

Status: owner-approved for publication on 2026-08-10.

Proposed publication target: the Intuition forum's
[Ecosystem Development](https://atlas.discourse.group/c/ecosystem-development/31)
category. This is the primary target because it is a public ERC-7710 community
proposal and directly satisfies the mission's forum-or-PR publication
requirement. A separate issue in `0xIntuition/agent-skills` can be opened later
if maintainers want to link the integration from the canonical Intuition skill;
that repository requires issue-first discussion for third-party integrations.

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
wallet-picker example are documented in the
[integration guide](https://github.com/intuition-box/caveat-enforcers-registry/blob/main/docs/INTEGRATION.md).
A client needs only the public Intuition GraphQL endpoint plus the membership
predicate and deployment-class IDs. It does not need to run this dapp, call the
registry API, connect a wallet, or use an Intuition-specific SDK.

The standalone example is runnable from a clone:

```bash
pnpm install --frozen-lockfile
node examples/wallet-picker.mjs
```

It queries `https://mainnet.intuition.sh/v1/graphql` directly, resolves each
deployment's canonical type, preserves support and opposition as separate
values, and emits portable JSON for a wallet picker. The latest independent run
on 2026-08-10 returned 33 deployments: the 32 MetaMask launch records plus the
open community contribution. The reference collection now also carries
source-derived restriction, operation, terms-schema, release, usage, and exact
audit-scope claims. Seven composability relationships and 17 contextual claims
are live on the same graph, while support and opposition remain separate.

The two registry-boundary IDs are:

- membership predicate: `0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1`
- deployment class: `0x6b417110d95173e05bb927254249126617efb6410824afe0e8d029245252f21c`

## Request for feedback

We would like review from ERC-7710 wallet, SDK, and enforcer authors on:

1. the minimal portable terms-schema fields;
2. whether additional source/runtime equivalence claims should be standardized;
3. the contextual composability vocabulary; and
4. the most useful upstream home for the integration pattern.

Registry: <https://caveat-enforcers-registry.vercel.app>

Repository: <https://github.com/intuition-box/caveat-enforcers-registry>

Acceptance evidence:
<https://github.com/intuition-box/caveat-enforcers-registry/blob/main/docs/REVIEWER-EVIDENCE.md>
