import { useEffect, useMemo, useState } from "react";
import { loadRegistry, type RegistryState } from "./registry";

function shortId(id: string) {
  return `${id.slice(0, 10)}...${id.slice(-8)}`;
}

export function App() {
  const [registry, setRegistry] = useState<RegistryState | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void loadRegistry().then(setRegistry);
  }, []);

  const entries = useMemo(() => {
    if (registry?.kind !== "ready") return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return registry.entries;
    return registry.entries.filter(
      (entry) =>
        entry.label.toLowerCase().includes(normalizedQuery) ||
        entry.id.toLowerCase().includes(normalizedQuery),
    );
  }, [query, registry]);

  return (
    <main>
      <nav className="nav" aria-label="Primary navigation">
        <a
          className="brand"
          href="#top"
          aria-label="Caveat Enforcers Registry home"
        >
          <span className="mark" aria-hidden="true" />
          <span>Caveat Enforcers</span>
        </a>
        <div className="nav-meta">
          <span className="network-dot" aria-hidden="true" />
          Intuition mainnet
        </div>
      </nav>

      <section className="hero" id="top">
        <p className="eyebrow">Open registry for ERC-7710</p>
        <h1>
          Make permission rules
          <br />
          discoverable.
        </h1>
        <p className="hero-copy">
          A public directory for caveat enforcer deployments, terms schemas,
          source provenance, and evidence.
        </p>
        <a
          className="text-link"
          href="https://github.com/intuition-box/caveat-enforcers-registry"
        >
          Read the registry standard <span aria-hidden="true">↗</span>
        </a>
      </section>

      <section className="status-bar" aria-label="Registry status">
        <div>
          <span>Environment</span>
          <strong>Intuition mainnet</strong>
        </div>
        <div>
          <span>Registry model</span>
          <strong>Open contribution</strong>
        </div>
        <div>
          <span>Listing state</span>
          <strong>
            {registry?.kind === "ready"
              ? `${registry.entries.length} indexed`
              : "Awaiting review"}
          </strong>
        </div>
      </section>

      <section className="directory" aria-labelledby="directory-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Directory</p>
            <h2 id="directory-title">Enforcer deployments</h2>
          </div>
          <label className="search">
            <span className="sr-only">Search enforcers</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or term ID"
              type="search"
            />
          </label>
        </div>

        {registry === null && (
          <div className="notice">Loading the registry...</div>
        )}

        {registry?.kind === "unconfigured" && (
          <div className="notice setup-notice">
            <span className="notice-number">01</span>
            <div>
              <strong>
                The directory is ready for reviewed registry terms.
              </strong>
              <p>
                The application is connected to Intuition mainnet. It will
                display live entries once the approved membership predicate and
                deployment-class term IDs are added.
              </p>
            </div>
          </div>
        )}

        {registry?.kind === "error" && (
          <div className="notice error-notice">
            <strong>Registry unavailable.</strong>
            <p>{registry.message}</p>
          </div>
        )}

        {registry?.kind === "ready" && entries.length === 0 && (
          <div className="notice">
            <strong>No listed deployments match this search.</strong>
            <p>Try a different name or term ID, or clear the search.</p>
          </div>
        )}

        {registry?.kind === "ready" && entries.length > 0 && (
          <div className="entry-grid">
            {entries.map((entry, index) => (
              <article className="entry-card" key={entry.id}>
                <div className="entry-index">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="entry-avatar" aria-hidden="true">
                  {entry.image ? (
                    <img alt="" src={entry.image} />
                  ) : (
                    entry.label.slice(0, 1)
                  )}
                </div>
                <h3>{entry.label}</h3>
                <p>{shortId(entry.id)}</p>
                <time dateTime={entry.createdAt}>Indexed deployment</time>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="principles" aria-labelledby="principles-title">
        <p className="eyebrow">Every listing includes</p>
        <h2 id="principles-title">
          Enough context to evaluate a permission boundary.
        </h2>
        <div className="principle-grid">
          <article>
            <span>01</span>
            <h3>Deployment</h3>
            <p>A verified address on a specific chain.</p>
          </article>
          <article>
            <span>02</span>
            <h3>Terms schema</h3>
            <p>The exact format used to encode the rule.</p>
          </article>
          <article>
            <span>03</span>
            <h3>Evidence</h3>
            <p>Source, release, audit, and usage claims stay distinct.</p>
          </article>
        </div>
      </section>

      <footer>
        <span>Built for open permission infrastructure.</span>
        <a href="https://github.com/intuition-box/caveat-enforcers-registry">
          Repository ↗
        </a>
      </footer>
    </main>
  );
}
