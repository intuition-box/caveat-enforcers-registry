/**
 * Registry, Detail, Submit, Learn and Developers.
 *
 * Built as operational product surfaces: hairline record rows, restrained
 * controls, and dark and paper bands alternating down the page. Art comes
 * from the approved asset set and is placed on the surface it was rendered for.
 *
 * The reference collection is labelled as reference data. Live records replace
 * it once the reviewed ontology IDs are configured — the page never presents
 * reference rows as registry listings.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { formatEther, parseEther } from "viem";
import { createPortal } from "react-dom";
import { Link, useParams } from "react-router-dom";
import { registryDeploymentsQuery } from "../src/registry";
import {
  buildEnforcerDisplayNameMap,
  enforcerTypeDisplayName,
} from "../src/enforcer-display-name";
import { deriveEnforcerPresentation } from "../src/enforcer-presentation";
import referenceDocument from "../data/metamask-v1.3.0.json";
import composabilityDocument from "../data/composability-seed.json";
import composabilityTriplesDocument from "../data/composability-seed.triples.json";
import ComposabilityGraph from "./ComposabilityGraph";
import EnforcerRadialGraph from "./EnforcerRadialGraph";
import BrowserFrame from "./BrowserFrame";
import {
  fetchRegistry,
  fetchComposability,
  fetchRegistryDetail,
  type RegistryApiState,
  type RegistryDetailResponse,
} from "./api";
import {
  buildCurationEnforcerOptions,
  curationClaimLabel,
} from "./curation-options";
import {
  curateWithBrowserWallet,
  previewCurationWithBrowserWallet,
  previewWithBrowserWallet,
  submitWithBrowserWallet,
  type BrowserWallet,
} from "./wallet";
import {
  CaveatConnectButton,
  CaveatWalletProvider,
  useCaveatWallet,
} from "./CaveatWallet";
import {
  validateSubmission as validateSubmissionLocally,
  type SubmissionAdditionalClaim,
  type SubmissionInput,
} from "../src/validation";
import { PROPOSED_ONTOLOGY_MANIFEST } from "../src/ontology";
import type {
  CurationAction,
  CurationExecution,
  CurationInput,
  CurationPlan,
} from "../src/curation";
import type { Claim, RegistrySignal } from "../src/types";
import type { ComposabilityClaim } from "../src/composability";
import type { ResolvedSubmission } from "../src/backend";
import type { SubmissionWriteOptions } from "../src/write-workflow";
import {
  submissionOutcomeFromResult,
  type SubmissionOutcome,
} from "./submission-outcome";
import { CaveatMarkSvg } from "./CaveatMark";
import IntuitionLogo from "./IntuitionLogo";
import { claimDistribution, intuitionClaimUrl } from "./claim-presentation";
import { chainDisplayName, chainOptionLabel } from "./chain-presentation";
import {
  LISTING_CLAIM_TEMPLATES,
  listingClaimSummary,
} from "./contribution-presentation";

/* ---------------------------------------------------------------- primitives */

type PillTone = "plain" | "observed" | "review";

type Web3Notice = {
  tone: "progress" | "success" | "error";
  title: string;
  message: string;
  transactionHash?: string;
};

function curationNotice(
  action: CurationAction,
  result: CurationExecution,
  amountTrust: string,
): Web3Notice {
  const actionLabel = action === "support" ? "Support" : "Dispute";
  const transactionHash =
    "transactionHash" in result && result.transactionHash
      ? result.transactionHash
      : undefined;

  if (result.status === "confirmed") {
    return {
      tone: "success",
      title: `${actionLabel} added`,
      message: `${amountTrust} TRUST was confirmed on Intuition mainnet and added to the ${action === "support" ? "supporting" : "opposition"} vault.`,
      transactionHash,
    };
  }
  if (result.status === "submitted" || result.status === "pending") {
    return {
      tone: "progress",
      title: `${actionLabel} submitted`,
      message: `${result.message} Keep this page open while the network confirms it.`,
      transactionHash,
    };
  }
  return {
    tone: "error",
    title: `${actionLabel} was not added`,
    message: result.message,
    transactionHash,
  };
}

function Web3NoticeToast({
  notice,
  onDismiss,
}: {
  notice: Web3Notice | null;
  onDismiss: () => void;
}) {
  if (!notice) return null;

  return (
    <aside
      className={`web3-toast web3-toast--${notice.tone}`}
      role={notice.tone === "error" ? "alert" : "status"}
      aria-live={notice.tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <div className="web3-toast__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          {notice.tone === "success" ? (
            <path d="m5 12.5 4.2 4.2L19 7" />
          ) : notice.tone === "progress" ? (
            <>
              <path d="M19 8a8 8 0 1 0 .4 7" />
              <path d="M19 4v4h-4" />
            </>
          ) : (
            <>
              <path d="M12 6v7" />
              <path d="M12 17.5v.5" />
            </>
          )}
        </svg>
      </div>
      <div className="web3-toast__content">
        <span className="mono-sub">
          {notice.tone === "success"
            ? "Intuition mainnet · confirmed"
            : notice.tone === "progress"
              ? "Intuition mainnet · pending"
              : "Transaction update"}
        </span>
        <strong>{notice.title}</strong>
        <p>{notice.message}</p>
        {notice.transactionHash && (
          <a
            href={`https://explorer.intuition.systems/tx/${notice.transactionHash}`}
            target="_blank"
            rel="noreferrer"
          >
            View transaction ↗
          </a>
        )}
      </div>
      <button
        className="web3-toast__dismiss"
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss transaction update"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m7 7 10 10M17 7 7 17" />
        </svg>
      </button>
    </aside>
  );
}

function Pill({
  children,
  tone = "plain",
}: {
  children: React.ReactNode;
  tone?: PillTone;
}) {
  return (
    <span className={`pill pill--${tone}`}>
      {tone !== "plain" && <i aria-hidden="true" />}
      {children}
    </span>
  );
}

