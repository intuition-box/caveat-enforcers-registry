import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  displayComposabilityRelationships,
  formatComposabilityTrust,
} from "../web/composability-presentation.js";

test("live Intuition claims become graph relationships without a seed plan", () => {
  const relationships = displayComposabilityRelationships([
    {
      id: "claim-1",
      subjectId: "term-a",
      subjectLabel: "AllowedTargetsEnforcer",
      kind: "complements",
      predicateId: "predicate-complements",
      predicateLabel: "complements",
      relatedId: "term-b",
      relatedLabel: "AllowedMethodsEnforcer",
      support: { value: "8", label: "8" },
      opposition: { value: "2", label: "2" },
      createdAt: "2026-08-10T00:00:00Z",
      context: [
        {
          id: "context-1",
          kind: "applies-in-context",
          predicateId: "predicate-context",
          predicateLabel: "applies in context",
          objectId: "context-object",
          objectLabel: "Scoped agent action",
          support: { value: "0", label: "No signal" },
          opposition: { value: "0", label: "No signal" },
          createdAt: "2026-08-10T00:00:01Z",
        },
      ],
    },
  ]);

  assert.deepEqual(relationships, [
    {
      key: "claim-1",
      claimId: "claim-1",
      live: true,
      subjectType: "AllowedTargetsEnforcer",
      relation: "complements",
      relatedType: "AllowedMethodsEnforcer",
      context: "Scoped agent action",
      supportedBy: "",
      support: "8",
      opposition: "2",
    },
  ]);
});

test("the composability UI contains no bundled relationship or registry fallback", () => {
  const pages = readFileSync(
    new URL("../web/Pages.tsx", import.meta.url),
    "utf8",
  );
  const graph = readFileSync(
    new URL("../web/ComposabilityGraph.tsx", import.meta.url),
    "utf8",
  );
  assert.equal(pages.includes("composability-seed.json"), false);
  assert.equal(pages.includes("composability-seed.triples.json"), false);
  assert.equal(graph.includes("metamask-v1.3.0.json"), false);
});

test("the registry graph excludes Intuition relationships outside live enforcer types", () => {
  const base = {
    predicateId: "predicate-conflicts",
    predicateLabel: "conflicts with",
    support: { value: "0", label: "No signal" },
    opposition: { value: "0", label: "No signal" },
    createdAt: "2026-08-10T00:00:00Z",
    context: [],
  };
  const relationships = displayComposabilityRelationships(
    [
      {
        ...base,
        id: "enforcer-claim",
        subjectId: "enforcer-a",
        subjectLabel: "AllowedTargetsEnforcer",
        kind: "conflicts" as const,
        relatedId: "enforcer-b",
        relatedLabel: "AllowedMethodsEnforcer",
      },
      {
        ...base,
        id: "unrelated-claim",
        subjectId: "tradition",
        subjectLabel: "Tradition",
        kind: "conflicts" as const,
        relatedId: "modernity",
        relatedLabel: "modern identity",
      },
      {
        ...base,
        id: "scoped-claim",
        subjectId: "scope-a",
        subjectLabel: "ScopeType.FunctionCall",
        kind: "conflicts" as const,
        relatedId: "scope-b",
        relatedLabel: "payable call",
        context: [
          {
            id: "context-1",
            kind: "applies-in-context" as const,
            predicateId: "predicate-context",
            predicateLabel: "applies in context",
            objectId: "context-object",
            objectLabel: "Delegation scope selection",
            support: { value: "0", label: "No signal" },
            opposition: { value: "0", label: "No signal" },
            createdAt: "2026-08-10T00:00:01Z",
          },
        ],
      },
    ],
    new Set(["enforcer-a", "enforcer-b"]),
  );

  assert.deepEqual(
    relationships.map((relationship) => relationship.key),
    ["enforcer-claim", "scoped-claim"],
  );
});

test("composability signals present vault wei as TRUST", () => {
  assert.equal(formatComposabilityTrust("1000000"), "<0.0001 TRUST");
  assert.equal(formatComposabilityTrust("1250000000000000000"), "1.25 TRUST");
});

test("every graph ledger row exposes its Intuition claim link", () => {
  const graph = readFileSync(
    new URL("../web/ComposabilityGraph.tsx", import.meta.url),
    "utf8",
  );
  assert.match(graph, /cgraph__ledger-link/);
  assert.match(graph, /Open .* claim in Intuition/);
  assert.match(graph, /intuitionClaimUrl\(relationship\.claimId\)/);
});
