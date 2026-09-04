import type { AtomThing } from "./pin.js";
import type { SubmissionUsageEvidence, TermsSchema } from "./validation.js";

/**
 * The single authority for how a JSON-valued atom is serialised.
 *
 * Every write path (reference migration, enrichment, live submission) turns a
 * structured value into a schema.org `Thing` through these builders, so the
 * on-chain shape is decided in one place. Change the policy here — including
 * switching to the Intuition SDK's exact Thing serialisation — and all paths
 * move together. Text/label atoms are not JSON-valued and never come through
 * here; they stay canonical plain-text atoms.
 */

/** Wrap a structured payload as a named schema.org Thing under a payload key. */
export function structuredThing(params: {
  name: string;
  description: string;
  url?: string;
  payloadKey: string;
  payload: unknown;
}): AtomThing {
  return {
    name: params.name,
    description: params.description,
    ...(params.url ? { url: params.url } : {}),
    [params.payloadKey]: params.payload,
  };
}

/** Terms schema Thing — identical across every path that publishes one. */
export function termsSchemaThing(
  enforcerName: string,
  schema: TermsSchema,
): AtomThing {
  return structuredThing({
    name: `${enforcerName} — terms schema`,
    description: `How the encoded caveat terms for ${enforcerName} are interpreted.`,
    payloadKey: "termsSchema",
    payload: schema,
  });
}

/**
 * Usage-context Thing — enforcer-independent so an identical context across
 * enforcers resolves to one shared atom.
 */
export function usageThing(usage: SubmissionUsageEvidence): AtomThing {
  return structuredThing({
    name: usage.name.trim(),
    description: "A context where a caveat enforcer boundary is used.",
    url: usage.sourceUrl,
    payloadKey: "usage",
    payload: usage,
  });
}
