import { decodeAbiParameters, type AbiParameter, type Hex } from "viem";

export type TermsEncodingKind = "abi" | "packed" | "raw" | "custom";

export type TermsField = {
  name: string;
  type: string;
  offset: number;
  bytes: number;
};

export type TermsFixture = {
  terms: string;
  decoded?: Record<string, unknown>;
  decoderArgs?: unknown[];
};

export type TermsSchema = {
  schemaVersion: string;
  enforcer: string;
  source: {
    repository: string;
    commit: string;
    path: string;
  };
  decoderFunction?: {
    name: string;
    inputs: Array<{ name: string; type: string }>;
    outputs: Array<{ name: string; type: string }>;
  };
  encoding: {
    kind: TermsEncodingKind;
    totalBytes?: number;
    fields: TermsField[];
  };
  constraints?: string[];
  malformedInputBehavior?: string;
  fixtures: TermsFixture[];
};

export type SubmissionAuditEvidence = {
  sourceUrl: string;
  scope: string;
  sourceVersion?: string;
};

export type SubmissionUsageEvidence = {
  name: string;
  sourceUrl?: string;
};

export type SubmissionCompositionEvidence = {
  relation: "complements" | "conflicts" | "redundant";
  relatedType: string;
  context: string;
  ordering?: string;
  supportedBy?: string;
};

export type SubmissionEvidence = {
  audit?: SubmissionAuditEvidence;
  usage?: SubmissionUsageEvidence[];
  compositions?: SubmissionCompositionEvidence[];
};

export type SubmissionAdditionalClaim = {
  subject: "deployment" | "type" | "term";
  subjectId?: string;
  predicateId: string;
  predicateLabel?: string;
  object: string;
};

export type LegacySubmissionInput = {
  chainId: string | number;
  contractAddress: string;
  enforcerName: string;
  description: string;
  type: string;
  restrictionDomain: string;
  operation: string;
  sourceUrl: string;
  sourceVersion?: string;
  termsSchema: TermsSchema;
  submitterWallet: string;
  initialSignal?: string;
  evidence?: SubmissionEvidence;
  additionalClaims?: SubmissionAdditionalClaim[];
};

export type SubmissionTermReference =
  | { kind: "value"; value: string }
  | { kind: "term"; termId: string; label?: string };

export type SubmissionClaim = {
  subject:
    | { kind: "deployment" }
    | { kind: "term"; termId: string; label?: string };
  predicate:
    | { kind: "term"; termId: string; label: string }
    | { kind: "value"; value: string };
  object: SubmissionTermReference;
};

export type ClaimFirstSubmissionInput = {
  version: "2";
  identity: {
    chainId: string | number;
    contractAddress: string;
    displayName?: string;
  };
  claims: SubmissionClaim[];
  submitterWallet: string;
  initialSignal?: string;
};

export type SubmissionInput = LegacySubmissionInput | ClaimFirstSubmissionInput;

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult =
  | { valid: true; value: NormalizedSubmission }
  | { valid: false; issues: ValidationIssue[] };

export type NormalizedLegacySubmission = Omit<
  LegacySubmissionInput,
  "chainId" | "contractAddress" | "submitterWallet"
> & {
  chainId: string;
  contractAddress: string;
  submitterWallet: string;
  caip10: string;
};

export type NormalizedClaimFirstSubmission = Omit<
  ClaimFirstSubmissionInput,
  "identity" | "submitterWallet" | "claims"
> & {
  identity: {
    chainId: string;
    contractAddress: string;
    displayName?: string;
  };
  claims: SubmissionClaim[];
  submitterWallet: string;
  chainId: string;
  contractAddress: string;
  caip10: string;
};

export type NormalizedSubmission =
  | NormalizedLegacySubmission
  | NormalizedClaimFirstSubmission;

export function isClaimFirstSubmissionInput(
  input: SubmissionInput,
): input is ClaimFirstSubmissionInput {
  return "version" in input && input.version === "2";
}

export function isNormalizedClaimFirstSubmission(
  input: NormalizedSubmission,
): input is NormalizedClaimFirstSubmission {
  return "version" in input && input.version === "2";
}

export type ContractCodeCheck =
  | { status: "verified"; address: string; codeLength: number }
  | { status: "missing"; address: string }
  | { status: "error"; address: string; message: string };

