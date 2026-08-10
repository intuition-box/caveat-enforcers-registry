import { readFile } from "node:fs/promises";
import {
  buildReferenceEnrichmentPlan,
  type ReferenceMetadataDocument,
} from "../src/reference-enrichment.js";
import type { ReferenceSeedDocument } from "../src/reference-seed.js";
import { runMainnetSeed } from "./mainnet-seed-runner.js";

const metadataUrl = new URL(
  "../data/metamask-v1.7.0.metadata.json",
  import.meta.url,
);
const referenceUrl = new URL("../data/metamask-v1.3.0.json", import.meta.url);

async function main(): Promise<void> {
  const [metadataRaw, referenceRaw] = await Promise.all([
    readFile(metadataUrl, "utf8"),
    readFile(referenceUrl, "utf8"),
  ]);
  const plan = buildReferenceEnrichmentPlan(
    JSON.parse(metadataRaw) as ReferenceMetadataDocument,
    JSON.parse(referenceRaw) as ReferenceSeedDocument,
  );
  await runMainnetSeed(plan, process.argv.slice(2), {
    command: "seed:reference-enrichment",
    title: "MetaMask reference enrichment: 32 deployments",
  });
}

const keepAlive = setInterval(() => undefined, 1_000);
main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Reference enrichment failed.",
    );
    process.exitCode = 1;
  })
  .finally(() => clearInterval(keepAlive));
