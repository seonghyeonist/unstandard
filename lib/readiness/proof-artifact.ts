import { createHash } from "node:crypto";
import { closeSync, fsyncSync, openSync, renameSync, unlinkSync, writeFileSync, existsSync, mkdirSync, readFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import {
  ARTIFACT_VERSION,
  INTEGRATION_MATRIX,
  PROOF_CLOCK_SKEW_MS,
  PROOF_MAX_AGE_MS,
  SMOKE_MATRIX,
} from "./proof-constants";
import { hostnameFailureMessage, validateEvidenceHostname } from "./hostnames";
import { scanForSecrets } from "./secret-scan";

const fullGitShaSchema = z
  .string()
  .regex(/^[a-f0-9]{40}$/, "gitSha must be a full 40-character lowercase hex SHA");

const migrationChecksumSchema = z
  .string()
  .min(1)
  .regex(/^[a-f0-9]{16}$/, "migrationChecksum must be 16 lowercase hex chars");

const isoTimestampSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)), {
  message: "timestamp must be valid ISO-8601",
});

const caseStatusSchema = z.enum(["PASS", "FAIL"]);

const proofCaseSchema = z
  .object({
    name: z.string().min(1),
    status: caseStatusSchema,
  })
  .strict();

const futureNotApplicableSchema = z
  .object({
    name: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

const verdictSchema = z.enum(["PASS", "FAIL", "BLOCKED_EXTERNAL", "INCOMPLETE"]);

const baseArtifactFields = {
  artifactVersion: z.literal(ARTIFACT_VERSION),
  verdict: verdictSchema,
  gitSha: fullGitShaSchema,
  migrationChecksum: migrationChecksumSchema,
  timestamp: isoTimestampSchema,
  matrix: z.string().min(1),
  cases: z.array(proofCaseSchema),
  futureNotApplicable: z.array(futureNotApplicableSchema).optional(),
};

export const integrationProofArtifactSchema = z
  .object({
    ...baseArtifactFields,
    kind: z.literal("integration"),
    matrix: z.literal(INTEGRATION_MATRIX),
  })
  .strict();

export const smokeProofArtifactSchema = z
  .object({
    ...baseArtifactFields,
    kind: z.literal("smoke"),
    matrix: z.literal(SMOKE_MATRIX),
    previewHostname: z.string().min(1),
  })
  .strict();

export const proofArtifactSchema = z.union([
  integrationProofArtifactSchema,
  smokeProofArtifactSchema,
]);

export type IntegrationProofArtifact = z.infer<typeof integrationProofArtifactSchema>;
export type SmokeProofArtifact = z.infer<typeof smokeProofArtifactSchema>;
export type ProofArtifact = z.infer<typeof proofArtifactSchema>;
export type ProofCase = z.infer<typeof proofCaseSchema>;
export type FutureNotApplicable = z.infer<typeof futureNotApplicableSchema>;
export type ProofVerdict = z.infer<typeof verdictSchema>;

export const combinedReadinessArtifactSchema = z
  .object({
    artifactVersion: z.literal(ARTIFACT_VERSION),
    kind: z.literal("readiness"),
    verdict: z.literal("PASS"),
    gitSha: fullGitShaSchema,
    migrationChecksum: migrationChecksumSchema,
    previewHostname: z.string().min(1),
    timestamp: isoTimestampSchema,
    sourceTimestamps: z
      .object({
        integration: isoTimestampSchema,
        smoke: isoTimestampSchema,
      })
      .strict(),
    integrationCases: z.array(
      z
        .object({
          name: z.string().min(1),
          status: z.literal("PASS"),
        })
        .strict(),
    ),
    smokeCases: z.array(
      z
        .object({
          name: z.string().min(1),
          status: z.literal("PASS"),
        })
        .strict(),
    ),
    /** Accidental-change fingerprint only — not a signature or attestation. */
    contentDigest: z.string().regex(/^[a-f0-9]{16}$/),
  })
  .strict();

export type CombinedReadinessArtifact = z.infer<typeof combinedReadinessArtifactSchema>;

export type ArtifactValidationOptions = {
  nowMs?: number;
  maxAgeMs?: number;
  clockSkewMs?: number;
  expectedPreviewHostname?: string;
  requirePreviewHostnameRules?: boolean;
};

function collectDuplicateNames(names: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) dupes.add(name);
    seen.add(name);
  }
  return [...dupes];
}

