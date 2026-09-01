import { useEffect, useReducer, useRef, useState } from "react";
import type { ClaimFirstSubmissionInput } from "../src/validation";
import {
  CLAIM_TEMPLATES,
  claimFirstInputFromWizard,
  initialSubmitWizardState,
  legacySubmissionClaims,
  submitWizardReducer,
  type ClaimTemplate,
  type WizardIdentity,
} from "./submit-wizard";

type SubmitListingWizardProps = {
  walletAddress?: string;
  busy: boolean;
  status: string | null;
  planReady: boolean;
  onVerifyIdentity(identity: WizardIdentity): Promise<void>;
  onPrepare(input: ClaimFirstSubmissionInput): Promise<void>;
  onApprove(): Promise<void>;
  onClosePlan(): void;
};

const chainOptions = [
  ["1155", "Intuition mainnet"],
  ["1", "Ethereum mainnet"],
  ["8453", "Base"],
  ["11155111", "Sepolia"],
] as const;

function templateFor(key: string): ClaimTemplate | undefined {
  return CLAIM_TEMPLATES.find((template) => template.key === key);
}

export default function SubmitListingWizard({
  walletAddress,
  busy,
  status,
  planReady,
  onVerifyIdentity,
  onPrepare,
  onApprove,
  onClosePlan,
}: SubmitListingWizardProps) {
  const [state, dispatch] = useReducer(
    submitWizardReducer,
    undefined,
    initialSubmitWizardState,
  );
  const [identity, setIdentity] = useState<WizardIdentity>({
    chainId: "1155",
    contractAddress: "",
    displayName: "",
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importNote, setImportNote] = useState<string | null>(null);
  const panelHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    panelHeading.current?.focus({ preventScroll: true });
  }, [state.panel]);

  async function verifyIdentity() {
    setLocalError(null);
    if (!/^\d+$/.test(identity.chainId)) {
      setLocalError("Choose a supported EIP-155 chain.");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(identity.contractAddress)) {
      setLocalError("Enter the deployed 20-byte contract address.");
      return;
    }
    try {
      await onVerifyIdentity(identity);
      dispatch({ type: "identity-verified", identity });
    } catch (error) {
      setLocalError(
        error instanceof Error
          ? error.message
          : "The deployment identity could not be verified.",
      );
    }
  }

  function importLegacyJson() {
    try {
      const parsed = JSON.parse(importText) as Record<string, unknown>;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error();
      }
      const chainId = String(parsed.chainId ?? "1155");
      const contractAddress = String(parsed.contractAddress ?? "");
      const displayName = String(
        parsed.enforcerName ?? parsed.displayName ?? "",
      );
      setIdentity({ chainId, contractAddress, displayName });
      const claims = legacySubmissionClaims(parsed);
      if (claims.length) dispatch({ type: "replace-claims", claims });
      setImportNote(
        `${claims.length} claim${claims.length === 1 ? "" : "s"} imported for review. Verify the identity before preparing a plan.`,
      );
    } catch {
      setImportNote(
        "That JSON is not a submission object. Check it and try again.",
      );
    }
  }

  const activeTemplate = state.draft
    ? templateFor(state.draft.templateKey)
    : undefined;
  const statement = state.draft
    ? `${state.identity?.displayName || "This deployment"} ${state.draft.predicateLabel} ${state.draft.objectLabel || state.draft.objectValue}`
    : "";

  return (
    <div className="submit-wizard">
      <nav className="submit-wizard__progress" aria-label="Submission progress">
        {(["Identity", "Claims", "Review"] as const).map((label, index) => {
          const active =
            (index === 0 && state.panel === "identity") ||
            (index === 1 && state.panel.startsWith("claim")) ||
            (index === 2 && state.panel === "review");
          return (
            <span key={label} aria-current={active ? "step" : undefined}>
              {label}
            </span>
          );
        })}
      </nav>

      {state.identity && state.panel !== "identity" && (
        <section
          className="submit-wizard__identity-summary"
          aria-label="Verified enforcer identity"
        >
          <div>
            <strong>{state.identity.displayName || "Unnamed enforcer"}</strong>
            <code>
              eip155:{state.identity.chainId}:{state.identity.contractAddress}
            </code>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "edit-identity" })}
          >
            Edit identity
          </button>
        </section>
      )}

      {state.claims.length > 0 && state.panel !== "identity" && (
        <section
          className="submit-wizard__ledger"
          aria-labelledby="claim-ledger-title"
        >
          <div className="submit-wizard__ledger-heading">
            <h3 id="claim-ledger-title">Your claims</h3>
            <span>{state.claims.length} selected</span>
          </div>
          <ol>
            {state.claims.map((claim, index) => (
              <li key={claim.id}>
                <div>
                  <span>{index + 1}</span>
                  <p>
                    <strong>{claim.predicateLabel}</strong>
                    {claim.objectLabel || claim.objectValue}
                  </p>
                </div>
                <div className="submit-wizard__claim-actions">
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({ type: "edit-claim", id: claim.id })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() =>
                      dispatch({
                        type: "move-claim",
                        id: claim.id,
                        direction: "up",
                      })
                    }
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    disabled={index === state.claims.length - 1}
                    onClick={() =>
                      dispatch({
                        type: "move-claim",
                        id: claim.id,
                        direction: "down",
                      })
                    }
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({ type: "remove-claim", id: claim.id })
                    }
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="submit-wizard__panel" aria-live="polite">
        {state.panel === "identity" && (
          <>
            <h2 ref={panelHeading} tabIndex={-1}>
              Verify the enforcer identity
            </h2>
            <p>
              Start with the deployed contract. The wallet that signs later
              remains a separate actor.
            </p>
            <div className="form__pair">
              <label>
                <span className="mono-label">Deployment chain</span>
                <select
                  value={identity.chainId}
                  onChange={(event) =>
                    setIdentity({ ...identity, chainId: event.target.value })
                  }
                >
                  {chainOptions.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label} · {id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mono-label">Display name · optional</span>
                <input
                  value={identity.displayName}
                  onChange={(event) =>
                    setIdentity({
                      ...identity,
                      displayName: event.target.value,
                    })
                  }
                  placeholder="AllowedTimeOfDayEnforcer"
                />
              </label>
            </div>
            <label>
              <span className="mono-label">Deployed contract address</span>
              <input
                value={identity.contractAddress}
                onChange={(event) =>
                  setIdentity({
                    ...identity,
                    contractAddress: event.target.value,
                  })
                }
                placeholder="0x…"
              />
            </label>
            <p className="form__hint">
              Caveat Registry checks deployed bytecode on the selected chain
              before continuing.
            </p>
            <details className="submit-wizard__import">
              <summary>Import existing submission JSON</summary>
              <textarea
                rows={5}
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder='Paste { "chainId": "1155", "contractAddress": "0x…" }'
              />
              <button type="button" onClick={importLegacyJson}>
                Import as editable claims
              </button>
              {importNote && <p role="status">{importNote}</p>}
            </details>
            {localError && (
              <p className="submit-wizard__error" role="alert">
                {localError}
              </p>
            )}
            <button
              className="cta cta--dark web3-action web3-action--primary"
              type="button"
              disabled={busy}
              onClick={() => void verifyIdentity()}
            >
              {busy ? "Checking deployment…" : "Verify identity"}{" "}
              <span aria-hidden="true">→</span>
            </button>
          </>
        )}

        {state.panel === "claim-choice" && (
          <>
            <h2 ref={panelHeading} tabIndex={-1}>
              Choose a claim
            </h2>
            <p>
              Add only what you intend to publish. None of these claims is
              required by the interface.
            </p>
            <div className="submit-wizard__templates">
              {CLAIM_TEMPLATES.map((template) => (
                <button
                  key={template.key}
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "choose-predicate",
                      templateKey: template.key,
                    })
                  }
                >
                  <strong>{template.label}</strong>
                  <span>{template.description}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {state.panel === "claim-details" && state.draft && (
          <>
            <h2 ref={panelHeading} tabIndex={-1}>
              {state.editingId
                ? "Edit claim"
                : `Complete: ${activeTemplate?.label}`}
            </h2>
            <p>
              The subject is this verified deployment. Complete the predicate
              and object below.
            </p>
            {state.draft.templateKey === "custom" && (
              <label>
                <span className="mono-label">Readable predicate</span>
                <input
                  value={state.draft.predicateLabel}
                  onChange={(event) =>
                    dispatch({
                      type: "update-draft",
                      patch: { predicateLabel: event.target.value },
                    })
                  }
                  placeholder="useful for"
                />
                <span className="form__hint">
                  This may create a new public predicate atom. You will see it
                  in the transaction plan.
                </span>
              </label>
            )}
            <label>
              <span className="mono-label">
                {activeTemplate?.editor === "url"
                  ? "Evidence URL"
                  : activeTemplate?.editor === "address"
                    ? "Address or identity"
                    : activeTemplate?.editor === "enforcer"
                      ? "Related enforcer"
                      : activeTemplate?.editor === "terms"
                        ? "Terms schema"
                        : "Claim object"}
              </span>
              {activeTemplate?.editor === "terms" ? (
                <textarea
                  rows={7}
                  value={state.draft.objectValue}
                  onChange={(event) =>
                    dispatch({
                      type: "update-draft",
                      patch: { objectValue: event.target.value },
                    })
                  }
                  placeholder="Describe the encoding or paste a readable JSON schema"
                />
              ) : (
                <input
                  type={activeTemplate?.editor === "url" ? "url" : "text"}
                  value={state.draft.objectValue}
                  onChange={(event) =>
                    dispatch({
                      type: "update-draft",
                      patch: { objectValue: event.target.value },
                    })
                  }
                  placeholder={
                    activeTemplate?.editor === "url"
                      ? "https://…"
                      : "Readable value"
                  }
                />
              )}
            </label>
            <div className="submit-wizard__actions">
              <button type="button" onClick={() => dispatch({ type: "back" })}>
                Back
              </button>
              <button
                className="cta cta--dark"
                type="button"
                disabled={
                  !state.draft.predicateLabel.trim() ||
                  !state.draft.objectValue.trim()
                }
                onClick={() => dispatch({ type: "preview-claim" })}
              >
                Continue <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        )}

        {state.panel === "claim-confirm" && state.draft && (
          <>
            <h2 ref={panelHeading} tabIndex={-1}>
              Confirm claim
            </h2>
            <p>Read the exact public statement before adding it.</p>
            <blockquote className="submit-wizard__statement">
              {statement}
            </blockquote>
            <div className="submit-wizard__actions">
              <button type="button" onClick={() => dispatch({ type: "back" })}>
                Back
              </button>
              <button
                className="cta cta--dark"
                type="button"
                onClick={() => dispatch({ type: "confirm-claim" })}
              >
                Confirm claim <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        )}

        {state.panel === "claim-saved" && (
          <>
            <h2 ref={panelHeading} tabIndex={-1}>
              Claim added
            </h2>
            <p>
              Add another statement or move to the exact transaction review.
            </p>
            <div className="submit-wizard__actions">
              <button
                className="cta cta--ghost"
                type="button"
                onClick={() => dispatch({ type: "add-another" })}
              >
                Add another claim
              </button>
              <button
                className="cta cta--dark"
                type="button"
                onClick={() => dispatch({ type: "review" })}
              >
                Review contribution <span aria-hidden="true">→</span>
              </button>
            </div>
          </>
        )}

        {state.panel === "review" && (
          <>
            <h2 ref={panelHeading} tabIndex={-1}>
              Review contribution
            </h2>
            <p>
              Registry infrastructure adds discoverability. Your claims below
              are the only semantic statements this contribution will publish.
            </p>
            <dl className="submit-wizard__review">
              <div>
                <dt>Registry infrastructure</dt>
                <dd>Deployment identity + membership</dd>
              </div>
              <div>
                <dt>Your claims</dt>
                <dd>
                  {state.claims.length} explicit statement
                  {state.claims.length === 1 ? "" : "s"}
                </dd>
              </div>
              <div>
                <dt>Signing actor</dt>
                <dd>{walletAddress || "Connect wallet before preparation"}</dd>
              </div>
            </dl>
            {status && (
              <p className="submit-wizard__status" role="status">
                {status}
              </p>
            )}
            <div className="submit-wizard__actions">
              <button
                type="button"
                onClick={() => {
                  onClosePlan();
                  dispatch({ type: "back" });
                }}
              >
                Back
              </button>
              {planReady ? (
                <button
                  className="cta cta--dark web3-action web3-action--primary"
                  type="button"
                  disabled={busy || !walletAddress}
                  onClick={() => void onApprove()}
                >
                  {busy ? "Waiting for wallet…" : "Approve writes"}{" "}
                  <span aria-hidden="true">→</span>
                </button>
              ) : (
                <button
                  className="cta cta--dark web3-action web3-action--primary"
                  type="button"
                  disabled={busy || !walletAddress}
                  onClick={() => {
                    if (!walletAddress) return;
                    void onPrepare(
                      claimFirstInputFromWizard(state, walletAddress),
                    );
                  }}
                >
                  {busy ? "Resolving plan…" : "Prepare transaction plan"}{" "}
                  <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
