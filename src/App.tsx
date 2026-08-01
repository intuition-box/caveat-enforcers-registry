import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent,
} from "react";
import { loadRegistry, type RegistryState } from "./registry";
import { referenceEntries } from "./reference";
import type { EnforcerRecord } from "./types";

type FilterState = {
  domain: string;
  chain: string;
  audit: string;
  sort: "name" | "stake";
};

type WalletProvider = {
  request: (args: { method: string }) => Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

const presets = [
  {
    number: "01",
    name: "Time-gated token transfer",
    summary:
      "Move a token only inside a defined time window and below a clear amount cap.",
    enforcers: ["TimestampEnforcer", "ERC20TransferAmountEnforcer"],
    relationship: "complements",
    reason:
      "One constrains when the action can happen. The other constrains how much can move. Their conditions are independent, so the pair narrows risk without duplicating the same check.",
  },
  {
    number: "02",
    name: "Scoped agent action",
    summary:
      "Give an agent a narrow set of callable methods, targets, and attempts.",
    enforcers: [
      "AllowedTargetsEnforcer",
      "AllowedMethodsEnforcer",
      "LimitedCallsEnforcer",
    ],
    relationship: "complements",
    reason:
      "Target and method restrictions define the action surface. The call limit bounds repetition. The combination is coherent when every allowed method is valid on every allowed target.",
  },
  {
    number: "03",
    name: "Exact batch execution",
    summary:
      "Require a known batch of calls while preserving a separate target boundary.",
    enforcers: ["ExactExecutionBatchEnforcer", "AllowedTargetsEnforcer"],
    relationship: "contextual complement",
    reason:
      "Exact execution defines the expected batch. Target allowlisting adds a second safety boundary. A compatibility claim must include the batch format and target set that make the pair valid.",
  },
];

const domains = [
  "All domains",
  "Assets",
  "Calls",
  "Timing & limits",
  "Identity & state",
];
const chains = [
  "All chains",
  "Multi-chain reference",
  "Intuition 1155",
  "Ethereum 1",
  "Base 8453",
];
const audits = [
  "All evidence",
  "Source linked",
  "Audited evidence",
  "No audit claim",
];

function shortId(id: string) {
  if (id.startsWith("reference:")) return "Reference set";
  return `${id.slice(0, 10)}...${id.slice(-8)}`;
}

function formatStake(value: number) {
  return value > 0 ? `${value.toLocaleString()} TRUST` : "Awaiting signal";
}

function revealOnScroll() {
  const items = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return () => undefined;
  }
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach(
        (entry) =>
          entry.isIntersecting && entry.target.classList.add("is-visible"),
      ),
    { threshold: 0.14 },
  );
  items.forEach((item) => observer.observe(item));
  return () => observer.disconnect();
}