export type RpcFetcher = (
  input: string,
  init: {
    method: "POST";
    headers: { "content-type": string };
    body: string;
  },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

type RpcPayload = {
  result?: unknown;
  error?: { message?: string };
};

const defaultRpcFetcher: RpcFetcher = (input, init) => {
  const fetcher = (globalThis as { fetch?: RpcFetcher }).fetch;
  if (!fetcher) {
    return Promise.reject(new Error("A fetch implementation is required."));
  }
  return fetcher(input, init);
};

export function normalizeEvmAddress(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(normalized) ? normalized : null;
}

export function normalizeChainId(value: string | number): string | null {
  const normalized = String(value).trim();
  return /^\d+$/.test(normalized) ? normalized : null;
}

export function buildCaip10(chainId: string, address: string): string {
  return `caip10:eip155:${chainId}:${address}`;
}

function requiredString(
  issues: ValidationIssue[],
  path: string,
  value: unknown,
): value is string {
  if (typeof value !== "string" || !value.trim()) {
    issues.push({ path, message: "This field is required." });
    return false;
  }
  return true;
}

function canonicalValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && /^0x[0-9a-f]+$/i.test(value)) {
    return value.toLowerCase();
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalValue(nested)]),
    );
  }
  return value;
}

function valuesMatch(expected: unknown, actual: unknown): boolean {
  return (
    JSON.stringify(canonicalValue(expected)) ===
    JSON.stringify(canonicalValue(actual))
  );
}

function validateEvidence(
  evidence: SubmissionEvidence | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (evidence === undefined) return issues;
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return [{ path: "evidence", message: "Evidence must be an object." }];
  }

  if (evidence.audit !== undefined) {
    if (
      !evidence.audit ||
      typeof evidence.audit !== "object" ||
      Array.isArray(evidence.audit)
    ) {
      issues.push({
        path: "evidence.audit",
        message: "Audit evidence must be an object.",
      });
    } else {
      requiredString(
        issues,
        "evidence.audit.sourceUrl",
        evidence.audit.sourceUrl,
      );
      requiredString(issues, "evidence.audit.scope", evidence.audit.scope);
      if (
        typeof evidence.audit.sourceUrl === "string" &&
        !/^https?:\/\/\S+$/i.test(evidence.audit.sourceUrl.trim())
      ) {
        issues.push({
          path: "evidence.audit.sourceUrl",
          message: "Audit evidence URL must use http or https.",
        });
      }
      if (
        evidence.audit.sourceVersion !== undefined &&
        (typeof evidence.audit.sourceVersion !== "string" ||
          !evidence.audit.sourceVersion.trim())
      ) {
        issues.push({
          path: "evidence.audit.sourceVersion",
          message: "Audit source version must be a non-empty string.",
        });
      }
    }
  }

  if (evidence.usage !== undefined) {
    if (!Array.isArray(evidence.usage)) {
      issues.push({
        path: "evidence.usage",
        message: "Usage evidence must be an array.",
      });
    } else {
      for (const [index, usage] of evidence.usage.entries()) {
        if (!usage || typeof usage !== "object" || Array.isArray(usage)) {
          issues.push({
            path: `evidence.usage[${index}]`,
            message: "Each usage evidence item must be an object.",
          });
          continue;
        }
        requiredString(issues, `evidence.usage[${index}].name`, usage.name);
        if (
          usage.sourceUrl !== undefined &&
          (typeof usage.sourceUrl !== "string" ||
            !/^https?:\/\/\S+$/i.test(usage.sourceUrl.trim()))
        ) {
          issues.push({
            path: `evidence.usage[${index}].sourceUrl`,
            message: "Usage evidence URL must use http or https.",
          });
        }
      }
    }
  }

  if (evidence.compositions !== undefined) {
    if (!Array.isArray(evidence.compositions)) {
      issues.push({
        path: "evidence.compositions",
        message: "Composability evidence must be an array.",
      });
    } else {
      for (const [index, composition] of evidence.compositions.entries()) {
        const path = `evidence.compositions[${index}]`;
        if (
          !composition ||
          typeof composition !== "object" ||
          Array.isArray(composition)
        ) {
          issues.push({
            path,
            message: "Each composability item must be an object.",
          });
          continue;
        }
        if (
          !["complements", "conflicts", "redundant"].includes(
            composition.relation,
          )
        ) {
          issues.push({
            path: `${path}.relation`,
            message:
              "Composability relation must be complements, conflicts, or redundant.",
          });
        }
        requiredString(issues, `${path}.relatedType`, composition.relatedType);
        requiredString(issues, `${path}.context`, composition.context);
        if (
          composition.ordering !== undefined &&
          (typeof composition.ordering !== "string" ||
            !composition.ordering.trim())
        ) {
          issues.push({
            path: `${path}.ordering`,
            message: "Ordering must be a non-empty string when supplied.",
          });
        }
        if (
          composition.supportedBy !== undefined &&
          (typeof composition.supportedBy !== "string" ||
            !/^https?:\/\/\S+$/i.test(composition.supportedBy.trim()))
        ) {
          issues.push({
            path: `${path}.supportedBy`,
            message: "Supporting evidence must be an http or https URL.",
          });
        }
      }
    }
  }
  return issues;
}

