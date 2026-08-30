const TERM_ID = /^0x[a-fA-F0-9]{64}$/;

export type ClaimDistribution = {
  supportPercent: number;
  oppositionPercent: number;
  hasSignal: boolean;
};

function signalValue(value: string | undefined): bigint {
  return value && /^\d+$/.test(value) ? BigInt(value) : 0n;
}

export function claimDistribution(
  support: string | undefined,
  opposition: string | undefined,
): ClaimDistribution {
  const supportValue = signalValue(support);
  const oppositionValue = signalValue(opposition);
  const total = supportValue + oppositionValue;
  if (total === 0n) {
    return { supportPercent: 0, oppositionPercent: 0, hasSignal: false };
  }

  const supportBasisPoints = Number((supportValue * 10_000n) / total);
  const supportPercent = Math.round(supportBasisPoints / 100);
  return {
    supportPercent,
    oppositionPercent: 100 - supportPercent,
    hasSignal: true,
  };
}

export function intuitionClaimUrl(claimId: string | undefined): string | null {
  if (!claimId || !TERM_ID.test(claimId)) return null;
  return `https://portal.intuition.systems/explore/triple/${claimId}`;
}