export function App() {
  const [registry, setRegistry] = useState<RegistryState | null>(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    domain: "All domains",
    chain: "All chains",
    audit: "All evidence",
    sort: "name",
  });
  const [selected, setSelected] = useState<EnforcerRecord | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [lensActive, setLensActive] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletMessage, setWalletMessage] = useState("");
  const [signalMessage, setSignalMessage] = useState("");
  const [heroStyle, setHeroStyle] = useState<CSSProperties>({});

  useEffect(() => {
    void loadRegistry().then(setRegistry);
  }, []);

  useEffect(() => revealOnScroll(), [registry]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelected(null);
        setSubmitOpen(false);
        setMobileMenu(false);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const isPreview = registry?.kind !== "ready";
  const entries = useMemo<EnforcerRecord[]>(() => {
    if (registry?.kind !== "ready") return referenceEntries;
    return registry.entries.map((entry) => ({
      ...entry,
      description: entry.description || "Onchain enforcer deployment.",
      domain: entry.domain || "Unclassified",
      operation: entry.operation || "Claim pending",
      chain: entry.chain || "Chain claim pending",
      audit: entry.audit || "No audit claim",
      stake: entry.stake || 0,
      stakeLabel: entry.stakeLabel || formatStake(entry.stake || 0),
      state: "live",
      deployment: entry.deployment || entry.id,
      source: entry.source || "Source claim pending",
      terms: entry.terms || "Terms schema claim pending.",
      claims: entry.claims || [],
      usage: entry.usage || [],
    }));
  }, [registry]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...entries]
      .filter(
        (entry) =>
          filters.domain === "All domains" || entry.domain === filters.domain,
      )
      .filter(
        (entry) =>
          filters.chain === "All chains" || entry.chain === filters.chain,
      )
      .filter(
        (entry) =>
          filters.audit === "All evidence" || entry.audit === filters.audit,
      )
      .filter(
        (entry) =>
          !normalizedQuery ||
          `${entry.label} ${entry.id} ${entry.description}`
            .toLowerCase()
            .includes(normalizedQuery),
      )
      .sort((a, b) =>
        filters.sort === "stake"
          ? b.stake - a.stake || a.label.localeCompare(b.label)
          : a.label.localeCompare(b.label),
      );
  }, [entries, filters, query]);

  const onHeroPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    setHeroStyle({
      "--pointer-x": `${x * 22}px`,
      "--pointer-y": `${y * 14}px`,
    } as CSSProperties);
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      setWalletMessage(
        "No injected wallet found. Install a wallet to prepare a mainnet submission.",
      );
      return;
    }
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      setWallet(accounts?.[0] ?? null);
      setWalletMessage(
        accounts?.[0]
          ? "Wallet connected. Review the transaction before signing."
          : "No account was returned.",
      );
    } catch {
      setWalletMessage("Wallet connection was cancelled.");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!wallet) {
      setWalletMessage(
        "Connect a wallet first. No transaction has been created.",
      );
      return;
    }
    setWalletMessage(
      "Submission prepared. The reviewed ontology IDs are still required before a mainnet write can be signed.",
    );
  };

  const signal = (side: "endorse" | "dispute") => {
    setSignalMessage(
      wallet
        ? `${side === "endorse" ? "Endorsement" : "Dispute"} prepared for review. No funds moved.`
        : "Connect a wallet to prepare a signal. No funds moved.",
    );
  };

  return (
    <main className={lensActive ? "lens-active" : ""}>
      <nav className="nav" aria-label="Primary navigation">
        <a
          className="brand"
          href="#top"
          aria-label="Caveat Enforcers Registry home"
          onClick={() => setMobileMenu(false)}
        >
          <span className="mark" aria-hidden="true" />
          <span>Caveat Enforcers</span>
        </a>
        <div className={`nav-links ${mobileMenu ? "open" : ""}`}>
          <a href="#directory" onClick={() => setMobileMenu(false)}>
            Browse
          </a>
          <a href="#composability" onClick={() => setMobileMenu(false)}>
            Composability
          </a>
          <a href="#submit" onClick={() => setMobileMenu(false)}>
            Submit
          </a>
        </div>
        <div className="nav-actions">
          <span className="network">
            <span className="network-dot" aria-hidden="true" /> Intuition
            mainnet
          </span>
          <button className="connect-button" onClick={connectWallet}>
            {wallet
              ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
              : "Connect wallet"}
          </button>
          <button
            className="menu-button"
            aria-label="Toggle navigation"
            aria-expanded={mobileMenu}
            onClick={() => setMobileMenu(!mobileMenu)}
          >
            <span />
            <span />
          </button>
        </div>
      </nav>

      <section
        className="hero"
        id="top"
        style={heroStyle}
        onPointerMove={onHeroPointerMove}
      >
        <div className="hero-copy-wrap" data-reveal>
          <p className="eyebrow">
            <span className="live-pip" /> Open registry for ERC-7710
          </p>
          <h1>
            Permission
            <br />
            <em>needs context.</em>
          </h1>
          <p className="hero-copy">
            Caveat enforcers, mapped to the rules they enforce, the chains they
            live on, and the evidence behind every claim.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#directory">
              Explore registry <span>↘</span>
            </a>
            <a className="button button-quiet" href="#composability">
              See how they compose <span>↘</span>
            </a>
          </div>
        </div>
        <div
          className="hero-visual"
          aria-label="Interactive registry constellation"
          role="img"
        >
          <div className="orbit orbit-one">
            <span className="orbit-node node-a">A</span>
            <span className="orbit-node node-b">T</span>
          </div>
          <div className="orbit orbit-two">
            <span className="orbit-node node-c">C</span>
          </div>
          <button
            className="lens-trigger"
            onClick={() => setLensActive(!lensActive)}
            aria-pressed={lensActive}
          >
            <span className="lens-ring" />
            <span>{lensActive ? "Lens active" : "Activate lens"}</span>
          </button>
          <div className="hero-visual-caption">
            <span>01</span>
            <span>
              {lensActive ? "Composability lens / on" : "Move through the map"}
            </span>
          </div>
        </div>
        <div className="hero-scroll">
          <span>Scroll to inspect</span>
          <i />
        </div>
      </section>

      <section
        className="signal-strip"
        aria-label="Registry status"
        data-reveal
      >
        <div>
          <span>Environment</span>
          <strong>Intuition mainnet</strong>
        </div>
        <div>
          <span>Directory</span>
          <strong>
            {isPreview ? "Reference preview" : `${entries.length} indexed`}
          </strong>
        </div>
        <div>
          <span>Signal</span>
          <strong>TRUST-weighted claims</strong>
        </div>
        <div>
          <span>Model</span>
          <strong>Open contribution</strong>
        </div>
      </section>

      <section
        className="directory section-shell"
        id="directory"
        aria-labelledby="directory-title"
      >
        <div className="section-intro" data-reveal>
          <div>
            <p className="eyebrow">01 / Browse</p>
            <h2 id="directory-title">
              Find the boundary
              <br />
              <em>before you sign.</em>
            </h2>
          </div>
          <p>
            Search the reference collection, compare deployment context, then
            open every supporting and opposing claim. Live records resolve from
            canonical Intuition term IDs.
          </p>
        </div>
        {isPreview && (
          <div className="preview-banner" data-reveal>
            <span className="preview-symbol">◌</span>
            <div>
              <strong>Reference set preview</strong>
              <p>
                The 32 official MetaMask enforcer names are shown for interface
                review. They are not being presented as seeded mainnet records.
              </p>
            </div>
            <span className="preview-status">Ontology review pending</span>
          </div>
        )}
        <div className="directory-toolbar" data-reveal>
          <label className="search-field">
            <span className="sr-only">Search enforcers</span>
            <span className="search-icon">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, address, or rule"
              type="search"
            />
          </label>
          <div className="toolbar-actions">
            <label>
              <span className="sr-only">Domain filter</span>
              <select
                value={filters.domain}
                onChange={(event) =>
                  setFilters({ ...filters, domain: event.target.value })
                }
              >
                {domains.map((domain) => (
                  <option key={domain}>{domain}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Chain filter</span>
              <select
                value={filters.chain}
                onChange={(event) =>
                  setFilters({ ...filters, chain: event.target.value })
                }
              >
                {chains.map((chain) => (
                  <option key={chain}>{chain}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Evidence filter</span>
              <select
                value={filters.audit}
                onChange={(event) =>
                  setFilters({ ...filters, audit: event.target.value })
                }
              >
                {audits.map((audit) => (
                  <option key={audit}>{audit}</option>
                ))}
              </select>
            </label>
            <label className="sort-label">
              <span>Sort</span>
              <select
                value={filters.sort}
                onChange={(event) =>
                  setFilters({
                    ...filters,
                    sort: event.target.value as FilterState["sort"],
                  })
                }
              >
                <option value="name">Name</option>
                <option value="stake">TRUST stake</option>
              </select>
            </label>
          </div>
        </div>
        <div className="directory-meta">
          <span>
            {filteredEntries.length}{" "}
            {isPreview ? "reference enforcers" : "indexed enforcers"}
          </span>
          <span>
            Each row opens its evidence trail <b>↗</b>
          </span>
        </div>
        <div
          className="registry-list"
          role="list"
          aria-label="Registered enforcers"
        >
          {filteredEntries.map((entry, index) => (
            <button
              className="registry-row"
              role="listitem"
              key={entry.id}
              onClick={() => setSelected(entry)}
              data-reveal
            >
              <span className="row-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="row-main">
                <strong>{entry.label}</strong>
                <small>{entry.description}</small>
              </span>
              <span className="row-domain">{entry.domain}</span>
              <span className="row-chain">{entry.chain}</span>
              <span className="row-audit">
                <i />
                {entry.audit}
              </span>
              <span className="row-stake">
                {entry.state === "live"
                  ? formatStake(entry.stake)
                  : "Pending seed"}
              </span>
              <span className="row-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
          ))}
        </div>
        {filteredEntries.length === 0 && (
          <div className="empty-state">
            No enforcers match those filters. Clear a filter and try again.
          </div>
        )}
      </section>

      <section
        className="composability section-shell"
        id="composability"
        aria-labelledby="composability-title"
      >
        <div className="section-intro" data-reveal>
          <div>
            <p className="eyebrow">02 / Compose</p>
            <h2 id="composability-title">
              Good permissions
              <br />
              <em>work in layers.</em>
            </h2>
          </div>
          <p>
            Composability is not a green checkmark. It is a contextual claim
            about which restrictions reinforce, conflict with, or duplicate one
            another for a specific job.
          </p>
        </div>
        <div className="compose-explainer" data-reveal>
          <div className="compose-diagram">
            <span className="diagram-node node-base">Base rule</span>
            <span className="diagram-line line-one" />
            <span className="diagram-line line-two" />
            <span className="diagram-node node-layer">Context</span>
            <span className="diagram-node node-signal">Signal</span>
          </div>
          <div>
            <p className="eyebrow">How to read the guide</p>
            <h3>Every relationship has a context.</h3>
            <p>
              Preset guidance is proposed as Intuition triples. The UI can
              surface support and dispute around the exact relationship instead
              of hiding a compatibility list in application code.
            </p>
            <a
              className="text-link"
              href="https://github.com/intuition-box/caveat-enforcers-registry/blob/main/docs/SCHEMA.md"
            >
              Read the schema ↗
            </a>
          </div>
        </div>
        <div className="preset-list">
          {presets.map((preset) => (
            <article className="preset" key={preset.name} data-reveal>
              <div className="preset-top">
                <span>{preset.number}</span>
                <span className="relation-chip">{preset.relationship}</span>
              </div>
              <h3>{preset.name}</h3>
              <p className="preset-summary">{preset.summary}</p>
              <div className="preset-enforcers">
                {preset.enforcers.map((enforcer) => (
                  <span key={enforcer}>{enforcer}</span>
                ))}
              </div>
              <p className="preset-reason">
                <strong>Why it works</strong>
                {preset.reason}
              </p>
              <button
                className="preset-action"
                onClick={() =>
                  setSignalMessage(
                    "This relationship is represented as a proposed triple pattern. Team ontology review is required before it becomes a live claim.",
                  )
                }
              >
                Inspect relationship <span>↗</span>
              </button>
            </article>
          ))}
        </div>
      </section>

      <section
        className="submit-section section-shell"
        id="submit"
        aria-labelledby="submit-title"
      >
        <div className="submit-panel" data-reveal>
          <div className="submit-copy">
            <p className="eyebrow">03 / Contribute</p>
            <h2 id="submit-title">
              Add the rule
              <br />
              <em>you need next.</em>
            </h2>
            <p>
              Submit a new enforcer in the same format as the reference set.
              Metadata, terms schema, source, and chain availability stay
              attached to the claim.
            </p>
            <div className="submit-checklist">
              <span>
                <i />
                CAIP-10 deployment identity
              </span>
              <span>
                <i />
                Terms codec and fixtures
              </span>
              <span>
                <i />
                Source and evidence trail
              </span>
            </div>
          </div>
          <form className="submit-form" onSubmit={handleSubmit}>
            <div className="form-header">
              <span>New deployment</span>
              <span>Preflight / mainnet</span>
            </div>
            <label>
              Contract address
              <input name="address" required placeholder="0x..." />
            </label>
            <div className="form-row">
              <label>
                Chain
                <select name="chain">
                  <option>Intuition / 1155</option>
                  <option>Ethereum / 1</option>
                  <option>Base / 8453</option>
                </select>
              </label>
              <label>
                Domain
                <select name="domain">
                  <option>Assets</option>
                  <option>Calls</option>
                  <option>Timing & limits</option>
                  <option>Identity & state</option>
                </select>
              </label>
            </div>
            <label>
              Enforcer name
              <input name="name" required placeholder="ExampleEnforcer" />
            </label>
            <label>
              Terms schema
              <textarea
                name="terms"
                required
                placeholder="Describe the encoding, fields, and decoder..."
                rows={3}
              />
            </label>
            <div className="form-actions">
              <button className="button button-primary" type="submit">
                Prepare submission <span>↗</span>
              </button>
              <span>Wallet signature required</span>
            </div>
            {walletMessage && (
              <p className="form-message" role="status">
                {walletMessage}
              </p>
            )}
          </form>
        </div>
      </section>

      <footer>
        <span>Caveat Enforcers Registry / Open permission infrastructure</span>
        <span>
          Intuition mainnet /{" "}
          <a href="https://github.com/intuition-box/caveat-enforcers-registry">
            Source ↗
          </a>
        </span>
      </footer>

      {signalMessage && (
        <div className="toast" role="status">
          <span>{signalMessage}</span>
          <button
            onClick={() => setSignalMessage("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {selected && (
        <div
          className="modal-layer"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSelected(null)
          }
        >
          <section
            className="detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
          >
            <button
              className="modal-close"
              onClick={() => setSelected(null)}
              aria-label="Close enforcer details"
            >
              ×
            </button>
            <div className="detail-kicker">
              <span className="eyebrow">Enforcer detail</span>
              <span
                className={
                  selected.state === "live" ? "live-tag" : "reference-tag"
                }
              >
                {selected.state === "live"
                  ? "Indexed onchain"
                  : "Reference preview"}
              </span>
            </div>
            <h2 id="detail-title">{selected.label}</h2>
            <p className="detail-description">{selected.description}</p>
            <div className="detail-facts">
              <div>
                <span>Domain</span>
                <strong>{selected.domain}</strong>
              </div>
              <div>
                <span>Operation</span>
                <strong>{selected.operation}</strong>
              </div>
              <div>
                <span>Chain</span>
                <strong>{selected.chain}</strong>
              </div>
              <div>
                <span>TRUST stake</span>
                <strong>{formatStake(selected.stake)}</strong>
              </div>
            </div>
            <div className="detail-columns">
              <div>
                <h3>Attested triples</h3>
                <div className="claim-list">
                  {selected.claims.map((claim) => (
                    <div
                      className="claim"
                      key={`${claim.predicate}-${claim.object}`}
                    >
                      <div>
                        <b>{claim.predicate}</b>
                        <span>{claim.object}</span>
                      </div>
                      <small>{claim.stake}</small>
                    </div>
                  ))}
                </div>
                <div className="signal-actions">
                  <button onClick={() => signal("endorse")}>
                    Endorse claim
                  </button>
                  <button onClick={() => signal("dispute")}>
                    Dispute claim
                  </button>
                </div>
              </div>
              <div>
                <h3>Terms schema</h3>
                <pre>{selected.terms}</pre>
                <h3>Provenance</h3>
                <p className="provenance">{selected.source}</p>
                <p className="provenance">{selected.deployment}</p>
                <h3>Usage</h3>
                <ul className="usage-list">
                  {selected.usage.map((usage) => (
                    <li key={usage}>{usage}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}

      {submitOpen && (
        <div
          className="modal-layer"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSubmitOpen(false)
          }
        >
          <section
            className="connect-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-title"
          >
            <button
              className="modal-close"
              onClick={() => setSubmitOpen(false)}
              aria-label="Close wallet panel"
            >
              ×
            </button>
            <span className="eyebrow">Transaction gate</span>
            <h2 id="connect-title">
              Ready to sign
              <br />
              <em>when the terms are clear.</em>
            </h2>
            <p>
              Wallet connection, preflight, direct onchain verification, and
              bounded indexer polling happen in that order.
            </p>
            <button className="button button-primary" onClick={connectWallet}>
              {wallet ? `Connected ${wallet.slice(0, 6)}...` : "Connect wallet"}{" "}
              <span>↗</span>
            </button>
            {walletMessage && (
              <p className="form-message" role="status">
                {walletMessage}
              </p>
            )}
            <div className="gate-note">
              <i />
              Mainnet write remains gated by reviewed ontology IDs.
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
