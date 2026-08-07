import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildEnforcerDisplayNameMap,
  ENFORCER_DISPLAY_NAME_MAX_LENGTH,
  enforcerDisplayName,
  enforcerTypeDisplayName,
} from "../src/enforcer-display-name.js";

test("generates semantic names for representative enforcer types", () => {
  assert.equal(enforcerDisplayName("AllowedTargetsEnforcer"), "Target Allow");
  assert.equal(enforcerDisplayName("ERC20StreamingEnforcer"), "ERC-20 Stream");
  assert.equal(enforcerDisplayName("LimitedCallsEnforcer"), "Call Limit");
  assert.equal(enforcerDisplayName("IdEnforcer"), "Single-Use ID");
  assert.equal(enforcerDisplayName("ValueLteEnforcer"), "Native Value Cap");
  assert.equal(
    enforcerDisplayName("ExactExecutionBatchEnforcer"),
    "Exact Exec Batch",
  );
});

test("generates unique names within the 32-entry reference collection", () => {
  const document = JSON.parse(
    readFileSync(
      new URL("../data/metamask-v1.3.0.json", import.meta.url),
      "utf8",
    ),
  ) as { enforcers: Array<{ name: string }> };
  const canonicalNames = document.enforcers.map((entry) => entry.name);
  const displayNames = buildEnforcerDisplayNameMap(canonicalNames);

  assert.equal(displayNames.size, 32);
  assert.equal(
    new Set([...displayNames.values()].map((name) => name.toLowerCase())).size,
    32,
  );
  for (const displayName of displayNames.values()) {
    assert.ok(displayName.length <= ENFORCER_DISPLAY_NAME_MAX_LENGTH);
  }
});

test("resolves compact-name collisions with stable suffixes", () => {
  const names = [
    "VeryLongExecutionAlphaEnforcer",
    "VeryLongExecutionBetaEnforcer",
  ];
  const first = buildEnforcerDisplayNameMap(names);
  const second = buildEnforcerDisplayNameMap([...names].reverse());

  assert.notEqual(first.get(names[0]), first.get(names[1]));
  assert.deepEqual([...first.entries()], [...second.entries()]);
  for (const displayName of first.values()) {
    assert.ok(displayName.length <= ENFORCER_DISPLAY_NAME_MAX_LENGTH);
  }
});

test("does not rewrite unresolved deployment identities", () => {
  const caip = "caip10:eip155:1155:0x1234";
  assert.equal(enforcerTypeDisplayName(caip), caip);
});
