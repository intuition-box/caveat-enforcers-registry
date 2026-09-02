import assert from "node:assert/strict";
import test from "node:test";
import { resolveRegistryApiBase } from "../web/api-base.js";

test("local development uses the Vite proxy when no API base is configured", () => {
  assert.equal(resolveRegistryApiBase("", true), "");
});

test("production falls back to the hosted registry API", () => {
  assert.equal(
    resolveRegistryApiBase("", false),
    "https://caveats-registry-api.intuition.box",
  );
});

test("an explicit API base overrides environment defaults", () => {
  assert.equal(
    resolveRegistryApiBase("https://registry.example/", true),
    "https://registry.example",
  );
});
