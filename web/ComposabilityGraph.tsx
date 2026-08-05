/**
 * Composability arc diagram.
 *
 * Enforcers and scopes sit on a baseline; each relationship is an arc above it,
 * green for complements and red for conflicts. An arc layout (rather than a
 * force graph) is deliberate: at this node count it never overlaps labels and
 * renders deterministically, so it is seek-safe and reduced-motion friendly.
 *
 * The diagram is a visual aid. The relationship cards below it remain the
 * accessible, screen-reader-first source of the same data.
 */
import { useMemo, useState } from "react";
import { scalePoint } from "d3-scale";

export type GraphRelationship = {
  key: string;
  subjectType: string;
  relation: "conflicts" | "complements";
  relatedType: string;
  context: string;
  ordering?: string;
  evidenceNote?: string;
  supportedBy: string;
};

// Left-to-right order chosen so related terms sit close and arcs do not cross.
const NODE_ORDER = [
  "payable call",
  "ScopeType.FunctionCall",
  "call with calldata",
  "ScopeType.NativeTokenTransferAmount",
  "AllowedMethodsEnforcer",
  "AllowedTargetsEnforcer",
  "LimitedCallsEnforcer",
  "TimestampEnforcer",
];

const WIDTH = 960;
const HEIGHT = 460;
const BASELINE = 300;
const MARGIN = 90;

function shortLabel(label: string): string {
  return label.replace(/^ScopeType\./, "").replace(/Enforcer$/, "");
}

export default function ComposabilityGraph({
  relationships,
}: {
  relationships: GraphRelationship[];
}) {
  const [active, setActive] = useState<string | null>(null);

  const { nodes, x } = useMemo(() => {
    const present = new Set<string>();
    for (const r of relationships) {
      present.add(r.subjectType);
      present.add(r.relatedType);
    }
    const ordered = [
      ...NODE_ORDER.filter((label) => present.has(label)),
      ...[...present].filter((label) => !NODE_ORDER.includes(label)),
    ];
    const scale = scalePoint<string>()
      .domain(ordered)
      .range([MARGIN, WIDTH - MARGIN])
      .padding(0.5);
    return { nodes: ordered, x: scale };
  }, [relationships]);

  const edges = relationships.map((r) => {
    const x1 = x(r.subjectType) ?? MARGIN;
    const x2 = x(r.relatedType) ?? WIDTH - MARGIN;
    const [left, right] = x1 <= x2 ? [x1, x2] : [x2, x1];
    const height = Math.min((right - left) * 0.6 + 40, 230);
    return {
      ...r,
      x1: left,
      x2: right,
      path: `M ${left} ${BASELINE} C ${left} ${BASELINE - height}, ${right} ${BASELINE - height}, ${right} ${BASELINE}`,
    };
  });

  const isActiveNode = (label: string) => active === label;
  const isActiveEdge = (r: GraphRelationship) =>
    active === null || active === r.subjectType || active === r.relatedType;
  const activeEdges = active
    ? edges.filter((e) => e.subjectType === active || e.relatedType === active)
    : [];

  return (
    <div className="compose-graph">
      <div className="compose-graph__legend" aria-hidden="true">
        <span className="compose-graph__key compose-graph__key--complement">
          Complements
        </span>
        <span className="compose-graph__key compose-graph__key--conflict">
          Conflicts
        </span>
        <span className="compose-graph__hint">
          Hover or focus a term to trace its relationships.
        </span>
      </div>

      <div className="compose-graph__scroll">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="compose-graph__svg"
          role="img"
          aria-label="Arc diagram of caveat enforcer relationships. Green arcs mark enforcers that complement each other; red arcs mark scopes that conflict with an operation. The same relationships are listed as text below."
        >
          <line
            x1={MARGIN - 30}
            y1={BASELINE}
            x2={WIDTH - MARGIN + 30}
            y2={BASELINE}
            className="compose-graph__baseline"
          />

          {edges.map((edge) => (
            <path
              key={edge.key}
              d={edge.path}
              className={`compose-graph__arc compose-graph__arc--${edge.relation} ${
                isActiveEdge(edge) ? "is-lit" : "is-dim"
              }`}
              onMouseEnter={() => setActive(edge.subjectType)}
              onMouseLeave={() => setActive(null)}
            >
              <title>{`${shortLabel(edge.subjectType)} ${
                edge.relation === "conflicts" ? "conflicts with" : "complements"
              } ${shortLabel(edge.relatedType)} — ${edge.context}`}</title>
            </path>
          ))}

          {nodes.map((label) => {
            const cx = x(label) ?? MARGIN;
            const lit = active === null || isActiveNode(label);
            return (
              <g
                key={label}
                className={`compose-graph__node ${lit ? "is-lit" : "is-dim"} ${
                  isActiveNode(label) ? "is-active" : ""
                }`}
                tabIndex={0}
                role="button"
                aria-label={label}
                onMouseEnter={() => setActive(label)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(label)}
                onBlur={() => setActive(null)}
              >
                <circle cx={cx} cy={BASELINE} r={7} />
                <text
                  x={cx}
                  y={BASELINE + 26}
                  transform={`rotate(35 ${cx} ${BASELINE + 26})`}
                  className="compose-graph__label"
                >
                  {shortLabel(label)}
                </text>
                <title>{label}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="compose-graph__readout" role="status" aria-live="polite">
        {active && activeEdges.length ? (
          <ul>
            {activeEdges.map((edge) => {
              const other =
                edge.subjectType === active
                  ? edge.relatedType
                  : edge.subjectType;
              return (
                <li key={edge.key}>
                  <strong
                    className={`compose-graph__tag compose-graph__tag--${edge.relation}`}
                  >
                    {edge.relation === "conflicts"
                      ? "conflicts with"
                      : "complements"}
                  </strong>{" "}
                  {shortLabel(other)} — {edge.context}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>
            {relationships.length} relationships across {nodes.length} enforcers
            and scopes. Each arc is an Intuition triple you can attest to.
          </p>
        )}
      </div>
    </div>
  );
}
