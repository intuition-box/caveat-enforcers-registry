/**
 * Composability correlation graph.
 *
 * This intentionally renders only terms and relationship records in the
 * composability dataset. The central index is browsing structure, not an
 * additional protocol claim; solid links are the documented relationships.
 */
import { useEffect, useMemo, useState } from "react";

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

type Position = { x: number; y: number };
type Selection =
  | { type: "term"; value: string }
  | { type: "relationship"; value: string }
  | null;

const VIEWBOX = { width: 1000, height: 620 };

const TERM_POSITIONS: Record<string, Position> = {
  "ScopeType.FunctionCall": { x: 185, y: 150 },
  "payable call": { x: 394, y: 110 },
  "ScopeType.NativeTokenTransferAmount": { x: 170, y: 432 },
  "call with calldata": { x: 402, y: 514 },
  AllowedTargetsEnforcer: { x: 622, y: 205 },
  AllowedMethodsEnforcer: { x: 842, y: 135 },
  LimitedCallsEnforcer: { x: 858, y: 350 },
  TimestampEnforcer: { x: 650, y: 510 },
};

const COMPACT_TERM_POSITIONS: Record<string, Position> = {
  "ScopeType.FunctionCall": { x: 58, y: 106 },
  "payable call": { x: 182, y: 72 },
  "ScopeType.NativeTokenTransferAmount": { x: 64, y: 462 },
  "call with calldata": { x: 190, y: 522 },
  AllowedTargetsEnforcer: { x: 252, y: 240 },
  AllowedMethodsEnforcer: { x: 342, y: 122 },
  LimitedCallsEnforcer: { x: 334, y: 354 },
  TimestampEnforcer: { x: 252, y: 496 },
};

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
  };

  return (
    labels[value] ?? value.replace(/^ScopeType\./, "").replace(/Enforcer$/, "")
  );
}

function edgePath(start: Position, end: Position): string {
  const midpointX = (start.x + end.x) / 2;
  const midpointY = (start.y + end.y) / 2;
  const bend = start.y < end.y ? 36 : -36;
  return `M ${start.x} ${start.y} Q ${midpointX} ${midpointY + bend} ${end.x} ${end.y}`;
}

function labelPosition(position: Position, compact: boolean) {
  if (!compact) return { x: position.x, anchor: "middle" as const };
  if (position.x < 100) return { x: position.x + 12, anchor: "start" as const };
  if (position.x > 290) return { x: position.x - 12, anchor: "end" as const };
  return { x: position.x, anchor: "middle" as const };
}

