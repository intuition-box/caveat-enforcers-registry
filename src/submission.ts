import type { OntologyManifest, PredicateKey } from "./ontology.js";
import {
  PROPOSED_DEPLOYMENT_CLASS_ID,
  PROPOSED_DEPLOYMENT_CLASS_LABEL,
  validateOntologyManifest,
} from "./ontology.js";
import type { RpcChainCheck } from "./chain.js";
import type {
  NormalizedSubmission,
  ContractCodeCheck,
  SubmissionCompositionEvidence,
} from "./validation.js";
import { intuitionAtomIdFromText } from "./intuition.js";

function canonicalJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalJsonValue(nested)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalJsonValue(value));
}

export type SubmissionPlanOperation =
  | {
      kind: "ensure-atom";
      key: string;
      content: string;
      note: string;
    }
  | {
      kind: "create-triple";
      key: string;
      subject: string;
      predicateId: string;
      object: string;
      note: string;
    };

export type SubmissionPlan = {
  status: "blocked-by-configuration" | "ready-for-simulation";
  deployment: string;
  initialSignal: string;
  operations: SubmissionPlanOperation[];
  requiredPredicateKeys: PredicateKey[];
  missingOntologyKeys: string[];
  codeCheck: ContractCodeCheck;
  chainCheck?: RpcChainCheck;
  warning: string;
};

export type SubmissionSimulation =
  | { status: "passed"; message: string }
  | { status: "failed"; message: string }
  | { status: "blocked"; message: string };

const requiredPredicates: PredicateKey[] = [
  "membership",
  "implements",
  "deployedOn",
  "sourceAt",
  "hasTermsSchema",
  "restricts",
  "affectsOperation",
];

const compositionPredicateKeys: Record<
  SubmissionCompositionEvidence["relation"],
  PredicateKey
> = {
  complements: "complements",
  conflicts: "conflictsWith",
  redundant: "redundantWith",
};

/**
 * The proposed manifest is permissionless: when a standard relationship atom
 * is not on mainnet yet, the first submission can create that atom in the same
 * ordered workflow. A custom/reviewed manifest still fails closed instead of
 * guessing a predicate.
 */
const PROPOSED_PREDICATE_ATOMS: Partial<Record<PredicateKey, string>> = {
  implements: "implements",
  sourceAt: "source at",
  hasTermsSchema: "has terms schema",
  restricts: "restricts",
  affectsOperation: "affects operation",
  coveredByAudit: "covered by audit",
  usedBy: "used by",
  complements: "complements",
  redundantWith: "redundant with",
  appliesInContext: "applies in context",
  requiresOrdering: "requires ordering",
  supportedBy: "supported by",
};

function predicateIdFor(
  ontology: OntologyManifest,
  key: PredicateKey,
): string | undefined {
  const configured = ontology.predicates[key]?.trim();
  if (configured) return configured;
  if (!ontology.version.startsWith("proposed-")) return undefined;
  const content = PROPOSED_PREDICATE_ATOMS[key];
  return content ? intuitionAtomIdFromText(content) : undefined;
}

function missingPredicateKeys(ontology: OntologyManifest): string[] {
  return requiredPredicates
    .filter((key) => !predicateIdFor(ontology, key))
    .map((key) => `predicates.${key}`);
}

