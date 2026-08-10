import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCurationEnforcerOptions,
  curationClaimLabel,
} from "../web/curation-options.js";

test("assigns stable creation-order display numbers without changing IDs", () => {
  const options = buildCurationEnforcerOptions([
    {
      id: "0xbbb",
      label: "caip10:eip155:1155:0xbbb",
      implementation: "AllowedTimeOfDayEnforcer",
      createdAt: "2026-08-09T18:25:50+00:00",
    },
    {
      id: "0xaaa",
      label: "caip10:eip155:1155:0xaaa",
      implementation: "AllowedCalldataEnforcer",
      createdAt: "2026-08-05T13:14:20+00:00",
    },
  ]);

  assert.deepEqual(
    options.map(({ deploymentId, numberLabel, canonicalName }) => ({
      deploymentId,
      numberLabel,
      canonicalName,
    })),
    [
      {
        deploymentId: "0xaaa",
        numberLabel: "#01",
        canonicalName: "AllowedCalldataEnforcer",
      },
      {
        deploymentId: "0xbbb",
        numberLabel: "#02",
        canonicalName: "AllowedTimeOfDayEnforcer",
      },
    ],
  );
});

test("uses the term ID as a deterministic tie breaker", () => {
  const records = [
    { id: "0xbbb", label: "B", createdAt: "2026-08-05T00:00:00Z" },
    { id: "0xaaa", label: "A", createdAt: "2026-08-05T00:00:00Z" },
  ];
  const forward = buildCurationEnforcerOptions(records);
  const reversed = buildCurationEnforcerOptions([...records].reverse());

  assert.deepEqual(forward, reversed);
  assert.deepEqual(
    forward.map((entry) => entry.deploymentId),
    ["0xaaa", "0xbbb"],
  );
});

test("keeps claim dropdown labels readable when objects are long", () => {
  const label = curationClaimLabel({
    id: "0xclaim",
    predicate: "has terms schema",
    object: `schema ${"x".repeat(160)}`,
    stake: "1",
    side: "support",
  });

  assert.match(label, /^has terms schema → schema /);
  assert.ok(label.endsWith("…"));
  assert.ok(label.length < 120);
});
