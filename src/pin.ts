import { createHash } from "node:crypto";

/**
 * IPFS pinning for JSON-valued atoms.
 *
 * Intuition's indexer renders an atom's label from a schema.org `Thing`
 * document stored on IPFS, referenced on-chain as `ipfs://<CID>`. Atoms whose
 * `data` is a raw JSON string are shown as an opaque "json object" because the
 * indexer never resolves a name. This module wraps a payload as a `Thing`,
 * serialises it deterministically, and derives the exact CIDv1 (raw codec,
 * sha-256) the pin will produce — so the resulting atom ID is reproducible and
 * the migration is idempotent without contacting the pinning service.
 */

export type AtomThing = {
  /** Human label the indexer surfaces. Required. */
  name: string;
  description?: string;
  image?: string;
  url?: string;
  /** Optional structured payload (terms schema, audit, usage) kept verbatim. */
  [key: string]: unknown;
};

const SCHEMA_CONTEXT = "https://schema.org";

/**
 * Deterministic JSON with keys sorted by UTF-16 code unit (locale-independent,
 * unlike `localeCompare`). This exact byte layout is what gets hashed into the
 * CID, so it must never depend on host locale or object insertion order.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, nested]) => [key, sortValue(nested)]),
    );
  }
  return value;
}

/** Wrap a payload as a schema.org Thing and return its canonical JSON bytes. */
export function atomThingJson(thing: AtomThing): string {
  if (!thing.name || !thing.name.trim()) {
    throw new Error("An atom Thing requires a non-empty name.");
  }
  return stableStringify({
    "@context": SCHEMA_CONTEXT,
    "@type": "Thing",
    ...thing,
  });
}

const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function base32Lower(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

/**
 * CIDv1, raw codec (0x55), sha2-256 multihash — the `bafkrei…` form a single
 * small file pins to on every conformant service (Pinata, web3.storage,
 * Kubo `add --cid-version 1 --raw-leaves`). Recomputable offline, so the atom
 * ID never depends on a network round-trip.
 */
export function cidV1Raw(bytes: Uint8Array): string {
  const digest = createHash("sha256").update(bytes).digest();
  const multihash = Uint8Array.from([0x12, 0x20, ...digest]); // sha2-256, 32 bytes
  const cid = Uint8Array.from([0x01, 0x55, ...multihash]); // v1, raw codec
  return `b${base32Lower(cid)}`; // 'b' = base32 multibase prefix
}

export type PreparedAtomDocument = {
  json: string;
  cid: string;
  /** The value written on-chain as the atom's `data`. */
  uri: string;
};

/** Prepare a Thing for pinning: canonical bytes, its CID, and the ipfs:// URI. */
export function prepareAtomDocument(thing: AtomThing): PreparedAtomDocument {
  const json = atomThingJson(thing);
  const cid = cidV1Raw(new TextEncoder().encode(json));
  return { json, cid, uri: `ipfs://${cid}` };
}

export type PinResult = { cid: string; uri: string };

export type Pinner = (json: string) => Promise<{ cid: string }>;

/**
 * Pin a prepared document and return the URI written on-chain. IPFS is
 * content-addressed, so re-pinning identical bytes yields an identical CID —
 * that is what makes the migration idempotent, independent of the service.
 *
 * When the service returns a raw-codec CID (`bafkrei…`, as Intuition's own
 * atoms use) we fail closed unless it equals the locally derived CID, proving
 * the bytes were not altered in transit. A dag-pb CID (`bafybei…`) is accepted
 * as authoritative because its hash covers a chunk-tree we do not recompute
 * offline; determinism still holds per content.
 */
export async function pinAtomDocument(
  thing: AtomThing,
  pin: Pinner,
): Promise<PinResult> {
  const prepared = prepareAtomDocument(thing);
  const { cid } = await pin(prepared.json);
  if (cid.startsWith("bafkrei") && cid !== prepared.cid) {
    throw new Error(
      `Pinned raw CID ${cid} does not match the deterministic CID ${prepared.cid}. Refusing to write a mismatched atom.`,
    );
  }
  return { cid, uri: `ipfs://${cid}` };
}

/**
 * Pinata pinner. Pins the exact canonical bytes as a raw file so the service
 * returns the same CIDv1 raw hash we derive offline (`pinFileToIPFS` with
 * raw-leaf single-block content), matching how Intuition's indexed atoms are
 * stored. Supply a JWT via env at run time; the service is swappable — any
 * `Pinner` that content-addresses the same bytes works.
 */
export function pinataPinner(config: {
  jwt: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}): Pinner {
  const endpoint =
    config.endpoint ?? "https://api.pinata.cloud/pinning/pinFileToIPFS";
  const fetchImpl = config.fetchImpl ?? fetch;
  return async (json: string) => {
    const form = new FormData();
    form.append(
      "file",
      new Blob([json], { type: "application/json" }),
      "atom.json",
    );
    form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
    const response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${config.jwt}` },
      body: form,
    });
    if (!response.ok) {
      throw new Error(
        `Pinata pin failed (${response.status}): ${await response.text()}`,
      );
    }
    const body = (await response.json()) as { IpfsHash?: string };
    if (!body.IpfsHash) throw new Error("Pinata response had no IpfsHash.");
    return { cid: body.IpfsHash };
  };
}
