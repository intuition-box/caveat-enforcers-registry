import { readFile } from "node:fs/promises";

const schemaPath = new URL("../schema/submission.schema.json", import.meta.url);
const examplePath = new URL(
  "../schema/submission.example.json",
  import.meta.url,
);
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const example = JSON.parse(await readFile(examplePath, "utf8"));

const required = schema.required ?? [];
const missing = required.filter((key) => !(key in example));
if (missing.length) {
  throw new Error(`Submission example is missing: ${missing.join(", ")}`);
}
if (!/^0x[0-9a-f]{40}$/i.test(example.contractAddress)) {
  throw new Error("Submission example has an invalid contract address.");
}
if (!/^0x[0-9a-f]{40}$/i.test(example.submitterWallet)) {
  throw new Error("Submission example has an invalid submitter wallet.");
}
if (!/^https?:\/\/\S+$/i.test(example.sourceUrl)) {
  throw new Error("Submission example has an invalid source URL.");
}
if (!/^0x(?:[0-9a-f]{2})*$/i.test(example.termsSchema.fixtures[0].terms)) {
  throw new Error("Submission example has invalid fixture bytes.");
}

console.log("Submission JSON schema and example smoke passed.");
