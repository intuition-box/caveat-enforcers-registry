/**
 * Registry, Detail, Submit, Learn and Developers.
 *
 * Built to the Codex page designs: an orange-dotted mono eyebrow above every
 * statement, pill actions, hairline record rows, and dark and paper bands
 * alternating down the page. Art comes from the approved asset set and is
 * placed on the surface it was rendered for.
 *
 * The reference collection is labelled as reference data. Live records replace
 * it once the reviewed ontology IDs are configured — the page never presents
 * reference rows as registry listings.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { registryDeploymentsQuery } from "../src/registry";
import referenceDocument from "../data/metamask-v1.3.0.json";
import {
  fetchRegistry,
  fetchRegistryDetail,
  type RegistryApiState,
  type RegistryDetailResponse,
} from "./api";

/* ---------------------------------------------------------------- primitives */

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="eyebrow">
      <i aria-hidden="true" />
      {children}
    </p>
  );
}

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

function Art({
  name,
  alt,
  ratio,
}: {
  name: string;
  alt: string;
  ratio: string;
}) {
  return (
    <figure className="art" style={{ aspectRatio: ratio }}>
      <picture>
        <source
          media="(max-width: 48rem)"
          srcSet={`/art/${name.replace("desktop", "mobile")}`}
        />
        <img src={`/art/${name}`} alt={alt} loading="lazy" decoding="async" />
      </picture>
    </figure>
  );
}

/* ------------------------------------------------------------ reference data */

type Reference = {
  id: string;
  slug: string;
  name: string;
  purpose: string;
  domain: string;
  glyph: string;
  chain: string;
  state: "observed" | "review";
  address: string;
};

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

function glyphForDomain(domain: string): string {
  if (domain.includes("address")) return "target-address";
  if (domain.includes("method") || domain.includes("calldata"))
    return "callable-method";
  if (domain.includes("time") || domain.includes("block")) return "time-window";
  return "amount-limit";
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
      name: entry.name,
      purpose,
      domain,
      glyph: glyphForDomain(domain.toLowerCase()),
      chain: "Intuition 1155",
      state: entry.codeStatus === "observed" ? "observed" : "review",
      address: entry.address,
    };
  },
);

type RegistryRow = Reference & { live?: boolean };

