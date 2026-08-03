import type { OntologyManifest, PredicateKey } from "./ontology.js";
import { validateOntologyManifest } from "./ontology.js";
import type { RpcChainCheck } from "./chain.js";
import type {
  NormalizedSubmission,
  ContractCodeCheck,
  SubmissionCompositionEvidence,
} from "./validation.js";

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

function missingPredicateKeys(ontology: OntologyManifest): string[] {
  return requiredPredicates
    .filter((key) => !ontology.predicates[key]?.trim())
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
    ...(auditContent && !ontology.predicates.coveredByAudit?.trim()
      ? ["predicates.coveredByAudit"]
      : []),
    ...(usageContent.length && !ontology.predicates.usedBy?.trim()
      ? ["predicates.usedBy"]
      : []),
    ...compositions.flatMap((composition) => {
      const requirements = [
        ...(!ontology.predicates[
          compositionPredicateKeys[composition.relation]
        ]?.trim()
          ? [`predicates.${compositionPredicateKeys[composition.relation]}`]
          : []),
        ...(!ontology.predicates.appliesInContext?.trim()
          ? ["predicates.appliesInContext"]
          : []),
        ...(composition.ordering &&
        !ontology.predicates.requiresOrdering?.trim()
          ? ["predicates.requiresOrdering"]
          : []),
        ...(composition.supportedBy && !ontology.predicates.supportedBy?.trim()
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

  const operations: SubmissionPlanOperation[] = [
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
      predicateId: ontology.predicates.membership ?? "",
      object: ontology.deploymentClassId,
      note: "Canonical registry membership relation.",
    },
    {
      kind: "create-triple",
      key: "implements",
      subject: deployment,
      predicateId: ontology.predicates.implements ?? "",
      object: submission.type,
      note: "Connects deployment to the chain-independent enforcer type.",
    },
    {
      kind: "create-triple",
      key: "deployed-on",
      subject: deployment,
      predicateId: ontology.predicates.deployedOn ?? "",
      object: `eip155:${submission.chainId}`,
      note: "Records the deployment chain independently from the address.",
    },
    {
      kind: "create-triple",
      key: "source-at",
      subject: deployment,
      predicateId: ontology.predicates.sourceAt ?? "",
      object: submission.sourceUrl,
      note: "Source URL claim. Version is represented in the source-release atom.",
    },
    {
      kind: "create-triple",
      key: "has-terms-schema",
      subject: deployment,
      predicateId: ontology.predicates.hasTermsSchema ?? "",
      object: termsContent,
      note: "Links the deployment to its codec document.",
    },
    {
      kind: "create-triple",
      key: "restricts",
      subject: submission.type,
      predicateId: ontology.predicates.restricts ?? "",
      object: submission.restrictionDomain,
      note: "Restriction domain belongs to the enforcer type.",
    },
    {
      kind: "create-triple",
      key: "affects-operation",
      subject: submission.type,
      predicateId: ontology.predicates.affectsOperation ?? "",
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
            predicateId: ontology.predicates.coveredByAudit ?? "",
            object: auditContent,
            note: "Links the deployment to an exact audit scope and source.",
          },
        ]
      : []),
    ...usageContent.map((content, index) => ({
      kind: "create-triple" as const,
      key: `used-by:${index}`,
      subject: deployment,
      predicateId: ontology.predicates.usedBy ?? "",
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
            ontology.predicates[
              compositionPredicateKeys[composition.relation]
            ] ?? "",
          object: composition.relatedType,
          note: "Declares a contextual compatibility relationship between enforcer types.",
        },
        {
          kind: "create-triple" as const,
          key: `${relationKey}:context`,
          subject: `@triple:${relationKey}`,
          predicateId: ontology.predicates.appliesInContext ?? "",
          object: composition.context,
          note: "Scopes the compatibility relationship to the submitted use case.",
        },
        ...(composition.ordering
          ? [
              {
                kind: "create-triple" as const,
                key: `${relationKey}:ordering`,
                subject: `@triple:${relationKey}`,
                predicateId: ontology.predicates.requiresOrdering ?? "",
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
                predicateId: ontology.predicates.supportedBy ?? "",
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
      "This plan is not a signed transaction. Simulate it and verify the receipt before any canonical write.",
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
