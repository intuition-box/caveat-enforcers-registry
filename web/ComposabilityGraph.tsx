/**
 * Composability graph — an Obsidian-style graph view.
 *
 * A central browse hub ties the documented terms together (like an Obsidian
 * index note); solid coloured links are the real complements/conflicts
 * relationships. The faint outer halo is the honest part: those are the real
 * registry enforcers that have no composability relationship yet — the graph's
 * "orphans". Layout is a d3-force simulation settled once and frozen
 * (deterministic, seek-safe); hover/selection only highlights.
 *
 * Nothing here infers compatibility or turns a relationship into a score.
 */
import { useMemo, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import referenceDocument from "../data/metamask-v1.3.0.json";
import { claimDistribution, intuitionClaimUrl } from "./claim-presentation";

export type GraphRelationship = {
  key: string;
  subjectType: string;
  relation: "conflicts" | "complements";
  relatedType: string;
  context: string;
  ordering?: string;
  evidenceNote?: string;
  supportedBy: string;
  claimId?: string;
  live?: boolean;
  support?: string;
  opposition?: string;
};

type Selection =
  | { type: "term"; value: string }
  | { type: "relationship"; value: string }
  | null;

type Position = { x: number; y: number };
type SimNode = SimulationNodeDatum & { id: string; degree: number };
type SimLink = SimulationLinkDatum<SimNode> & { key: string };

const VIEWBOX = { width: 1000, height: 660 };
const CENTER = { x: VIEWBOX.width / 2, y: VIEWBOX.height / 2 };
const HUB = "__hub__";
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

function shortLabel(value: string): string {
  const labels: Record<string, string> = {
    "ScopeType.FunctionCall": "Function call",
    "ScopeType.NativeTokenTransferAmount": "Native transfer",
    "payable call": "Payable call",
    "call with calldata": "Call with calldata",
    AllowedTargetsEnforcer: "Allowed targets",
    AllowedMethodsEnforcer: "Allowed methods",
    LimitedCallsEnforcer: "Limited calls",
    TimestampEnforcer: "Time window",
    ERC20TransferAmountEnforcer: "ERC-20 cap",
    ExactExecutionBatchEnforcer: "Exact batch",
  };
  return (
    labels[value] ?? value.replace(/^ScopeType\./, "").replace(/Enforcer$/, "")
  );
}

function curvePath(a: Position, b: Position): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = Math.min(58, len * 0.13);
  const cx = mx - (dy / len) * off;
  const cy = my + (dx / len) * off;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

export default function ComposabilityGraph({
  relationships,
}: {
  relationships: GraphRelationship[];
}) {
  const [selection, setSelection] = useState<Selection>(null);
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);

  const { namedTerms, positions, orphans, maxDegree } = useMemo(() => {
    const degree = new Map<string, number>();
    const present = new Set<string>();
    for (const r of relationships) {
      present.add(r.subjectType);
      present.add(r.relatedType);
      degree.set(r.subjectType, (degree.get(r.subjectType) ?? 0) + 1);
      degree.set(r.relatedType, (degree.get(r.relatedType) ?? 0) + 1);
    }
    const named = [...present];

    // Force core: a central hub linked weakly to every named term (keeps the
    // otherwise-disconnected relationship pairs in one cohesive cluster), plus
    // the real relationship links.
    const coreNodes: SimNode[] = [
      { id: HUB, degree: 0 },
      ...named.map((id) => ({ id, degree: degree.get(id) ?? 0 })),
    ];
    const coreLinks: SimLink[] = [
      ...named.map((id) => ({ source: HUB, target: id, key: `hub:${id}` })),
      ...relationships.map((r) => ({
        source: r.subjectType,
        target: r.relatedType,
        key: r.key,
      })),
    ];
    const sim = forceSimulation<SimNode>(coreNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(coreLinks)
          .id((d) => d.id)
          .distance((l) => (l.key.startsWith("hub:") ? 150 : 96))
          .strength((l) => (l.key.startsWith("hub:") ? 0.14 : 0.55)),
      )
      .force("charge", forceManyBody().strength(-540))
      .force("collide", forceCollide<SimNode>().radius(52))
      .force("center", forceCenter(0, 0))
      .force("x", forceX(0).strength(0.06))
      .force("y", forceY(0).strength(0.06))
      .stop();
    for (let i = 0; i < 460; i += 1) sim.tick();

    const xs = coreNodes.map((n) => n.x ?? 0);
    const ys = coreNodes.map((n) => n.y ?? 0);
    const spanX = Math.max(1, Math.max(...xs) - Math.min(...xs));
    const spanY = Math.max(1, Math.max(...ys) - Math.min(...ys));
    // Keep the core in the middle third so the orphan halo has room.
    const scale = Math.min(360 / spanX, 250 / spanY);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const positionMap: Record<string, Position> = {};
    for (const n of coreNodes) {
      positionMap[n.id] = {
        x: CENTER.x + ((n.x ?? 0) - cx) * scale,
        y: CENTER.y + ((n.y ?? 0) - cy) * scale,
      };
    }

    // Orphan halo: real registry enforcers with no composability relationship
    // yet. Deterministic golden-angle scatter in an elliptical outer ring.
    const orphanNames = (referenceDocument.enforcers as Array<{ name: string }>)
      .map((e) => e.name)
      .filter((name) => !present.has(name));
    const orphanNodes = orphanNames.map((name, i) => {
      const t = orphanNames.length > 1 ? i / (orphanNames.length - 1) : 0;
      const angle = i * GOLDEN;
      const rx = 330 + t * 150;
      const ry = 235 + t * 70;
      return {
        name,
        x: CENTER.x + rx * Math.cos(angle),
        y: CENTER.y + ry * Math.sin(angle),
      };
    });

    return {
      namedTerms: named.map((id) => ({ id, degree: degree.get(id) ?? 0 })),
      positions: positionMap,
      orphans: orphanNodes,
      maxDegree: Math.max(1, ...named.map((id) => degree.get(id) ?? 0)),
    };
  }, [relationships]);

  // Details panel + persistent selection come from a click.
  const selectedRelationship =
    selection?.type === "relationship"
      ? relationships.find((r) => r.key === selection.value)
      : undefined;
  const selectedTerm = selection?.type === "term" ? selection.value : undefined;
  const selectedDistribution = selectedRelationship?.live
    ? claimDistribution(
        selectedRelationship.support,
        selectedRelationship.opposition,
      )
    : null;
  const inspectorConnected = selectedTerm
    ? relationships.filter(
        (r) => r.subjectType === selectedTerm || r.relatedType === selectedTerm,
      )
    : [];

  // Highlight follows the hover (Obsidian-style), falling back to the click
  // selection so a chosen node stays lit while its details are open.
  const focusTerm = hoveredTerm ?? selectedTerm;
  const focusRelationship = hoveredTerm ? undefined : selectedRelationship;
  const focusConnected = focusTerm
    ? relationships.filter(
        (r) => r.subjectType === focusTerm || r.relatedType === focusTerm,
      )
    : [];
  const activeRelationshipKeys = new Set(
    focusRelationship
      ? [focusRelationship.key]
      : focusConnected.map((r) => r.key),
  );
  const activeTerms = new Set(
    focusRelationship
      ? [focusRelationship.subjectType, focusRelationship.relatedType]
      : focusTerm
        ? [
            focusTerm,
            ...focusConnected.flatMap((r) => [r.subjectType, r.relatedType]),
          ]
        : [],
  );
  const dimGraph = hoveredTerm !== null || selection !== null;

  const selectRelationship = (relationship: GraphRelationship) =>
    setSelection((current) =>
      current?.type === "relationship" && current.value === relationship.key
        ? null
        : { type: "relationship", value: relationship.key },
    );
  const selectTerm = (term: string) =>
    setSelection((current) =>
      current?.type === "term" && current.value === term
        ? null
        : { type: "term", value: term },
    );

  return (
    <section className="cgraph" aria-label="Composability relationship graph">
      <header className="cgraph__header">
        <div>
          <h2>Trace a boundary before you compose it.</h2>
          <p>
            Hover or select a node or line to read the exact relationship. Solid
            links are documented relationships; faint outer nodes are registry
            enforcers with no composability claim yet.
          </p>
        </div>
        <div className="cgraph__legend" aria-label="Graph key">
          <span className="cgraph__key cgraph__key--complement">
            Complements
          </span>
          <span className="cgraph__key cgraph__key--conflict">Conflicts</span>
        </div>
      </header>

      <div className={`cgraph__canvas ${dimGraph ? "is-focused" : ""}`}>
        <svg
          className="cgraph__svg"
          viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
          role="img"
          aria-label={`${relationships.length} documented composability relationships across ${namedTerms.length} terms, with ${orphans.length} unrelated registry enforcers shown faintly. Use the ledger below to read each relationship.`}
        >
          <defs>
            <filter
              id="cgraph-glow"
              x="-80%"
              y="-80%"
              width="260%"
              height="260%"
            >
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {/* Orphan halo — real enforcers with no composability relationship */}
          <g className="cgraph__orphans" aria-hidden="true">
            {orphans.map((o) => (
              <circle key={o.name} cx={o.x} cy={o.y} r={3.4}>
                <title>{o.name} — no composability claim yet</title>
              </circle>
            ))}
          </g>

          {/* Browse spokes: hub → each named term */}
          <g className="cgraph__spokes" aria-hidden="true">
            {namedTerms.map((n) => {
              const p = positions[n.id];
              const h = positions[HUB];
              if (!p || !h) return null;
              return <line key={n.id} x1={h.x} y1={h.y} x2={p.x} y2={p.y} />;
            })}
          </g>

          {/* Relationship links */}
          <g className="cgraph__links">
            {relationships.map((relationship) => {
              const a = positions[relationship.subjectType];
              const b = positions[relationship.relatedType];
              if (!a || !b) return null;
              const active = activeRelationshipKeys.has(relationship.key);
              return (
                <path
                  key={relationship.key}
                  d={curvePath(a, b)}
                  className={`cgraph__link cgraph__link--${relationship.relation} ${
                    dimGraph ? (active ? "is-active" : "is-dim") : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${shortLabel(relationship.subjectType)} ${relationship.relation === "conflicts" ? "conflicts with" : "complements"} ${shortLabel(relationship.relatedType)}`}
                  onClick={() => selectRelationship(relationship)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectRelationship(relationship);
                    }
                  }}
                >
                  <title>{`${shortLabel(relationship.subjectType)} ${relationship.relation === "conflicts" ? "conflicts with" : "complements"} ${shortLabel(relationship.relatedType)} — ${relationship.context}`}</title>
                </path>
              );
            })}
          </g>

          {/* Hub */}
          <circle
            className="cgraph__hub"
            cx={positions[HUB]?.x ?? CENTER.x}
            cy={positions[HUB]?.y ?? CENTER.y}
            r={7}
            aria-hidden="true"
          />

          {/* Named term glow */}
          <g
            className="cgraph__halos"
            filter="url(#cgraph-glow)"
            aria-hidden="true"
          >
            {namedTerms.map((node) => {
              const p = positions[node.id];
              if (!p) return null;
              const active = activeTerms.has(node.id);
              const isHub = node.degree >= maxDegree;
              const r = 7 + node.degree * 2.4;
              return (
                <circle
                  key={node.id}
                  cx={p.x}
                  cy={p.y}
                  r={r * 1.5}
                  className={`cgraph__halo ${isHub ? "is-hub" : ""} ${dimGraph && !active ? "is-dim" : ""}`}
                />
              );
            })}
          </g>

          {/* Named term nodes */}
          <g className="cgraph__nodes">
            {namedTerms.map((node) => {
              const p = positions[node.id];
              if (!p) return null;
              const active = activeTerms.has(node.id);
              const isHub = node.degree >= maxDegree;
              const r = 7 + node.degree * 2.4;
              return (
                <g
                  key={node.id}
                  className={`cgraph__node ${isHub ? "is-hub" : ""} ${dimGraph && active ? "is-active" : ""} ${dimGraph && !active ? "is-dim" : ""} ${selectedTerm === node.id ? "is-selected" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Show relationships for ${shortLabel(node.id)}`}
                  onMouseEnter={() => setHoveredTerm(node.id)}
                  onMouseLeave={() => setHoveredTerm(null)}
                  onFocus={() => setHoveredTerm(node.id)}
                  onBlur={() => setHoveredTerm(null)}
                  onClick={() => selectTerm(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectTerm(node.id);
                    }
                  }}
                >
                  <circle
                    className="cgraph__node-hit"
                    cx={p.x}
                    cy={p.y}
                    r={Math.max(28, r + 16)}
                  />
                  <circle
                    className="cgraph__node-dot"
                    cx={p.x}
                    cy={p.y}
                    r={r}
                  />
                  <text
                    x={p.x}
                    y={p.y + r + 18}
                    textAnchor="middle"
                    className="cgraph__node-label"
                  >
                    {shortLabel(node.id)}
                  </text>
                  <title>{node.id}</title>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <section className="cgraph__inspector" aria-live="polite">
        <div className="cgraph__inspector-copy">
          {selectedRelationship ? (
            <>
              <p className="cgraph__status">
                {selectedRelationship.live
                  ? "Live Intuition claim"
                  : "Canonical plan"}
              </p>
              <h3>
                {shortLabel(selectedRelationship.subjectType)}{" "}
                {selectedRelationship.relation === "conflicts" ? "×" : "+"}{" "}
                {shortLabel(selectedRelationship.relatedType)}
              </h3>
              <p>{selectedRelationship.context}</p>
              {selectedRelationship.ordering && (
                <p>
                  <strong>Order:</strong> {selectedRelationship.ordering}
                </p>
              )}
              {selectedRelationship.evidenceNote && (
                <p>
                  <strong>Why:</strong> {selectedRelationship.evidenceNote}
                </p>
              )}
              {selectedRelationship.live && (
                <div className="cgraph__position">
                  <div className="cgraph__position-labels">
                    <span>
                      {selectedDistribution?.hasSignal
                        ? `${selectedDistribution.supportPercent}% support`
                        : "No positions yet"}
                    </span>
                    {selectedDistribution?.hasSignal && (
                      <span>
                        {selectedDistribution.oppositionPercent}% oppose
                      </span>
                    )}
                  </div>
                  <div
                    className="cgraph__position-track"
                    role="img"
                    aria-label={
                      selectedDistribution?.hasSignal
                        ? `TRUST distribution: ${selectedDistribution.supportPercent}% support and ${selectedDistribution.oppositionPercent}% oppose`
                        : "No TRUST positions on this relationship claim yet"
                    }
                  >
                    <span
                      style={{
                        width: `${selectedDistribution?.supportPercent ?? 0}%`,
                      }}
                    />
                  </div>
                  <small>
                    {selectedRelationship.support ?? "0 TRUST"} support ·{" "}
                    {selectedRelationship.opposition ?? "0 TRUST"} opposition
                  </small>
                </div>
              )}
              <div className="cgraph__links-row">
                {selectedRelationship.live &&
                  intuitionClaimUrl(selectedRelationship.claimId) && (
                    <a
                      href={intuitionClaimUrl(selectedRelationship.claimId)!}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open claim in Intuition <span aria-hidden="true">↗</span>
                    </a>
                  )}
                <a
                  href={selectedRelationship.supportedBy}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read source <span aria-hidden="true">↗</span>
                </a>
              </div>
            </>
          ) : selectedTerm ? (
            <>
              <p className="cgraph__status">Selected term</p>
              <h3>{shortLabel(selectedTerm)}</h3>
              <p>
                {inspectorConnected.length} documented{" "}
                {inspectorConnected.length === 1
                  ? "relationship"
                  : "relationships"}{" "}
                connect to this term. Pick a highlighted line or ledger entry to
                read the evidence.
              </p>
            </>
          ) : (
            <>
              <p className="cgraph__status">Browse the graph</p>
              <h3>Every line has a readable claim.</h3>
              <p>
                {relationships.length} documented relationships across{" "}
                {namedTerms.length} terms. The faint outer nodes are registry
                enforcers with no composability claim yet.
              </p>
            </>
          )}
        </div>
        {selection && (
          <button
            type="button"
            className="cgraph__clear"
            onClick={() => setSelection(null)}
          >
            Clear selection
          </button>
        )}
      </section>

      <div className="cgraph__ledger" aria-label="Relationship ledger">
        {relationships.map((relationship) => {
          const selected = selectedRelationship?.key === relationship.key;
          return (
            <button
              key={relationship.key}
              type="button"
              className={`cgraph__ledger-row cgraph__ledger-row--${relationship.relation} ${selected ? "is-selected" : ""}`}
              onClick={() => selectRelationship(relationship)}
              aria-pressed={selected}
            >
              <span>{shortLabel(relationship.subjectType)}</span>
              <span className="cgraph__ledger-relation">
                {relationship.relation === "conflicts"
                  ? "conflicts with"
                  : "complements"}
              </span>
              <span>{shortLabel(relationship.relatedType)}</span>
              <span className="cgraph__ledger-state">
                {relationship.live ? "Live" : "Plan"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
