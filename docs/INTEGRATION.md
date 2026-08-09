# Integration Rules

## Canonical registry environment

- Intuition chain ID: `1155`
- Mainnet GraphQL endpoint: `https://mainnet.intuition.sh/v1/graphql`
- Mainnet JSON-RPC: `https://rpc.intuition.systems/http`
- MultiVault: `0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e`
- DelegationManager: `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3`

The proposed registry boundary uses the dedicated object class atom
`ERC-7710 caveat enforcer deployment` (`0x6b417110d95173e05bb927254249126617efb6410824afe0e8d029245252f21c`).
It deliberately does not reuse the generic `deployment` atom: a broad object would
allow unrelated deployment claims to collide with the registry. The dedicated atom is
live on mainnet and is the object shared by all 33 currently indexed membership claims.
A client must still verify or create it before a write instead of assuming that a label
is canonical.

Mainnet is the canonical data environment for registry reads and release validation. Do not write disposable records to it.

## Directory configuration

The registry client requires these configured values:

- `REGISTRY_MEMBERSHIP_PREDICATE_ID`
- `REGISTRY_DEPLOYMENT_CLASS_ID`

The values belong in the application's environment configuration and must match the versioned ontology manifest. They identify the query boundary; they are not an access-control list. Intuition permits any wallet to propose a new term or claim. Team review is a curation and payout concern, not a prerequisite encoded by this client.

## Query boundary

The application must define its membership predicate and deployment-class object IDs in a versioned ontology manifest. It must query those IDs to discover deployments.

Do not use a display label as the membership boundary. Labels can change or collide.

### Membership query

This is the canonical read used by the registry. The predicate and object IDs are variables so a
contributor can propose an ontology without changing the query or shipping a new app release.

```graphql
query RegistryDeployments(
  $membershipPredicateId: String!
  $deploymentClassId: String!
  $limit: Int!
  $offset: Int!
) {
  triples(
    where: {
      predicate_id: { _eq: $membershipPredicateId }
      object_id: { _eq: $deploymentClassId }
    }
    order_by: { created_at: desc }
    limit: $limit
    offset: $offset
  ) {
    term_id
    subject_id
    created_at
    transaction_hash
    block_number
    subject {
      term_id
      label
      data
      image
      type
    }
    term {
      vaults {
        curve_id
        total_assets
        total_shares
        market_cap
        position_count
      }
    }
    counter_term {
      vaults {
        curve_id
        total_assets
        total_shares
        market_cap
        position_count
      }
    }
  }
}
```

Variables (these are the live mainnet values used by the launched registry, not placeholders):

```json
{
  "membershipPredicateId": "0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1",
  "deploymentClassId": "0x6b417110d95173e05bb927254249126617efb6410824afe0e8d029245252f21c",
  "limit": 100,
  "offset": 0
}
```

`membershipPredicateId` is the `is` predicate atom; `deploymentClassId` is the
`ERC-7710 caveat enforcer deployment` class atom. Together they are the registry boundary.

`data.triples` is the membership page. `subject.term_id` is the deployment term to use for
detail lookup. `subject.label` is the CAIP-10 identity (`caip10:eip155:1155:{address}`).
`term.vaults` and `counter_term.vaults` are separate support and opposition signals; a missing
vault is not a zero-confidence guarantee. `transaction_hash` and `block_number` identify the
indexed claim write when the indexer supplies them.

### Runnable example

No SDK and no Intuition-specific knowledge required. This returns the launched registry today:

```bash
curl -s https://mainnet.intuition.sh/v1/graphql \
  -H 'content-type: application/json' \
  -d '{
    "query": "query($p:String!,$o:String!,$l:Int!,$off:Int!){triples(where:{predicate_id:{_eq:$p},object_id:{_eq:$o}},order_by:{created_at:desc},limit:$l,offset:$off){subject_id subject{label}}}",
    "variables": {
      "p": "0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1",
      "o": "0x6b417110d95173e05bb927254249126617efb6410824afe0e8d029245252f21c",
      "l": 100, "off": 0
    }
  }'
```

### Populating a wallet's enforcer picker

A wallet or delegation UI can turn the same query into an enforcer picker with no registry code:

```ts
const ENDPOINT = "https://mainnet.intuition.sh/v1/graphql";
const MEMBERSHIP_PREDICATE =
  "0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1";
const DEPLOYMENT_CLASS =
  "0x6b417110d95173e05bb927254249126617efb6410824afe0e8d029245252f21c";

const query = `
  query RegistryDeployments($p: String!, $o: String!, $l: Int!, $off: Int!) {
    triples(
      where: { predicate_id: { _eq: $p }, object_id: { _eq: $o } }
      order_by: { created_at: desc }
      limit: $l
      offset: $off
    ) {
      subject_id
      subject { label }
      term { vaults { total_assets position_count } }
    }
  }`;

async function fetchEnforcerPicker() {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query,
      variables: {
        p: MEMBERSHIP_PREDICATE,
        o: DEPLOYMENT_CLASS,
        l: 100,
        off: 0,
      },
    }),
  });
  const { data } = await res.json();
  return data.triples.map((t) => {
    // subject.label is "caip10:eip155:{chainId}:{address}"
    const [, , chainId, address] = t.subject.label.split(":");
    return {
      deploymentTermId: t.subject_id, // use for the detail query
      chainId,
      address,
      trustStaked: t.term?.vaults?.[0]?.total_assets ?? "0", // sort by community confidence
    };
  });
}
```

Sort the returned options by `trustStaked` to surface the most community-endorsed enforcers first,
then run the deployment detail query below for the one the user selects.

The repository also includes a dependency-free, runnable version that resolves
canonical implementation names and keeps support and opposition separate:

```bash
pnpm example:wallet-picker
```

It talks directly to Intuition GraphQL and prints portable JSON. It does not call
the registry dapp API, require an Intuition SDK, connect a wallet, or write state.

### Deployment detail query

After selecting a deployment, fetch every claim where that deployment is the subject. Resolve
meaning from predicate IDs in the ontology manifest, not from labels alone.

```graphql
query DeploymentClaims($deploymentId: String!, $limit: Int!, $offset: Int!) {
  triples(
    where: { subject_id: { _eq: $deploymentId } }
    order_by: { created_at: asc }
    limit: $limit
    offset: $offset
  ) {
    term_id
    created_at
    transaction_hash
    block_number
    subject {
      term_id
      label
      data
      image
      type
    }
    predicate {
      term_id
      label
      data
      type
    }
    object {
      term_id
      label
      data
      type
    }
    term {
      vaults {
        curve_id
        total_assets
        total_shares
        market_cap
        position_count
      }
    }
    counter_term_id
    counter_term {
      vaults {
        curve_id
        total_assets
        total_shares
        market_cap
        position_count
      }
    }
  }
}
```

### Runnable read-only runner

The repository includes a dependency-free runner. It performs only `POST` GraphQL reads and
never signs or writes a transaction:

```bash
REGISTRY_MEMBERSHIP_PREDICATE_ID=0x... \
REGISTRY_DEPLOYMENT_CLASS_ID=0x... \
pnpm query:registry
```

To read one deployment's claims:

```bash
pnpm query:registry -- --detail 0x...deployment-term-id...
```

The runner prints the raw GraphQL response so clients can preserve fields they do not yet map.

For a complete detail view:

1. query all claims where the deployment is the subject;
2. resolve its `implements` object ID;
3. run the same subject query for that enforcer-type ID to load `restricts`,
   `affects operation`, `described by`, and `covered by audit` claims;
4. treat a structured audit object as source-scope evidence, then optionally query
   that audit atom for its `audited by` claim; and
5. preserve support and opposition vaults for every returned triple.

This second hop is required because chain-independent semantics belong to the enforcer
type, not to every deployment. Resolve all meaning from the manifest's predicate IDs;
labels are display metadata only.

## Submission and indexing

After a write transaction:

1. verify the transaction receipt;
2. verify the affected term or vault directly onchain;
3. poll GraphQL with bounded retries;
4. show `confirmed onchain, indexing` while the indexer catches up;
5. treat the entry as discoverable only when the registry query returns it.

## Wallet-facing use

A wallet integration should fetch registry membership, resolve the linked claims, filter for the wallet's supported chain and intended use case, and load the associated terms schema.

It must present support and opposition separately. Registry membership, usage claims, and support are not execution guarantees. The wallet must simulate an intended delegation before it executes it.

## Open-registry proof

The open model is demonstrated when a previously unlisted enforcer is submitted through the standard flow, verified onchain, indexed, and displayed by the same query pattern as the initial reference collection. No application release may be required for that result.
