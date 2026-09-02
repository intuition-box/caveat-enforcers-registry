import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pages = readFileSync(
  new URL("../web/Pages.tsx", import.meta.url),
  "utf8",
);

const inspectorStart = pages.indexOf("function RegistryDetailDrawer");
const inspectorEnd = pages.indexOf(
  "/* -------------------------------------------------------------------- registry */",
  inspectorStart,
);
const inspector = pages.slice(inspectorStart, inspectorEnd);

test("the registry inspector gives native wheel input to its scroll container", () => {
  assert.match(
    inspector,
    /className="registry-drawer__panel"\s+data-lenis-prevent/,
  );
});

test("the registry inspector presents live claims before extended evidence", () => {
  const claims = inspector.indexOf(">Claim ledger<");
  const evidence = inspector.indexOf(">Evidence<");

  assert.notEqual(claims, -1, "claim ledger heading is missing");
  assert.notEqual(evidence, -1, "evidence heading is missing");
  assert.ok(claims < evidence, "claim ledger remains buried below evidence");
});
