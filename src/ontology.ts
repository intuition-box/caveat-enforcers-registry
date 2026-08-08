export const INTUITION_MAINNET_CHAIN_ID = "1155";
export const INTUITION_MAINNET_GRAPHQL =
  "https://mainnet.intuition.sh/v1/graphql";
export const INTUITION_MAINNET_RPC = "https://rpc.intuition.systems/http";
export const INTUITION_MAINNET_MULTIVAULT =
  "0x6E35cF57A41fA15eA0EaE9C33e751b01A784Fe7e";
export const INTUITION_MAINNET_DELEGATION_MANAGER =
  "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3";

/** The collision-safe object class for registry membership claims. */
export const PROPOSED_DEPLOYMENT_CLASS_LABEL =
  "ERC-7710 caveat enforcer deployment";
export const PROPOSED_DEPLOYMENT_CLASS_ID =
  "0x6b417110d95173e05bb927254249126617efb6410824afe0e8d029245252f21c";
export const LEGACY_GENERIC_DEPLOYMENT_CLASS_ID =
  "0x4d0e5a453b4d4d38741c899591d7e1ea838237d445b9c0e0c87826bc4a566b63";

/** Predicate atoms used by the funded MetaMask reference seed. */
export const REFERENCE_SEED_PREDICATES = {
  implements:
    "0xb8adf8a79c30ae6a224ac8a76a738258114da42a3799387648f0fde2caeb2bba",
  sourceAt:
    "0xe5705ab105b08eb11c2fb1d624d71ba0243e8e4324864b56acafdc5fdc6c6a3e",
} as const;

/**
 * Permissionless starting point for the open registry ontology.
 *
 * These are existing Intuition mainnet atoms, not a central approval list. A
 * deployment can be proposed against this shape immediately; the community
 * can add support, opposition, or a more specific predicate later.
 */
export const PROPOSED_ONTOLOGY_MANIFEST: OntologyManifest = {
  version: "proposed-mainnet-2026-08-03",
  chainId: INTUITION_MAINNET_CHAIN_ID,
  deploymentClassId: PROPOSED_DEPLOYMENT_CLASS_ID,
  predicates: {
    membership:
      "0xb0681668ca193e8608b43adea19fecbbe0828ef5afc941cef257d30a20564ef1",
    deployedOn:
      "0x957beb2e34369c31c05a83dd43b7361bae62ce27aa799d731e7b24bd4ede7d7b",
    conflictsWith:
      "0x01d4e9039fd585178fcb08acd7daec2416d6226e9a6ecd51cf844f996ee7d5d3",
  },
};

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
      message: "A deployment-class term ID is required.",
    });
  } else if (!termIdPattern.test(manifest.deploymentClassId.trim())) {
    issues.push({
      path: "deploymentClassId",
      message: "The deployment-class term ID must be a 32-byte hex value.",
    });
  } else if (
    manifest.deploymentClassId.trim().toLowerCase() ===
    LEGACY_GENERIC_DEPLOYMENT_CLASS_ID
  ) {
    issues.push({
      path: "deploymentClassId",
      message:
        "The generic deployment atom is not a safe registry boundary; use the ERC-7710 caveat enforcer deployment class.",
    });
  }

  if (!manifest.predicates.membership?.trim()) {
    issues.push({
      path: "predicates.membership",
      message: "A membership predicate ID is required.",
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
  const proposed = PROPOSED_ONTOLOGY_MANIFEST;
  const envValue = (name: string, fallback?: string): string | undefined =>
    env[name]?.trim() || fallback;
  return createOntologyManifest({
    version: envValue("REGISTRY_ONTOLOGY_VERSION", proposed.version)!,
    chainId: envValue("INTUITION_CHAIN_ID", proposed.chainId)!,
    deploymentClassId: envValue(
      "REGISTRY_DEPLOYMENT_CLASS_ID",
      proposed.deploymentClassId,
    ),
    predicates: {
      membership: envValue(
        "REGISTRY_MEMBERSHIP_PREDICATE_ID",
        proposed.predicates.membership,
      ),
      implements: envValue("REGISTRY_PREDICATE_IMPLEMENTS"),
      deployedOn: envValue(
        "REGISTRY_PREDICATE_DEPLOYED_ON",
        proposed.predicates.deployedOn,
      ),
      partOfRelease: env.REGISTRY_PREDICATE_PART_OF_RELEASE,
      sourceAt: envValue("REGISTRY_PREDICATE_SOURCE_AT"),
      describedBy: envValue("REGISTRY_PREDICATE_DESCRIBED_BY"),
      hasTermsSchema: envValue("REGISTRY_PREDICATE_HAS_TERMS_SCHEMA"),
      coveredByAudit: envValue("REGISTRY_PREDICATE_COVERED_BY_AUDIT"),
      usedBy: envValue("REGISTRY_PREDICATE_USED_BY"),
      restricts: envValue("REGISTRY_PREDICATE_RESTRICTS"),
      affectsOperation: envValue("REGISTRY_PREDICATE_AFFECTS_OPERATION"),
      complements: envValue("REGISTRY_PREDICATE_COMPLEMENTS"),
      conflictsWith: envValue(
        "REGISTRY_PREDICATE_CONFLICTS_WITH",
        proposed.predicates.conflictsWith,
      ),
      redundantWith: envValue("REGISTRY_PREDICATE_REDUNDANT_WITH"),
      appliesInContext: envValue("REGISTRY_PREDICATE_APPLIES_IN_CONTEXT"),
      requiresOrdering: envValue("REGISTRY_PREDICATE_REQUIRES_ORDERING"),
      supportedBy: envValue("REGISTRY_PREDICATE_SUPPORTED_BY"),
    },
  });
}
