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
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { registryDeploymentsQuery } from "../src/registry";
import {
  buildEnforcerDisplayNameMap,
  enforcerTypeDisplayName,
} from "../src/enforcer-display-name";
import referenceDocument from "../data/metamask-v1.3.0.json";
import composabilityDocument from "../data/composability-seed.json";
import ComposabilityGraph from "./ComposabilityGraph";
import EnforcerRadialGraph from "./EnforcerRadialGraph";
import BrowserFrame from "./BrowserFrame";
import {
  fetchRegistry,
  fetchRegistryDetail,
  type RegistryApiState,
  type RegistryDetailResponse,
} from "./api";
import {
  browserWalletAvailable,
  connectBrowserWallet,
  curateWithBrowserWallet,
  submitWithBrowserWallet,
  type BrowserWallet,
} from "./wallet";
import {
  validateSubmission as validateSubmissionLocally,
  type SubmissionInput,
} from "../src/validation";
import type { CurationInput } from "../src/curation";
import { CaveatMarkSvg } from "./CaveatMark";
import IntuitionLogo from "./IntuitionLogo";

/* ---------------------------------------------------------------- primitives */

type PillTone = "plain" | "observed" | "review";

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

function Spec({ rows }: { rows: Array<[string, string]> }) {
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
    const [domain, purpose] = PURPOSES[entry.name] ?? [
      "Caveat rule",
      "A MetaMask Delegation Framework caveat enforcer reference.",
    ];
    return {
      id: entry.address,
      slug: slugify(entry.name),
      name: REFERENCE_DISPLAY_NAMES.get(entry.name) ?? entry.name,
      canonicalName: entry.name,
      purpose,
      domain,
      chain: "Intuition 1155",
      state: entry.codeStatus === "observed" ? "observed" : "review",
      address: entry.address,
    };
  },
);

type RegistryRow = Reference & { live?: boolean };

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

function liveRow(
  entry: Extract<RegistryApiState, { kind: "ready" }>["entries"][number],
): RegistryRow {
  const canonicalName = canonicalNameForIndexedEntry(entry);
  return {
    id: entry.id,
    slug: entry.id,
    name: enforcerTypeDisplayName(canonicalName),
    canonicalName,
    purpose: entry.description,
    domain: entry.domain,
    chain: entry.chain,
    state: "observed",
    address: entry.deployment,
    live: true,
  };
}

/* -------------------------------------------------------------------- registry */

