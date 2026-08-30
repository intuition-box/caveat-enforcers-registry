export type ListingClaimTemplate = {
  key:
    | "source"
    | "purpose"
    | "restriction"
    | "operation"
    | "terms"
    | "audit"
    | "usage"
    | "composability"
    | "deployer"
    | "author";
  label: string;
  description: string;
};

export const LISTING_CLAIM_TEMPLATES: readonly ListingClaimTemplate[] = [
  {
    key: "source",
    label: "Source release",
    description: "Repository or verified release that supports this record.",
  },
  {
    key: "purpose",
    label: "Plain-language purpose",
    description: "What boundary this enforcer expresses.",
  },
  {
    key: "restriction",
    label: "Restriction",
    description: "The rule family this enforcer constrains.",
  },
  {
    key: "operation",
    label: "Operation",
    description: "The delegated action affected by the rule.",
  },
  {
    key: "terms",
    label: "Terms schema",
    description: "The encoded parameters and their decoder.",
  },
  {
    key: "audit",
    label: "Audit evidence",
    description: "A review claim, only when evidence exists.",
  },
  {
    key: "usage",
    label: "Usage context",
    description: "A concrete context in which this boundary is used.",
  },
  {
    key: "composability",
    label: "Composability",
    description: "A relationship to another enforcer or dependency.",
  },
  {
    key: "deployer",
    label: "Deployer",
    description: "Deployment provenance backed by an address or receipt.",
  },
  {
    key: "author",
    label: "Author",
    description: "Authorship evidence supplied separately from the signer.",
  },
];

export function listingClaimSummary(input: {
  chainId: string;
  contractAddress: string;
  name: string;
  purpose: string;
  category: string;
  sourceUrl: string;
  termsJson: string;
}): { identity: string; claimCount: number } {
  return {
    identity: `eip155:${input.chainId}:${input.contractAddress.toLowerCase()}`,
    claimCount: 5,
  };
}
