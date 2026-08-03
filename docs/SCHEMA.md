# Registry Schema

## Design rules

1. An enforcer type is separate from a deployment.
2. A deployment is identified by CAIP-10: `caip10:eip155:{chainId}:{address}`.
3. Canonical term IDs define meaning. Labels are presentation only.
4. Structured JSON atoms use sorted object keys so equivalent metadata has one deterministic atom value.
5. Evidence is attached to the exact claim it supports.
6. A type can be listed even when it has no deployment on a particular chain.
7. Every contributor uses the same submission schema.
8. A new indexed entry must be discoverable without an application release.

## Entities

| Entity          | Purpose                                                                      |
| --------------- | ---------------------------------------------------------------------------- |
| Enforcer type   | Chain-independent description of a restriction mechanism.                    |
| Deployment      | A verified chain and contract-address pair for an enforcer type.             |
| Source release  | Repository, immutable commit or tag, and source path.                        |
| Terms schema    | Versioned description of the `terms` encoding and decoder contract.          |
| Audit evidence  | Structured reference to a report, its scope, and the covered source version. |
| Use-case preset | Contextual description of a combination of enforcers.                        |

## Core claims

The reviewed ontology manifest will supply canonical predicate and object term IDs. The registry must support claims equivalent to these relationships:

| Subject            | Relationship      | Object                              |
| ------------------ | ----------------- | ----------------------------------- |
| deployment         | is                | ERC-7710 caveat enforcer deployment |
| deployment         | implements        | enforcer type                       |
| deployment         | deployed on       | chain                               |
| deployment         | part of release   | source release                      |
| deployment         | source at         | source artifact                     |
| enforcer type      | described by      | human-readable description          |
| deployment         | has terms schema  | terms schema                        |
| deployment         | covered by audit  | audit evidence                      |
| deployment or type | used by           | wallet or protocol                  |
| type               | restricts         | domain                              |
| type               | affects operation | operation                           |

Do not create an audit claim without an exact evidence artifact.

## Terms schema

`terms` bytes are not assumed to be standard ABI encoding. Every listed enforcer must include a versioned codec document with:

- the enforcer name and immutable source reference;
- the decoder function, when one exists;
- encoding kind: `abi`, `packed`, `raw`, or `custom`;
- field names, types, offsets, and lengths where applicable;
- constraints and malformed-input behavior;
- encode and decode fixtures;
- tests for boundaries and round trips.

When a contract exposes a terms decoder, the codec tests must compare against that contract behavior.

## Portable submission contract

The language-neutral submission contract is published at [`schema/submission.schema.json`](../schema/submission.schema.json), with a complete example at [`schema/submission.example.json`](../schema/submission.example.json). The backend runtime validator remains authoritative for semantic checks such as executable fixtures, code presence, and chain identity.

## Minimum deployment submission

- chain ID and contract address;
- enforcer name, type, description, restriction domain, and affected operation;
- source URL and immutable source version when available;
- valid terms schema;
- submitter wallet;
- initial signal;
- contract-code verification result for the chosen chain.

Optional evidence includes an audit report, release record, deployment transaction, known usage, composition relationship, and examples. Optional evidence must remain absent when it is unavailable.

The portable submission contract currently models audit evidence as a source URL, scope, and
optional source version, known usage as named references with optional URLs, and composability
evidence as a relationship, use-case context, optional ordering, and optional supporting URL.
These claims are written only when the corresponding reviewed predicates are present in the
ontology manifest. Context and ordering claims use the canonical ID of the relationship triple as
their subject, so they remain extensible and attestable by the community.

## Submission flow

1. Normalize the chain and contract address.
2. Build the CAIP-10 deployment identity.
3. Verify contract code on the selected chain.
4. Resolve existing atoms and triples using canonical IDs.
5. Validate and pin structured metadata and the terms schema.
6. Preview and simulate the complete transaction plan.
7. Submit through the connected wallet.
8. Verify the receipt and direct onchain state.
9. Wait for indexing and confirm discovery through the registry query.

## Composition claims

Compatibility is contextual. A relationship such as `complements`, `conflicts with`, or `redundant with` must include its use-case context and supporting evidence. The application must query these claims rather than maintain a separate hardcoded compatibility database.
