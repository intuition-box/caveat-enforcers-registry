/**
 * Radial hub-and-spoke of the seeded registry.
 *
 * The centre node is the `ERC-7710 caveat enforcer deployment` class atom; each
 * spoke is a real membership triple on Intuition mainnet linking one of the 32
 * enforcer deployments to that class. Nodes are grouped and coloured by
 * restriction domain (a presentation grouping), and sit on a single ring so the
 * layout is deterministic and never overlaps — no physics to babysit.
 *
 * The registry table remains the accessible, screen-reader-first source; this
 * is an overview aid.
 */
import { useMemo, useState } from "react";

export type RadialNode = {
  name: string;
  domain: string;
  address: string;
  slug: string;
};

const SIZE = 720;
const CENTER = SIZE / 2;
const RING = 250;

// Coarse buckets keep the legend readable while still colouring by meaning.
const BUCKETS: Array<{ id: string; label: string; match: RegExp }> = [
  {
    id: "amount",
    label: "Amount & value",
    match: /amount|value|payment|stream/i,
  },
  {
    id: "access",
    label: "Target & method",
    match: /target|method|calldata|redeemer|action|execution/i,
  },
  {
    id: "time",
    label: "Time & count",
    match: /time|block|call count|nonce|periodic/i,
  },
  {
    id: "balance",
    label: "Balance & token",
    match: /balance|nft|multi-token|token/i,
  },
];
const OTHER = { id: "other", label: "Other rule", match: /.*/ };

function bucketOf(domain: string): string {
  return (BUCKETS.find((b) => b.match.test(domain)) ?? OTHER).id;
}

function polar(angle: number, radius: number): [number, number] {
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
}

export default function EnforcerRadialGraph({
  nodes,
  onSelect,
}: {
  nodes: RadialNode[];
  onSelect?: (slug: string) => void;
}) {
  const [active, setActive] = useState<string | null>(null);

  const placed = useMemo(() => {
    const ordered = [...nodes].sort(
      (a, b) =>
        bucketOf(a.domain).localeCompare(bucketOf(b.domain)) ||
        a.name.localeCompare(b.name),
    );
    const count = ordered.length || 1;
    return ordered.map((node, index) => {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      const [x, y] = polar(angle, RING);
      const [lx, ly] = polar(angle, RING + 26);
      const cos = Math.cos(angle);
      const anchor: "start" | "middle" | "end" =
        cos < -0.05 ? "end" : cos > 0.05 ? "start" : "middle";
      return {
        ...node,
        bucket: bucketOf(node.domain),
        x,
        y,
        labelX: lx,
        labelY: ly,
        anchor,
      };
    });
  }, [nodes]);

  const activeNode = placed.find((n) => n.slug === active) ?? null;
  const legend = [...BUCKETS, OTHER].filter((b) =>
    placed.some((n) => n.bucket === b.id),
  );

  return (
    <div className="radial">
      <div className="radial__scroll">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="radial__svg"
          role="img"
          aria-label={`Radial map of ${placed.length} ERC-7710 caveat enforcers seeded on Intuition mainnet, each linked to the deployment class at the centre. The full list is in the registry table.`}
        >
          {placed.map((node) => (
            <line
              key={`spoke-${node.slug}`}
              x1={CENTER}
              y1={CENTER}
              x2={node.x}
              y2={node.y}
              className={`radial__spoke ${
                active === null || active === node.slug ? "is-lit" : "is-dim"
              }`}
            />
          ))}

          <circle
            cx={CENTER}
            cy={CENTER}
            r={13}
            className="radial__hub"
            onMouseEnter={() => setActive(null)}
          />
          <text x={CENTER} y={CENTER + 34} className="radial__hub-label">
            deployment class
          </text>

          {placed.map((node) => (
            <g
              key={node.slug}
              className={`radial__node radial__node--${node.bucket} ${
                active === null || active === node.slug ? "is-lit" : "is-dim"
              } ${active === node.slug ? "is-active" : ""}`}
              tabIndex={0}
              role="button"
              aria-label={`${node.name}, ${node.domain}`}
              onMouseEnter={() => setActive(node.slug)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(node.slug)}
              onBlur={() => setActive(null)}
              onClick={() => onSelect?.(node.slug)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect?.(node.slug);
                }
              }}
            >
              <circle cx={node.x} cy={node.y} r={6} />
              {active === node.slug && (
                <text
                  x={node.labelX}
                  y={node.labelY}
                  textAnchor={node.anchor}
                  className="radial__node-label"
                >
                  {node.name}
                </text>
              )}
              <title>{`${node.name} — ${node.domain}`}</title>
            </g>
          ))}
        </svg>
      </div>

      <div className="radial__side">
        <ul className="radial__legend" aria-hidden="true">
          {legend.map((b) => (
            <li key={b.id} className={`radial__key radial__key--${b.id}`}>
              {b.label}
            </li>
          ))}
        </ul>
        <div className="radial__readout" role="status" aria-live="polite">
          {activeNode ? (
            <>
              <p className="radial__readout-name">{activeNode.name}</p>
              <p className="radial__readout-meta">{activeNode.domain}</p>
              <p className="radial__readout-addr">{activeNode.address}</p>
            </>
          ) : (
            <p className="radial__readout-meta">
              {placed.length} enforcers seeded on Intuition mainnet. Hover a
              node to read it; open the table below for the full record. Node
              size is uniform until community $TRUST staking varies.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
