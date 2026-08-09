export type Claim = {
  subjectId?: string;
  subjectLabel?: string | null;
  predicate: string;
  object: string;
  stake: string;
  side: "support" | "counter";
  id?: string;
  predicateId?: string;
  predicateLabel?: string | null;
  objectId?: string;
  objectLabel?: string | null;
  objectData?: string | null;
  objectValue?: string | null;
  objectType?: string | null;
  createdAt?: string;
  oppositionStake?: string;
};

export type RegistrySignal = {
  value: string;
  label: string;
  positionCount?: string;
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
  implementation?: string;
  source: string;
  terms: string;
  claims: Claim[];
  usage: string[];
  supportSignal?: RegistrySignal;
  oppositionSignal?: RegistrySignal;
};
