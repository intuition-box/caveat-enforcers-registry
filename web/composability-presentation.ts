import type { ComposabilityClaim } from "../src/composability";
import { formatEther } from "viem";

export type DisplayComposabilityRelationship = {
  key: string;
  claimId: string;
  live: true;
  subjectType: string;
  relation: "complements" | "conflicts" | "redundant";
  relatedType: string;
  context: string;
  ordering?: string;
  supportedBy: string;
  support: string;
  opposition: string;
};

export function formatComposabilityTrust(value: string | undefined): string {
  if (!value || !/^\d+$/.test(value)) return "No indexed signal";
  const wei = BigInt(value);
  const trust = formatEther(wei);
  const [integer, fraction = ""] = trust.split(".");
  const readableFraction = fraction.slice(0, 4).replace(/0+$/, "");
  if (wei > 0n && integer === "0" && !readableFraction) {
    return "<0.0001 TRUST";
  }
  return `${integer}${readableFraction ? `.${readableFraction}` : ""} TRUST`;
}

function contextValue(
  claim: ComposabilityClaim,
  kind: "applies-in-context" | "requires-ordering" | "supported-by",
): string {
  return (
    claim.context.find((item) => item.kind === kind)?.objectLabel?.trim() ?? ""
  );
}

export function displayComposabilityRelationships(
  claims: ComposabilityClaim[],
  allowedTermIds?: ReadonlySet<string>,
): DisplayComposabilityRelationship[] {
  return claims.flatMap((claim) => {
    const usesReviewedContext = claim.context.some(
      (item) =>
        item.kind === "applies-in-context" ||
        item.kind === "requires-ordering" ||
        item.kind === "supported-by",
    );
    if (
      allowedTermIds &&
      (!allowedTermIds.has(claim.subjectId) ||
        !allowedTermIds.has(claim.relatedId)) &&
      !usesReviewedContext
    ) {
      return [];
    }
    if (
      claim.kind !== "complements" &&
      claim.kind !== "conflicts" &&
      claim.kind !== "redundant"
    ) {
      return [];
    }

    const subjectType = claim.subjectLabel?.trim() || claim.subjectId;
    const relatedType = claim.relatedLabel?.trim() || claim.relatedId;
    if (!claim.id || !subjectType || !relatedType) return [];

    const ordering = contextValue(claim, "requires-ordering");
    return [
      {
        key: claim.id,
        claimId: claim.id,
        live: true as const,
        subjectType,
        relation: claim.kind,
        relatedType,
        context:
          contextValue(claim, "applies-in-context") || "No context claim",
        ...(ordering ? { ordering } : {}),
        supportedBy: contextValue(claim, "supported-by"),
        support: claim.support.value,
        opposition: claim.opposition.value,
      },
    ];
  });
}
