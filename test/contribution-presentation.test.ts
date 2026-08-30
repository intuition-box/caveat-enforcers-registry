import assert from "node:assert/strict";
import test from "node:test";
import {
  LISTING_CLAIM_TEMPLATES,
  listingClaimSummary,
} from "../web/contribution-presentation.js";

const listing = {
  chainId: "1155",
  contractAddress: "0x1111111111111111111111111111111111111111",
  name: "AllowedTimeOfDayEnforcer",
  purpose: "Restricts calls to a permitted time window.",
  category: "time",
  sourceUrl: "https://github.com/ronkenx9/allowed-time-of-day-enforcer",
  termsJson: '{"schemaVersion":"1.0.0"}',
};

test("listing summary separates deployment identity from five core claims", () => {
  assert.deepEqual(listingClaimSummary(listing), {
    identity: "eip155:1155:0x1111111111111111111111111111111111111111",
    claimCount: 5,
  });
});

test("optional claim templates never label the signing wallet as author or deployer", () => {
  assert.equal(
    LISTING_CLAIM_TEMPLATES.some((template) =>
      /signing wallet/i.test(template.label),
    ),
    false,
  );
  assert.ok(
    LISTING_CLAIM_TEMPLATES.some((template) => template.key === "audit"),
  );
  assert.ok(
    LISTING_CLAIM_TEMPLATES.some((template) => template.key === "author"),
  );
});