export function RegistryPage() {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("all");
  const [chain, setChain] = useState("all");
  const [apiState, setApiState] = useState<RegistryApiState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void fetchRegistry({
      query,
      domain: domain === "all" ? undefined : domain,
      chain: chain === "all" ? undefined : chain,
      signal: controller.signal,
    })
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
  }, [query, domain, chain]);

  const showingLive = apiState?.kind === "ready";
  const liveRows = showingLive ? apiState.entries.map(liveRow) : [];
  const filtersActive =
    Boolean(query.trim()) || domain !== "all" || chain !== "all";
  const showReferenceFallback =
    !showingLive || (!liveRows.length && !filtersActive);

  const domains = useMemo(
    () =>
      Array.from(
        new Set(
          showingLive && liveRows.length
            ? apiState.entries.map((entry) => entry.domain)
            : REFERENCE.map((r) => r.domain),
        ),
      ).sort(),
    [apiState, showingLive],
  );

  const referenceRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return REFERENCE.filter(
      (r) =>
        (domain === "all" || r.domain === domain) &&
        (chain === "all" || chain === "eip155:1155") &&
        (q === "" ||
          r.name.toLowerCase().includes(q) ||
          r.canonicalName.toLowerCase().includes(q) ||
          r.purpose.toLowerCase().includes(q) ||
          r.domain.toLowerCase().includes(q) ||
          r.address.toLowerCase().includes(q)),
    );
  }, [query, domain, chain]);
  const rows: RegistryRow[] = showReferenceFallback ? referenceRows : liveRows;

  const statusLabel = loading
    ? "Connecting to registry service"
    : liveRows.length
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
          <span className="route-kicker intuition-lockup">
            <IntuitionLogo size={17} /> Intuition 1155 / Registry
          </span>
          <h1 className="display">Find the boundary you need.</h1>
          <p className="lede">
            Search caveat enforcers by purpose, constraint, chain, or deployment
            evidence.
          </p>
          <div className="route-hero__meta">
            <span>32 reference types</span>
            <span>Live membership when configured</span>
          </div>
        </div>
      </section>

      <section className="route-section route-section--ink registry-map scroll-reveal">
        <div className="route-section__intro">
          <div>
            <p className="route-kicker">Seeded on mainnet</p>
            <h2 className="headline">The whole registry at a glance.</h2>
          </div>
          <p className="lede">
            Every spoke is a live membership triple on Intuition: 32 ERC-7710
            enforcers linked to one deployment class. Coloured by what they
            restrict.
          </p>
        </div>
        <BrowserFrame
          title="Caveat Registry"
          label="Live · Intuition 1155"
          tone="ink"
        >
          <EnforcerRadialGraph
            nodes={REFERENCE.map((entry) => ({
              name: entry.name,
              domain: entry.domain,
              address: entry.address,
              slug: entry.slug,
            }))}
          />
        </BrowserFrame>
      </section>

      <section className="route-section route-section--paper registry-workspace scroll-reveal">
        <div className="route-section__intro">
          <div>
            <p className="route-kicker">One public index</p>
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
            <span className="mono-label">Chain evidence</span>
            <select value={chain} onChange={(e) => setChain(e.target.value)}>
              <option value="all">All chains</option>
              <option value="eip155:1155">Intuition 1155</option>
            </select>
          </label>
        </div>

        <div className="rail">
          <span className="mono-sub">{statusLabel}</span>
          <span className="mono-sub">
            {rows.length}{" "}
            {liveRows.length && !showReferenceFallback
              ? "indexed"
              : `of ${REFERENCE.length} reference`}{" "}
            shown
          </span>
        </div>

        <ul className="table" aria-live="polite">
          {rows.map((r) => (
            <li key={r.slug}>
              <Link to={`/registry/${r.slug}`}>
                <span className="table__name">
                  <strong>{r.name}</strong>
                  <em>{r.purpose}</em>
                </span>
                <span className="table__domain">{r.domain}</span>
                <span className="table__chain">{r.chain}</span>
                <Pill tone={r.state}>
                  {r.state === "observed" ? "Observed" : "Review"}
                </Pill>
              </Link>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="table__empty">
              {liveRows.length && !showReferenceFallback
                ? "No indexed membership claims match this view."
                : "The live service is unavailable, so no reference type matches that filter."}
            </li>
          )}
        </ul>

        <p className="band__note">
          {liveRows.length && !showReferenceFallback
            ? "Live rows come from the canonical Intuition membership query. Membership is a discoverability claim, not a safety guarantee."
            : apiState?.kind === "error"
              ? `Live registry unavailable: ${apiState.message} Showing the 32-entry MetaMask reference collection without presenting it as indexed data.`
              : showingLive
                ? "No indexed membership claims exist for this proposed ontology yet. The 32-entry MetaMask collection below remains reference data only."
                : "The 32-entry MetaMask collection is reference data only. Start the local registry service to inspect indexed Intuition records."}
        </p>
      </section>
    </main>
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
                ["Chain", "eip155:1155"],
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

const STEPS = ["Identity", "Deployment", "Evidence", "Review"];

type ContributionMode = "list" | "attest" | "counter";

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

export function SubmitPage() {
  const [mode, setMode] = useState<ContributionMode>("list");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("frequency");
  const [purpose, setPurpose] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceVersion, setSourceVersion] = useState("");
  const [contractAddress, setContractAddress] = useState("");
  const [termsJson, setTermsJson] = useState(DEFAULT_TERMS_SCHEMA);
  const [claimId, setClaimId] = useState("");
  const [amount, setAmount] = useState("1");
  const [curveId, setCurveId] = useState("1");
  const [wallet, setWallet] = useState<BrowserWallet | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importNote, setImportNote] = useState<string | null>(null);

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

    setImportNote(
      filled.length
        ? `Filled ${filled.length} field${filled.length === 1 ? "" : "s"}: ${filled.join(", ")}. Review, connect your wallet, and sign.`
        : "No recognized fields were found in that JSON.",
    );
  }

  async function connectWallet() {
    setStatus("Requesting an Intuition mainnet account from your wallet…");
    try {
      const connected = await connectBrowserWallet();
      setWallet(connected);
      setStatus(
        `Connected ${shortAddress(connected.address)} on Intuition mainnet.`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "The browser wallet could not be connected.",
      );
    }
  }

  async function submitContribution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus("Preparing a wallet-owned write…");
    try {
      const activeWallet = wallet ?? (await connectBrowserWallet());
      if (!wallet) setWallet(activeWallet);

      if (mode === "list") {
        let termsSchema: unknown;
        try {
          termsSchema = JSON.parse(termsJson);
        } catch {
          throw new Error("Terms schema must be valid JSON before submitting.");
        }
        const input: SubmissionInput = {
          chainId: 1155,
          contractAddress,
          enforcerName: name,
          description: purpose,
          type: name,
          restrictionDomain: category,
          operation: "Delegated contract call",
          sourceUrl,
          ...(sourceVersion.trim() ? { sourceVersion } : {}),
          termsSchema: termsSchema as SubmissionInput["termsSchema"],
          submitterWallet: activeWallet.address,
          initialSignal: "0",
          evidence: {
            audit: {
              sourceUrl,
              scope: "Repository and deployed contract evidence",
              ...(sourceVersion.trim() ? { sourceVersion } : {}),
            },
          },
        };
        const validation = validateSubmissionLocally(input);
        if (!validation.valid) {
          throw new Error(
            validation.issues
              .slice(0, 3)
              .map((issue) => `${issue.path}: ${issue.message}`)
              .join("; "),
          );
        }
        const result = await submitWithBrowserWallet(input, activeWallet);
        setStatus(
          "message" in result
            ? result.message
            : result.issues
                .map((issue) => `${issue.path}: ${issue.message}`)
                .join("; "),
        );
        return;
      }

      const curation: CurationInput = {
        claimId,
        action: mode === "attest" ? "support" : "oppose",
        receiver: activeWallet.address,
        amount,
        curveId,
      };
      const result = await curateWithBrowserWallet(curation, activeWallet);
      setStatus(result.message);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "The contribution could not be prepared.",
      );
    } finally {
      setBusy(false);
    }
  }

  const walletLabel = wallet
    ? shortAddress(wallet.address)
    : browserWalletAvailable()
      ? "Available"
      : "Not detected";

  return (
    <main>
      <section className="route-hero route-hero--visual route-hero--submit scroll-reveal">
        <div className="route-hero__mark" aria-hidden="true">
          <CaveatMarkSvg />
        </div>
        <div className="route-hero__copy">
          <span className="route-kicker">Contribution / Public standard</span>
          <h1 className="display">Add what the ecosystem is missing.</h1>
          <p className="lede">
            List an enforcer, attest to an existing claim, or submit a
            counter-signal.
          </p>
          <div className="route-hero__meta">
            <span>Wallet-owned write</span>
            <span>Validate → simulate → sign</span>
          </div>
        </div>
      </section>

      <ol className="stepper scroll-reveal">
        {STEPS.map((step, i) => (
          <li
            key={step}
            className={
              i === (mode === "list" ? 0 : 2) ? "is-active" : undefined
            }
          >
            <span className="mono-sub">{String(i + 1).padStart(2, "0")}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <section className="route-section route-section--paper submit-workspace scroll-reveal">
        <div className="route-section__intro">
          <p className="route-kicker">A public record starts here</p>
          <p className="lede">
            Describe the boundary in plain language, attach source and terms,
            then let your wallet approve the write.
          </p>
        </div>
        <div className="two-col two-col--form">
          <form
            id="contribution-form"
            className="form"
            onSubmit={submitContribution}
            aria-label="Contribute to the open registry"
          >
            <label className="form__import">
              <span className="mono-label">
                Paste submission JSON (optional)
              </span>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                rows={4}
                placeholder='Paste a submission JSON here and the fields below fill in automatically — e.g. { "enforcerName": "...", "contractAddress": "0x...", "termsSchema": { ... } }'
                spellCheck={false}
              />
              <div className="form__import-actions">
                <button
                  className="cta cta--ghost"
                  type="button"
                  onClick={applyImportedJson}
                >
                  Autofill fields from JSON <span aria-hidden="true">↓</span>
                </button>
                {importNote && (
                  <span className="band__note" role="status" aria-live="polite">
                    {importNote}
                  </span>
                )}
              </div>
            </label>

            <label>
              <span className="mono-label">Contribution type</span>
              <select
                value={mode}
                onChange={(event) =>
                  setMode(event.target.value as ContributionMode)
                }
              >
                <option value="list">List a new enforcer</option>
                <option value="attest">Attest to an existing claim</option>
                <option value="counter">Submit a counter-signal</option>
              </select>
            </label>

            <div className="form__pair">
              <label>
                <span className="mono-label">Enforcer name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="SessionFrequencyEnforcer"
                  required={mode === "list"}
                  disabled={mode !== "list"}
                />
              </label>
              <label>
                <span className="mono-label">Constraint category</span>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  disabled={mode !== "list"}
                >
                  <option value="frequency">Frequency</option>
                  <option value="amount">Amount limit</option>
                  <option value="target">Target address</option>
                  <option value="method">Callable method</option>
                  <option value="time">Time window</option>
                </select>
              </label>
            </div>

            <label>
              <span className="mono-label">Plain-language purpose</span>
              <textarea
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                rows={3}
                placeholder="Limits how often a delegated session may execute within a defined interval."
                required={mode === "list"}
                disabled={mode !== "list"}
              />
            </label>

            <div className="form__pair">
              <label>
                <span className="mono-label">Source URL</span>
                <input
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://github.com/example/enforcers"
                  required={mode === "list"}
                  disabled={mode !== "list"}
                />
              </label>
              <label>
                <span className="mono-label">Chain</span>
                <select value="1155" disabled>
                  <option value="1155">Intuition 1155</option>
                </select>
              </label>
            </div>

            {mode === "list" ? (
              <>
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
                      required
                    />
                  </label>
                  <label>
                    <span className="mono-label">Source version</span>
                    <input
                      value={sourceVersion}
                      onChange={(event) => setSourceVersion(event.target.value)}
                      placeholder="v1.0.0 or commit SHA"
                    />
                  </label>
                </div>

                <label>
                  <span className="mono-label">Terms schema JSON</span>
                  <textarea
                    rows={8}
                    value={termsJson}
                    onChange={(event) => setTermsJson(event.target.value)}
                    spellCheck={false}
                    required
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  <span className="mono-label">Existing claim ID</span>
                  <input
                    value={claimId}
                    onChange={(event) => setClaimId(event.target.value)}
                    placeholder="0x… 32-byte Intuition triple ID"
                    required
                  />
                </label>
                <div className="form__pair">
                  <label>
                    <span className="mono-label">Deposit amount (wei)</span>
                    <input
                      inputMode="numeric"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span className="mono-label">Curve ID</span>
                    <input
                      inputMode="numeric"
                      value={curveId}
                      onChange={(event) => setCurveId(event.target.value)}
                      required
                    />
                  </label>
                </div>
              </>
            )}
          </form>

          <aside className="preflight">
            <h2 className="headline headline--sm">Submission outline</h2>
            <Spec
              rows={[
                [
                  "Identity",
                  mode === "list" ? name || "Required" : "Claim signal",
                ],
                [
                  "Source",
                  mode === "list"
                    ? sourceUrl
                      ? "Provided"
                      : "Required"
                    : "Intuition triple",
                ],
                [
                  "Deployment",
                  mode === "list"
                    ? contractAddress
                      ? "Provided"
                      : "Required"
                    : "Verified before deposit",
                ],
                ["Wallet", walletLabel],
              ]}
            />
            <button
              className="cta cta--solid"
              type="button"
              onClick={connectWallet}
              disabled={busy || Boolean(wallet)}
            >
              {wallet ? "Wallet connected" : "Connect wallet"}{" "}
              <span aria-hidden="true">→</span>
            </button>
            <button
              className="cta cta--dark"
              type="submit"
              form="contribution-form"
              disabled={busy}
            >
              {busy
                ? "Waiting for wallet…"
                : mode === "list"
                  ? "Review and sign"
                  : "Review signal"}{" "}
              <span aria-hidden="true">→</span>
            </button>
            {status && (
              <p className="band__note" role="status" aria-live="polite">
                {status}
              </p>
            )}
            <p className="band__note">
              {mode === "list"
                ? "Validation, simulation, wallet approval, receipt verification, and indexer confirmation happen in order. The server never receives your signing key."
                : "The claim and target vault are verified before the wallet prompts for a support or opposition deposit."}
            </p>
          </aside>
        </div>
      </section>
    </main>
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
          <span className="route-kicker">Learn / Read the boundary</span>
          <h1 className="display">From permission to proof.</h1>
          <p className="lede">
            Choose your starting point. Each path moves from plain language to
            inspectable implementation.
          </p>
          <div className="route-hero__meta">
            <span>Plain language</span>
            <span>Encoded terms</span>
            <span>Evidence model</span>
          </div>
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

const COMPOSABILITY_RELATIONSHIPS =
  composabilityDocument.relationships as ComposabilityRelationship[];

/**
 * Curated use-case presets. The grouping is presentation; every compatibility
 * claim below it comes from the composability relationship data, which is
 * published as attestable Intuition triples (not hardcoded reasoning).
 */
const COMPOSABILITY_PRESETS: Array<{
  id: string;
  title: string;
  plain: string;
  keys: string[];
}> = [
  {
    id: "scoped-agent-action",
    title: "Scoped agent action",
    plain:
      "Give an agent a narrow, safe action surface: which contracts it may call, which methods, how often, and for how long.",
    keys: [
      "allowed-targets-methods-complement",
      "allowed-targets-call-count-complement",
      "allowed-targets-time-complement",
    ],
  },
  {
    id: "spending-native-value",
    title: "Spending native value",
    plain:
      "Let a delegation move TRUST. The scope you choose decides whether a payable call is even possible.",
    keys: ["function-call-payable-conflict"],
  },
  {
    id: "native-transfer-with-calldata",
    title: "Native transfer that also calls a contract",
    plain:
      "Move value and call a function in one delegated action. Some scopes silently block the calldata you need.",
    keys: ["native-transfer-calldata-conflict"],
  },
];

function RelationshipCard({
  relationship,
}: {
  relationship: ComposabilityRelationship;
}) {
  const isConflict = relationship.relation === "conflicts";
  return (
    <article className="compose-card">
      <div className="compose-card__relation">
        <span className="compose-card__term">{relationship.subjectType}</span>
        <Pill tone={isConflict ? "review" : "observed"}>
          {isConflict ? "conflicts with" : "complements"}
        </Pill>
        <span className="compose-card__term">{relationship.relatedType}</span>
      </div>
      <Spec
        rows={[
          ["When", relationship.context],
          ...(relationship.ordering
            ? ([["Ordering", relationship.ordering]] as Array<[string, string]>)
            : []),
        ]}
      />
      {relationship.evidenceNote && (
        <p className="compose-card__why">{relationship.evidenceNote}</p>
      )}
      <a
        className="compose-card__evidence"
        href={relationship.supportedBy}
        target="_blank"
        rel="noreferrer"
      >
        Evidence source <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}

export function ComposabilityPage() {
  return (
    <main>
      <section className="route-hero route-hero--visual route-hero--compose scroll-reveal">
        <div className="route-hero__mark" aria-hidden="true">
          <CaveatMarkSvg />
        </div>
        <div className="route-hero__copy">
          <span className="route-kicker">Composability / Fit</span>
          <h1 className="display">Which caveats work together.</h1>
          <p className="lede">
            Composability is a claim about a set of enforcers: whether they
            reinforce the intended permission, conflict with it, or repeat a
            restriction that is already there. Each claim below is an Intuition
            triple the community can extend and dispute.
          </p>
          <div className="route-hero__meta">
            <span>Plain language</span>
            <span>Chain-verified</span>
            <span>Attestable triples</span>
          </div>
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

        <BrowserFrame
          title="Composability"
          label="Reinforce · conflict · repeat"
          tone="ink"
        >
          <ComposabilityGraph relationships={COMPOSABILITY_RELATIONSHIPS} />
        </BrowserFrame>

        <div className="compose-presets">
          {COMPOSABILITY_PRESETS.map((preset) => {
            const relationships = preset.keys
              .map((key) =>
                COMPOSABILITY_RELATIONSHIPS.find((item) => item.key === key),
              )
              .filter((item): item is ComposabilityRelationship =>
                Boolean(item),
              );
            return (
              <section
                key={preset.id}
                id={preset.id}
                className="compose-preset"
              >
                <header className="compose-preset__head">
                  <h3 className="headline headline--sm">{preset.title}</h3>
                  <p className="lede">{preset.plain}</p>
                </header>
                <div className="compose-preset__grid">
                  {relationships.map((relationship) => (
                    <RelationshipCard
                      key={relationship.key}
                      relationship={relationship}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section className="route-section route-section--ink scroll-reveal">
        <div className="two-col">
          <div>
            <h2 className="headline">Represented as triples, not UI rules.</h2>
          </div>
          <p className="lede">
            Every relationship here is published to Intuition as a triple with
            its use-case context, ordering, and evidence. Anyone can stake
            $TRUST to support or dispute a claim, and any wallet or SDK can read
            the same relationships through the documented GraphQL pattern. The
            registry surfaces community signal; it does not invent a universal
            score.
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
          <span className="route-kicker intuition-lockup">
            <IntuitionLogo size={17} /> Intuition Graph
          </span>
          <h1 className="display">Registry data, ready for your interface.</h1>
          <p className="lede">
            Query enforcer identity, deployment evidence, terms, relationships,
            and community signal from Intuition.
          </p>
          <div className="route-hero__meta">
            <span>GraphQL</span>
            <span>Deployment-aware</span>
            <span>Evidence-first</span>
          </div>
        </div>
      </section>

      <section className="route-section route-section--paper developers-workspace scroll-reveal">
        <div className="route-section__intro">
          <p className="route-kicker">Integration surface</p>
          <p className="lede">
            Ask for the evidence your interface needs. Keep individual claims
            visible instead of inventing a universal trust score.
          </p>
        </div>
        <div className="two-col two-col--code">
          <div>
            <h2 className="headline">Ask for evidence, not assumptions.</h2>
            <p className="lede">
              The client takes explicit registry configuration. Products decide
              how to present individual signals without inventing a universal
              trust badge.
            </p>
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
            <span className="visually-hidden" role="status" aria-live="polite">
              {copyState === "copied"
                ? "GraphQL query copied to clipboard."
                : copyState === "error"
                  ? "Clipboard access is unavailable. Select the query text to copy it manually."
                  : ""}
            </span>
          </div>
        </div>
      </section>

      <section className="route-section route-section--ink developers-close scroll-reveal">
        <div className="two-col">
          <div>
            <h2 className="headline">One record, many surfaces.</h2>
          </div>
          <p className="lede">
            Wallets, explorers, agents, and developer tools can all resolve the
            same record. The signature prompt asks the index the site does, so a
            user reads the same terms wherever the delegation is presented.
          </p>
        </div>
      </section>
    </main>
  );
}
