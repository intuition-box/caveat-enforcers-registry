import { PROPOSED_ONTOLOGY_MANIFEST } from "../src/ontology.js";
import type { ClaimFirstSubmissionInput } from "../src/validation.js";

export type ClaimTemplateKey =
  | "type"
  | "chain"
  | "source"
  | "purpose"
  | "terms"
  | "restriction"
  | "operation"
  | "author"
  | "deployer"
  | "audit"
  | "usage"
  | "composability"
  | "custom";

export type ClaimTemplate = {
  key: ClaimTemplateKey;
  label: string;
  description: string;
  predicateLabel: string;
  predicateId?: string;
  editor: "text" | "url" | "address" | "enforcer" | "terms";
  required: false;
};

const predicate = PROPOSED_ONTOLOGY_MANIFEST.predicates;

export const CLAIM_TEMPLATES: readonly ClaimTemplate[] = [
  {
    key: "type",
    label: "Enforcer type",
    description: "Name the chain-independent implementation.",
    predicateLabel: "implements",
    predicateId: predicate.implements,
    editor: "text",
    required: false,
  },
  {
    key: "chain",
    label: "Available on a chain",
    description: "Record another verified deployment context.",
    predicateLabel: "deployed on",
    predicateId: predicate.deployedOn,
    editor: "text",
    required: false,
  },
  {
    key: "source",
    label: "Source release",
    description: "Point to a repository or verified release.",
    predicateLabel: "source at",
    predicateId: predicate.sourceAt,
    editor: "url",
    required: false,
  },
  {
    key: "purpose",
    label: "Plain-language purpose",
    description: "Describe the boundary this enforcer expresses.",
    predicateLabel: "described by",
    predicateId: predicate.describedBy,
    editor: "text",
    required: false,
  },
  {
    key: "terms",
    label: "Terms schema",
    description: "Describe how encoded terms are interpreted.",
    predicateLabel: "has terms schema",
    predicateId: predicate.hasTermsSchema,
    editor: "terms",
    required: false,
  },
  {
    key: "restriction",
    label: "Restriction",
    description: "Name the rule family this enforcer constrains.",
    predicateLabel: "restricts",
    predicateId: predicate.restricts,
    editor: "text",
    required: false,
  },
  {
    key: "operation",
    label: "Affected operation",
    description: "Name the delegated action affected by the rule.",
    predicateLabel: "affects operation",
    predicateId: predicate.affectsOperation,
    editor: "text",
    required: false,
  },
  {
    key: "author",
    label: "Authored by",
    description: "Add authorship only when you can support it.",
    predicateLabel: "authored by",
    editor: "address",
    required: false,
  },
  {
    key: "deployer",
    label: "Deployed by",
    description: "Add deployment provenance independently from the signer.",
    predicateLabel: "deployed by",
    editor: "address",
    required: false,
  },
  {
    key: "audit",
    label: "Audit evidence",
    description: "Point to a specific audit or review.",
    predicateLabel: "covered by audit",
    predicateId: predicate.coveredByAudit,
    editor: "url",
    required: false,
  },
  {
    key: "usage",
    label: "Usage context",
    description: "Name a concrete context where this boundary is used.",
    predicateLabel: "used by",
    predicateId: predicate.usedBy,
    editor: "text",
    required: false,
  },
  {
    key: "composability",
    label: "Works with another enforcer",
    description: "Link an explicit composability relationship.",
    predicateLabel: "complements",
    predicateId: predicate.complements,
    editor: "enforcer",
    required: false,
  },
  {
    key: "custom",
    label: "Another claim",
    description: "Create a readable public predicate and object.",
    predicateLabel: "",
    editor: "text",
    required: false,
  },
];

export type WizardIdentity = {
  chainId: string;
  contractAddress: string;
  displayName?: string;
};

export type WizardClaim = {
  id: number;
  templateKey: ClaimTemplateKey;
  predicateLabel: string;
  predicateId?: string;
  objectValue: string;
  objectTermId?: string;
  objectLabel?: string;
  subjectTermId?: string;
  subjectLabel?: string;
};

export type SubmitWizardState = {
  panel:
    | "identity"
    | "claim-choice"
    | "claim-details"
    | "claim-confirm"
    | "claim-saved"
    | "review";
  identity: WizardIdentity | null;
  claims: WizardClaim[];
  draft: WizardClaim | null;
  editingId: number | null;
  nextId: number;
};

export type SubmitWizardAction =
  | { type: "identity-verified"; identity: WizardIdentity }
  | { type: "edit-identity" }
  | { type: "choose-predicate"; templateKey: ClaimTemplateKey }
  | { type: "update-draft"; patch: Partial<WizardClaim> }
  | { type: "preview-claim" }
  | { type: "confirm-claim" }
  | { type: "add-another" }
  | { type: "review" }
  | { type: "edit-claim"; id: number }
  | { type: "remove-claim"; id: number }
  | { type: "back" }
  | { type: "replace-claims"; claims: WizardClaim[] };

export function initialSubmitWizardState(
  identity?: WizardIdentity,
): SubmitWizardState {
  return {
    panel: identity ? "claim-choice" : "identity",
    identity: identity ?? null,
    claims: [],
    draft: null,
    editingId: null,
    nextId: 1,
  };
}

