# Contributing

Contributions must preserve the registry's open, evidence-based model.

## Before opening a pull request

1. Read [the registry schema](docs/SCHEMA.md).
2. Keep claims specific to their source, deployment, and evidence.
3. Do not add a claim that cannot be supported by the submitted artifact.
4. Run `pnpm check`, `pnpm test`, `pnpm check:submission-schema`, and `pnpm format:check`.

## Enforcer submissions

A submission must include the required fields in the schema, including a valid terms schema and chain-specific contract-code verification. Do not submit a label-only entry or rely on an assumed deployment.

## Changes to the ontology

Changes to canonical predicate or object term IDs require review because they affect registry membership and query results. Include the reason for the change, its effect on existing data, and the migration plan when one is needed.

## Pull request guidance

Keep each pull request focused. Explain the user-visible effect, the evidence behind any new claims, and the checks you ran.
