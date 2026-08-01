export type Claim = {
  predicate: string;
  object: string;
  stake: string;
  side: "support" | "counter";
};

export type EnforcerRecord = {
  id: string;
  label: string;
  description: string;
  domain: string;
  operation: string;
  chain: string;
  audit: string;
  stake: number;
  stakeLabel: string;
  state: "reference" | "live";
  createdAt: string;
  deployment: string;
  source: string;
  terms: string;
  claims: Claim[];
  usage: string[];
};
