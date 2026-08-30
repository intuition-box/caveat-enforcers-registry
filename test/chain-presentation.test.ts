import assert from "node:assert/strict";
import test from "node:test";
import {
  chainDisplayName,
  chainOptionLabel,
  eip155ChainId,
} from "../web/chain-presentation.js";

test("chain presentation names reviewed EIP-155 examples without changing IDs", () => {
  assert.equal(chainDisplayName("eip155:1"), "Ethereum mainnet");
  assert.equal(chainDisplayName("eip155:8453"), "Base");
  assert.equal(chainDisplayName("eip155:11155111"), "Sepolia");
  assert.equal(chainDisplayName("eip155:1155"), "Intuition mainnet");
  assert.equal(chainOptionLabel("eip155:8453"), "Base · 8453");
});

test("unknown EVM chains remain explicit and malformed claims are not rewritten", () => {
  assert.equal(chainDisplayName("eip155:999999"), "EVM chain 999999");
  assert.equal(eip155ChainId("eip155:999999"), "999999");
  assert.equal(chainDisplayName("Chain claim pending"), "Chain claim pending");
  assert.equal(eip155ChainId("Intuition 1155"), null);
});
