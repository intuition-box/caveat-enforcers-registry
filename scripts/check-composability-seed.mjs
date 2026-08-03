import { readFile } from "node:fs/promises";
import { concatHex, keccak256, stringToHex } from "viem";

const seed = JSON.parse(
  await readFile(new URL("../data/composability-seed.json", import.meta.url), "utf8"),
);
const triples = JSON.parse(
  await readFile(
    new URL("../data/composability-seed.triples.json", import.meta.url),
    "utf8",
  ),
);
const errors = [];
const bytes32 = /^0x[0-9a-f]{64}$/i;
const atomSalt = keccak256(stringToHex("ATOM_SALT"));
const tripleSalt = keccak256(stringToHex("TRIPLE_SALT"));
const atomId = (text) =>
  keccak256(concatHex([atomSalt, keccak256(stringToHex(text))]));
const tripleId = (subject, predicate, object) =>
  keccak256(concatHex([tripleSalt, subject, predicate, object]));

if (seed.chainId !== "1155") errors.push("seed chain must be 1155");
if (seed.status !== "portable-seed") errors.push("seed must remain portable-seed");
if (!Array.isArray(seed.relationships) || seed.relationships.length < 3)
  errors.push("seed must contain at least three relationships");
if (triples.status !== "canonical-id-plan")
  errors.push("generated triples must be canonical-id-plan");
if (triples.triples?.length !== seed.relationships?.length)
  errors.push("generated triple count must match seed relationship count");

for (const [index, item] of (triples.triples ?? []).entries()) {
  const relationship = item.relationship;
  if (!bytes32.test(relationship?.id ?? ""))
    errors.push(`triples[${index}] relationship ID is invalid`);
  if (
    relationship?.id !==
    tripleId(
      relationship.subject.id,
      relationship.predicate.id,
      relationship.object.id,
    )
  )
    errors.push(`triples[${index}] relationship ID does not match components`);
  if (item.context?.id !== tripleId(item.context.subjectId, item.context.predicateId, item.context.object.id))
    errors.push(`triples[${index}] context ID does not match components`);
  if (item.ordering && item.ordering.id !== tripleId(item.ordering.subjectId, item.ordering.predicateId, item.ordering.object.id))
    errors.push(`triples[${index}] ordering ID does not match components`);
  if (item.evidence?.id !== tripleId(item.evidence.subjectId, item.evidence.predicateId, item.evidence.object.id))
    errors.push(`triples[${index}] evidence ID does not match components`);
  for (const atom of [
    relationship.subject,
    relationship.object,
    item.context.object,
    item.ordering?.object,
    item.evidence.object,
  ]) {
    if (atom && atom.id !== atomId(atom.label))
      errors.push(`triples[${index}] atom ID does not match its label`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Composability seed passed: ${triples.triples.length} canonical relationship plans with contextual triples.`,
  );
}