export function buildSubmissionPlan(
  submission: NormalizedSubmission,
  ontology: OntologyManifest,
  codeCheck: ContractCodeCheck,
  chainCheck?: RpcChainCheck,
): SubmissionPlan {
  const ontologyIssues = validateOntologyManifest(ontology);
  const missingOntologyKeys = [
    ...ontologyIssues.map((issue) => issue.path),
    ...missingPredicateKeys(ontology),
  ];
  const deployment = submission.caip10;
  const sourceVersion =
    submission.sourceVersion?.trim() || "version not supplied";
  const termsContent = canonicalJson(submission.termsSchema);
  const sourceReleasePredicate = ontology.predicates.partOfRelease?.trim();
  const predicate = (key: PredicateKey) => predicateIdFor(ontology, key);
  const hasSourceRelease =
    Boolean(submission.sourceVersion?.trim()) &&
    Boolean(sourceReleasePredicate);
  const auditContent = submission.evidence?.audit
    ? canonicalJson(submission.evidence.audit)
    : null;
  const usageContent = (submission.evidence?.usage ?? []).map((usage) =>
    canonicalJson(usage),
  );
  const compositions = submission.evidence?.compositions ?? [];
  const evidencePredicateRequirements = [
    ...(auditContent && !predicate("coveredByAudit")
      ? ["predicates.coveredByAudit"]
      : []),
    ...(usageContent.length && !predicate("usedBy")
      ? ["predicates.usedBy"]
      : []),
    ...compositions.flatMap((composition) => {
      const requirements = [
        ...(!ontology.predicates[
          compositionPredicateKeys[composition.relation]
        ]?.trim() && !predicate(compositionPredicateKeys[composition.relation])
          ? [`predicates.${compositionPredicateKeys[composition.relation]}`]
          : []),
        ...(!predicate("appliesInContext")
          ? ["predicates.appliesInContext"]
          : []),
        ...(composition.ordering && !predicate("requiresOrdering")
          ? ["predicates.requiresOrdering"]
          : []),
        ...(composition.supportedBy && !predicate("supportedBy")
          ? ["predicates.supportedBy"]
          : []),
      ];
      return requirements;
    }),
  ];
  const allMissingOntologyKeys = [
    ...missingOntologyKeys,
    ...evidencePredicateRequirements,
  ];

  const evidencePredicateKeys: PredicateKey[] = [
    ...(auditContent ? ["coveredByAudit" as const] : []),
    ...(usageContent.length ? ["usedBy" as const] : []),
    ...compositions.flatMap((composition) => [
      compositionPredicateKeys[composition.relation],
      "appliesInContext" as const,
      ...(composition.ordering ? (["requiresOrdering"] as const) : []),
      ...(composition.supportedBy ? (["supportedBy"] as const) : []),
    ]),
  ];
  const proposedPredicateKeys = Array.from(
    new Set<PredicateKey>([...requiredPredicates, ...evidencePredicateKeys]),
  ).filter(
    (key) =>
      !ontology.predicates[key]?.trim() &&
      ontology.version.startsWith("proposed-") &&
      Boolean(PROPOSED_PREDICATE_ATOMS[key]),
  );

  const operations: SubmissionPlanOperation[] = [
    ...(ontology.version.startsWith("proposed-") &&
    ontology.deploymentClassId.toLowerCase() ===
      PROPOSED_DEPLOYMENT_CLASS_ID.toLowerCase()
      ? [
          {
            kind: "ensure-atom" as const,
            key: "ontology-class:deployment",
            content: PROPOSED_DEPLOYMENT_CLASS_LABEL,
            note: "Create the collision-safe ERC-7710 deployment class before membership triples.",
          },
        ]
      : []),
    ...proposedPredicateKeys.map((key) => ({
      kind: "ensure-atom" as const,
      key: `ontology-predicate:${key}`,
      content: PROPOSED_PREDICATE_ATOMS[key]!,
      note: "Permissionless proposed ontology atom; create it before dependent triples.",
    })),
    {
      kind: "ensure-atom",
      key: "deployment",
      content: deployment,
      note: "Deployment identity uses the normalized CAIP-10 value.",
    },
    {
      kind: "ensure-atom",
      key: "enforcer-type",
      content: submission.type,
      note: "Chain-independent type atom.",
    },
    {
      kind: "ensure-atom",
      key: "chain",
      content: `eip155:${submission.chainId}`,
      note: "Chain identity is explicit and separate from the deployment.",
    },
    ...(hasSourceRelease
      ? [
          {
            kind: "ensure-atom" as const,
            key: "source-release",
            content: `${submission.sourceUrl} @ ${sourceVersion}`,
            note: "Source evidence remains immutable when a version is supplied.",
          },
        ]
      : []),
    {
      kind: "ensure-atom",
      key: "source-url",
      content: submission.sourceUrl,
      note: "The source URL receives its own canonical atom.",
    },
    {
      kind: "ensure-atom",
      key: "terms-schema",
      content: termsContent,
      note: "Terms are stored as a versioned codec document, not assumed ABI.",
    },
    {
      kind: "ensure-atom",
      key: "restriction-domain",
      content: submission.restrictionDomain,
      note: "Restriction domain is a reusable semantic atom.",
    },
    {
      kind: "ensure-atom",
      key: "operation",
      content: submission.operation,
      note: "Affected operation is a reusable semantic atom.",
    },
    ...(ontology.predicates.describedBy?.trim()
      ? [
          {
            kind: "ensure-atom" as const,
            key: "description",
            content: submission.description,
            note: "Human-readable description is stored as a reusable atom.",
          },
        ]
      : []),
    ...(auditContent
      ? [
          {
            kind: "ensure-atom" as const,
            key: "audit-evidence",
            content: auditContent,
            note: "Audit scope and immutable source evidence are stored together.",
          },
        ]
      : []),
    ...usageContent.map((content, index) => ({
      kind: "ensure-atom" as const,
      key: `usage-evidence:${index}`,
      content,
      note: "Known usage evidence is stored as a reusable claim object.",
    })),
    ...compositions.flatMap((composition, index) => [
      {
        kind: "ensure-atom" as const,
        key: `composability-related:${index}`,
        content: composition.relatedType,
        note: "The related enforcer type is a canonical reusable atom.",
      },
      {
        kind: "ensure-atom" as const,
        key: `composability-context:${index}`,
        content: composition.context,
        note: "The composability relationship is scoped to an explicit use case.",
      },
      ...(composition.ordering
        ? [
            {
              kind: "ensure-atom" as const,
              key: `composability-ordering:${index}`,
              content: composition.ordering,
              note: "Ordering guidance is stored as a relationship claim.",
            },
          ]
        : []),
      ...(composition.supportedBy
        ? [
            {
              kind: "ensure-atom" as const,
              key: `composability-evidence:${index}`,
              content: composition.supportedBy,
              note: "Supporting evidence is stored as an immutable source atom.",
            },
          ]
        : []),
    ]),
    {
      kind: "create-triple",
      key: "membership",
      subject: deployment,
      predicateId: predicate("membership") ?? "",
      object: ontology.deploymentClassId,
      note: "Canonical registry membership relation.",
    },
    {
      kind: "create-triple",
      key: "implements",
      subject: deployment,
      predicateId: predicate("implements") ?? "",
      object: submission.type,
      note: "Connects deployment to the chain-independent enforcer type.",
    },
    {
      kind: "create-triple",
      key: "deployed-on",
      subject: deployment,
      predicateId: predicate("deployedOn") ?? "",
      object: `eip155:${submission.chainId}`,
      note: "Records the deployment chain independently from the address.",
    },
    {
      kind: "create-triple",
      key: "source-at",
      subject: deployment,
      predicateId: predicate("sourceAt") ?? "",
      object: submission.sourceUrl,
      note: "Source URL claim. Version is represented in the source-release atom.",
    },
    {
      kind: "create-triple",
      key: "has-terms-schema",
      subject: deployment,
      predicateId: predicate("hasTermsSchema") ?? "",
      object: termsContent,
      note: "Links the deployment to its codec document.",
    },
    {
      kind: "create-triple",
      key: "restricts",
      subject: submission.type,
      predicateId: predicate("restricts") ?? "",
      object: submission.restrictionDomain,
      note: "Restriction domain belongs to the enforcer type.",
    },
    {
      kind: "create-triple",
      key: "affects-operation",
      subject: submission.type,
      predicateId: predicate("affectsOperation") ?? "",
      object: submission.operation,
      note: "Affected operation belongs to the enforcer type.",
    },
    ...(ontology.predicates.describedBy?.trim()
      ? [
          {
            kind: "create-triple" as const,
            key: "described-by",
            subject: submission.type,
            predicateId: ontology.predicates.describedBy,
            object: submission.description,
            note: "Links the enforcer type to its submitted description.",
          },
        ]
      : []),
    ...(hasSourceRelease
      ? [
          {
            kind: "create-triple" as const,
            key: "part-of-release",
            subject: deployment,
            predicateId: sourceReleasePredicate!,
            object: `${submission.sourceUrl} @ ${sourceVersion}`,
            note: "Links the deployment to its immutable source release atom.",
          },
        ]
      : []),
    ...(auditContent
      ? [
          {
            kind: "create-triple" as const,
            key: "covered-by-audit",
            subject: deployment,
            predicateId: predicate("coveredByAudit") ?? "",
            object: auditContent,
            note: "Links the deployment to an exact audit scope and source.",
          },
        ]
      : []),
    ...usageContent.map((content, index) => ({
      kind: "create-triple" as const,
      key: `used-by:${index}`,
      subject: deployment,
      predicateId: predicate("usedBy") ?? "",
      object: content,
      note: "Links the deployment to a declared usage reference.",
    })),
    ...compositions.flatMap((composition, index) => {
      const relationKey = `composability:${index}`;
      return [
        {
          kind: "create-triple" as const,
          key: relationKey,
          subject: submission.type,
          predicateId:
            predicate(compositionPredicateKeys[composition.relation]) ?? "",
          object: composition.relatedType,
          note: "Declares a contextual compatibility relationship between enforcer types.",
        },
        {
          kind: "create-triple" as const,
          key: `${relationKey}:context`,
          subject: `@triple:${relationKey}`,
          predicateId: predicate("appliesInContext") ?? "",
          object: composition.context,
          note: "Scopes the compatibility relationship to the submitted use case.",
        },
        ...(composition.ordering
          ? [
              {
                kind: "create-triple" as const,
                key: `${relationKey}:ordering`,
                subject: `@triple:${relationKey}`,
                predicateId: predicate("requiresOrdering") ?? "",
                object: composition.ordering,
                note: "Records required ordering for the relationship.",
              },
            ]
          : []),
        ...(composition.supportedBy
          ? [
              {
                kind: "create-triple" as const,
                key: `${relationKey}:evidence`,
                subject: `@triple:${relationKey}`,
                predicateId: predicate("supportedBy") ?? "",
                object: composition.supportedBy,
                note: "Links the relationship to supporting source evidence.",
              },
            ]
          : []),
      ];
    }),
  ];

  return {
    status:
      allMissingOntologyKeys.length === 0 &&
      codeCheck.status === "verified" &&
      (chainCheck === undefined || chainCheck.status === "verified")
        ? "ready-for-simulation"
        : "blocked-by-configuration",
    deployment,
    initialSignal: submission.initialSignal ?? "0",
    operations,
    requiredPredicateKeys: requiredPredicates,
    missingOntologyKeys: allMissingOntologyKeys,
    codeCheck,
    chainCheck,
    warning:
      "This plan is not a signed transaction. Simulate it and verify the receipt before any canonical write. Proposed predicate atoms are permissionless and may be created by the submitting wallet.",
  };
}

export async function simulateSubmissionPlan(
  plan: SubmissionPlan,
  simulator?: (plan: SubmissionPlan) => Promise<SubmissionSimulation>,
): Promise<SubmissionSimulation> {
  if (plan.status !== "ready-for-simulation") {
    return {
      status: "blocked",
      message:
        "Simulation is blocked until the ontology is configured and contract code is verified.",
    };
  }

  if (!simulator) {
    return {
      status: "blocked",
      message:
        "No wallet or chain simulator is connected. The plan is ready, but it has not been simulated.",
    };
  }

  return simulator(plan);
}
