import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "docs/PRODUCT.md",
  "docs/SCHEMA.md",
  "docs/COMPOSABILITY.md",
  "docs/BRAND-DIRECTION.md",
  "docs/INTEGRATION.md",
];

const forbiddenCharacters = /[\u2013\u2014]/u;

let failed = false;

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    console.error(`Missing required file: ${file}`);
    failed = true;
    continue;
  }

  const contents = readFileSync(file, "utf8");
  if (forbiddenCharacters.test(contents)) {
    console.error(`Use a hyphen instead of a typographic dash in: ${file}`);
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log("Documentation checks passed.");