export default function ComposabilityGraph({
  relationships,
}: {
  relationships: GraphRelationship[];
}) {
  const [selection, setSelection] = useState<Selection>(null);
  const [isCompact, setIsCompact] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 48rem)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(max-width: 48rem)");
    const update = () => setIsCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const viewbox = isCompact
    ? { width: 390, height: 620, centre: { x: 195, y: 310 } }
    : {
        width: VIEWBOX.width,
        height: VIEWBOX.height,
        centre: { x: 500, y: 310 },
      };
  const termPositions = isCompact ? COMPACT_TERM_POSITIONS : TERM_POSITIONS;

  const terms = useMemo(() => {
    const present = new Set<string>();
    relationships.forEach((relationship) => {
      present.add(relationship.subjectType);
      present.add(relationship.relatedType);
    });
    return [...present].map((term, index) => ({
      term,
      position: termPositions[term] ?? {
        x: 180 + ((index * 157) % 640),
        y: 110 + ((index * 103) % 400),
      },
    }));
  }, [relationships, termPositions]);

  const selectedRelationship =
    selection?.type === "relationship"
      ? relationships.find(
          (relationship) => relationship.key === selection.value,
        )
      : undefined;
  const selectedTerm = selection?.type === "term" ? selection.value : undefined;
  const connectedRelationships = selectedTerm
    ? relationships.filter(
        (relationship) =>
          relationship.subjectType === selectedTerm ||
          relationship.relatedType === selectedTerm,
      )
    : [];
  const activeRelationshipKeys = new Set(
    selectedRelationship
      ? [selectedRelationship.key]
      : connectedRelationships.map((relationship) => relationship.key),
  );
  const activeTerms = new Set(
    selectedRelationship
      ? [selectedRelationship.subjectType, selectedRelationship.relatedType]
      : selectedTerm
        ? [
            selectedTerm,
            ...connectedRelationships.flatMap((item) => [
              item.subjectType,
              item.relatedType,
            ]),
          ]
        : terms.map(({ term }) => term),
  );
  const dimGraph = selection !== null;

  const selectRelationship = (relationship: GraphRelationship) =>
    setSelection((current) =>
      current?.type === "relationship" && current.value === relationship.key
        ? null
        : { type: "relationship", value: relationship.key },
    );

  return (
    <section
      className="correlation-graph"
      aria-label="Composability relationship graph"
    >
      <header className="correlation-graph__header">
        <div>
          <h2>Trace a boundary before you compose it.</h2>
          <p>
            Select an enforcer, scope, or line to read the exact relationship.
            Solid links are documented relationships; the centre only helps
            browse them.
          </p>
        </div>
        <div className="correlation-graph__legend" aria-label="Graph key">
          <span className="correlation-graph__key correlation-graph__key--complement">
            Complements
          </span>
          <span className="correlation-graph__key correlation-graph__key--conflict">
            Conflicts
          </span>
        </div>
      </header>

      <div className="correlation-graph__canvas">
        <svg
          className="correlation-graph__svg"
          viewBox={`0 0 ${viewbox.width} ${viewbox.height}`}
          role="img"
          aria-label={`${relationships.length} documented composability relationships across ${terms.length} terms. Select the relationship ledger below to read each relationship.`}
        >
          <g aria-hidden="true" className="correlation-graph__browse-links">
            {terms.map(({ term, position }) => (
              <line
                key={term}
                x1={viewbox.centre.x}
                y1={viewbox.centre.y}
                x2={position.x}
                y2={position.y}
              />
            ))}
          </g>

          <g className="correlation-graph__links">
            {relationships.map((relationship) => {
              const start = termPositions[relationship.subjectType];
              const end = termPositions[relationship.relatedType];
              if (!start || !end) return null;
              const isActive = activeRelationshipKeys.has(relationship.key);
              return (
                <g
                  key={relationship.key}
                  className={`correlation-graph__link correlation-graph__link--${relationship.relation} ${
                    dimGraph && !isActive ? "is-dim" : "is-active"
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
                  <path
                    d={edgePath(start, end)}
                    className="correlation-graph__link-visible"
                  />
                  <path
                    d={edgePath(start, end)}
                    className="correlation-graph__link-hit"
                  />
                  <title>{`${shortLabel(relationship.subjectType)} ${relationship.relation === "conflicts" ? "conflicts with" : "complements"} ${shortLabel(relationship.relatedType)}`}</title>
                </g>
              );
            })}
          </g>

          <g className="correlation-graph__index" aria-hidden="true">
            <circle cx={viewbox.centre.x} cy={viewbox.centre.y} r="45" />
            <text x={viewbox.centre.x} y={viewbox.centre.y - 8}>
              Relationship
            </text>
            <text x={viewbox.centre.x} y={viewbox.centre.y + 11}>
              index
            </text>
          </g>

          {terms.map(({ term, position }) => {
            const isActive = activeTerms.has(term);
            const label = labelPosition(position, isCompact);
            return (
              <g
                key={term}
                className={`correlation-graph__term ${
                  dimGraph && !isActive ? "is-dim" : "is-active"
                } ${selectedTerm === term ? "is-selected" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`Show relationships for ${shortLabel(term)}`}
                onClick={() =>
                  setSelection((current) =>
                    current?.type === "term" && current.value === term
                      ? null
                      : { type: "term", value: term },
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelection((current) =>
                      current?.type === "term" && current.value === term
                        ? null
                        : { type: "term", value: term },
                    );
                  }
                }}
              >
                <circle
                  className="correlation-graph__term-hit"
                  cx={position.x}
                  cy={position.y}
                  r="48"
                />
                <circle
                  className="correlation-graph__term-dot"
                  cx={position.x}
                  cy={position.y}
                  r="9"
                />
                <text x={label.x} y={position.y + 27} textAnchor={label.anchor}>
                  {shortLabel(term)}
                </text>
                <title>{term}</title>
              </g>
            );
          })}
        </svg>
      </div>

      <section className="correlation-graph__inspector" aria-live="polite">
        <div className="correlation-graph__inspector-copy">
          {selectedRelationship ? (
            <>
              <p className="correlation-graph__status">
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
              {selectedRelationship.claimId && (
                <p className="correlation-graph__claim-id">
                  <strong>Claim:</strong> {selectedRelationship.claimId}
                </p>
              )}
              {selectedRelationship.live && (
                <p>
                  <strong>Signal:</strong> {selectedRelationship.support ?? "0"}{" "}
                  support
                  {" · "}
                  {selectedRelationship.opposition ?? "0"} opposition
                </p>
              )}
              <a
                href={selectedRelationship.supportedBy}
                target="_blank"
                rel="noreferrer"
              >
                Read source <span aria-hidden="true">↗</span>
              </a>
            </>
          ) : selectedTerm ? (
            <>
              <p className="correlation-graph__status">Selected term</p>
              <h3>{shortLabel(selectedTerm)}</h3>
              <p>
                {connectedRelationships.length} documented{" "}
                {connectedRelationships.length === 1
                  ? "relationship"
                  : "relationships"}{" "}
                connect to this term. Pick a highlighted line or entry to
                inspect the evidence.
              </p>
            </>
          ) : (
            <>
              <p className="correlation-graph__status">Browse the graph</p>
              <h3>Every line has a readable claim.</h3>
              <p>
                This view maps {relationships.length} documented relationships
                across {terms.length} enforcers and scopes. It does not infer
                compatibility or turn a relationship into a safety score.
              </p>
            </>
          )}
        </div>
        {selection && (
          <button
            type="button"
            className="correlation-graph__clear"
            onClick={() => setSelection(null)}
          >
            Clear selection
          </button>
        )}
      </section>

      <div
        className="correlation-graph__ledger"
        aria-label="Relationship ledger"
      >
        {relationships.map((relationship) => {
          const selected = selectedRelationship?.key === relationship.key;
          return (
            <button
              key={relationship.key}
              type="button"
              className={`correlation-graph__ledger-row correlation-graph__ledger-row--${relationship.relation} ${selected ? "is-selected" : ""}`}
              onClick={() => selectRelationship(relationship)}
              aria-pressed={selected}
            >
              <span>{shortLabel(relationship.subjectType)}</span>
              <span className="correlation-graph__ledger-relation">
                {relationship.relation === "conflicts"
                  ? "conflicts with"
                  : "complements"}
              </span>
              <span>{shortLabel(relationship.relatedType)}</span>
              <span className="correlation-graph__ledger-state">
                {relationship.live ? "Live" : "Plan"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