function Spec({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="spec">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------ reference data */

type Reference = {
  id: string;
  slug: string;
  name: string;
  canonicalName: string;
  purpose: string;
  domain: string;
  operation: string;
  chain: string;
  state: "observed" | "review";
  address: string;
};

const REFERENCE_DISPLAY_NAMES = buildEnforcerDisplayNameMap(
  referenceDocument.enforcers.map((entry) => entry.name),
);

const PURPOSES: Record<string, [string, string]> = {
  AllowedCalldataEnforcer: [
    "Calldata shape",
    "Pins the calldata a delegation may pass.",
  ],
  AllowedMethodsEnforcer: [
    "Callable method",
    "Limits execution to approved function selectors.",
  ],
  AllowedTargetsEnforcer: [
    "Target address",
    "Restricts calls to approved contract addresses.",
  ],
  BlockNumberEnforcer: [
    "Block window",
    "Constrains execution to a block range.",
  ],
  DeployedEnforcer: [
    "Deployment proof",
    "Checks that an enforcer is deployed at a target address.",
  ],
  ERC20BalanceChangeEnforcer: [
    "Balance change",
    "Constrains the change in an ERC-20 balance.",
  ],
  ERC20TransferAmountEnforcer: [
    "Amount limit",
    "Limits cumulative ERC-20 transfer value.",
  ],
  ERC20PeriodTransferEnforcer: [
    "Periodic amount",
    "Limits ERC-20 transfers inside a recurring period.",
  ],
  ERC20StreamingEnforcer: [
    "Streaming amount",
    "Controls the rate of an ERC-20 stream.",
  ],
  ERC721BalanceChangeEnforcer: [
    "NFT balance",
    "Constrains ERC-721 balance changes.",
  ],
  ERC721TransferEnforcer: ["NFT transfer", "Constrains ERC-721 transfers."],
  ERC1155BalanceChangeEnforcer: [
    "Multi-token balance",
    "Constrains ERC-1155 balance changes.",
  ],
  ExactCalldataBatchEnforcer: [
    "Batch calldata",
    "Pins a batch of calldata values.",
  ],
  ExactCalldataEnforcer: [
    "Exact calldata",
    "Pins the calldata for an execution.",
  ],
  ExactExecutionBatchEnforcer: [
    "Batch execution",
    "Constrains a batch of exact executions.",
  ],
  ExactExecutionEnforcer: [
    "Exact execution",
    "Constrains the target, value, and calldata of an execution.",
  ],
  IdEnforcer: [
    "Delegation identity",
    "Binds a caveat to a specific delegation identity.",
  ],
  LogicalOrWrapperEnforcer: [
    "Alternative rule",
    "Allows one of several wrapped enforcers to pass.",
  ],
  LimitedCallsEnforcer: [
    "Call count",
    "Limits how many calls a delegation may make.",
  ],
  MultiTokenPeriodEnforcer: [
    "Periodic multi-token",
    "Limits multi-token movement inside a recurring period.",
  ],
  NativeBalanceChangeEnforcer: [
    "Native balance",
    "Constrains native-token balance changes.",
  ],
  ArgsEqualityCheckEnforcer: [
    "Argument equality",
    "Checks equality between call arguments.",
  ],
  NativeTokenPaymentEnforcer: [
    "Native payment",
    "Requires a native-token payment under the delegation.",
  ],
  NativeTokenTransferAmountEnforcer: [
    "Amount limit",
    "Caps native-token transfers.",
  ],
  NativeTokenStreamingEnforcer: [
    "Streaming amount",
    "Controls the rate of a native-token stream.",
  ],
  NativeTokenPeriodTransferEnforcer: [
    "Periodic amount",
    "Limits native-token transfers inside a recurring period.",
  ],
  NonceEnforcer: ["Nonce", "Constrains reuse of a delegation nonce."],
  OwnershipTransferEnforcer: [
    "Ownership",
    "Controls an ownership transfer path.",
  ],
  RedeemerEnforcer: ["Redeemer", "Restricts who may redeem a delegation."],
  SpecificActionERC20TransferBatchEnforcer: [
    "Specific action",
    "Constrains a specific ERC-20 transfer batch.",
  ],
  TimestampEnforcer: ["Time window", "Sets a valid time window for execution."],
  ValueLteEnforcer: [
    "Value limit",
    "Caps the native value attached to an execution.",
  ],
};

function slugify(name: string): string {
  return name
    .replace(/Enforcer$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

export const REFERENCE: Reference[] = referenceDocument.enforcers.map(
  (entry) => {
    const presentation = deriveEnforcerPresentation(entry.name);
    return {
      id: entry.address,
      slug: slugify(entry.name),
      name: REFERENCE_DISPLAY_NAMES.get(entry.name) ?? entry.name,
      canonicalName: entry.name,
      purpose: presentation.purpose,
      domain: presentation.domain,
      operation: presentation.operation,
      chain: "eip155:1155",
      state: entry.codeStatus === "observed" ? "observed" : "review",
      address: entry.address,
    };
  },
);

type RegistryRow = Reference & {
  live?: boolean;
  termId?: string;
  source?: string;
  terms?: string;
  audit?: string;
  claims?: Claim[];
  supportSignal?: RegistrySignal;
  oppositionSignal?: RegistrySignal;
  usage?: string[];
  createdAt?: string;
  transactionHash?: string;
  blockNumber?: string;
  classificationSource?: "indexed" | "derived";
};

const REFERENCE_CANONICAL_NAMES_BY_ADDRESS = new Map(
  REFERENCE.map((entry) => [entry.address.toLowerCase(), entry.canonicalName]),
);

function canonicalNameForIndexedEntry(
  entry: Extract<RegistryApiState, { kind: "ready" }>["entries"][number],
): string {
  if (entry.implementation) return entry.implementation;

  const address = /caip10:eip155:\d+:(0x[a-fA-F0-9]{40})/.exec(
    entry.label ?? "",
  )?.[1];
  return address
    ? (REFERENCE_CANONICAL_NAMES_BY_ADDRESS.get(address.toLowerCase()) ??
        entry.label)
    : entry.label;
}

function contractAddressForIndexedEntry(
  entry: Extract<RegistryApiState, { kind: "ready" }>["entries"][number],
): string {
  return (
    /caip10:eip155:\d+:(0x[a-fA-F0-9]{40})/.exec(entry.label ?? "")?.[1] ??
    "Address unavailable"
  );
}

function hasIndexedClassification(value: string, pending: string): boolean {
  return Boolean(value.trim()) && value !== pending;
}

function liveRow(
  entry: Extract<RegistryApiState, { kind: "ready" }>["entries"][number],
): RegistryRow {
  const canonicalName = canonicalNameForIndexedEntry(entry);
  const presentation = deriveEnforcerPresentation(canonicalName);
  const indexedDomain = hasIndexedClassification(entry.domain, "Unclassified");
  const indexedOperation = hasIndexedClassification(
    entry.operation,
    "Claim pending",
  );
  const genericDescription = entry.description.startsWith(
    "Onchain registry deployment",
  );
  return {
    id: entry.id,
    slug: entry.id,
    name: enforcerTypeDisplayName(canonicalName),
    canonicalName,
    purpose: genericDescription ? presentation.purpose : entry.description,
    domain: indexedDomain ? entry.domain : presentation.domain,
    operation: indexedOperation ? entry.operation : presentation.operation,
    chain: entry.chain,
    state: "observed",
    address: contractAddressForIndexedEntry(entry),
    live: true,
    termId: entry.id,
    source: entry.source,
    terms: entry.terms,
    audit: entry.audit,
    claims: entry.claims,
    supportSignal: entry.supportSignal,
    oppositionSignal: entry.oppositionSignal,
    usage: entry.usage,
    createdAt: entry.createdAt,
    transactionHash: entry.transactionHash,
    blockNumber: entry.blockNumber,
    classificationSource:
      indexedDomain && indexedOperation ? "indexed" : "derived",
  };
}

function externalUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function signalLabel(signal: RegistrySignal | undefined): string {
  if (!signal) return "No indexed signal";
  const positions = signal.positionCount
    ? ` · ${signal.positionCount} position${signal.positionCount === "1" ? "" : "s"}`
    : "";
  return `${formatTrustSignal(signal.value)}${positions}`;
}

function formatTrustSignal(value: string | undefined): string {
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

function hasAuditClaim(row: RegistryRow): boolean {
  const audit = row.audit?.trim().toLowerCase() ?? "";
  return Boolean(
    audit &&
    audit !== "no audit claim" &&
    audit !== "audit claim pending" &&
    audit !== "no audit evidence",
  );
}

type AuditEvidenceRecord = {
  auditor: string;
  reportUrl: string;
  sourceCommit: string;
  scope: string;
  qualification?: string;
};

function auditEvidenceRecord(
  value: string | undefined,
): AuditEvidenceRecord | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<AuditEvidenceRecord>;
    if (
      typeof parsed.auditor !== "string" ||
      typeof parsed.reportUrl !== "string" ||
      typeof parsed.sourceCommit !== "string" ||
      typeof parsed.scope !== "string" ||
      !externalUrl(parsed.reportUrl)
    ) {
      return null;
    }
    return parsed as AuditEvidenceRecord;
  } catch {
    return null;
  }
}

function signalValue(row: RegistryRow): bigint {
  const value = row.supportSignal?.value;
  return value && /^\d+$/.test(value) ? BigInt(value) : 0n;
}

function formattedTermsSchema(value: string | undefined): string {
  if (!value) return "No terms schema claim";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function ClaimDistributionBar({ claim }: { claim: Claim }) {
  const distribution = claimDistribution(claim.stake, claim.oppositionStake);
  return (
    <div className="claim-distribution">
      <div className="claim-distribution__labels">
        <span>
          {distribution.hasSignal
            ? `${distribution.supportPercent}% support`
            : "No positions yet"}
        </span>
        {distribution.hasSignal && (
          <span>{distribution.oppositionPercent}% oppose</span>
        )}
      </div>
      <div
        className="claim-distribution__track"
        role="img"
        aria-label={
          distribution.hasSignal
            ? `TRUST distribution: ${distribution.supportPercent}% support and ${distribution.oppositionPercent}% oppose`
            : "No TRUST positions on this claim yet"
        }
      >
        <span
          className="claim-distribution__support"
          style={{ width: `${distribution.supportPercent}%` }}
        />
      </div>
      <span className="claim-distribution__basis">
        TRUST-weighted positions
      </span>
    </div>
  );
}

function RegistryDetailDrawer({
  row,
  onClose,
}: {
  row: RegistryRow;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const { wallet, error: walletError } = useCaveatWallet();
  const [selection, setSelection] = useState<{
    claim: Claim;
    action: CurationAction;
  } | null>(null);
  const [amountTrust, setAmountTrust] = useState("0.1");
  const [signalPlan, setSignalPlan] = useState<
    Extract<CurationPlan, { status: "ready" }> | undefined
  >();
  const [signalResult, setSignalResult] = useState<CurationExecution | null>(
    null,
  );
  const [signalStatus, setSignalStatus] = useState<string | null>(null);
  const [signalBusy, setSignalBusy] = useState(false);
  const [web3Notice, setWeb3Notice] = useState<Web3Notice | null>(null);

  useEffect(() => {
    setSignalPlan(undefined);
    setSignalResult(null);
  }, [wallet?.address]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      openerRef.current?.focus();
    };
  }, []);

  const sourceUrl = externalUrl(row.source);
  const auditEvidence = auditEvidenceRecord(row.audit);
  const claims = row.claims ?? [];

  function signalInput(activeWallet: BrowserWallet): CurationInput {
    if (!selection?.claim.id)
      throw new Error("This claim has no Intuition ID.");
    let amount: bigint;
    try {
      amount = parseEther(amountTrust.trim());
    } catch {
      throw new Error("Enter a valid positive TRUST amount.");
    }
    if (amount <= 0n)
      throw new Error("Deposit amount must be greater than zero.");
    return {
      claimId: selection.claim.id,
      action: selection.action,
      receiver: activeWallet.address,
      amount: amount.toString(),
      curveId: "1",
    };
  }

  function selectSignal(claim: Claim, action: CurationAction) {
    setSelection({ claim, action });
    setSignalPlan(undefined);
    setSignalResult(null);
    setSignalStatus(null);
  }

  async function previewSignal() {
    if (!selection || signalBusy) return;
    if (!wallet) {
      setSignalStatus(
        walletError ??
          "Connect a wallet on Intuition mainnet to review this deposit.",
      );
      return;
    }
    setSignalBusy(true);
    setSignalStatus("Verifying the claim and resolving its target vault…");
    try {
      const result = await previewCurationWithBrowserWallet(
        signalInput(wallet),
        wallet,
      );
      if (result.status !== "ready") {
        setSignalPlan(undefined);
        setSignalStatus(result.message);
        return;
      }
      setSignalPlan(result);
      setSignalStatus(
        "Plan verified. Review the claim, target vault, and amount before opening your wallet.",
      );
    } catch (error) {
      setSignalStatus(
        error instanceof Error
          ? error.message
          : "The signal plan could not be prepared.",
      );
    } finally {
      setSignalBusy(false);
    }
  }

  async function approveSignal() {
    if (!selection || !wallet || !signalPlan || signalBusy) return;
    setSignalBusy(true);
    setSignalStatus("Simulating the exact deposit before the wallet prompt…");
    setWeb3Notice({
      tone: "progress",
      title: "Confirm in your wallet",
      message:
        "The exact TRUST deposit is being simulated before the approval prompt opens.",
    });
    try {
      const result = await curateWithBrowserWallet(signalInput(wallet), wallet);
      setSignalResult(result);
      setWeb3Notice(
        curationNotice(selection.action, result, amountTrust.trim()),
      );
      setSignalStatus(
        "message" in result
          ? result.message
          : "The signal deposit did not complete.",
      );
      if (result.status === "confirmed") setSignalPlan(undefined);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The signal deposit failed.";
      setSignalStatus(message);
      setWeb3Notice({
        tone: "error",
        title: `${selection.action === "support" ? "Support" : "Dispute"} was not added`,
        message,
      });
    } finally {
      setSignalBusy(false);
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className="registry-drawer"
      aria-labelledby="registry-drawer-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article className="registry-drawer__panel">
        <header className="registry-drawer__header">
          <div>
            <span className="mono-sub">Enforcer record</span>
            <h2 id="registry-drawer-title">{row.name}</h2>
          </div>
          <button type="button" onClick={onClose} autoFocus>
            Close
          </button>
        </header>

        <div className="registry-drawer__body">
          <p className="registry-drawer__purpose">{row.purpose}</p>
          <div className="pill-row">
            <Pill>{row.domain}</Pill>
            <Pill>{row.operation}</Pill>
            <Pill tone={row.state}>
              {row.state === "observed" ? "Observed" : "Review"}
            </Pill>
          </div>

          <Spec
            rows={[
              ["Canonical type", row.canonicalName],
              ["Chain", chainOptionLabel(row.chain)],
              ["Contract address", <code>{row.address}</code>],
              ...(row.termId
                ? ([["Intuition term ID", <code>{row.termId}</code>]] as Array<
                    [string, React.ReactNode]
                  >)
                : []),
              ["Source family", "MetaMask Delegation Framework"],
              [
                "Registry source",
                row.live ? "Intuition index" : "Reference collection",
              ],
            ]}
          />

          <section className="registry-drawer__section">
            <div className="registry-drawer__section-heading">
              <span className="mono-sub">Evidence</span>
              <h3>Keep every signal separate.</h3>
            </div>
            <Spec
              rows={[
                [
                  "Source",
                  sourceUrl ? (
                    <a href={sourceUrl} target="_blank" rel="noreferrer">
                      {row.source}
                    </a>
                  ) : (
                    row.source || "No source claim"
                  ),
                ],
                ["Supporting signal", signalLabel(row.supportSignal)],
                ["Opposition signal", signalLabel(row.oppositionSignal)],
                [
                  "Audit evidence",
                  auditEvidence ? (
                    <span>
                      <a
                        href={auditEvidence.reportUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {auditEvidence.auditor} · scoped report ↗
                      </a>
                      <br />
                      <small>
                        {auditEvidence.scope} ·{" "}
                        {auditEvidence.sourceCommit.slice(0, 12)}
                      </small>
                    </span>
                  ) : hasAuditClaim(row) ? (
                    row.audit
                  ) : (
                    "No exact audit claim"
                  ),
                ],
                [
                  "Known usage",
                  row.usage?.length ? row.usage.join(" · ") : "No usage claim",
                ],
                [
                  "Registry record",
                  row.transactionHash ? (
                    <a
                      href={`https://explorer.intuition.systems/tx/${row.transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Block {row.blockNumber ?? "confirmed"} ↗
                    </a>
                  ) : (
                    "Transaction unavailable"
                  ),
                ],
              ]}
            />
            <details className="terms-schema" open>
              <summary>Terms encoding / ABI schema</summary>
              <pre>{formattedTermsSchema(row.terms)}</pre>
            </details>
          </section>

          <section className="registry-drawer__section">
            <div className="registry-drawer__section-heading">
              <span className="mono-sub">Claim ledger</span>
              <h3>{claims.length} indexed claims</h3>
            </div>
            {claims.length ? (
              <ol className="claim-ledger">
                {claims.map((claim, index) => (
                  <li key={claim.id ?? `${claim.predicate}-${index}`}>
                    <div className="claim-ledger__record">
                      <span className="claim-ledger__statement">
                        <strong>{claim.predicate}</strong>
                        <span>{claim.object}</span>
                      </span>
                      <span className="claim-ledger__signal">
                        {formatTrustSignal(claim.stake)} support
                        {claim.oppositionStake
                          ? ` · ${formatTrustSignal(claim.oppositionStake)} opposition`
                          : " · 0 TRUST opposition"}
                      </span>
                      <ClaimDistributionBar claim={claim} />
                    </div>
                    <div className="claim-ledger__actions">
                      <button
                        className="web3-choice web3-choice--support"
                        type="button"
                        disabled={!claim.id}
                        onClick={() => selectSignal(claim, "support")}
                      >
                        Support
                      </button>
                      <button
                        className="web3-choice web3-choice--oppose"
                        type="button"
                        disabled={!claim.id}
                        onClick={() => selectSignal(claim, "oppose")}
                      >
                        Dispute
                      </button>
                      {intuitionClaimUrl(claim.id) && (
                        <a
                          className="web3-choice web3-choice--portal"
                          href={intuitionClaimUrl(claim.id)!}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Intuition ↗
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="band__note">No hydrated claims are available.</p>
            )}
          </section>

          {selection && (
            <section className="claim-curation" aria-live="polite">
              <div className="registry-drawer__section-heading">
                <span className="mono-sub">
                  {selection.action === "support" ? "Support" : "Dispute"} claim
                </span>
                <h3>{selection.claim.predicate}</h3>
              </div>
              <p className="claim-curation__object">{selection.claim.object}</p>
              <label>
                <span className="mono-label">Deposit amount (TRUST)</span>
                <input
                  inputMode="decimal"
                  value={amountTrust}
                  onChange={(event) => {
                    setAmountTrust(event.target.value);
                    setSignalPlan(undefined);
                    setSignalResult(null);
                  }}
                  placeholder="0.1"
                />
              </label>
              <Spec
                rows={[
                  ["Claim ID", <code>{selection.claim.id}</code>],
                  ["Curve", "1"],
                  [
                    "Wallet",
                    wallet ? shortAddress(wallet.address) : "Connect to review",
                  ],
                  ...(signalPlan
                    ? ([
                        [
                          "Target vault",
                          <code>{signalPlan.targetTermId}</code>,
                        ],
                        [
                          "Deposit",
                          `${formatEther(BigInt(signalPlan.amount))} TRUST`,
                        ],
                      ] as Array<[string, React.ReactNode]>)
                    : []),
                ]}
              />
              <div className="claim-curation__actions">
                {wallet ? (
                  <button
                    className="web3-action web3-action--primary"
                    type="button"
                    onClick={previewSignal}
                    disabled={signalBusy}
                  >
                    {signalBusy ? "Checking…" : "Review deposit"}
                  </button>
                ) : (
                  <CaveatConnectButton compact disabled={signalBusy} />
                )}
                {signalPlan && (
                  <button
                    className="web3-action web3-action--primary"
                    type="button"
                    onClick={approveSignal}
                    disabled={signalBusy}
                  >
                    Approve{" "}
                    {selection.action === "support" ? "support" : "dispute"}
                  </button>
                )}
                <button
                  className="web3-action web3-action--quiet"
                  type="button"
                  onClick={() => {
                    setSelection(null);
                    setSignalPlan(undefined);
                    setSignalResult(null);
                    setSignalStatus(null);
                  }}
                >
                  Cancel
                </button>
              </div>
              {signalStatus && (
                <p className="claim-curation__status">{signalStatus}</p>
              )}
              {signalResult &&
                "transactionHash" in signalResult &&
                signalResult.transactionHash && (
                  <a
                    className="claim-curation__receipt"
                    href={`https://explorer.intuition.systems/tx/${signalResult.transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View confirmed transaction ↗
                  </a>
                )}
            </section>
          )}

          {row.classificationSource === "derived" && (
            <div className="registry-drawer__classification">
              <strong>Display classification</strong>
              <p>
                Constraint and operation labels are derived from the canonical
                implementation type for search and navigation. They are not
                persisted Intuition claims.
              </p>
            </div>
          )}

          <Web3NoticeToast
            notice={web3Notice}
            onDismiss={() => setWeb3Notice(null)}
          />

          <div className="registry-drawer__note">
            <strong>What this record means</strong>
            <p>
              This entry makes the deployment discoverable. It is evidence of a
              registry claim, not an approval, audit, or safety guarantee.
            </p>
          </div>
        </div>
      </article>
    </dialog>,
    document.body,
  );
}

/* -------------------------------------------------------------------- registry */

function RegistryPageContent() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [domain, setDomain] = useState("all");
  const [operation, setOperation] = useState("all");
  const [chain, setChain] = useState("all");
  const [audit, setAudit] = useState("all");
  const [minimumTrust, setMinimumTrust] = useState("0");
  const [sort, setSort] = useState("trust-desc");
  const [apiState, setApiState] = useState<RegistryApiState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState<RegistryRow | null>(null);
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetchRegistry({ signal: controller.signal })
      .then((state) => {
        if (!controller.signal.aborted) setApiState(state);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setApiState({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "The registry service could not be reached.",
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const showingLive = apiState?.kind === "ready";
  const referenceCount = REFERENCE.length;
  const allLiveRows = useMemo(
    () => (showingLive ? apiState.entries.map(liveRow) : []),
    [apiState, showingLive],
  );
  const showReferenceFallback = !showingLive;
  const graphRows = useMemo(() => {
    if (!showingLive) return REFERENCE;
    const byType = new Map<string, RegistryRow>();
    for (const row of allLiveRows) {
      const key = (row.canonicalName || row.name).toLowerCase();
      if (!byType.has(key)) byType.set(key, row);
    }
    return [...byType.values()];
  }, [allLiveRows, showingLive]);

  const matchesFilters = (row: RegistryRow): boolean => {
    const q = debouncedQuery.trim().toLowerCase();
    const minimumSignal = parseEther(minimumTrust);
    return (
      (domain === "all" || row.domain === domain) &&
      (operation === "all" || row.operation === operation) &&
      (chain === "all" || row.chain === chain) &&
      (audit === "all" ||
        (audit === "with-claim" ? hasAuditClaim(row) : !hasAuditClaim(row))) &&
      signalValue(row) >= minimumSignal &&
      (q === "" ||
        row.name.toLowerCase().includes(q) ||
        row.canonicalName.toLowerCase().includes(q) ||
        row.purpose.toLowerCase().includes(q) ||
        row.domain.toLowerCase().includes(q) ||
        row.operation.toLowerCase().includes(q) ||
        row.address.toLowerCase().includes(q) ||
        Boolean(row.source?.toLowerCase().includes(q)))
    );
  };

  const liveRows = allLiveRows.filter(matchesFilters);

  const domains = useMemo(
    () =>
      Array.from(
        new Set(
          showingLive && allLiveRows.length
            ? allLiveRows.map((entry) => entry.domain)
            : REFERENCE.map((r) => r.domain),
        ),
      ).sort(),
    [allLiveRows, showingLive],
  );

  const operations = useMemo(
    () =>
      Array.from(
        new Set(
          showingLive && allLiveRows.length
            ? allLiveRows.map((entry) => entry.operation)
            : REFERENCE.map((entry) => entry.operation),
        ),
      ).sort(),
    [allLiveRows, showingLive],
  );

  const chains = useMemo(
    () =>
      Array.from(
        new Set(
          showingLive && allLiveRows.length
            ? allLiveRows
                .map((entry) => entry.chain)
                .filter((value) => /^eip155:\d+$/.test(value))
            : REFERENCE.map((entry) => entry.chain),
        ),
      ).sort((left, right) =>
        chainDisplayName(left).localeCompare(chainDisplayName(right)),
      ),
    [allLiveRows, showingLive],
  );

  const referenceRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const minimumSignal = parseEther(minimumTrust);
    return REFERENCE.filter(
      (r) =>
        (domain === "all" || r.domain === domain) &&
        (operation === "all" || r.operation === operation) &&
        (chain === "all" || r.chain === chain) &&
        (audit === "all" || audit === "without-claim") &&
        signalValue(r) >= minimumSignal &&
        (q === "" ||
          r.name.toLowerCase().includes(q) ||
          r.canonicalName.toLowerCase().includes(q) ||
          r.purpose.toLowerCase().includes(q) ||
          r.domain.toLowerCase().includes(q) ||
          r.operation.toLowerCase().includes(q) ||
          r.address.toLowerCase().includes(q)),
    );
  }, [query, domain, operation, chain, audit, minimumTrust]);
  const unsortedRows: RegistryRow[] = showReferenceFallback
    ? referenceRows
    : liveRows;
  const rows = [...unsortedRows].sort((left, right) => {
    if (sort === "name") return left.name.localeCompare(right.name);
    if (sort === "newest")
      return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
    const leftSignal = signalValue(left);
    const rightSignal = signalValue(right);
    if (leftSignal === rightSignal) return left.name.localeCompare(right.name);
    return sort === "trust-asc"
      ? leftSignal < rightSignal
        ? -1
        : 1
      : leftSignal > rightSignal
        ? -1
        : 1;
  });

  const statusLabel = loading
    ? "Connecting to registry service"
    : allLiveRows.length
      ? "Live enforcers · Intuition"
      : showingLive
        ? "Reference collection · no indexed entries"
        : "Reference collection · read only";

  return (
    <main>
      <section className="route-hero route-hero--visual route-hero--registry scroll-reveal">
        <div className="route-hero__mark" aria-hidden="true">
          <CaveatMarkSvg />
        </div>
        <div className="route-hero__copy">
          <h1 className="display">Registry</h1>
          <p className="lede">
            Search caveat enforcers by purpose, constraint, chain, or deployment
            evidence.
          </p>
        </div>
      </section>

      <section className="route-section route-section--paper registry-workspace scroll-reveal">
        <div className="route-section__intro">
          <div>
            <h2 className="headline">
              Start with the rule, then inspect the record.
            </h2>
          </div>
          <p className="lede">
            Membership makes an enforcer discoverable. It does not turn a
            deployment into a safety badge.
          </p>
        </div>
        <div className="filters">
          <label>
            <span className="mono-label">Search enforcers</span>
            <input
              type="search"
              value={query}
              placeholder="Name, purpose, source, or address"
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            <span className="mono-label">Constraint</span>
            <select value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value="all">All constraints</option>
              {domains.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mono-label">Chain</span>
            <select value={chain} onChange={(e) => setChain(e.target.value)}>
              <option value="all">All chains</option>
              {chains.map((value) => (
                <option key={value} value={value}>
                  {chainOptionLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mono-label">Operation</span>
            <select
              value={operation}
              onChange={(event) => setOperation(event.target.value)}
            >
              <option value="all">All operations</option>
              {operations.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="mono-label">Audit evidence</span>
            <select
              value={audit}
              onChange={(event) => setAudit(event.target.value)}
            >
              <option value="all">All audit states</option>
              <option value="with-claim">Audit claim present</option>
              <option value="without-claim">No audit claim</option>
            </select>
          </label>
          <label>
            <span className="mono-label">Minimum TRUST</span>
            <select
              value={minimumTrust}
              onChange={(event) => setMinimumTrust(event.target.value)}
            >
              <option value="0">Any signal</option>
              <option value="0.1">0.1 TRUST</option>
              <option value="1">1 TRUST</option>
              <option value="10">10 TRUST</option>
            </select>
          </label>
          <label>
            <span className="mono-label">Sort records</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="trust-desc">Highest TRUST</option>
              <option value="trust-asc">Lowest TRUST</option>
              <option value="newest">Newest claim</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>

        <div className="rail" role="status" aria-live="polite">
          <span className="mono-sub">{statusLabel}</span>
          <span className="mono-sub">
            {rows.length}{" "}
            {allLiveRows.length && !showReferenceFallback
              ? "indexed"
              : `of ${REFERENCE.length} reference`}{" "}
            shown
          </span>
        </div>

        <ul className="table">
          {rows.map((r) => (
            <li key={r.slug}>
              <button
                type="button"
                className="table__row-button"
                onClick={() =>
                  setExpandedSlug((active) =>
                    active === r.slug ? null : r.slug,
                  )
                }
                aria-expanded={expandedSlug === r.slug}
                aria-controls={`claims-${r.slug}`}
              >
                <span className="table__name">
                  <strong>{r.name}</strong>
                  <em>{r.purpose}</em>
                </span>
                <span className="table__domain">{r.domain}</span>
                <span className="table__chain">
                  {chainDisplayName(r.chain)}
                </span>
                <span className="table__trust">
                  {formatTrustSignal(r.supportSignal?.value)}
                </span>
                <Pill tone={hasAuditClaim(r) ? "observed" : "review"}>
                  {hasAuditClaim(r) ? "Audit claim" : "No audit claim"}
                </Pill>
                <span className="table__open" aria-hidden="true">
                  {expandedSlug === r.slug ? "Hide claims" : "Claims"}
                </span>
              </button>
              {expandedSlug === r.slug && (
                <section
                  id={`claims-${r.slug}`}
                  className="table__expanded registry-inline-ledger"
                  aria-label={`${r.name} claims and positions`}
                >
                  <header className="registry-inline-ledger__header">
                    <div>
                      <span className="mono-sub">Claims and positions</span>
                      <h3>
                        {r.claims?.length ?? 0} indexed claim
                        {(r.claims?.length ?? 0) === 1 ? "" : "s"}
                      </h3>
                    </div>
                    <button
                      type="button"
                      className="web3-action web3-action--quiet"
                      onClick={() => setSelectedRow(r)}
                    >
                      Open full record
                    </button>
                  </header>
                  {r.claims?.length ? (
                    <ol className="claim-ledger">
                      {r.claims.map((claim, index) => (
                        <li key={claim.id ?? `${claim.predicate}-${index}`}>
                          <div className="claim-ledger__record">
                            <span className="claim-ledger__statement">
                              <strong>{claim.predicate}</strong>
                              <span>{claim.object}</span>
                            </span>
                            <span className="claim-ledger__signal">
                              {formatTrustSignal(claim.stake)} support ·{" "}
                              {formatTrustSignal(claim.oppositionStake)}{" "}
                              opposition
                            </span>
                            <ClaimDistributionBar claim={claim} />
                          </div>
                          {intuitionClaimUrl(claim.id) ? (
                            <a
                              className="web3-choice web3-choice--portal"
                              href={intuitionClaimUrl(claim.id)!}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Intuition ↗
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="band__note">
                      This record has no hydrated claim ledger. Open the full
                      record to inspect the indexed deployment fields.
                    </p>
                  )}
                </section>
              )}
            </li>
          ))}
          {rows.length === 0 && (
            <li className="table__empty">
              {allLiveRows.length && !showReferenceFallback
                ? "No indexed membership claims match this view."
                : "The live service is unavailable, so no reference type matches that filter."}
            </li>
          )}
        </ul>

        <p className="band__note">
          {allLiveRows.length && !showReferenceFallback
            ? "Live rows come from the canonical Intuition membership query. Membership is a discoverability claim, not a safety guarantee."
            : apiState?.kind === "error"
              ? `Live registry unavailable: ${apiState.message} Showing the ${referenceCount}-entry MetaMask reference collection without presenting it as indexed data.`
              : showingLive
                ? `No indexed membership claims exist for this proposed ontology yet. The ${referenceCount}-entry MetaMask collection below remains reference data only.`
                : `The ${referenceCount}-entry MetaMask collection is reference data only. Start the local registry service to inspect indexed Intuition records.`}
        </p>
      </section>

      <section className="route-section route-section--ink registry-map scroll-reveal">
        <div className="route-section__intro">
          <div>
            <h2 className="headline">The whole registry at a glance.</h2>
          </div>
          <p className="lede">
            {showingLive
              ? `${allLiveRows.length} chain-qualified deployment records resolve to ${graphRows.length} ERC-7710 enforcer types. Every spoke remains linked to live Intuition membership evidence.`
              : `The reference map contains ${referenceCount} ERC-7710 enforcers linked to one deployment class. Live membership appears here when the registry service is available.`}
          </p>
        </div>
        <BrowserFrame
          title="Caveat Registry"
          label={
            showingLive
              ? `Live · ${chains.length} chain${chains.length === 1 ? "" : "s"}`
              : "Reference · Intuition mainnet"
          }
          tone="ink"
        >
          <EnforcerRadialGraph
            nodes={graphRows.map((entry) => ({
              name: entry.name,
              domain: entry.domain,
              address: entry.address,
              slug: entry.slug,
            }))}
            onSelect={(slug) => {
              const selected = graphRows.find((entry) => entry.slug === slug);
              if (selected) {
                setSelectedRow(selected);
                return;
              }
              const fallback = REFERENCE.find((entry) => entry.slug === slug);
              const indexed = fallback
                ? allLiveRows.find(
                    (entry) =>
                      entry.canonicalName === fallback.canonicalName ||
                      entry.address.toLowerCase() ===
                        fallback.address.toLowerCase(),
                  )
                : undefined;
              setSelectedRow(indexed ?? fallback ?? null);
            }}
          />
        </BrowserFrame>
      </section>

      {selectedRow && (
        <RegistryDetailDrawer
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </main>
  );
}

export function RegistryPage() {
  return (
    <CaveatWalletProvider>
      <RegistryPageContent />
    </CaveatWalletProvider>
  );
}

/* ---------------------------------------------------------------------- detail */

export function DetailPage() {
  const { slug } = useParams();
  const record = REFERENCE.find((r) => r.slug === slug);
  const [detailState, setDetailState] = useState<RegistryDetailResponse | null>(
    null,
  );

  useEffect(() => {
    if (!slug || record) return;
    const controller = new AbortController();
    void fetchRegistryDetail(slug, controller.signal)
      .then((state) => {
        if (!controller.signal.aborted) setDetailState(state);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDetailState({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "The deployment detail could not be reached.",
          });
        }
      });
    return () => controller.abort();
  }, [record, slug]);

  const summary =
    detailState?.kind === "ready" ? detailState.summary : undefined;
  const name =
    record?.name ??
    (summary?.implementation
      ? enforcerTypeDisplayName(summary.implementation)
      : undefined) ??
    (detailState?.kind === "ready" ? detailState.label : undefined) ??
    "Indexed deployment";
  const canonicalName =
    record?.canonicalName ?? summary?.implementation ?? "Type claim pending";
  const purpose =
    record?.purpose ??
    summary?.description ??
    "An indexed Intuition deployment.";
  const address = record?.address ?? slug ?? "Address unavailable";
  const domain = record?.domain ?? summary?.domain ?? "Claim pending";
  const state = record?.state ?? "observed";

  return (
    <main>
      <section className="route-hero route-hero--visual route-hero--detail scroll-reveal">
        <div className="route-hero__mark" aria-hidden="true">
          <CaveatMarkSvg />
        </div>
        <div className="route-hero__copy">
          <Link className="pill pill--back" to="/registry">
            ← Registry
          </Link>

          <div className="detail">
            <div>
              <h1 className="display">{name}</h1>
              <p className="lede">{purpose}</p>
              <div className="pill-row">
                <Pill>{domain}</Pill>
                <Pill>ERC-7710</Pill>
                <Pill tone={state}>
                  {record
                    ? state === "observed"
                      ? "Deployment observed"
                      : "Deployment missing"
                    : "Indexed membership"}
                </Pill>
              </div>
            </div>

            <Spec
              rows={[
                [
                  "Chain",
                  chainOptionLabel(
                    record?.chain ?? summary?.chain ?? "Chain claim pending",
                  ),
                ],
                ["Address", address],
                ["Canonical type", canonicalName],
                ["Source family", "MetaMask Delegation Framework"],
                [
                  "Registry state",
                  record
                    ? "Reference data"
                    : detailState?.kind === "ready"
                      ? "Indexed"
                      : "Loading",
                ],
              ]}
            />
          </div>
        </div>
      </section>

      <section className="route-section route-section--paper detail-workspace scroll-reveal">
        <div className="route-section__intro">
          <p className="route-kicker">Record anatomy</p>
          <p className="lede">
            Every field stays inspectable. The page can explain the rule without
            pretending the evidence is a verdict.
          </p>
        </div>
        <div className="two-col">
          <div>
            <h2 className="headline">What this rule controls.</h2>
            <Spec
              rows={[
                ["Actor", "Delegated smart account"],
                ["Action", "Contract call"],
                ["Boundary", "Only listed targets"],
                ["Failure", "Execution reverts"],
              ]}
            />
          </div>

          <div>
            <h2 className="headline">Trust stays inspectable.</h2>
            <EvidenceGraph />
            {!record && detailState?.kind === "error" && (
              <p className="band__note">{detailState.message}</p>
            )}
            {!record && detailState?.kind === "ready" && (
              <p className="band__note">
                {detailState.claims.length} indexed claims loaded. Support and
                opposition remain separate in the response.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

/** Source, chain and counter-signal held apart from the record itself. */
function EvidenceGraph() {
  return (
    <svg
      className="graph"
      viewBox="0 0 460 320"
      role="img"
      aria-label="The enforcer record linked to its source repository, chain deployment, and an open counter-signal."
    >
      <line x1="194.8" y1="143.6" x2="154.8" y2="113.6" />
      <line x1="266.2" y1="145" x2="314" y2="111.9" />
      <line
        className="graph__counter"
        x1="253.6"
        y1="207.1"
        x2="274.2"
        y2="239.5"
      />

      <circle className="graph__node" cx="110" cy="80" r="56" />
      <text x="110" y="74">
        Source
      </text>
      <text x="110" y="92">
        repository
      </text>

      <circle className="graph__node" cx="360" cy="80" r="56" />
      <text x="360" y="74">
        Chain
      </text>
      <text x="360" y="92">
        deployment
      </text>

      <circle
        className="graph__node graph__node--counter"
        cx="300"
        cy="280"
        r="48"
      />
      <text x="300" y="274">
        Counter
      </text>
      <text x="300" y="292">
        signal
      </text>

      <circle className="graph__core" cx="230" cy="170" r="44" />
      <text className="graph__core-label" x="230" y="176">
        Enforcer
      </text>
    </svg>
  );
}

/* ---------------------------------------------------------------------- submit */

type ContributionMode = "list" | "attest" | "counter";

type SubmissionReview = {
  input: SubmissionInput;
  resolved: Extract<ResolvedSubmission, { status: "ready" }>;
  write: SubmissionWriteOptions;
};

type AdditionalClaimDraft = SubmissionAdditionalClaim & { id: number };

const MODULAR_CLAIM_PREDICATES = [
  {
    key: "describedBy",
    label: "described by",
    subject: "type",
  },
  { key: "usedBy", label: "used by", subject: "deployment" },
  {
    key: "coveredByAudit",
    label: "covered by audit",
    subject: "deployment",
  },
  { key: "restricts", label: "restricts", subject: "type" },
  {
    key: "affectsOperation",
    label: "affects operation",
    subject: "type",
  },
  { key: "complements", label: "complements", subject: "type" },
  { key: "conflictsWith", label: "conflicts with", subject: "type" },
  { key: "redundantWith", label: "redundant with", subject: "type" },
  {
    key: "appliesInContext",
    label: "applies in context",
    subject: "term",
  },
  {
    key: "requiresOrdering",
    label: "requires ordering",
    subject: "term",
  },
  { key: "supportedBy", label: "supported by", subject: "term" },
] as const;

const CLAIM_PREDICATE_OPTIONS = MODULAR_CLAIM_PREDICATES.flatMap((option) => {
  const predicateId = PROPOSED_ONTOLOGY_MANIFEST.predicates[option.key];
  return predicateId ? [{ ...option, predicateId }] : [];
});

let claimDraftId = 0;

function additionalClaimDraft(
  option = CLAIM_PREDICATE_OPTIONS[1] ?? CLAIM_PREDICATE_OPTIONS[0],
): AdditionalClaimDraft {
  claimDraftId += 1;
  return {
    id: claimDraftId,
    subject: option?.subject ?? "deployment",
    predicateId: option?.predicateId ?? "",
    predicateLabel: option?.label ?? "",
    object: "",
  };
}

function additionalClaimFromTemplate(
  key: (typeof LISTING_CLAIM_TEMPLATES)[number]["key"],
): AdditionalClaimDraft {
  const predicateKey =
    key === "audit"
      ? "coveredByAudit"
      : key === "usage"
        ? "usedBy"
        : key === "composability"
          ? "complements"
          : undefined;
  const option = CLAIM_PREDICATE_OPTIONS.find(
    (candidate) => candidate.key === predicateKey,
  );
  const draft = additionalClaimDraft(option);
  if (option) return draft;
  const template = LISTING_CLAIM_TEMPLATES.find(
    (candidate) => candidate.key === key,
  );
  return {
    ...draft,
    predicateId: "",
    predicateLabel: template?.label.toLowerCase() ?? "",
  };
}

const DEFAULT_TERMS_SCHEMA = JSON.stringify(
  {
    schemaVersion: "1.0.0",
    enforcer: "ExampleEnforcer",
    source: {
      repository: "https://github.com/example/enforcer",
      commit: "main",
      path: "src/ExampleEnforcer.sol",
    },
    encoding: {
      kind: "raw",
      totalBytes: 1,
      fields: [{ name: "byte", type: "bytes1", offset: 0, bytes: 1 }],
    },
    malformedInputBehavior: "revert",
    fixtures: [{ terms: "0x00", decoded: { byte: "0x00" } }],
  },
  null,
  2,
);

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function SubmitPageContent() {
  const [mode, setMode] = useState<ContributionMode>("list");
  const [chainId, setChainId] = useState("1155");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("frequency");
  const [purpose, setPurpose] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceVersion, setSourceVersion] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [termsJson, setTermsJson] = useState(DEFAULT_TERMS_SCHEMA);
  const [additionalClaims, setAdditionalClaims] = useState<
    AdditionalClaimDraft[]
  >([]);
  const [claimId, setClaimId] = useState("");
  const [selectedDeploymentId, setSelectedDeploymentId] = useState("");
  const [amount, setAmount] = useState("0.1");
  const [curveId, setCurveId] = useState("1");
  const [curationRegistryState, setCurationRegistryState] =
    useState<RegistryApiState | null>(null);
  const [curationRegistryLoading, setCurationRegistryLoading] = useState(false);
  const [curationRegistryReload, setCurationRegistryReload] = useState(0);
  const [curationDetail, setCurationDetail] =
    useState<RegistryDetailResponse | null>(null);
  const [curationDetailLoading, setCurationDetailLoading] = useState(false);
  const [curationDetailReload, setCurationDetailReload] = useState(0);
  const {
    wallet,
    error: walletError,
    connected: walletConnected,
    onIntuition,
  } = useCaveatWallet();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importNote, setImportNote] = useState<string | null>(null);
  const [submissionReview, setSubmissionReview] =
    useState<SubmissionReview | null>(null);
  const [submissionOutcome, setSubmissionOutcome] =
    useState<SubmissionOutcome | null>(null);
  const [web3Notice, setWeb3Notice] = useState<Web3Notice | null>(null);
  const previousWalletAddress = useRef<string | null>(null);

  useEffect(() => {
    const nextAddress = wallet?.address ?? null;
    if (
      previousWalletAddress.current &&
      previousWalletAddress.current !== nextAddress
    ) {
      setSubmissionReview(null);
      setStatus(
        nextAddress
          ? "Wallet account changed. Prepare a fresh transaction plan."
          : "Wallet disconnected or changed network. Reconnect to continue.",
      );
    }
    previousWalletAddress.current = nextAddress;
  }, [wallet?.address]);

  useEffect(() => {
    setSubmissionReview(null);
  }, [
    mode,
    chainId,
    name,
    category,
    purpose,
    sourceUrl,
    sourceVersion,
    contractAddress,
    termsJson,
    additionalClaims,
  ]);

  useEffect(() => {
    if (mode === "list") return;
    const controller = new AbortController();
    setCurationRegistryLoading(true);
    void fetchRegistry({ signal: controller.signal })
      .then((state) => {
        if (!controller.signal.aborted) setCurationRegistryState(state);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setCurationRegistryState({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "The live enforcer list could not be loaded.",
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCurationRegistryLoading(false);
      });
    return () => controller.abort();
  }, [mode, curationRegistryReload]);

  useEffect(() => {
    setCurationDetail(null);
    if (mode === "list" || !selectedDeploymentId) return;
    const controller = new AbortController();
    setCurationDetailLoading(true);
    void fetchRegistryDetail(selectedDeploymentId, controller.signal)
      .then((detail) => {
        if (!controller.signal.aborted) setCurationDetail(detail);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setCurationDetail({
            kind: "error",
            message:
              error instanceof Error
                ? error.message
                : "The claims for this enforcer could not be loaded.",
          });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCurationDetailLoading(false);
      });
    return () => controller.abort();
  }, [mode, selectedDeploymentId, curationDetailReload]);

  function applyImportedJson() {
    const raw = importText.trim();
    if (!raw) {
      setImportNote("Paste a submission JSON first.");
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("not an object");
      }
      parsed = value as Record<string, unknown>;
    } catch {
      setImportNote("That is not valid submission JSON.");
      return;
    }

    const str = (value: unknown): string =>
      typeof value === "string" ? value : "";
    const filled: string[] = [];
    const set = (
      label: string,
      value: string,
      apply: (next: string) => void,
    ) => {
      if (value.trim()) {
        apply(value);
        filled.push(label);
      }
    };

    setMode("list");
    set("name", str(parsed.enforcerName) || str(parsed.type), setName);
    set("purpose", str(parsed.description), setPurpose);
    set("source URL", str(parsed.sourceUrl), setSourceUrl);
    set("source version", str(parsed.sourceVersion), setSourceVersion);
    set("contract address", str(parsed.contractAddress), setContractAddress);
    if (
      (typeof parsed.chainId === "string" ||
        typeof parsed.chainId === "number") &&
      /^\d+$/.test(String(parsed.chainId))
    ) {
      setChainId(String(parsed.chainId));
      filled.push("chain");
    }

    const domain = str(parsed.restrictionDomain).toLowerCase();
    const categoryKey = domain.includes("time")
      ? "time"
      : domain.includes("amount")
        ? "amount"
        : domain.includes("target")
          ? "target"
          : domain.includes("method")
            ? "method"
            : domain.includes("frequency") || domain.includes("period")
              ? "frequency"
              : "";
    set("category", categoryKey, setCategory);

    if (parsed.termsSchema && typeof parsed.termsSchema === "object") {
      setTermsJson(JSON.stringify(parsed.termsSchema, null, 2));
      filled.push("terms schema");
    }

    if (Array.isArray(parsed.additionalClaims)) {
      const importedClaims = parsed.additionalClaims.flatMap((claim) => {
        if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
          return [];
        }
        const value = claim as Record<string, unknown>;
        const subject = value.subject;
        if (
          subject !== "deployment" &&
          subject !== "type" &&
          subject !== "term"
        ) {
          return [];
        }
        claimDraftId += 1;
        return [
          {
            id: claimDraftId,
            subject,
            predicateId: str(value.predicateId),
            predicateLabel: str(value.predicateLabel),
            object: str(value.object),
            ...(subject === "term" ? { subjectId: str(value.subjectId) } : {}),
          } satisfies AdditionalClaimDraft,
        ];
      });
      if (importedClaims.length) {
        setAdditionalClaims(importedClaims);
        filled.push(`${importedClaims.length} additional claims`);
      }
    }

    setImportNote(
      filled.length
        ? `Filled ${filled.length} field${filled.length === 1 ? "" : "s"}: ${filled.join(", ")}. Review, connect your wallet, and sign.`
        : "No recognized fields were found in that JSON.",
    );
  }

  function buildSubmissionInput(activeWallet: BrowserWallet): SubmissionInput {
    let termsSchema: unknown;
    try {
      termsSchema = JSON.parse(termsJson);
    } catch {
      throw new Error("Terms schema must be valid JSON before submitting.");
    }
    return {
      chainId,
      contractAddress,
      enforcerName: name.trim() || contractAddress,
      description: purpose,
      type: name.trim() || contractAddress,
      restrictionDomain: category,
      operation: "Delegated contract call",
      sourceUrl,
      ...(sourceVersion.trim() ? { sourceVersion } : {}),
      termsSchema: termsSchema as SubmissionInput["termsSchema"],
      submitterWallet: activeWallet.address,
      initialSignal: "0",
      additionalClaims: additionalClaims.map(({ id: _id, ...claim }) => claim),
    };
  }

  function resolvedSubmissionMessage(result: ResolvedSubmission): string {
    if (result.status === "blocked") return result.message;
    if (result.status === "invalid") {
      return result.issues
        .slice(0, 3)
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ");
    }
    return `${result.batch.transactions.length} transaction${result.batch.transactions.length === 1 ? "" : "s"} resolved and ready for your review.`;
  }

  function contributionErrorMessage(error: unknown, fallback: string): string {
    const message = error instanceof Error ? error.message : "";
    if (/failed to fetch dynamically imported module/i.test(message)) {
      return "A newer version of Caveat Registry is available. Reload this page, reconnect your wallet, then prepare the transaction plan again.";
    }
    if (/rlp: non-canonical integer|DynamicFeeTx/i.test(message)) {
      return "Your wallet used an incompatible dynamic-fee transaction. Reload, reconnect, and prepare a fresh plan; Caveat Registry will use Intuition's compatible legacy fee mode.";
    }
    return message || fallback;
  }

  async function submitContribution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus(
      mode === "list"
        ? "Resolving and verifying the transaction plan…"
        : "Preparing a wallet-owned signal…",
    );
    if (mode !== "list") {
      setWeb3Notice({
        tone: "progress",
        title: "Confirm in your wallet",
        message: `Caveat Registry is verifying the claim before requesting your ${mode === "attest" ? "support" : "dispute"} deposit.`,
      });
    }
    try {
      if (!wallet) {
        throw new Error(
          walletError ??
            (walletConnected && !onIntuition
              ? "Switch your connected wallet to Intuition mainnet before continuing."
              : "Connect a wallet before preparing this contribution."),
        );
      }
      const activeWallet = wallet;

      if (mode === "list") {
        const input = buildSubmissionInput(activeWallet);
        const validation = validateSubmissionLocally(input);
        if (!validation.valid) {
          throw new Error(
            validation.issues
              .slice(0, 3)
              .map((issue) => `${issue.path}: ${issue.message}`)
              .join("; "),
          );
        }
        const preview = await previewWithBrowserWallet(input, activeWallet);
        const result = preview.result;
        setStatus(resolvedSubmissionMessage(result));
        if (result.status === "ready") {
          setSubmissionReview({
            input,
            resolved: result,
            write: preview.write ?? {},
          });
        }
        return;
      }

      if (!/^0x[a-fA-F0-9]{64}$/.test(claimId)) {
        throw new Error(
          "Choose an enforcer and one of its indexed claims before reviewing the signal.",
        );
      }
      let signalAmount: bigint;
      try {
        signalAmount = parseEther(amount.trim());
      } catch {
        throw new Error("Enter a valid positive TRUST amount.");
      }
      if (signalAmount <= 0n) {
        throw new Error("Deposit amount must be greater than zero.");
      }
      const curation: CurationInput = {
        claimId,
        action: mode === "attest" ? "support" : "oppose",
        receiver: activeWallet.address,
        amount: signalAmount.toString(),
        curveId,
      };
      const result = await curateWithBrowserWallet(curation, activeWallet);
      setStatus(result.message);
      setWeb3Notice(
        curationNotice(
          curation.action,
          result,
          formatEther(BigInt(curation.amount)),
        ),
      );
      if (result.status === "confirmed") {
        setCurationDetailReload((value) => value + 1);
      }
    } catch (error) {
      const message = contributionErrorMessage(
        error,
        "The contribution could not be prepared.",
      );
      setStatus(message);
      if (mode !== "list") {
        setWeb3Notice({
          tone: "error",
          title: `${mode === "attest" ? "Support" : "Dispute"} was not added`,
          message,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function approveSubmission() {
    if (busy || !submissionReview || !wallet) return;
    setBusy(true);
    setSubmissionOutcome({
      tone: "progress",
      title: "Complete the wallet prompts",
      message:
        "Keep this page open. Caveat Registry will confirm each approved transaction and then check the public index.",
      transactionHashes: [],
      confirmedTransactions: 0,
      totalTransactions: submissionReview.resolved.batch.transactions.length,
      indexed: false,
      deploymentId: submissionReview.resolved.prepared.plan.deployment,
    });
    setStatus("Requesting approval for the reviewed transaction plan…");
    try {
      const result = await submitWithBrowserWallet(
        submissionReview.input,
        wallet,
        submissionReview.resolved.batch,
        submissionReview.write,
      );
      setSubmissionOutcome(submissionOutcomeFromResult(result));
      setStatus(
        "message" in result
          ? result.message
          : result.issues
              .map((issue) => `${issue.path}: ${issue.message}`)
              .join("; "),
      );
      if ("message" in result && result.status === "indexed") {
        setSubmissionReview(null);
      }
    } catch (error) {
      setStatus(
        contributionErrorMessage(
          error,
          "The reviewed transaction plan could not be submitted.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const walletLabel = wallet
    ? shortAddress(wallet.address)
    : walletConnected
      ? "Switch to Intuition"
      : "Wallet connection required";
  const curationOptions = useMemo(
    () =>
      curationRegistryState?.kind === "ready"
        ? buildCurationEnforcerOptions(curationRegistryState.entries)
        : [],
    [curationRegistryState],
  );
  const selectedEnforcer = curationOptions.find(
    (option) => option.deploymentId === selectedDeploymentId,
  );
  const selectableClaims =
    curationDetail?.kind === "ready"
      ? curationDetail.claims.filter((claim) =>
          /^0x[a-fA-F0-9]{64}$/.test(claim.id ?? ""),
        )
      : [];
  const selectedClaim = selectableClaims.find((claim) => claim.id === claimId);

  return (
    <main>
      <section className="route-hero route-hero--visual route-hero--submit scroll-reveal">
        <div className="route-hero__mark" aria-hidden="true">
          <CaveatMarkSvg />
        </div>
        <div className="route-hero__copy">
          <h1 className="display">Submit</h1>
          <p className="lede">
            List an enforcer, support an indexed claim, or dispute it with a
            counter-signal.
          </p>
        </div>
      </section>

      <section className="route-section route-section--paper submit-workspace scroll-reveal">
        <div className="route-section__intro">
          <h2 className="headline">Create a registry contribution.</h2>
          <p className="lede">
            Choose the contribution, provide its evidence, then review the exact
            wallet-owned write before signing.
          </p>
        </div>
        <div className="two-col two-col--form">
          <form
            id="contribution-form"
            className="form"
            onSubmit={submitContribution}
            aria-label="Contribute to the open registry"
          >
            <label>
              <span className="mono-label">Contribution type</span>
              <select
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value as ContributionMode);
                  setStatus(null);
                }}
              >
                <option value="list">List a new enforcer</option>
                <option value="attest">Support an existing claim</option>
                <option value="counter">Dispute an existing claim</option>
              </select>
            </label>

            {mode === "list" ? (
              <>
                <div className="submission-step-heading">
                  <span className="submission-step-heading__number">1</span>
                  <div>
                    <h3>Find or create the enforcer identity.</h3>
                    <p>
                      The identity is the deployed contract plus its EIP-155
                      chain. The connected signing wallet is a separate actor.
                    </p>
                  </div>
                </div>
                <details className="form__import">
                  <summary>Have submission JSON? Autofill the form</summary>
                  <label>
                    <span className="mono-label">Submission JSON</span>
                    <textarea
                      value={importText}
                      onChange={(event) => setImportText(event.target.value)}
                      rows={4}
                      placeholder='Paste JSON such as { "enforcerName": "...", "contractAddress": "0x...", "termsSchema": { ... } }'
                      spellCheck={false}
                    />
                  </label>
                  <div className="form__import-actions">
                    <button
                      className="cta cta--ghost"
                      type="button"
                      onClick={applyImportedJson}
                    >
                      Autofill fields from JSON
                    </button>
                    {importNote && (
                      <span
                        className="band__note"
                        role="status"
                        aria-live="polite"
                      >
                        {importNote}
                      </span>
                    )}
                  </div>
                </details>

                <div className="form__pair">
                  <label>
                    <span className="mono-label">Chain</span>
                    <select
                      value={
                        ["1155", "1", "8453", "11155111"].includes(chainId)
                          ? chainId
                          : "custom"
                      }
                      onChange={(event) =>
                        setChainId(
                          event.target.value === "custom"
                            ? ""
                            : event.target.value,
                        )
                      }
                    >
                      <option value="1155">Intuition mainnet · 1155</option>
                      <option value="1">Ethereum mainnet · 1</option>
                      <option value="8453">Base · 8453</option>
                      <option value="11155111">Sepolia · 11155111</option>
                      <option value="custom">Other EVM chain…</option>
                    </select>
                    {!["1155", "1", "8453", "11155111"].includes(chainId) && (
                      <input
                        inputMode="numeric"
                        pattern="[0-9]+"
                        value={chainId}
                        onChange={(event) => setChainId(event.target.value)}
                        placeholder="EIP-155 chain ID"
                        aria-label="Custom EIP-155 chain ID"
                        required
                      />
                    )}
                    <span className="form__hint">
                      Choose the chain where this exact contract has deployed
                      bytecode. Availability is verified before any registry
                      write.
                    </span>
                  </label>
                </div>

                <div className="form__pair">
                  <label>
                    <span className="mono-label">
                      Deployed enforcer address
                    </span>
                    <input
                      value={contractAddress}
                      onChange={(event) =>
                        setContractAddress(event.target.value)
                      }
                      placeholder="0x…"
                      pattern="^0x[a-fA-F0-9]{40}$"
                      title="Enter a 20-byte EVM address beginning with 0x."
                      required
                    />
                    <span className="form__hint">
                      The deployed contract address, not the wallet that lists
                      it.
                    </span>
                  </label>
                  <label>
                    <span className="mono-label">Display name · optional</span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="AllowedTimeOfDayEnforcer"
                      maxLength={128}
                    />
                  </label>
                </div>

                <p className="identity-preview" aria-live="polite">
                  <span className="mono-label">Chain-qualified identity</span>
                  <code>
                    {
                      listingClaimSummary({
                        chainId,
                        contractAddress: contractAddress || "0x…",
                        name,
                        purpose,
                        category,
                        sourceUrl,
                        termsJson,
                      }).identity
                    }
                  </code>
                </p>

                <section
                  className="signing-actor"
                  aria-labelledby="signing-actor-heading"
                >
                  <span className="mono-label">Signing actor</span>
                  <h3 id="signing-actor-heading">
                    {wallet?.address ?? "Connect a wallet to sign"}
                  </h3>
                  <p>
                    This wallet submits the Intuition claims. It is never
                    inferred to be the contract deployer, author, or auditor.
                  </p>
                </section>

                <div className="submission-step-heading submission-step-heading--claims">
                  <span className="submission-step-heading__number">2</span>
                  <div>
                    <h3>Review the claims about this identity.</h3>
                    <p>
                      These five core claims make the record usable. Extra
                      evidence stays optional, explicit, and separately
                      inspectable.
                    </p>
                  </div>
                </div>

                <section
                  className="submission-claim-ledger"
                  aria-label="Core registry claims"
                >
                  <label>
                    <span className="mono-label">
                      Claim · plain-language purpose
                    </span>
                    <textarea
                      value={purpose}
                      onChange={(event) => setPurpose(event.target.value)}
                      rows={3}
                      maxLength={800}
                      placeholder="Limits calls to a permitted time window."
                      required
                    />
                  </label>
                  <div className="form__pair">
                    <label>
                      <span className="mono-label">Claim · source release</span>
                      <input
                        type="url"
                        value={sourceUrl}
                        onChange={(event) => setSourceUrl(event.target.value)}
                        placeholder="https://github.com/example/enforcers"
                        required
                      />
                    </label>
                    <label>
                      <span className="mono-label">
                        Source version · optional
                      </span>
                      <input
                        value={sourceVersion}
                        onChange={(event) =>
                          setSourceVersion(event.target.value)
                        }
                        placeholder="v1.0.0 or commit SHA"
                        maxLength={128}
                      />
                    </label>
                  </div>
                  <div className="form__pair">
                    <label>
                      <span className="mono-label">Claim · restriction</span>
                      <select
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                      >
                        <option value="frequency">Frequency</option>
                        <option value="amount">Amount limit</option>
                        <option value="target">Target address</option>
                        <option value="method">Callable method</option>
                        <option value="time">Time window</option>
                      </select>
                    </label>
                    <div className="submission-claim-ledger__fixed">
                      <span className="mono-label">Claim · operation</span>
                      <strong>Delegated contract call</strong>
                    </div>
                  </div>
                  <label>
                    <span className="mono-label">
                      Claim · terms schema JSON
                    </span>
                    <textarea
                      rows={8}
                      value={termsJson}
                      onChange={(event) => setTermsJson(event.target.value)}
                      spellCheck={false}
                      required
                    />
                  </label>
                </section>

                <section
                  className="modular-claims"
                  aria-labelledby="modular-claims-heading"
                >
                  <div className="modular-claims__header">
                    <div>
                      <h3 id="modular-claims-heading">Add evidence claims</h3>
                      <p>
                        Add only claims you can support. A signer never becomes
                        a deployer, author, or auditor by implication.
                      </p>
                    </div>
                    <button
                      className="cta cta--ghost"
                      type="button"
                      onClick={() =>
                        setAdditionalClaims((claims) => [
                          ...claims,
                          additionalClaimDraft(),
                        ])
                      }
                    >
                      Add claim
                    </button>
                  </div>

                  <div
                    className="claim-template-row"
                    aria-label="Evidence claim templates"
                  >
                    {LISTING_CLAIM_TEMPLATES.filter((template) =>
                      [
                        "audit",
                        "usage",
                        "composability",
                        "deployer",
                        "author",
                      ].includes(template.key),
                    ).map((template) => (
                      <button
                        key={template.key}
                        type="button"
                        title={template.description}
                        onClick={() =>
                          setAdditionalClaims((claims) => [
                            ...claims,
                            additionalClaimFromTemplate(template.key),
                          ])
                        }
                      >
                        + {template.label}
                      </button>
                    ))}
                  </div>

                  {additionalClaims.length === 0 ? (
                    <p className="modular-claims__empty">
                      No extra evidence claims added. Use the templates for
                      authorship, deployment provenance, audit evidence, usage,
                      or composability only when you have an exact predicate and
                      object.
                    </p>
                  ) : (
                    <ol className="modular-claims__list">
                      {additionalClaims.map((claim, index) => {
                        const knownPredicate = CLAIM_PREDICATE_OPTIONS.find(
                          (option) => option.predicateId === claim.predicateId,
                        );
                        return (
                          <li key={claim.id}>
                            <div className="modular-claims__claim-heading">
                              <strong>Claim {index + 1}</strong>
                              <button
                                type="button"
                                onClick={() =>
                                  setAdditionalClaims((claims) =>
                                    claims.filter(
                                      (candidate) => candidate.id !== claim.id,
                                    ),
                                  )
                                }
                              >
                                Remove
                              </button>
                            </div>
                            <div className="form__pair">
                              <label>
                                <span className="mono-label">Predicate</span>
                                <select
                                  value={
                                    knownPredicate?.predicateId ?? "custom"
                                  }
                                  onChange={(event) => {
                                    const option = CLAIM_PREDICATE_OPTIONS.find(
                                      (candidate) =>
                                        candidate.predicateId ===
                                        event.target.value,
                                    );
                                    setAdditionalClaims((claims) =>
                                      claims.map((candidate) =>
                                        candidate.id === claim.id
                                          ? option
                                            ? {
                                                ...candidate,
                                                predicateId: option.predicateId,
                                                predicateLabel: option.label,
                                                subject: option.subject,
                                                subjectId:
                                                  option.subject === "term"
                                                    ? candidate.subjectId
                                                    : undefined,
                                              }
                                            : {
                                                ...candidate,
                                                predicateId: "",
                                                predicateLabel: "",
                                              }
                                          : candidate,
                                      ),
                                    );
                                  }}
                                >
                                  {CLAIM_PREDICATE_OPTIONS.map((option) => (
                                    <option
                                      key={option.predicateId}
                                      value={option.predicateId}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                                  <option value="custom">
                                    Custom exact predicate
                                  </option>
                                </select>
                              </label>
                              <label>
                                <span className="mono-label">Subject</span>
                                <select
                                  value={claim.subject}
                                  onChange={(event) =>
                                    setAdditionalClaims((claims) =>
                                      claims.map((candidate) =>
                                        candidate.id === claim.id
                                          ? {
                                              ...candidate,
                                              subject: event.target.value as
                                                "deployment" | "type" | "term",
                                            }
                                          : candidate,
                                      ),
                                    )
                                  }
                                >
                                  <option value="deployment">
                                    This chain deployment
                                  </option>
                                  <option value="type">
                                    Chain-independent enforcer type
                                  </option>
                                  <option value="term">
                                    Existing Intuition claim or term
                                  </option>
                                </select>
                              </label>
                            </div>

                            {!knownPredicate && (
                              <div className="form__pair">
                                <label>
                                  <span className="mono-label">
                                    Predicate label
                                  </span>
                                  <input
                                    value={claim.predicateLabel ?? ""}
                                    onChange={(event) =>
                                      setAdditionalClaims((claims) =>
                                        claims.map((candidate) =>
                                          candidate.id === claim.id
                                            ? {
                                                ...candidate,
                                                predicateLabel:
                                                  event.target.value,
                                              }
                                            : candidate,
                                        ),
                                      )
                                    }
                                    placeholder="deployed by"
                                  />
                                </label>
                                <label>
                                  <span className="mono-label">
                                    Exact predicate term ID
                                  </span>
                                  <input
                                    value={claim.predicateId}
                                    onChange={(event) =>
                                      setAdditionalClaims((claims) =>
                                        claims.map((candidate) =>
                                          candidate.id === claim.id
                                            ? {
                                                ...candidate,
                                                predicateId: event.target.value,
                                              }
                                            : candidate,
                                        ),
                                      )
                                    }
                                    placeholder="0x… 32-byte Intuition atom ID"
                                    pattern="^0x[a-fA-F0-9]{64}$"
                                    required
                                  />
                                </label>
                              </div>
                            )}

                            {claim.subject === "term" && (
                              <label>
                                <span className="mono-label">
                                  Subject claim or term ID
                                </span>
                                <input
                                  value={claim.subjectId ?? ""}
                                  onChange={(event) =>
                                    setAdditionalClaims((claims) =>
                                      claims.map((candidate) =>
                                        candidate.id === claim.id
                                          ? {
                                              ...candidate,
                                              subjectId: event.target.value,
                                            }
                                          : candidate,
                                      ),
                                    )
                                  }
                                  placeholder="0x… relationship triple ID"
                                  pattern="^0x[a-fA-F0-9]{64}$"
                                  required
                                />
                              </label>
                            )}

                            <label>
                              <span className="mono-label">Claim object</span>
                              <textarea
                                rows={3}
                                value={claim.object}
                                onChange={(event) =>
                                  setAdditionalClaims((claims) =>
                                    claims.map((candidate) =>
                                      candidate.id === claim.id
                                        ? {
                                            ...candidate,
                                            object: event.target.value,
                                          }
                                        : candidate,
                                    ),
                                  )
                                }
                                placeholder="The identity, evidence URL, context, or canonical value this claim points to"
                                required
                              />
                            </label>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              </>
            ) : (
              <section
                className="curation-picker"
                aria-labelledby="curation-picker-title"
              >
                <div className="curation-picker__intro">
                  <h3 id="curation-picker-title">
                    {mode === "attest" ? "Support a claim" : "Dispute a claim"}
                  </h3>
                  <p>
                    Choose readable records below. Caveat Registry resolves the
                    Intuition IDs for your wallet.
                  </p>
                </div>

                <label>
                  <span className="mono-label">Enforcer</span>
                  <select
                    value={selectedDeploymentId}
                    onChange={(event) => {
                      setSelectedDeploymentId(event.target.value);
                      setClaimId("");
                      setStatus(null);
                    }}
                    disabled={curationRegistryLoading}
                  >
                    <option value="">
                      {curationRegistryLoading
                        ? "Loading live enforcers…"
                        : "Choose an enforcer"}
                    </option>
                    {curationOptions.map((option) => (
                      <option
                        key={option.deploymentId}
                        value={option.deploymentId}
                      >
                        {option.numberLabel} · {option.canonicalName}
                      </option>
                    ))}
                  </select>
                  {curationRegistryState?.kind === "ready" && (
                    <span className="form__hint">
                      {curationOptions.length} live enforcers, numbered by
                      creation order. The number is a display shortcut; the
                      onchain term ID remains canonical.
                    </span>
                  )}
                </label>

                {curationRegistryState?.kind === "error" && (
                  <div className="curation-picker__notice" role="alert">
                    <p>{curationRegistryState.message}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setCurationRegistryReload((attempt) => attempt + 1)
                      }
                    >
                      Retry enforcer list
                    </button>
                  </div>
                )}
                {curationRegistryState?.kind === "unconfigured" && (
                  <div className="curation-picker__notice" role="alert">
                    <p>
                      The live registry boundary is not configured. Missing:{" "}
                      {curationRegistryState.missing.join(", ")}.
                    </p>
                  </div>
                )}

                <label>
                  <span className="mono-label">Claim</span>
                  <select
                    value={claimId}
                    onChange={(event) => {
                      setClaimId(event.target.value);
                      setStatus(null);
                    }}
                    disabled={!selectedDeploymentId || curationDetailLoading}
                  >
                    <option value="">
                      {!selectedDeploymentId
                        ? "Choose an enforcer first"
                        : curationDetailLoading
                          ? "Loading indexed claims…"
                          : "Choose a claim"}
                    </option>
                    {selectableClaims.map((claim) => (
                      <option key={claim.id} value={claim.id}>
                        {curationClaimLabel(claim)}
                      </option>
                    ))}
                  </select>
                  {curationDetail?.kind === "ready" && (
                    <span className="form__hint">
                      {selectableClaims.length} claim
                      {selectableClaims.length === 1 ? "" : "s"} available for
                      this enforcer.
                    </span>
                  )}
                </label>

                {curationDetail?.kind === "error" && (
                  <div className="curation-picker__notice" role="alert">
                    <p>{curationDetail.message}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setCurationDetailReload((attempt) => attempt + 1)
                      }
                    >
                      Retry claims
                    </button>
                  </div>
                )}
                {curationDetail?.kind === "unconfigured" && (
                  <div className="curation-picker__notice" role="alert">
                    <p>
                      Claim lookup is not configured. Missing:{" "}
                      {curationDetail.missing.join(", ")}.
                    </p>
                  </div>
                )}
                {curationDetail?.kind === "ready" &&
                  selectableClaims.length === 0 && (
                    <div className="curation-picker__notice" role="status">
                      <p>
                        No signalable claims were returned for this enforcer.
                        Retry later or use Advanced transaction details with a
                        verified claim ID.
                      </p>
                    </div>
                  )}

                {selectedClaim && (
                  <div className="curation-selection" aria-live="polite">
                    <span className="mono-sub">
                      {selectedEnforcer?.numberLabel} · selected claim
                    </span>
                    <p className="curation-selection__statement">
                      <strong>{selectedClaim.predicate}</strong>
                      <span>{selectedClaim.object}</span>
                    </p>
                    <p className="curation-selection__signals">
                      {formatTrustSignal(selectedClaim.stake)} support ·{" "}
                      {selectedClaim.oppositionStake
                        ? formatTrustSignal(selectedClaim.oppositionStake)
                        : "0 TRUST"}{" "}
                      opposition
                    </p>
                  </div>
                )}

                <label>
                  <span className="mono-label">Deposit amount (TRUST)</span>
                  <input
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.1"
                    required
                  />
                </label>
                <div
                  className="trust-presets"
                  role="group"
                  aria-label="TRUST amount presets"
                >
                  {["0.1", "1", "5"].map((preset) => (
                    <button
                      type="button"
                      key={preset}
                      aria-pressed={amount === preset}
                      onClick={() => setAmount(preset)}
                    >
                      {preset} TRUST
                    </button>
                  ))}
                </div>

                <details className="form__advanced">
                  <summary>Advanced transaction details</summary>
                  <label>
                    <span className="mono-label">Canonical claim ID</span>
                    <input
                      value={claimId}
                      onChange={(event) => {
                        setClaimId(event.target.value);
                        setSelectedDeploymentId("");
                        setCurationDetail(null);
                      }}
                      placeholder="0x… 32-byte Intuition triple ID"
                      pattern="^0x[a-fA-F0-9]{64}$"
                      title="Enter a 32-byte Intuition claim ID beginning with 0x."
                      required
                    />
                    <span className="form__hint">
                      Filled automatically from the selected claim. Edit only
                      when signaling a claim that is not yet discoverable in the
                      registry list.
                    </span>
                  </label>
                  <label>
                    <span className="mono-label">Curve ID</span>
                    <input
                      inputMode="numeric"
                      pattern="[0-9]+"
                      value={curveId}
                      onChange={(event) => setCurveId(event.target.value)}
                      required
                    />
                  </label>
                </details>
              </section>
            )}
          </form>

          <aside className="preflight">
            <h2 className="headline headline--sm">Submission outline</h2>
            <Spec
              rows={[
                [
                  "Identity",
                  mode === "list"
                    ? contractAddress
                      ? `eip155:${chainId}`
                      : "Deployment required"
                    : selectedEnforcer
                      ? `${selectedEnforcer.numberLabel} · ${selectedEnforcer.canonicalName}`
                      : claimId
                        ? "Manual claim ID"
                        : "Choose an enforcer",
                ],
                [
                  "Core claims",
                  mode === "list"
                    ? `${
                        listingClaimSummary({
                          chainId,
                          contractAddress,
                          name,
                          purpose,
                          category,
                          sourceUrl,
                          termsJson,
                        }).claimCount
                      } to review`
                    : "Intuition triple",
                ],
                [
                  mode === "list" ? "Deployment" : "Claim",
                  mode === "list"
                    ? contractAddress
                      ? "Provided"
                      : "Required"
                    : selectedClaim
                      ? curationClaimLabel(selectedClaim)
                      : claimId
                        ? shortAddress(claimId)
                        : "Choose a claim",
                ],
                ...(mode === "list"
                  ? ([
                      ["Chain identity", `eip155:${chainId}`],
                      ["Additional claims", `${additionalClaims.length} added`],
                    ] as Array<[string, React.ReactNode]>)
                  : []),
                ...(mode === "list"
                  ? []
                  : ([
                      ["Signal", mode === "attest" ? "Support" : "Dispute"],
                      ["Deposit", `${amount || "0"} TRUST`],
                    ] as Array<[string, React.ReactNode]>)),
                [mode === "list" ? "Signing actor" : "Wallet", walletLabel],
              ]}
            />
            {submissionReview && mode === "list" && (
              <section className="transaction-plan" aria-labelledby="tx-plan">
                <div className="transaction-plan__heading">
                  <span className="mono-sub">Resolved · no signature yet</span>
                  <h3 id="tx-plan">Exact transaction plan</h3>
                  <p>
                    Check every target and value. After approval, each write is
                    simulated immediately before its wallet prompt.
                  </p>
                  <p>
                    Required deposits:{" "}
                    <strong>
                      {formatEther(
                        submissionReview.resolved.batch.transactions.reduce(
                          (total, transaction) =>
                            total + BigInt(transaction.request.value ?? "0"),
                          0n,
                        ),
                      )}{" "}
                      TRUST
                    </strong>{" "}
                    plus network gas.
                  </p>
                </div>
                <ol className="transaction-plan__list">
                  {submissionReview.resolved.batch.transactions.map(
                    (transaction, index) => {
                      const itemCount =
                        transaction.atomIds?.length ??
                        transaction.tripleIds?.length ??
                        0;
                      return (
                        <li key={`${transaction.kind}-${index}`}>
                          <div>
                            <span className="mono-sub">
                              Transaction {index + 1}
                            </span>
                            <strong>
                              {transaction.kind === "create-atoms"
                                ? "Create missing atoms"
                                : "Create registry claims"}
                            </strong>
                          </div>
                          <Spec
                            rows={[
                              ["Target", <code>{transaction.request.to}</code>],
                              ["Value (wei)", transaction.request.value ?? "0"],
                              ["Records", String(itemCount)],
                              [
                                "Dependency",
                                transaction.dependsOn
                                  ? "After atom creation"
                                  : "None",
                              ],
                            ]}
                          />
                          <details>
                            <summary>Inspect calldata</summary>
                            <code className="transaction-plan__calldata">
                              {transaction.request.data}
                            </code>
                          </details>
                        </li>
                      );
                    },
                  )}
                </ol>
                <p className="transaction-plan__warning">
                  {submissionReview.resolved.batch.warning}
                </p>
              </section>
            )}
            <CaveatConnectButton disabled={busy} />
            {!wallet && (
              <p className="wallet-connect-guidance">
                {walletConnected && !onIntuition
                  ? "Use the network control to switch this wallet to Intuition mainnet (chain 1155)."
                  : "Choose an installed EVM wallet. WalletConnect and mobile QR wallets are available when a WalletConnect project ID is configured."}
              </p>
            )}
            {submissionReview && mode === "list" ? (
              <div className="transaction-plan__actions">
                <button
                  className="cta cta--ghost"
                  type="button"
                  onClick={() => {
                    setSubmissionReview(null);
                    setStatus("Plan closed. Edit fields or prepare it again.");
                  }}
                  disabled={busy}
                >
                  Back to edit
                </button>
                <button
                  className="cta cta--dark web3-action web3-action--primary"
                  type="button"
                  onClick={approveSubmission}
                  disabled={busy}
                >
                  {busy ? "Waiting for wallet…" : "Approve in wallet"}{" "}
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            ) : (
              <button
                className="cta cta--dark web3-action web3-action--primary"
                type="submit"
                form="contribution-form"
                disabled={
                  busy ||
                  (mode !== "list" && !/^0x[a-fA-F0-9]{64}$/.test(claimId))
                }
              >
                {busy
                  ? "Preparing plan…"
                  : mode === "list"
                    ? "Prepare transaction plan"
                    : mode === "attest"
                      ? "Add support"
                      : "Add dispute"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            )}
            {submissionOutcome && mode === "list" && (
              <section
                className={`submission-outcome submission-outcome--${submissionOutcome.tone}`}
                role="status"
                aria-live="polite"
                aria-labelledby="submission-outcome-title"
              >
                <div className="submission-outcome__icon" aria-hidden="true">
                  {submissionOutcome.tone === "success"
                    ? "✓"
                    : submissionOutcome.tone === "progress"
                      ? "↻"
                      : "!"}
                </div>
                <div className="submission-outcome__content">
                  <span className="mono-sub">
                    {submissionOutcome.indexed
                      ? "Mainnet · indexed"
                      : submissionOutcome.transactionHashes.length
                        ? "Intuition mainnet"
                        : "Submission status"}
                  </span>
                  <h3 id="submission-outcome-title">
                    {submissionOutcome.title}
                  </h3>
                  <p>{submissionOutcome.message}</p>
                  {submissionOutcome.totalTransactions > 0 && (
                    <div className="submission-outcome__progress">
                      <span>
                        {submissionOutcome.confirmedTransactions}/
                        {submissionOutcome.totalTransactions} transactions
                        confirmed
                      </span>
                      <span>
                        {submissionOutcome.indexed
                          ? "Registry indexed"
                          : "Indexing status checked"}
                      </span>
                    </div>
                  )}
                  {submissionOutcome.transactionHashes.length > 0 && (
                    <ol className="submission-outcome__transactions">
                      {submissionOutcome.transactionHashes.map(
                        (hash, index) => (
                          <li key={hash}>
                            <span>Transaction {index + 1}</span>
                            <a
                              href={`https://explorer.intuition.systems/tx/${hash}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {shortAddress(hash)} ↗
                            </a>
                          </li>
                        ),
                      )}
                    </ol>
                  )}
                  <div className="submission-outcome__actions">
                    <Link className="cta cta--solid" to="/registry">
                      Open live registry <span aria-hidden="true">→</span>
                    </Link>
                    {submissionOutcome.deploymentId && (
                      <button
                        className="cta cta--ghost"
                        type="button"
                        onClick={() =>
                          void navigator.clipboard.writeText(
                            submissionOutcome.deploymentId ?? "",
                          )
                        }
                      >
                        Copy record ID
                      </button>
                    )}
                  </div>
                </div>
              </section>
            )}
            {status && (
              <p className="band__note" role="status" aria-live="polite">
                {status}
              </p>
            )}
            <Web3NoticeToast
              notice={web3Notice}
              onDismiss={() => setWeb3Notice(null)}
            />
            <p className="band__note">
              {mode === "list"
                ? "Validation and an exact plan resolve before the approval button appears. After approval, each write is simulated before its wallet prompt. The server never receives your signing key."
                : "The claim and target vault are verified before the wallet prompts for a support or opposition deposit."}
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}

export function SubmitPage() {
  return (
    <CaveatWalletProvider>
      <SubmitPageContent />
    </CaveatWalletProvider>
  );
}

/* ----------------------------------------------------------------------- learn */

const PATHS = [
  {
    id: "new-to-caveats",
    title: "New to caveats",
    body: "Understand permissions, boundaries, and enforcers in plain language.",
    points: [
      "A delegation gives another account limited authority.",
      "A caveat enforcer checks one condition before that authority is used.",
      "Terms are the encoded values that make the condition specific.",
    ],
  },
  {
    id: "wallet-builder",
    title: "Wallet builder",
    body: "Query records, compare evidence, and present rules before signing.",
    points: [
      "Resolve the deployed address to a readable enforcer identity.",
      "Decode terms with the published schema and show the exact boundary.",
      "Keep source, deployment, support, and counter-signal separate.",
    ],
  },
  {
    id: "enforcer-author",
    title: "Enforcer author",
    body: "Encode terms, publish deployments, and contribute registry claims.",
    points: [
      "Publish source, version, deployment address, and terms schema.",
      "Validate the contract and simulate the proposed registry write.",
      "Sign from your own wallet, then wait for chain and indexer confirmation.",
    ],
  },
  {
    id: "researcher",
    title: "Researcher",
    body: "Inspect provenance, signal, counter-signal, and change history.",
    points: [
      "Treat membership as a discovery fact, never a safety verdict.",
      "Inspect the claim source and what every signal actually asserts.",
      "Read support and opposition independently instead of as one score.",
    ],
  },
] as const;

export function LearnPage() {
  return (
    <main>
      <section className="route-hero route-hero--visual route-hero--learn scroll-reveal">
        <div className="route-hero__mark" aria-hidden="true">
          <CaveatMarkSvg />
        </div>
        <div className="route-hero__copy">
          <h1 className="display">Learn</h1>
          <p className="lede">
            Choose your starting point. Each path moves from plain language to
            inspectable implementation.
          </p>
        </div>
      </section>

      <section className="route-section route-section--paper route-section--tight learn-index scroll-reveal">
        <div className="rail rail--head">
          <div>
            <h2 className="headline">Learn at your depth.</h2>
          </div>
          <p className="lede">
            No wall of documentation. Each track answers one audience's
            immediate questions first.
          </p>
        </div>

        <ul className="table table--paths">
          {PATHS.map((path) => (
            <li key={path.id}>
              <a href={`#${path.id}`}>
                <span className="table__name">
                  <strong>{path.title}</strong>
                  <em>{path.body}</em>
                </span>
                <span className="table__start">
                  Start <span aria-hidden="true">→</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="route-section route-section--ink learn-chapters scroll-reveal"
        aria-label="Learning paths"
      >
        {PATHS.map((path) => (
          <article id={path.id} key={path.id} className="learn-chapter">
            <div>
              <h2 className="headline">{path.title}</h2>
              <p className="lede">{path.body}</p>
            </div>
            <ol>
              {path.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ol>
          </article>
        ))}
      </section>
    </main>
  );
}

/* --------------------------------------------------------------- composability */

type ComposabilityRelationship = {
  key: string;
  subjectType: string;
  relation: "conflicts" | "complements";
  relatedType: string;
  context: string;
  ordering?: string;
  evidenceNote?: string;
  supportedBy: string;
};

type ComposabilityTriplePlan = {
  key: string;
  relationship: {
    id: string;
    subject: { id: string };
  };
};

type DisplayComposabilityRelationship = ComposabilityRelationship & {
  claimId: string;
  live: boolean;
  support?: string;
  opposition?: string;
};

const COMPOSABILITY_RELATIONSHIPS =
  composabilityDocument.relationships as ComposabilityRelationship[];
const COMPOSABILITY_TRIPLE_PLANS = composabilityTriplesDocument.triples as
  ComposabilityTriplePlan[] | undefined;

const COMPOSABILITY_PRESETS = [
  {
    title: "Time-gated token transfer",
    keys: ["erc20-amount-timestamp-complement"],
    body: "Cap the ERC-20 amount and independently limit when the delegation may be redeemed. Both terms must describe the same intended transfer.",
  },
  {
    title: "Exact batch with a redemption cap",
    keys: ["exact-batch-limited-calls-complement"],
    body: "Fix every call in the batch, then independently cap how many times that exact delegation may be redeemed.",
  },
  {
    title: "Scoped agent action",
    keys: [
      "allowed-targets-methods-complement",
      "allowed-targets-call-count-complement",
      "allowed-targets-time-complement",
    ],
    body: "Target, method, call-count, and time-window restrictions reinforce one another when their terms describe the same delegation.",
  },
] as const;

export function ComposabilityPage() {
  const [claims, setClaims] = useState<Map<string, ComposabilityClaim>>(
    () => new Map(),
  );
  const [liveStatus, setLiveStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    const controller = new AbortController();
    const subjectIds = Array.from(
      new Set(
        (COMPOSABILITY_TRIPLE_PLANS ?? []).map(
          (plan) => plan.relationship.subject.id,
        ),
      ),
    );
    void Promise.all(
      subjectIds.map((subjectId) =>
        fetchComposability(subjectId, controller.signal),
      ),
    )
      .then((states) => {
        if (controller.signal.aborted) return;
        const next = new Map<string, ComposabilityClaim>();
        for (const state of states) {
          if (state.kind !== "ready") continue;
          for (const claim of state.claims) next.set(claim.id, claim);
        }
        setClaims(next);
        setLiveStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setLiveStatus("error");
      });
    return () => controller.abort();
  }, []);

  const relationships = useMemo<DisplayComposabilityRelationship[]>(() => {
    const plans = new Map(
      (COMPOSABILITY_TRIPLE_PLANS ?? []).map((plan) => [plan.key, plan]),
    );
    return COMPOSABILITY_RELATIONSHIPS.map((relationship) => {
      const plan = plans.get(relationship.key);
      const claim = plan ? claims.get(plan.relationship.id) : undefined;
      const context = claim?.context.find(
        (item) => item.kind === "applies-in-context",
      );
      const ordering = claim?.context.find(
        (item) => item.kind === "requires-ordering",
      );
      const evidence = claim?.context.find(
        (item) => item.kind === "supported-by",
      );
      return {
        ...relationship,
        claimId: plan?.relationship.id ?? "",
        live: Boolean(claim),
        ...(claim?.kind === "conflicts" || claim?.kind === "complements"
          ? { relation: claim.kind }
          : {}),
        ...(claim?.relatedLabel ? { relatedType: claim.relatedLabel } : {}),
        ...(context?.objectLabel ? { context: context.objectLabel } : {}),
        ...(ordering?.objectLabel ? { ordering: ordering.objectLabel } : {}),
        ...(externalUrl(evidence?.objectLabel ?? undefined)
          ? { supportedBy: evidence!.objectLabel! }
          : {}),
        ...(claim
          ? {
              support: formatTrustSignal(claim.support.value),
              opposition: formatTrustSignal(claim.opposition.value),
            }
          : {}),
      };
    });
  }, [claims]);
  const liveCount = relationships.filter(
    (relationship) => relationship.live,
  ).length;

  return (
    <main>
      <section className="route-hero route-hero--visual route-hero--compose scroll-reveal">
        <div className="route-hero__mark" aria-hidden="true">
          <CaveatMarkSvg />
        </div>
        <div className="route-hero__copy">
          <h1 className="display">Composability</h1>
          <p className="lede">
            See which enforcers reinforce, conflict with, or repeat a delegation
            boundary. Every relationship remains an inspectable Intuition claim.
          </p>
        </div>
      </section>

      <section className="route-section route-section--paper route-section--tight scroll-reveal">
        <div className="rail rail--head">
          <div>
            <h2 className="headline">Start from the job to be done.</h2>
          </div>
          <p className="lede">
            Pick the outcome you want to permit, then read which enforcers fit
            and which fight each other. A highly staked relationship is a
            community-endorsed fit, not a safety guarantee.
          </p>
        </div>

        <div
          className="composability-live-status"
          role="status"
          aria-live="polite"
        >
          <span className="mono-sub">
            {liveStatus === "loading"
              ? "Resolving Intuition claims"
              : liveStatus === "error"
                ? "Intuition claims unavailable"
                : `${liveCount} of ${relationships.length} relationship claims live`}
          </span>
          <span>
            {liveStatus === "ready" && liveCount === relationships.length
              ? "Graph, context, ordering, and signal are resolved from Intuition mainnet."
              : "Unpublished relationships remain visibly labelled as canonical plans."}
          </span>
        </div>

        <ComposabilityGraph relationships={relationships} />

        <section
          className="composability-presets"
          aria-labelledby="preset-heading"
        >
          <div className="composability-presets__heading">
            <span className="mono-sub">Three starting presets</span>
            <h2 id="preset-heading">Compose from an outcome, not a label.</h2>
          </div>
          <div className="composability-presets__grid">
            {COMPOSABILITY_PRESETS.map((preset, index) => {
              const presetRelationships = relationships.filter((relationship) =>
                preset.keys.includes(relationship.key as never),
              );
              const presetLiveCount = presetRelationships.filter(
                (relationship) => relationship.live,
              ).length;
              return (
                <article key={preset.title}>
                  <span className="mono-sub">0{index + 1}</span>
                  <h3>{preset.title}</h3>
                  <p>{preset.body}</p>
                  <span className="composability-presets__state">
                    {presetLiveCount === presetRelationships.length
                      ? "Live on Intuition"
                      : `${presetLiveCount}/${presetRelationships.length} claims live`}
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      </section>

      <section className="route-section route-section--ink scroll-reveal">
        <div className="two-col">
          <div>
            <h2 className="headline">Represented as triples, not UI rules.</h2>
          </div>
          <p className="lede">
            Published relationships are resolved from Intuition as triples with
            their use-case context, ordering, evidence, and separate community
            signals. Canonical plans stay marked as plans until those exact IDs
            exist onchain. Anyone can support or dispute a live claim with
            TRUST; the registry never turns that signal into a universal score.
          </p>
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ developers */

export function DevelopersPage() {
  const snippet = registryDeploymentsQuery.trim();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("error");
    }
  }

  return (
    <main>
      <section className="route-hero route-hero--visual route-hero--developers scroll-reveal">
        <div className="route-hero__mark" aria-hidden="true">
          <CaveatMarkSvg />
        </div>
        <div className="route-hero__copy">
          <h1 className="display">Developers</h1>
          <p className="lede">
            The public read path for ERC-7710 caveat enforcers: deployments,
            terms, evidence, and community signal on Intuition.
          </p>
        </div>
      </section>

      <section className="route-section route-section--paper developer-docs">
        <div className="developer-docs__layout">
          <aside className="developer-docs__nav" aria-label="On this page">
            <p>Developer docs</p>
            <nav>
              <a href="#overview">Overview</a>
              <a href="#scope">Scope and limits</a>
              <a href="#capabilities">What it provides</a>
              <a href="#integration">Integration path</a>
              <a href="#query">Canonical query</a>
              <a href="#resources">Resources</a>
            </nav>
          </aside>

          <div className="developer-docs__content">
            <section id="overview" className="developer-docs__section">
              <h2>One public record for delegation boundaries.</h2>
              <p>
                Caveat Registry is an open registry for ERC-7710 caveat enforcer
                deployments. It makes deployment identity, source provenance,
                terms schemas, and evidence discoverable without making the
                initial MetaMask collection a closed allowlist.
              </p>
              <p>
                A wallet, explorer, agent, or application can resolve the same
                record through Intuition rather than maintaining its own opaque
                directory.
              </p>
            </section>

            <section id="scope" className="developer-docs__section">
              <h2>Scope and limits</h2>
              <div className="developer-docs__split">
                <div>
                  <h3>It provides</h3>
                  <ul>
                    <li>Canonical discovery of listed deployments.</li>
                    <li>Terms, source, release, chain, and evidence claims.</li>
                    <li>Separate support and opposition signals.</li>
                    <li>A permissionless path to propose another enforcer.</li>
                  </ul>
                </div>
                <div>
                  <h3>It does not provide</h3>
                  <ul>
                    <li>A safety rating, audit substitute, or allowlist.</li>
                    <li>A guarantee that a future delegation will execute.</li>
                    <li>A replacement for wallet-level simulation.</li>
                    <li>
                      Hidden signing authority or custody of a user wallet.
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <section id="capabilities" className="developer-docs__section">
              <h2>What the registry gives your product.</h2>
              <dl className="developer-docs__facts">
                <div>
                  <dt>Discover</dt>
                  <dd>
                    Browse deployments using canonical Intuition term IDs, chain
                    availability, and declared restriction domains.
                  </dd>
                </div>
                <div>
                  <dt>Inspect</dt>
                  <dd>
                    Resolve the claims behind one deployment: source, release,
                    terms schema, observed code, and related evidence.
                  </dd>
                </div>
                <div>
                  <dt>Compare signal</dt>
                  <dd>
                    Read supporting and counter-claims independently. Neither is
                    collapsed into one trust score.
                  </dd>
                </div>
                <div>
                  <dt>Contribute</dt>
                  <dd>
                    Validate and submit an unlisted enforcer through the same
                    public standard the registry reads.
                  </dd>
                </div>
              </dl>
            </section>

            <section id="integration" className="developer-docs__section">
              <h2>Integration path</h2>
              <ol className="developer-docs__steps">
                <li>
                  <div>
                    <strong>Read membership.</strong>
                    <p>
                      Query the registry boundary on Intuition mainnet using the
                      canonical predicate and class atom IDs.
                    </p>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Resolve the selected deployment.</strong>
                    <p>
                      Fetch its subject claims and interpret them through the
                      versioned ontology—not display labels alone.
                    </p>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Show the boundary.</strong>
                    <p>
                      Put terms, source, availability, support, and opposition
                      beside the action your user is about to approve.
                    </p>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Simulate before signing.</strong>
                    <p>
                      Registry membership and evidence inform a decision; the
                      intended delegation still needs wallet-level simulation.
                    </p>
                  </div>
                </li>
              </ol>
            </section>

            <section id="query" className="developer-docs__section">
              <div className="developer-docs__section-head">
                <div>
                  <h2>Canonical membership query</h2>
                  <p>
                    Start here to discover listed deployments. The registry
                    boundary uses term IDs, never a display-label search.
                  </p>
                </div>
                <a href="/registry">
                  Open registry <span aria-hidden="true">↗</span>
                </a>
              </div>
              <div className="code-shell">
                <div className="code-shell__bar">
                  <span>registry-deployments.graphql</span>
                  <button type="button" onClick={copySnippet}>
                    {copyState === "copied"
                      ? "Copied"
                      : copyState === "error"
                        ? "Copy unavailable"
                        : "Copy query"}
                  </button>
                </div>
                <pre
                  className="code"
                  aria-label="Registry deployments GraphQL query"
                >
                  <code>{snippet}</code>
                </pre>
                <span
                  className="visually-hidden"
                  role="status"
                  aria-live="polite"
                >
                  {copyState === "copied"
                    ? "GraphQL query copied to clipboard."
                    : copyState === "error"
                      ? "Clipboard access is unavailable. Select the query text to copy it manually."
                      : ""}
                </span>
              </div>
            </section>

            <section id="resources" className="developer-docs__section">
              <h2>Read the contract, then build.</h2>
              <nav
                className="developer-docs__resources"
                aria-label="Developer resources"
              >
                <a
                  href="https://github.com/intuition-box/caveat-enforcers-registry/blob/main/docs/INTEGRATION.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Integration rules</span>
                  <span>Canonical GraphQL queries and lifecycle</span>
                  <span aria-hidden="true">↗</span>
                </a>
                <a
                  href="https://github.com/intuition-box/caveat-enforcers-registry/blob/main/docs/SCHEMA.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Submission schema</span>
                  <span>Fields, validation, and evidence requirements</span>
                  <span aria-hidden="true">↗</span>
                </a>
                <a
                  href="https://github.com/intuition-box/caveat-enforcers-registry/blob/main/docs/COMPOSABILITY.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Composability guide</span>
                  <span>Relationship claims and supporting context</span>
                  <span aria-hidden="true">↗</span>
                </a>
                <a
                  href="https://github.com/intuition-box/caveat-enforcers-registry"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Repository</span>
                  <span>Source, tests, and local development</span>
                  <span aria-hidden="true">↗</span>
                </a>
              </nav>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
