import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DEPTH_MOCK_MODEL_VERSION, evaluateDepthAnswer } from "../lib/depth/evaluate-depth-answer";

const ROOT = process.cwd();

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".venv" || entry === "drizzle") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

describe("Local AI depth service — fail-closed containment (P0.4A)", () => {
  it("lib/api/client.ts (the NEXT_PUBLIC_API_BASE_URL remote-scorer switch) no longer exists", () => {
    assert.equal(existsSync(join(ROOT, "lib/api/client.ts")), false);
  });

  it("no application source references NEXT_PUBLIC_API_BASE_URL, apiFetch, hasApiBaseUrl, or /internal/depth/evaluate", () => {
    const forbidden = [
      "NEXT_PUBLIC_API_BASE_URL",
      "apiFetch",
      "hasApiBaseUrl",
      "/internal/depth/evaluate",
    ];
    const scanDirs = ["app", "components", "lib", "types"];
    const offenders: string[] = [];

    for (const scanDir of scanDirs) {
      const base = join(ROOT, scanDir);
      if (!existsSync(base)) continue;
      for (const file of walk(base)) {
        const content = readFileSync(file, "utf8");
        for (const needle of forbidden) {
          if (content.includes(needle)) {
            offenders.push(`${file} references "${needle}"`);
          }
        }
      }
    }

    assert.deepEqual(offenders, []);
  });

  it("the unlock route always evaluates with the deterministic heuristic, with no remote-selection branch", () => {
    const source = readFileSync(join(ROOT, "app/api/answers/unlock/route.ts"), "utf8");

    assert.match(source, /from "@\/lib\/depth\/evaluate-depth-answer"/);
    assert.match(source, /evaluateDepthAnswer\(/);
    assert.doesNotMatch(source, /NEXT_PUBLIC_API_BASE_URL/);
    assert.doesNotMatch(source, /apiFetch/);
    assert.doesNotMatch(source, /hasApiBaseUrl/);
    assert.doesNotMatch(source, /internal\/depth\/evaluate/);
    assert.doesNotMatch(source, /lib\/api\/client/);
  });

  it("evaluateDepthAnswer is a pure local function that never performs network I/O", () => {
    const source = readFileSync(join(ROOT, "lib/depth/evaluate-depth-answer.ts"), "utf8");
    assert.doesNotMatch(source, /fetch\(/);
    assert.doesNotMatch(source, /XMLHttpRequest/);
  });

  it("the live scorer identity is exactly mock-local-heuristic-v0.0, never claimed as AI", () => {
    assert.equal(DEPTH_MOCK_MODEL_VERSION, "mock-local-heuristic-v0.0");
    const result = evaluateDepthAnswer({
      questionText: "요즘 당신을 웃게 만드는 것은?",
      answerText: "어제 퇴근길에 본 고양이가 자꾸 생각나요.",
    });
    assert.equal(result.modelVersion, "mock-local-heuristic-v0.0");
  });

  it(".env.example advertises no public/client env var that selects the Depth service", () => {
    const source = readFileSync(join(ROOT, ".env.example"), "utf8");
    assert.doesNotMatch(source, /NEXT_PUBLIC_API_BASE_URL/);
    // Qwen review must ship with no default remote target.
    assert.match(source, /^QWEN_REVIEW_URL=$/m);
  });

  it("docker-compose.yml keeps tei and depth-service behind an explicit opt-in profile", () => {
    const source = readFileSync(join(ROOT, "docker-compose.yml"), "utf8");
    const services = source.split(/\n {2}(?=\w)/);
    const tei = services.find((block) => block.startsWith("tei:"));
    const depthService = services.find((block) => block.startsWith("depth-service:"));

    assert.ok(tei, "tei service block not found");
    assert.ok(depthService, "depth-service service block not found");
    assert.match(tei!, /profiles:\s*\["local-ai-poc"\]/);
    assert.match(depthService!, /profiles:\s*\["local-ai-poc"\]/);
    // No default remote Qwen target may leak in via compose interpolation.
    assert.doesNotMatch(source, /QWEN_REVIEW_URL:\s*\$\{QWEN_REVIEW_URL:-http/);
  });
});