export function submitWizardReducer(
  state: SubmitWizardState,
  action: SubmitWizardAction,
): SubmitWizardState {
  switch (action.type) {
    case "identity-verified":
      return { ...state, identity: action.identity, panel: "claim-choice" };
    case "edit-identity":
      return { ...state, panel: "identity" };
    case "choose-predicate": {
      const template = CLAIM_TEMPLATES.find(
        (item) => item.key === action.templateKey,
      )!;
      return {
        ...state,
        panel: "claim-details",
        editingId: null,
        draft: {
          id: state.nextId,
          templateKey: template.key,
          predicateLabel: template.predicateLabel,
          ...(template.predicateId
            ? { predicateId: template.predicateId }
            : {}),
          objectValue: "",
        },
      };
    }
    case "update-draft":
      return state.draft
        ? { ...state, draft: { ...state.draft, ...action.patch } }
        : state;
    case "preview-claim":
      return state.draft ? { ...state, panel: "claim-confirm" } : state;
    case "confirm-claim": {
      if (!state.draft) return state;
      const claims =
        state.editingId === null
          ? [...state.claims, state.draft]
          : state.claims.map((claim) =>
              claim.id === state.editingId ? state.draft! : claim,
            );
      return {
        ...state,
        panel: "claim-saved",
        claims,
        nextId: Math.max(state.nextId, state.draft.id + 1),
        draft: null,
        editingId: null,
      };
    }
    case "add-another":
      return { ...state, panel: "claim-choice", draft: null, editingId: null };
    case "review":
      return state.claims.length
        ? { ...state, panel: "review", draft: null, editingId: null }
        : state;
    case "edit-claim": {
      const claim = state.claims.find((item) => item.id === action.id);
      return claim
        ? {
            ...state,
            panel: "claim-details",
            draft: { ...claim },
            editingId: claim.id,
          }
        : state;
    }
    case "remove-claim":
      return {
        ...state,
        claims: state.claims.filter((claim) => claim.id !== action.id),
        panel: state.claims.length === 1 ? "claim-choice" : state.panel,
      };
    case "back": {
      if (state.panel === "claim-confirm")
        return { ...state, panel: "claim-details" };
      if (state.panel === "claim-details")
        return {
          ...state,
          panel: "claim-choice",
          draft: null,
          editingId: null,
        };
      if (state.panel === "review") return { ...state, panel: "claim-saved" };
      return state;
    }
    case "replace-claims":
      return {
        ...state,
        claims: action.claims,
        panel: action.claims.length ? "claim-saved" : "claim-choice",
        nextId: action.claims.length + 1,
      };
  }
}

export function claimFirstInputFromWizard(
  state: SubmitWizardState,
  submitterWallet: string,
): ClaimFirstSubmissionInput {
  if (!state.identity) throw new Error("Verify the enforcer identity first.");
  if (!state.claims.length)
    throw new Error("Add at least one claim before review.");
  return {
    version: "2",
    identity: state.identity,
    claims: state.claims.map((claim) => ({
      subject: claim.subjectTermId
        ? {
            kind: "term" as const,
            termId: claim.subjectTermId,
            ...(claim.subjectLabel ? { label: claim.subjectLabel } : {}),
          }
        : { kind: "deployment" as const },
      predicate: claim.predicateId
        ? {
            kind: "term" as const,
            termId: claim.predicateId,
            label: claim.predicateLabel,
          }
        : { kind: "value" as const, value: claim.predicateLabel },
      object: claim.objectTermId
        ? {
            kind: "term" as const,
            termId: claim.objectTermId,
            ...(claim.objectLabel ? { label: claim.objectLabel } : {}),
          }
        : { kind: "value" as const, value: claim.objectValue },
    })),
    submitterWallet,
    initialSignal: "0",
  };
}

export function legacySubmissionClaims(
  input: Record<string, unknown>,
): WizardClaim[] {
  const claims: WizardClaim[] = [];
  const push = (templateKey: ClaimTemplateKey, value: unknown) => {
    if (value === undefined || value === null || value === "") return;
    const template = CLAIM_TEMPLATES.find((item) => item.key === templateKey)!;
    claims.push({
      id: claims.length + 1,
      templateKey,
      predicateLabel: template.predicateLabel,
      ...(template.predicateId ? { predicateId: template.predicateId } : {}),
      objectValue: typeof value === "string" ? value : JSON.stringify(value),
    });
  };
  push("type", input.enforcerName ?? input.type);
  push("purpose", input.description);
  push("source", input.sourceUrl);
  push("restriction", input.restrictionDomain);
  push("operation", input.operation);
  push("terms", input.termsSchema);
  if (Array.isArray(input.additionalClaims)) {
    for (const item of input.additionalClaims) {
      if (!item || typeof item !== "object") continue;
      const claim = item as Record<string, unknown>;
      claims.push({
        id: claims.length + 1,
        templateKey: "custom",
        predicateLabel: String(claim.predicateLabel ?? "custom claim"),
        ...(typeof claim.predicateId === "string"
          ? { predicateId: claim.predicateId }
          : {}),
        objectValue: String(claim.object ?? ""),
      });
    }
  }
  return claims;
}
