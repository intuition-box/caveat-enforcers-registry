/**
 * Migrate the reference set's JSON-valued atoms (terms schema, audit, usage) to
 * IPFS-backed atoms so the Intuition portal renders readable names instead of
 * "json object".
 *
 * The migration is additive and idempotent: it creates new ipfs://<CID> atoms
 * and the triples that link each enforcer to them; anything already on chain is
 * skipped by the shared seed runner. The old raw-JSON atoms remain (atoms are
 * immutable) but the registry backend surfaces only the ipfs-backed claim.
 *
 * ipfs:// pointers are derived offline, so a dry run needs no credentials.
 * --execute pins each document (Pinata JWT) and signs the writes (deployer
 * key), both entered at a masked prompt — never on a command line or in a file.
 *
 *   pnpm migrate:ipfs                              # dry run: plan only
 *   pnpm migrate:ipfs -- --execute --confirm-mainnet
 */
import { readFile } from "node:fs/promises";
import {
  buildReferenceEnrichmentPlan,
  collectReferenceEnrichmentThings,
  type ReferenceMetadataDocument,
} from "../src/reference-enrichment.js";
import type { ReferenceSeedDocument } from "../src/reference-seed.js";
import {
  pinAtomDocument,
  pinataPinner,
  prepareAtomDocument,
  type AtomThing,
} from "../src/pin.js";
import { resolveSecret } from "./secret-prompt.js";
import { runMainnetSeed } from "./mainnet-seed-runner.js";

const metadataUrl = new URL(
  "../data/metamask-v1.7.0.metadata.json",
  import.meta.url,
);
const referenceUrl = new URL("../data/metamask-v1.3.0.json", import.meta.url);

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const execute = argv.includes("--execute");

  const [metadataRaw, referenceRaw] = await Promise.all([
    readFile(metadataUrl, "utf8"),
    readFile(referenceUrl, "utf8"),
  ]);
  const metadata = JSON.parse(metadataRaw) as ReferenceMetadataDocument;
  const reference = JSON.parse(referenceRaw) as ReferenceSeedDocument;

  const things = collectReferenceEnrichmentThings(metadata);

  // Distinct documents to pin (shared usage contexts collapse to one CID).
  const byUri = new Map<string, AtomThing>();
  const ipfsContent = new Map<string, string>();
  for (const { key, thing } of things) {
    const uri = prepareAtomDocument(thing).uri;
    ipfsContent.set(key, uri);
    if (!byUri.has(uri)) byUri.set(uri, thing);
  }

  console.log(
    `IPFS migration: ${things.length} JSON claims → ${byUri.size} unique documents`,
  );

  // Building with the offline URIs proves the plan before any network call.
  const plan = buildReferenceEnrichmentPlan(metadata, reference, {
    ipfsContent,
  });
  const ipfsAtoms = plan.atoms.filter((atom) =>
    atom.content.startsWith("ipfs://"),
  );
  console.log(
    `Plan: ${plan.atoms.length} atoms (${ipfsAtoms.length} ipfs-backed), ${plan.triples.length} triples`,
  );

  // Only --execute pins and signs; without it the shared runner still reads
  // chain state and reports the exact missing atoms/triples and TRUST cost.
  if (execute) {
    // Pin every distinct document so its CID is publicly retrievable before the
    // atom that references it is created. pinAtomDocument fails closed if the
    // service returns a raw CID that disagrees with the offline derivation.
    const jwt = await resolveSecret("PINATA_JWT", "Pinata JWT");
    const pin = pinataPinner({ jwt });
    let pinned = 0;
    for (const [uri, thing] of byUri) {
      const result = await pinAtomDocument(thing, pin);
      if (result.uri !== uri) {
        throw new Error(
          `Pinned URI ${result.uri} does not match the derived URI ${uri}.`,
        );
      }
      pinned += 1;
      if (pinned % 10 === 0 || pinned === byUri.size) {
        console.log(`Pinned ${pinned}/${byUri.size}`);
      }
    }

    // Hand the deployer key to the shared runner via the environment it reads;
    // prompt for it (masked) when it is not already exported.
    if (!process.env.INTUITION_SEED_PRIVATE_KEY?.trim()) {
      process.env.INTUITION_SEED_PRIVATE_KEY = await resolveSecret(
        "CAVEAT_DEPLOYER_PRIVATE_KEY",
        "Deployer private key (0x…, hidden)",
      );
    }
  }

  await runMainnetSeed(plan, argv, {
    command: "migrate:ipfs",
    title: "IPFS atom migration: 32 reference deployments",
  });
}

const keepAlive = setInterval(() => undefined, 1_000);
main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "IPFS migration failed.",
    );
    process.exitCode = 1;
  })
  .finally(() => clearInterval(keepAlive));