function validateAdditionalClaims(
  claims: SubmissionAdditionalClaim[] | undefined,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (claims === undefined) return issues;
  if (!Array.isArray(claims)) {
    return [
      {
        path: "additionalClaims",
        message: "Additional claims must be a list.",
      },
    ];
  }
  claims.forEach((claim, index) => {
    const path = `additionalClaims[${index}]`;
    if (!claim || typeof claim !== "object" || Array.isArray(claim)) {
      issues.push({
        path,
        message: "Each additional claim must be an object.",
      });
      return;
    }
    if (
      claim.subject !== "deployment" &&
      claim.subject !== "type" &&
      claim.subject !== "term"
    ) {
      issues.push({
        path: `${path}.subject`,
        message: "Claim subject must be deployment, type, or an existing term.",
      });
    }
    if (
      claim.subject === "term" &&
      !/^0x[a-fA-F0-9]{64}$/.test(claim.subjectId?.trim() ?? "")
    ) {
      issues.push({
        path: `${path}.subjectId`,
        message:
          "Existing claim subjects require a canonical Intuition term ID.",
      });
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(claim.predicateId?.trim() ?? "")) {
      issues.push({
        path: `${path}.predicateId`,
        message: "Predicate ID must be a canonical 32-byte Intuition term ID.",
      });
    }
    if (!requiredString(issues, `${path}.object`, claim.object)) return;
    if (new TextEncoder().encode(claim.object.trim()).length > 1_000) {
      issues.push({
        path: `${path}.object`,
        message: "Claim objects must fit within the 1,000-byte atom limit.",
      });
    }
    if (
      claim.predicateLabel !== undefined &&
      (typeof claim.predicateLabel !== "string" || !claim.predicateLabel.trim())
    ) {
      issues.push({
        path: `${path}.predicateLabel`,
        message: "Predicate label must be non-empty when supplied.",
      });
    }
  });
  return issues;
}

type PackedDecode =
  { supported: true; value: unknown } | { supported: false; message: string };

