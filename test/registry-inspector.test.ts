import assert from "node:assert/strict";
import test from "node:test";
import { toggleExpandedRegistryRow } from "../web/registry-inspector.js";

test("clicking a closed registry row expands that row", () => {
  assert.equal(toggleExpandedRegistryRow(null, "second"), "second");
});

test("clicking the expanded registry row closes it", () => {
  assert.equal(toggleExpandedRegistryRow("second", "second"), null);
});

test("clicking another registry row moves the expansion", () => {
  assert.equal(toggleExpandedRegistryRow("first", "second"), "second");
});