function validateTimestampBounds(
  timestamp: string,
  options: ArtifactValidationOptions,
  label: string,
): string[] {
  const failures: string[] = [];
  const nowMs = options.nowMs ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? PROOF_MAX_AGE_MS;
  const clockSkewMs = options.clockSkewMs ?? PROOF_CLOCK_SKEW_MS;
  const parsed = Date.parse(timestamp);

  if (!Number.isFinite(parsed)) {
    failures.push(`${label} timestamp is invalid`);
    return failures;
  }

  if (parsed > nowMs + clockSkewMs) {
    failures.push(`${label} timestamp is excessively in the future`);
  }

  if (nowMs - parsed > maxAgeMs) {
    failures.push(`${label} timestamp is stale`);
  }

  return failures;
}

function validateCaseInventory(
  cases: ProofCase[],
  futureNotApplicable: FutureNotApplicable[] | undefined,
  verdict: ProofVerdict,
  label: string,
): string[] {
  const failures: string[] = [];
  const caseNames = cases.map((item) => item.name);
  const futureNames = (futureNotApplicable ?? []).map((item) => item.name);

  const caseDupes = collectDuplicateNames(caseNames);
  for (const name of caseDupes) {
    failures.push(`${label}: duplicate case name "${name}"`);
  }

  const futureDupes = collectDuplicateNames(futureNames);
  for (const name of futureDupes) {
    failures.push(`${label}: duplicate futureNotApplicable name "${name}"`);
  }

  const caseSet = new Set(caseNames);
  for (const name of futureNames) {
    if (caseSet.has(name)) {
      failures.push(`${label}: active case overlaps futureNotApplicable: "${name}"`);
    }
  }

  const failedCases = cases.filter((item) => item.status === "FAIL");
  const allPass = cases.length > 0 && failedCases.length === 0;

  if (verdict === "PASS") {
    if (cases.length === 0) {
      failures.push(`${label}: PASS requires at least one active case`);
    }
    if (failedCases.length > 0) {
      failures.push(`${label}: PASS aggregate cannot contain FAIL cases`);
    }
  }

  if (verdict === "FAIL" && failedCases.length === 0) {
    failures.push(`${label}: FAIL requires at least one active FAIL case`);
  }

  if (verdict === "INCOMPLETE") {
    failures.push(`${label}: INCOMPLETE is not accepted as readiness proof`);
  }

  if (verdict === "BLOCKED_EXTERNAL") {
    const fabricatedPass = cases.some((item) => item.status === "PASS");
    if (fabricatedPass) {
      failures.push(`${label}: BLOCKED_EXTERNAL must not contain PASS execution results`);
    }
  }

  if (allPass && verdict === "FAIL") {
    failures.push(`${label}: all cases PASS but aggregate verdict is FAIL`);
  }

  return failures;
}

/**
 * Runtime validation beyond Zod shape: timestamps, duplicates, verdict coherence,
 * hostname rules, secret scan, and rejection of legacy pass:boolean shapes.
 */
export function validateProofArtifactSemantics(
  artifact: ProofArtifact,
  options: ArtifactValidationOptions = {},
): string[] {
  const failures: string[] = [];
  failures.push(...validateTimestampBounds(artifact.timestamp, options, artifact.kind));
  failures.push(
    ...validateCaseInventory(
      artifact.cases,
      artifact.futureNotApplicable,
      artifact.verdict,
      artifact.kind,
    ),
  );

  if (artifact.kind === "smoke") {
    const hostFailure = validateEvidenceHostname(artifact.previewHostname, {
      expectedPreviewHostname: options.expectedPreviewHostname,
    });
    if (hostFailure && (options.requirePreviewHostnameRules ?? true)) {
      failures.push(hostnameFailureMessage(hostFailure));
    }
  }

  const secretHits = scanForSecrets(artifact);
  failures.push(...secretHits);

  return failures;
}