function decodePackedField(field: TermsField, terms: string): PackedDecode {
  const start = 2 + field.offset * 2;
  const end = start + field.bytes * 2;
  const bytes = `0x${terms.slice(start, end)}`.toLowerCase();
  const type = field.type.trim().toLowerCase();
  if (type === "address") {
    if (field.bytes !== 20) {
      return {
        supported: false,
        message: "Packed address fields must occupy exactly 20 bytes.",
      };
    }
    return { supported: true, value: bytes };
  }
  if (type === "bool") {
    if (field.bytes !== 1 || !["0x00", "0x01"].includes(bytes)) {
      return {
        supported: false,
        message: "Packed bool fields must be one byte with value 0 or 1.",
      };
    }
    return { supported: true, value: bytes === "0x01" };
  }
  if (
    /^uint(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/.test(
      type,
    )
  ) {
    return { supported: true, value: BigInt(bytes).toString() };
  }
  if (
    /^int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/.test(
      type,
    )
  ) {
    const bits = field.bytes * 8;
    const unsigned = BigInt(bytes);
    const sign = 1n << BigInt(bits - 1);
    const signed =
      unsigned >= sign ? unsigned - (1n << BigInt(bits)) : unsigned;
    return { supported: true, value: signed.toString() };
  }
  const bytesMatch = type.match(/^bytes(\d+)$/);
  if (bytesMatch) {
    const expectedBytes = Number(bytesMatch[1]);
    if (expectedBytes !== field.bytes) {
      return {
        supported: false,
        message: `Packed ${type} fields must occupy ${expectedBytes} bytes.`,
      };
    }
    return { supported: true, value: bytes };
  }
  return {
    supported: false,
    message: `Packed field type ${field.type} needs a custom decoder fixture.`,
  };
}

function executableFixtureIssues(
  schema: TermsSchema,
  fixture: TermsFixture,
  index: number,
): ValidationIssue[] {
  if (
    !fixture.decoded ||
    typeof fixture.decoded !== "object" ||
    Array.isArray(fixture.decoded) ||
    !/^0x(?:[0-9a-f]{2})*$/i.test(fixture.terms.trim()) ||
    !Array.isArray(schema.encoding?.fields)
  ) {
    return [];
  }

  const path = `termsSchema.fixtures[${index}].decoded`;
  if (schema.encoding.kind === "abi") {
    try {
      const parameters = schema.encoding.fields.map((field) => ({
        name: field.name,
        type: field.type,
      })) as unknown as readonly AbiParameter[];
      const values = decodeAbiParameters(
        parameters,
        fixture.terms.trim() as Hex,
      );
      const actual = Object.fromEntries(
        schema.encoding.fields.map((field, fieldIndex) => [
          field.name,
          values[fieldIndex],
        ]),
      );
      if (!valuesMatch(fixture.decoded, actual)) {
        return [
          {
            path,
            message: "ABI fixture decoded values do not match the terms bytes.",
          },
        ];
      }
    } catch (error) {
      return [
        {
          path: `termsSchema.fixtures[${index}].terms`,
          message:
            error instanceof Error
              ? `ABI fixture could not be decoded: ${error.message}`
              : "ABI fixture could not be decoded.",
        },
      ];
    }
  }

  if (schema.encoding.kind === "packed") {
    const actual: Record<string, unknown> = {};
    for (const field of schema.encoding.fields) {
      const decoded = decodePackedField(field, fixture.terms.trim());
      if (!decoded.supported) {
        return [
          {
            path: `termsSchema.encoding.fields.${field.name}.type`,
            message: decoded.message,
          },
        ];
      }
      actual[field.name] = decoded.value;
    }
    if (!valuesMatch(fixture.decoded, actual)) {
      return [
        {
          path,
          message:
            "Packed fixture decoded values do not match the terms bytes.",
        },
      ];
    }
  }

  return [];
}

export function validateTermsSchema(schema: TermsSchema): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  requiredString(issues, "termsSchema.schemaVersion", schema.schemaVersion);
  requiredString(issues, "termsSchema.enforcer", schema.enforcer);
  requiredString(
    issues,
    "termsSchema.source.repository",
    schema.source?.repository,
  );
  requiredString(issues, "termsSchema.source.commit", schema.source?.commit);
  requiredString(issues, "termsSchema.source.path", schema.source?.path);
  requiredString(
    issues,
    "termsSchema.malformedInputBehavior",
    schema.malformedInputBehavior,
  );

  if (schema.decoderFunction !== undefined) {
    requiredString(
      issues,
      "termsSchema.decoderFunction.name",
      schema.decoderFunction.name,
    );
    for (const key of ["inputs", "outputs"] as const) {
      const values = schema.decoderFunction[key];
      if (!Array.isArray(values)) {
        issues.push({
          path: `termsSchema.decoderFunction.${key}`,
          message: "Decoder parameters must be an array.",
        });
        continue;
      }
      for (const [index, parameter] of values.entries()) {
        requiredString(
          issues,
          `termsSchema.decoderFunction.${key}[${index}].name`,
          parameter?.name,
        );
        requiredString(
          issues,
          `termsSchema.decoderFunction.${key}[${index}].type`,
          parameter?.type,
        );
      }
    }
  }

  if (
    !schema.encoding ||
    !["abi", "packed", "raw", "custom"].includes(schema.encoding.kind)
  ) {
    issues.push({
      path: "termsSchema.encoding.kind",
      message: "Encoding kind must be abi, packed, raw, or custom.",
    });
  }

  if (!Array.isArray(schema.encoding?.fields)) {
    issues.push({
      path: "termsSchema.encoding.fields",
      message: "At least one encoding field is required.",
    });
  } else {
    const ranges: Array<{ start: number; end: number; index: number }> = [];
    const names = new Set<string>();
    for (const [index, field] of schema.encoding.fields.entries()) {
      requiredString(
        issues,
        `termsSchema.encoding.fields[${index}].name`,
        field.name,
      );
      requiredString(
        issues,
        `termsSchema.encoding.fields[${index}].type`,
        field.type,
      );
      if (!Number.isInteger(field.offset) || field.offset < 0) {
        issues.push({
          path: `termsSchema.encoding.fields[${index}].offset`,
          message: "Offset must be a non-negative integer.",
        });
      }
      if (!Number.isInteger(field.bytes) || field.bytes <= 0) {
        issues.push({
          path: `termsSchema.encoding.fields[${index}].bytes`,
          message: "Bytes must be a positive integer.",
        });
      }

      const name = typeof field.name === "string" ? field.name.trim() : "";
      if (name && names.has(name)) {
        issues.push({
          path: `termsSchema.encoding.fields[${index}].name`,
          message: "Field names must be unique.",
        });
      }
      if (name) names.add(name);

      if (
        Number.isInteger(field.offset) &&
        field.offset >= 0 &&
        Number.isInteger(field.bytes) &&
        field.bytes > 0
      ) {
        ranges.push({
          start: field.offset,
          end: field.offset + field.bytes,
          index,
        });
      }
    }

    const orderedRanges = [...ranges].sort(
      (left, right) => left.start - right.start,
    );
    for (let index = 1; index < orderedRanges.length; index += 1) {
      const previous = orderedRanges[index - 1];
      const current = orderedRanges[index];
      if (current.start < previous.end) {
        issues.push({
          path: `termsSchema.encoding.fields[${current.index}]`,
          message: `Field overlaps encoding field ${previous.index}.`,
        });
      }
    }

    if (schema.encoding?.totalBytes !== undefined && ranges.length) {
      const maxEnd = Math.max(...ranges.map((range) => range.end));
      if (maxEnd > schema.encoding.totalBytes) {
        issues.push({
          path: "termsSchema.encoding.totalBytes",
          message: "Total bytes must cover every declared field.",
        });
      }
    }
  }

  if (schema.encoding?.totalBytes !== undefined) {
    if (
      !Number.isInteger(schema.encoding.totalBytes) ||
      schema.encoding.totalBytes <= 0
    ) {
      issues.push({
        path: "termsSchema.encoding.totalBytes",
        message: "Total bytes must be a positive integer when provided.",
      });
    }
  }

  if (!Array.isArray(schema.fixtures) || schema.fixtures.length === 0) {
    issues.push({
      path: "termsSchema.fixtures",
      message: "At least one encode/decode fixture is required.",
    });
  } else {
    for (const [index, fixture] of schema.fixtures.entries()) {
      const hasTerms = requiredString(
        issues,
        `termsSchema.fixtures[${index}].terms`,
        fixture.terms,
      );
      if (hasTerms && !/^0x(?:[0-9a-f]{2})*$/i.test(fixture.terms.trim())) {
        issues.push({
          path: `termsSchema.fixtures[${index}].terms`,
          message:
            "Fixture terms must be an even-length 0x-prefixed byte string.",
        });
      }
      if (
        hasTerms &&
        schema.encoding?.totalBytes !== undefined &&
        fixture.terms.trim().length !== 2 + schema.encoding.totalBytes * 2
      ) {
        issues.push({
          path: `termsSchema.fixtures[${index}].terms`,
          message: "Fixture byte length must match encoding.totalBytes.",
        });
      }
      if (
        !fixture.decoded ||
        typeof fixture.decoded !== "object" ||
        Array.isArray(fixture.decoded)
      ) {
        issues.push({
          path: `termsSchema.fixtures[${index}].decoded`,
          message: "Each fixture must include decoded field values.",
        });
      } else if (Array.isArray(schema.encoding?.fields)) {
        for (const field of schema.encoding.fields) {
          if (!(field.name in fixture.decoded)) {
            issues.push({
              path: `termsSchema.fixtures[${index}].decoded.${field.name}`,
              message:
                "Decoded fixture values must cover every declared field.",
            });
          }
        }
        issues.push(...executableFixtureIssues(schema, fixture, index));
      }
    }
  }

  return issues;
}

