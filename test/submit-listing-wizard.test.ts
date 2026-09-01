import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the wizard component exposes the complete guided action language", () => {
  const source = readFileSync(
    new URL("../web/SubmitListingWizard.tsx", import.meta.url),
    "utf8",
  );
  for (const label of [
    "Verify identity",
    "Confirm claim",
    "Add another claim",
    "Review contribution",
    "Edit",
    "Move up",
    "Move down",
    "Remove",
  ]) {
    assert.equal(source.includes(label), true, `missing ${label}`);
  }
});
