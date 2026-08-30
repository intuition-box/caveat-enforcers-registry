import assert from "node:assert/strict";
import test from "node:test";
import { resolveInspectorRow } from "../web/registry-inspector.js";

const rows = [
  { slug: "first", name: "First" },
  { slug: "second", name: "Second" },
];

test("registry inspector keeps the selected row when it remains visible", () => {
  assert.equal(resolveInspectorRow(rows, "second")?.slug, "second");
});

test("registry inspector falls back to the first visible row after filtering", () => {
  assert.equal(resolveInspectorRow(rows, "missing")?.slug, "first");
  assert.equal(resolveInspectorRow(rows, null)?.slug, "first");
});

test("registry inspector has an honest empty state", () => {
  assert.equal(resolveInspectorRow([], "missing"), null);
});