const termIdPattern = /^0x[a-fA-F0-9]{64}$/;

function validateClaimFirstSubmission(
  input: ClaimFirstSubmissionInput,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const chainId = normalizeChainId(input.identity?.chainId ?? "");
  const contractAddress = normalizeEvmAddress(
    input.identity?.contractAddress ?? "",
  );
  const submitterWallet = normalizeEvmAddress(input.submitterWallet ?? "");

  if (!chainId) {
    issues.push({
      path: "identity.chainId",
      message: "Chain ID must be decimal digits.",
    });
  }
  if (!contractAddress) {
    issues.push({
      path: "identity.contractAddress",
      message: "Enter a valid 20-byte EVM contract address.",
    });
  }
  if (!submitterWallet) {
    issues.push({
      path: "submitterWallet",
      message: "Enter a valid submitter wallet address.",
    });
  }
  if (
    input.identity?.displayName !== undefined &&
    (typeof input.identity.displayName !== "string" ||
      !input.identity.displayName.trim() ||
      input.identity.displayName.trim().length > 128)
  ) {
    issues.push({
      path: "identity.displayName",
      message: "Display name must contain between 1 and 128 characters.",
    });
  }
  if (!Array.isArray(input.claims) || input.claims.length === 0) {
    issues.push({
      path: "claims",
      message: "Add at least one explicit claim about this enforcer.",
    });
  } else if (input.claims.length > 20) {
    issues.push({
      path: "claims",
      message: "A contribution can contain at most 20 claims.",
    });
  }

  const normalizedClaims: SubmissionClaim[] = [];
  if (Array.isArray(input.claims)) {
    input.claims.forEach((claim, index) => {
      const path = `claims[${index}]`;
      if (!claim || typeof claim !== "object") {
        issues.push({ path, message: "Each claim must be an object." });
        return;
      }

      let subject: SubmissionClaim["subject"] | null = null;
      if (claim.subject?.kind === "deployment") {
        subject = { kind: "deployment" };
      } else if (
        claim.subject?.kind === "term" &&
        termIdPattern.test(claim.subject.termId?.trim() ?? "")
      ) {
        subject = {
          kind: "term",
          termId: claim.subject.termId.trim().toLowerCase(),
          ...(claim.subject.label?.trim()
            ? { label: claim.subject.label.trim() }
            : {}),
        };
      } else {
        issues.push({
          path: `${path}.subject.termId`,
          message: "Existing claim subjects require a canonical Intuition term ID.",
        });
      }

      let predicate: SubmissionClaim["predicate"] | null = null;
      if (
        claim.predicate?.kind === "term" &&
        termIdPattern.test(claim.predicate.termId?.trim() ?? "") &&
        claim.predicate.label?.trim()
      ) {
        predicate = {
          kind: "term",
          termId: claim.predicate.termId.trim().toLowerCase(),
          label: claim.predicate.label.trim(),
        };
      } else if (
        claim.predicate?.kind === "value" &&
        claim.predicate.value?.trim()
      ) {
        predicate = {
          kind: "value",
          value: claim.predicate.value.trim(),
        };
      } else {
        issues.push({
          path: `${path}.predicate`,
          message: "Choose a reviewed predicate or enter a readable custom predicate.",
        });
      }

      let object: SubmissionClaim["object"] | null = null;
      if (
        claim.object?.kind === "term" &&
        termIdPattern.test(claim.object.termId?.trim() ?? "")
      ) {
        object = {
          kind: "term",
          termId: claim.object.termId.trim().toLowerCase(),
          ...(claim.object.label?.trim()
            ? { label: claim.object.label.trim() }
            : {}),
        };
      } else if (
        claim.object?.kind === "value" &&
        claim.object.value?.trim()
      ) {
        const value = claim.object.value.trim();
        if (new TextEncoder().encode(value).length > 1_000) {
          issues.push({
            path: `${path}.object.value`,
            message: "Claim objects must fit within the 1,000-byte atom limit.",
          });
        } else {
          object = { kind: "value", value };
        }
      } else {
        issues.push({
          path:
            claim.object?.kind === "term"
              ? `${path}.object.termId`
              : `${path}.object`,
          message: "Create a readable object or choose an existing Intuition term.",
        });
      }

      if (subject && predicate && object) {
        normalizedClaims.push({ subject, predicate, object });
      }
    });
  }

  if (
    input.initialSignal !== undefined &&
    !/^\d+$/.test(input.initialSignal.trim())
  ) {
    issues.push({
      path: "initialSignal",
      message: "Initial signal must be a non-negative decimal amount.",
    });
  }

  if (issues.length || !chainId || !contractAddress || !submitterWallet) {
    return { valid: false, issues };
  }
  return {
    valid: true,
    value: {
      version: "2",
      identity: {
        chainId,
        contractAddress,
        ...(input.identity.displayName?.trim()
          ? { displayName: input.identity.displayName.trim() }
          : {}),
      },
      claims: normalizedClaims,
      submitterWallet,
      ...(input.initialSignal !== undefined
        ? { initialSignal: input.initialSignal.trim() }
        : {}),
      chainId,
      contractAddress,
      caip10: buildCaip10(chainId, contractAddress),
    },
  };
}