export function parseProofArtifact(
  raw: unknown,
  options: ArtifactValidationOptions = {},
): { ok: true; artifact: ProofArtifact } | { ok: false; failures: string[] } {
  if (raw && typeof raw === "object" && "cases" in raw && Array.isArray((raw as { cases: unknown }).cases)) {
    for (const item of (raw as { cases: unknown[] }).cases) {
      if (item && typeof item === "object" && "pass" in item && !("status" in item)) {
        return {
          ok: false,
          failures: ["legacy pass:boolean case shape is rejected"],
        };
      }
      if (item && typeof item === "object" && "status" in item) {
        const status = (item as { status: unknown }).status;
        if (status === "SKIPPED") {
          return { ok: false, failures: ["SKIPPED is not a valid active case status"] };
        }
      }
    }
  }

  const parsed = proofArtifactSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      failures: parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`),
    };
  }

  const semantic = validateProofArtifactSemantics(parsed.data, options);
  if (semantic.length > 0) {
    return { ok: false, failures: semantic };
  }

  return { ok: true, artifact: parsed.data };
}

export function parseIntegrationProofArtifact(
  raw: unknown,
  options: ArtifactValidationOptions = {},
): { ok: true; artifact: IntegrationProofArtifact } | { ok: false; failures: string[] } {
  const result = parseProofArtifact(raw, options);
  if (!result.ok) return result;
  if (result.artifact.kind !== "integration") {
    return { ok: false, failures: ["expected kind: integration"] };
  }
  return { ok: true, artifact: result.artifact };
}

export function parseSmokeProofArtifact(
  raw: unknown,
  options: ArtifactValidationOptions = {},
): { ok: true; artifact: SmokeProofArtifact } | { ok: false; failures: string[] } {
  const result = parseProofArtifact(raw, options);
  if (!result.ok) return result;
  if (result.artifact.kind !== "smoke") {
    return { ok: false, failures: ["expected kind: smoke"] };
  }
  return { ok: true, artifact: result.artifact };
}

export function parseCombinedReadinessArtifact(
  raw: unknown,
  options: ArtifactValidationOptions = {},
): { ok: true; artifact: CombinedReadinessArtifact } | { ok: false; failures: string[] } {
  const parsed = combinedReadinessArtifactSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      failures: parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`),
    };
  }

  const failures: string[] = [];
  failures.push(...validateTimestampBounds(parsed.data.timestamp, options, "readiness"));
  failures.push(
    ...validateTimestampBounds(parsed.data.sourceTimestamps.integration, options, "integration source"),
  );
  failures.push(...validateTimestampBounds(parsed.data.sourceTimestamps.smoke, options, "smoke source"));

  const hostFailure = validateEvidenceHostname(parsed.data.previewHostname, {
    expectedPreviewHostname: options.expectedPreviewHostname,
  });
  if (hostFailure) {
    failures.push(hostnameFailureMessage(hostFailure));
  }

  const integDupes = collectDuplicateNames(parsed.data.integrationCases.map((c) => c.name));
  const smokeDupes = collectDuplicateNames(parsed.data.smokeCases.map((c) => c.name));
  for (const name of integDupes) failures.push(`duplicate integration case "${name}"`);
  for (const name of smokeDupes) failures.push(`duplicate smoke case "${name}"`);

  const digest = computeContentDigest({
    ...parsed.data,
    contentDigest: undefined,
  });
  if (digest !== parsed.data.contentDigest) {
    failures.push("contentDigest does not match serialized content (not a signature — mismatch only)");
  }

  failures.push(...scanForSecrets(parsed.data));

  if (failures.length > 0) {
    return { ok: false, failures };
  }

  return { ok: true, artifact: parsed.data };
}

export type BuildIntegrationArtifactInput = {
  verdict: ProofVerdict;
  gitSha: string;
  migrationChecksum: string;
  timestamp?: string;
  cases: ProofCase[];
  futureNotApplicable?: FutureNotApplicable[];
};

export type BuildSmokeArtifactInput = BuildIntegrationArtifactInput & {
  previewHostname: string;
};

export function buildIntegrationArtifact(
  input: BuildIntegrationArtifactInput,
): { ok: true; artifact: IntegrationProofArtifact } | { ok: false; failures: string[] } {
  const candidate = {
    artifactVersion: ARTIFACT_VERSION,
    kind: "integration" as const,
    verdict: input.verdict,
    gitSha: input.gitSha,
    migrationChecksum: input.migrationChecksum,
    timestamp: input.timestamp ?? new Date().toISOString(),
    matrix: INTEGRATION_MATRIX,
    cases: input.cases,
    ...(input.futureNotApplicable ? { futureNotApplicable: input.futureNotApplicable } : {}),
  };

  return parseIntegrationProofArtifact(candidate);
}

export function buildSmokeArtifact(
  input: BuildSmokeArtifactInput,
): { ok: true; artifact: SmokeProofArtifact } | { ok: false; failures: string[] } {
  const candidate = {
    artifactVersion: ARTIFACT_VERSION,
    kind: "smoke" as const,
    verdict: input.verdict,
    gitSha: input.gitSha,
    migrationChecksum: input.migrationChecksum,
    timestamp: input.timestamp ?? new Date().toISOString(),
    matrix: SMOKE_MATRIX,
    previewHostname: input.previewHostname,
    cases: input.cases,
    ...(input.futureNotApplicable ? { futureNotApplicable: input.futureNotApplicable } : {}),
  };

  return parseSmokeProofArtifact(candidate);
}

/**
 * contentDigest identifies serialized content only.
 * It is not a signature, not tamper-proof, and not an independent attestation.
 */
