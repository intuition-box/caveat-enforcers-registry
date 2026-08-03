export const INTUITION_MAINNET_CHAIN_ID = "1155";
export const INTUITION_MAINNET_GRAPHQL =
  "https://mainnet.intuition.sh/v1/graphql";
export const INTUITION_MAINNET_MULTIVAULT =
  "0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e";

export type PredicateKey =
  | "membership"
  | "implements"
  | "deployedOn"
  | "partOfRelease"
  | "sourceAt"
  | "describedBy"
  | "hasTermsSchema"
  | "coveredByAudit"
  | "usedBy"
  | "restricts"
  | "affectsOperation"
  | "complements"
  | "conflictsWith"
  | "redundantWith"
  | "appliesInContext"
  | "requiresOrdering"
  | "supportedBy";

export type OntologyManifest = {
  version: string;
  chainId: string;
  deploymentClassId: string;
  predicates: Partial<Record<PredicateKey, string>>;
};

export type OntologyIssue = {
  path: string;
  message: string;
};

const termIdPattern = /^0x[0-9a-f]{64}$/i;

export function validateOntologyManifest(
  manifest: OntologyManifest,
): OntologyIssue[] {
  const issues: OntologyIssue[] = [];

  if (!manifest.version.trim()) {
    issues.push({
      path: "version",
      message: "A manifest version is required.",
    });
  }

  if (!/^\d+$/.test(manifest.chainId)) {
    issues.push({
      path: "chainId",
      message: "The Intuition chain ID must contain only decimal digits.",
    });
  }

  if (!manifest.deploymentClassId.trim()) {
    issues.push({
      path: "deploymentClassId",
      message: "The reviewed deployment-class term ID is required.",
    });
  } else if (!termIdPattern.test(manifest.deploymentClassId.trim())) {
    issues.push({
      path: "deploymentClassId",
      message: "The deployment-class term ID must be a 32-byte hex value.",
    });
  }

  if (!manifest.predicates.membership?.trim()) {
    issues.push({
      path: "predicates.membership",
      message: "The reviewed membership predicate ID is required.",
    });
  } else if (!termIdPattern.test(manifest.predicates.membership.trim())) {
    issues.push({
      path: "predicates.membership",
      message: "The membership predicate ID must be a 32-byte hex value.",
    });
  }

  for (const [key, value] of Object.entries(manifest.predicates)) {
    if (
      key !== "membership" &&
      value?.trim() &&
      !termIdPattern.test(value.trim())
    ) {
      issues.push({
        path: `predicates.${key}`,
        message: "Predicate IDs must be 32-byte hex values.",
      });
    }
  }

  return issues;
}

export function createOntologyManifest(input: {
  version: string;
  chainId?: string;
  deploymentClassId?: string;
  predicates?: Partial<Record<PredicateKey, string>>;
}): OntologyManifest {
  return {
    version: input.version,
    chainId: input.chainId ?? INTUITION_MAINNET_CHAIN_ID,
    deploymentClassId: input.deploymentClassId ?? "",
    predicates: input.predicates ?? {},
  };
}

export function readOntologyManifestFromEnv(
  env: Record<string, string | undefined>,
): OntologyManifest {
  return createOntologyManifest({
    version: env.REGISTRY_ONTOLOGY_VERSION ?? "unreviewed",
    chainId: env.INTUITION_CHAIN_ID ?? INTUITION_MAINNET_CHAIN_ID,
    deploymentClassId: env.REGISTRY_DEPLOYMENT_CLASS_ID,
    predicates: {
      membership: env.REGISTRY_MEMBERSHIP_PREDICATE_ID,
      implements: env.REGISTRY_PREDICATE_IMPLEMENTS,
      deployedOn: env.REGISTRY_PREDICATE_DEPLOYED_ON,
      partOfRelease: env.REGISTRY_PREDICATE_PART_OF_RELEASE,
      sourceAt: env.REGISTRY_PREDICATE_SOURCE_AT,
      describedBy: env.REGISTRY_PREDICATE_DESCRIBED_BY,
      hasTermsSchema: env.REGISTRY_PREDICATE_HAS_TERMS_SCHEMA,
      coveredByAudit: env.REGISTRY_PREDICATE_COVERED_BY_AUDIT,
      usedBy: env.REGISTRY_PREDICATE_USED_BY,
      restricts: env.REGISTRY_PREDICATE_RESTRICTS,
      affectsOperation: env.REGISTRY_PREDICATE_AFFECTS_OPERATION,
      complements: env.REGISTRY_PREDICATE_COMPLEMENTS,
      conflictsWith: env.REGISTRY_PREDICATE_CONFLICTS_WITH,
      redundantWith: env.REGISTRY_PREDICATE_REDUNDANT_WITH,
      appliesInContext: env.REGISTRY_PREDICATE_APPLIES_IN_CONTEXT,
      requiresOrdering: env.REGISTRY_PREDICATE_REQUIRES_ORDERING,
      supportedBy: env.REGISTRY_PREDICATE_SUPPORTED_BY,
    },
  });
}