export function validateSubmission(input: SubmissionInput): ValidationResult {
  if (isClaimFirstSubmissionInput(input)) {
    return validateClaimFirstSubmission(input);
  }
  const issues: ValidationIssue[] = [];
  const chainId = normalizeChainId(input.chainId);
  const contractAddress = normalizeEvmAddress(input.contractAddress);
  const submitterWallet = normalizeEvmAddress(input.submitterWallet);

  if (!chainId) {
    issues.push({
      path: "chainId",
      message: "Chain ID must be decimal digits.",
    });
  }
  if (!contractAddress) {
    issues.push({
      path: "contractAddress",
      message: "Enter a valid 20-byte EVM contract address.",
    });
  }
  if (!submitterWallet) {
    issues.push({
      path: "submitterWallet",
      message: "Enter a valid submitter wallet address.",
    });
  }

  requiredString(issues, "enforcerName", input.enforcerName);
  requiredString(issues, "description", input.description);
  requiredString(issues, "type", input.type);
  requiredString(issues, "restrictionDomain", input.restrictionDomain);
  requiredString(issues, "operation", input.operation);
  requiredString(issues, "sourceUrl", input.sourceUrl);

  if (
    typeof input.termsSchema?.enforcer === "string" &&
    typeof input.type === "string" &&
    input.termsSchema.enforcer.trim() !== input.type.trim()
  ) {
    issues.push({
      path: "termsSchema.enforcer",
      message: "Terms schema enforcer must match the submission type.",
    });
  }

  if (input.sourceUrl && !/^https?:\/\/\S+$/i.test(input.sourceUrl.trim())) {
    issues.push({
      path: "sourceUrl",
      message: "Source URL must use http or https.",
    });
  }

  if (
    input.initialSignal !== undefined &&
    !/^\d+$/.test(input.initialSignal.trim())
  ) {
    issues.push({
      path: "initialSignal",
      message: "Initial signal must be a non-negative decimal amount.",
    });
  }

  issues.push(...validateEvidence(input.evidence));
  issues.push(...validateAdditionalClaims(input.additionalClaims));

  issues.push(...validateTermsSchema(input.termsSchema));

  if (issues.length || !chainId || !contractAddress || !submitterWallet) {
    return { valid: false, issues };
  }

  return {
    valid: true,
    value: {
      ...input,
      chainId,
      contractAddress,
      submitterWallet,
      caip10: buildCaip10(chainId, contractAddress),
    },
  };
}

