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
    implements:
      "0xb8adf8a79c30ae6a224ac8a76a738258114da42a3799387648f0fde2caeb2bba",
    deployedOn:
      "0x957beb2e34369c31c05a83dd43b7361bae62ce27aa799d731e7b24bd4ede7d7b",
    partOfRelease:
      "0x2c688bdb2f2bb10f90d90c700aea5a7581bf6df3bf6f194651dc113acc7382d0",
    sourceAt:
      "0xe5705ab105b08eb11c2fb1d624d71ba0243e8e4324864b56acafdc5fdc6c6a3e",
    describedBy:
      "0x92ab13841f2b3da8f16f0efac82f7ec45867c3500dfbd438b56f1c0273726056",
    hasTermsSchema:
      "0x8bf919230c76a14fdc10038cad9a85d85035cd2078eeff8af81741bbd1950d94",
    coveredByAudit:
      "0x81d99cc1df880cc0e12d0e8a2a193322663c05b4f893d63d24a3c730cb495e87",
    auditedBy:
      "0x54c893bab75931352eb462bd00012ca1ec13379bf197c54a01947420a3799c6d",
    usedBy:
      "0x9df1961750a1787da8ed4a143f23014393a2c63d6a0032766b643b8256e4a8e9",
    restricts:
      "0xba357fd06b94c6a10c58158e140ea2260008f3ee717c306cb9e3b62ad82683b6",
    affectsOperation:
      "0x9a3c3920f0a1cff7d22efc91ef92a9a5ff88f443b92475fece97abde5af20526",
    complements:
      "0x1185fe25f14560074c18ba04e54dd87bda9cf94517a87fe7aebea726e9a6b318",
    conflictsWith:
      "0x01d4e9039fd585178fcb08acd7daec2416d6226e9a6ecd51cf844f996ee7d5d3",
    redundantWith:
      "0xbbed32d394097ae6b00400413af767f039ef1e1b42ca76157aad81424f81ec5f",
    appliesInContext:
      "0x2221a9913138f0b959ce3819c122c9c579b882d1d59c1e47ee0e5c9e6f0f9bbb",
    requiresOrdering:
      "0xaecf3645b41bffa37ddd92543d5e61489738a84d3e22ee49e86a44a63ac6dff8",
    supportedBy:
      "0xffb5cca1253d9f3c9f7ecd2bdcb7952bc5238ef964fbf53eaa1d238a6371b8fe",
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
  | "auditedBy"
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
      implements: envValue(
        "REGISTRY_PREDICATE_IMPLEMENTS",
        proposed.predicates.implements,
      ),
      deployedOn: envValue(
        "REGISTRY_PREDICATE_DEPLOYED_ON",
        proposed.predicates.deployedOn,
      ),
      partOfRelease: envValue(
        "REGISTRY_PREDICATE_PART_OF_RELEASE",
        proposed.predicates.partOfRelease,
      ),
      sourceAt: envValue(
        "REGISTRY_PREDICATE_SOURCE_AT",
        proposed.predicates.sourceAt,
      ),
      describedBy: envValue(
        "REGISTRY_PREDICATE_DESCRIBED_BY",
        proposed.predicates.describedBy,
      ),
      hasTermsSchema: envValue(
        "REGISTRY_PREDICATE_HAS_TERMS_SCHEMA",
        proposed.predicates.hasTermsSchema,
      ),
      coveredByAudit: envValue(
        "REGISTRY_PREDICATE_COVERED_BY_AUDIT",
        proposed.predicates.coveredByAudit,
      ),
      auditedBy: envValue(
        "REGISTRY_PREDICATE_AUDITED_BY",
        proposed.predicates.auditedBy,
      ),
      usedBy: envValue(
        "REGISTRY_PREDICATE_USED_BY",
        proposed.predicates.usedBy,
      ),
      restricts: envValue(
        "REGISTRY_PREDICATE_RESTRICTS",
        proposed.predicates.restricts,
      ),
      affectsOperation: envValue(
        "REGISTRY_PREDICATE_AFFECTS_OPERATION",
        proposed.predicates.affectsOperation,
      ),
      complements: envValue(
        "REGISTRY_PREDICATE_COMPLEMENTS",
        proposed.predicates.complements,
      ),
      conflictsWith: envValue(
        "REGISTRY_PREDICATE_CONFLICTS_WITH",
        proposed.predicates.conflictsWith,
      ),
      redundantWith: envValue(
        "REGISTRY_PREDICATE_REDUNDANT_WITH",
        proposed.predicates.redundantWith,
      ),
      appliesInContext: envValue(
        "REGISTRY_PREDICATE_APPLIES_IN_CONTEXT",
        proposed.predicates.appliesInContext,
      ),
      requiresOrdering: envValue(
        "REGISTRY_PREDICATE_REQUIRES_ORDERING",
        proposed.predicates.requiresOrdering,
      ),
      supportedBy: envValue(
        "REGISTRY_PREDICATE_SUPPORTED_BY",
        proposed.predicates.supportedBy,
      ),
    },
  });
}