export function computeContentDigest(value: unknown): string {
  const normalized = JSON.stringify(value);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export function buildCombinedReadinessArtifact(input: {
  integration: IntegrationProofArtifact;
  smoke: SmokeProofArtifact;
  nowIso?: string;
}): { ok: true; artifact: CombinedReadinessArtifact } | { ok: false; failures: string[] } {
  const withoutDigest = {
    artifactVersion: ARTIFACT_VERSION,
    kind: "readiness" as const,
    verdict: "PASS" as const,
    gitSha: input.integration.gitSha,
    migrationChecksum: input.integration.migrationChecksum,
    previewHostname: input.smoke.previewHostname,
    timestamp: input.nowIso ?? new Date().toISOString(),
    sourceTimestamps: {
      integration: input.integration.timestamp,
      smoke: input.smoke.timestamp,
    },
    integrationCases: input.integration.cases.map((item) => ({
      name: item.name,
      status: "PASS" as const,
    })),
    smokeCases: input.smoke.cases.map((item) => ({
      name: item.name,
      status: "PASS" as const,
    })),
  };

  const artifact = {
    ...withoutDigest,
    contentDigest: computeContentDigest(withoutDigest),
  };

  return parseCombinedReadinessArtifact(artifact);
}

export type WriteArtifactOptions = {
  outputPath: string;
  artifact: object;
  /** When true, allow overwriting a PASS artifact from a different gitSha. */
  allowOverwriteDifferentSha?: boolean;
};

function readExistingGitSha(path: string): string | null {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as { gitSha?: unknown; verdict?: unknown };
    if (typeof raw.gitSha === "string") return raw.gitSha;
    return null;
  } catch {
    return null;
  }
}

/**
 * Atomic write: temp sibling → fsync → rename.
 * Refuses to overwrite a non-empty PASS artifact from another gitSha unless override is set.
 * Never leaves a partial PASS artifact as the destination on failure.
 */
export function writeProofArtifactAtomically(options: WriteArtifactOptions): void {
  const { outputPath, artifact } = options;
  const parent = dirname(outputPath);
  mkdirSync(parent, { recursive: true });

  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  const secretHits = scanForSecrets(artifact);
  if (secretHits.length > 0) {
    throw new Error(`refusing to write artifact: ${secretHits.join("; ")}`);
  }

  const verdict =
    artifact && typeof artifact === "object" && "verdict" in artifact
      ? (artifact as { verdict?: unknown }).verdict
      : undefined;
  const gitSha =
    artifact && typeof artifact === "object" && "gitSha" in artifact
      ? (artifact as { gitSha?: unknown }).gitSha
      : undefined;

  if (existsSync(outputPath) && verdict === "PASS" && typeof gitSha === "string") {
    try {
      const existingRaw = readFileSync(outputPath, "utf8");
      if (existingRaw.trim().length > 0) {
        const existing = JSON.parse(existingRaw) as { verdict?: unknown; gitSha?: unknown };
        if (
          existing.verdict === "PASS" &&
          typeof existing.gitSha === "string" &&
          existing.gitSha !== gitSha &&
          !options.allowOverwriteDifferentSha
        ) {
          throw new Error(
            "refusing to overwrite PASS artifact from a different gitSha (set UNSTANDARD_PROOF_OVERWRITE_DIFFERENT_SHA=yes to override)",
          );
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("refusing to overwrite")) {
        throw error;
      }
      // Unparseable existing file: proceed with atomic replace.
    }
  }

  const tempPath = join(parent, `.${Date.now()}-${process.pid}.proof.tmp`);
  const fd = openSync(tempPath, "w");
  try {
    writeSync(fd, serialized);
    fsyncSync(fd);
  } catch (error) {
    try {
      closeSync(fd);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(tempPath);
    } catch {
      /* ignore */
    }
    throw error;
  }
  closeSync(fd);

  try {
    renameSync(tempPath, outputPath);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      /* ignore */
    }
    throw error;
  }
}

/** Test helper: simulate a failed write after temp creation (temp must not remain as success output). */
export function writeProofArtifactAtomicallyWithInjectedFailure(
  options: WriteArtifactOptions & { injectFailureAfterTempWrite?: boolean },
): void {
  if (!options.injectFailureAfterTempWrite) {
    writeProofArtifactAtomically(options);
    return;
  }

  const parent = dirname(options.outputPath);
  mkdirSync(parent, { recursive: true });
  const tempPath = join(parent, `.${Date.now()}-${process.pid}.proof.tmp`);
  writeFileSync(tempPath, "partial");
  try {
    unlinkSync(tempPath);
  } catch {
    /* ignore */
  }
  throw new Error("injected write failure");
}

export function loadJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

export { readExistingGitSha };