export async function verifyContractCode(
  rpcEndpoint: string,
  address: string,
  fetcher: RpcFetcher = defaultRpcFetcher,
): Promise<ContractCodeCheck> {
  const normalized = normalizeEvmAddress(address);
  if (!normalized) {
    return {
      status: "error",
      address,
      message: "Cannot verify code for an invalid EVM address.",
    };
  }
  if (!rpcEndpoint.trim()) {
    return {
      status: "error",
      address: normalized,
      message: "An RPC endpoint is required for code verification.",
    };
  }

  try {
    const response = await fetcher(rpcEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getCode",
        params: [normalized, "latest"],
      }),
    });

    if (!response.ok) {
      return {
        status: "error",
        address: normalized,
        message: `RPC request failed (${response.status}).`,
      };
    }

    const payload = (await response.json()) as RpcPayload;
    if (payload.error) {
      return {
        status: "error",
        address: normalized,
        message: payload.error.message ?? "RPC returned an error.",
      };
    }

    if (typeof payload.result !== "string") {
      return {
        status: "error",
        address: normalized,
        message: "RPC returned an invalid code response.",
      };
    }

    const code = payload.result.toLowerCase();
    if (code === "0x" || code === "0x0") {
      return { status: "missing", address: normalized };
    }

    return {
      status: "verified",
      address: normalized,
      codeLength: Math.max((code.length - 2) / 2, 0),
    };
  } catch (error) {
    return {
      status: "error",
      address: normalized,
      message: error instanceof Error ? error.message : "RPC request failed.",
    };
  }
}
