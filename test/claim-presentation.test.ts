import assert from "node:assert/strict";
import test from "node:test";
import {
  claimDistribution,
  intuitionClaimUrl,
} from "../web/claim-presentation.js";

test("claim distribution keeps support and opposition separate", () => {
  assert.deepEqual(claimDistribution("75", "25"), {
    supportPercent: 75,
    oppositionPercent: 25,
    hasSignal: true,
  });
  assert.deepEqual(claimDistribution("0", "0"), {
    supportPercent: 0,
    oppositionPercent: 0,
    hasSignal: false,
  });
});

test("claim links resolve only canonical Intuition term IDs", () => {
  const id = `0x${"ab".repeat(32)}`;
  assert.equal(
    intuitionClaimUrl(id),
    `https://portal.intuition.systems/explore/triple/${id}`,
  );
  assert.equal(intuitionClaimUrl("not-a-term"), null);
});