function liveRow(
  entry: Extract<RegistryApiState, { kind: "ready" }>["entries"][number],
): RegistryRow {
  return {
    id: entry.id,
    slug: entry.id,
    name: entry.label,
    purpose: entry.description,
    domain: entry.domain,
    glyph: glyphForDomain(entry.domain.toLowerCase()),
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
          r.purpose.toLowerCase().includes(q) ||
          r.domain.toLowerCase().includes(q) ||
          r.address.toLowerCase().includes(q)),
    );
  }, [query, domain, chain]);
  const rows: RegistryRow[] = showReferenceFallback ? referenceRows : liveRows;

  const statusLabel = loading
    ? "Connecting to registry service"
    : liveRows.length
      ? "Indexed Intuition records"
      : showingLive
        ? "Reference collection · no indexed entries"
        : "Reference collection · read only";

  return (
    <main>
      <section className="band band--ink band--art">
        <div className="band__art" aria-hidden="true">
          <img src="/art/registry-header-desktop-2000x600.webp" alt="" />
        </div>
        <div className="band__inner">
          <Eyebrow>Community source of truth</Eyebrow>
          <h1 className="display">Find the boundary you need.</h1>
          <p className="lede">
            Search caveat enforcers by purpose, constraint, chain, or deployment
            evidence.
          </p>
        </div>
      </section>

      <section className="band band--paper">
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
    (detailState?.kind === "ready" ? detailState.label : undefined) ??
    "Indexed deployment";
  const purpose =
    record?.purpose ??
    summary?.description ??
    "An indexed Intuition deployment.";
  const address = record?.address ?? slug ?? "Address unavailable";
  const domain = record?.domain ?? summary?.domain ?? "Claim pending";
  const state = record?.state ?? "observed";

  return (
    <main>
      <section className="band band--ink">
        <div className="band__inner">
          <Link className="pill pill--back" to="/registry">
            ← Registry
          </Link>

          <Eyebrow>{record ? "Reference record" : "Indexed record"}</Eyebrow>

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

      <section className="band band--paper">
        <div className="two-col">
          <div>
            <Eyebrow>Plain-language anatomy</Eyebrow>
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
            <Eyebrow>Evidence relationships</Eyebrow>
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

export function SubmitPage() {
  return (
    <main>
      <section className="band band--ink band--split">
        <div>
          <Eyebrow>Open contribution flow</Eyebrow>
          <h1 className="display">Add what the ecosystem is missing.</h1>
          <p className="lede">
            List an enforcer, attest to an existing claim, or submit a
            counter-signal.
          </p>
        </div>
        <Art
          name="contribution-desktop-1600x900.webp"
          alt="A contributed record entering the index."
          ratio="1600 / 900"
        />
      </section>

      <ol className="stepper">
        {STEPS.map((step, i) => (
          <li key={step} className={i === 0 ? "is-active" : undefined}>
            <span className="mono-sub">{String(i + 1).padStart(2, "0")}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <section className="band band--paper">
        <div className="two-col two-col--form">
          <form
            className="form"
            onSubmit={(e) => e.preventDefault()}
            aria-label="List a new enforcer"
          >
            <label>
              <span className="mono-label">Contribution type</span>
              <select defaultValue="list">
                <option value="list">List a new enforcer</option>
                <option value="attest">Attest to an existing claim</option>
                <option value="counter">Submit a counter-signal</option>
              </select>
            </label>

            <div className="form__pair">
              <label>
                <span className="mono-label">Enforcer name</span>
                <input placeholder="SessionFrequencyEnforcer" />
              </label>
              <label>
                <span className="mono-label">Constraint category</span>
                <select defaultValue="frequency">
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
                rows={3}
                placeholder="Limits how often a delegated session may execute within a defined interval."
              />
            </label>

            <div className="form__pair">
              <label>
                <span className="mono-label">Source URL</span>
                <input placeholder="https://github.com/example/enforcers" />
              </label>
              <label>
                <span className="mono-label">Chain</span>
                <select defaultValue="1155">
                  <option value="1155">Intuition 1155</option>
                </select>
              </label>
            </div>
          </form>

          <aside className="preflight">
            <Eyebrow>Live preflight</Eyebrow>
            <h2 className="headline headline--sm">Submission outline</h2>
            <Spec
              rows={[
                ["Identity", "Ready"],
                ["Source", "Provided"],
                ["Deployment", "Next step"],
                ["Wallet write", "Not started"],
              ]}
            />
            <button className="cta cta--solid" type="button">
              Continue to deployment <span aria-hidden="true">→</span>
            </button>
            <p className="band__note">
              Nothing is written on-chain from this screen. Every submission is
              validated and shown as a transaction plan before any write.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}

/* ----------------------------------------------------------------------- learn */

const PATHS = [
  [
    "New to caveats",
    "Understand permissions, boundaries, and enforcers in plain language.",
  ],
  [
    "Wallet builder",
    "Query records, compare evidence, and present rules before signing.",
  ],
  [
    "Enforcer author",
    "Encode terms, publish deployments, and contribute registry claims.",
  ],
  [
    "Researcher",
    "Inspect provenance, signal, counter-signal, and change history.",
  ],
];

export function LearnPage() {
  return (
    <main>
      <section className="band band--paper band--split">
        <div>
          <Eyebrow>Learn by mental model</Eyebrow>
          <h1 className="display">From permission to proof.</h1>
          <p className="lede">
            Choose your starting point. Each path moves from plain language to
            inspectable implementation.
          </p>
        </div>
        <Art
          name="learning-desktop-1600x1100.webp"
          alt="A permission resolving from plain language into an inspectable record."
          ratio="1600 / 1100"
        />
      </section>

      <section className="band band--paper band--tight">
        <div className="rail rail--head">
          <div>
            <Eyebrow>Choose a path</Eyebrow>
            <h2 className="headline">Learn at your depth.</h2>
          </div>
          <p className="lede">
            No wall of documentation. Each track answers one audience's
            immediate questions first.
          </p>
        </div>

        <ul className="table table--paths">
          {PATHS.map(([title, body], i) => (
            <li key={title}>
              <Link to="/learn">
                <span className="mono-sub">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="table__name">
                  <strong>{title}</strong>
                  <em>{body}</em>
                </span>
                <span className="table__start">
                  Start <span aria-hidden="true">→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

/* ------------------------------------------------------------------ developers */

export function DevelopersPage() {
  const snippet = registryDeploymentsQuery.trim();

  return (
    <main>
      <section className="band band--ink band--split">
        <div>
          <Eyebrow>Build on the same source</Eyebrow>
          <h1 className="display">Registry data, ready for your interface.</h1>
          <p className="lede">
            Query enforcer identity, deployment evidence, terms, relationships,
            and community signal from Intuition.
          </p>
        </div>
        <Art
          name="composition-desktop-1600x900.webp"
          alt="One record resolving across many surfaces."
          ratio="1600 / 900"
        />
      </section>

      <section className="band band--paper">
        <div className="two-col two-col--code">
          <div>
            <Eyebrow>Query pattern</Eyebrow>
            <h2 className="headline">Ask for evidence, not assumptions.</h2>
            <p className="lede">
              The client takes explicit registry configuration. Products decide
              how to present individual signals without inventing a universal
              trust badge.
            </p>
          </div>
          <pre className="code" aria-label="Registry deployments GraphQL query">
            <code>{snippet}</code>
          </pre>
        </div>
      </section>

      <section className="band band--ink">
        <div className="two-col">
          <div>
            <Eyebrow>Integration architecture</Eyebrow>
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
