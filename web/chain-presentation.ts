const KNOWN_EIP155_CHAINS: Record<string, string> = {
  "1": "Ethereum mainnet",
  "1155": "Intuition mainnet",
  "8453": "Base",
  "11155111": "Sepolia",
};

export function eip155ChainId(value: string | null | undefined): string | null {
  const match = /^eip155:(\d+)$/.exec(value?.trim() ?? "");
  return match?.[1] ?? null;
}

export function chainDisplayName(value: string | null | undefined): string {
  const normalized = value?.trim() ?? "";
  const chainId = eip155ChainId(normalized);
  if (!chainId) return normalized || "Chain claim pending";
  return KNOWN_EIP155_CHAINS[chainId] ?? `EVM chain ${chainId}`;
}

export function chainOptionLabel(value: string): string {
  const chainId = eip155ChainId(value);
  const name = chainDisplayName(value);
  return chainId ? `${name} · ${chainId}` : name;
}
