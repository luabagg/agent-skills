import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { parseOpenCodeModels } from "../scripts/lib/model-discovery.mjs";

const root = resolve(import.meta.dirname, "..");
const model = {
  id: "gpt-6.1-sol", providerID: "openai", name: "GPT-6.1 Sol",
  capabilities: { reasoning: true, input: { text: true, image: true, pdf: true } },
  limit: { context: 1050000, input: 922000, output: 128000 },
  cost: { input: 3, output: 12, cache: { read: 0.3, write: 0 } },
  headers: { Authorization: "private-value-must-not-enter-catalog" },
};
const output = `openai/${model.id}\n${JSON.stringify(model, null, 2)}\n`;

test("OpenCode discovery keeps model capabilities and limits but omits request credentials", () => {
  const discovered = parseOpenCodeModels(output.replaceAll("\n", "\r\n"), "openai");
  assert.deepEqual(discovered[model.id], {
    name: "GPT-6.1 Sol", reasoning: true, input: ["text", "image"],
    contextWindow: 1050000, maxTokens: 128000,
    cost: { input: 3, output: 12, cacheRead: 0.3, cacheWrite: 0 },
  });
  assert.doesNotMatch(JSON.stringify(discovered), /Authorization|private-value|pdf/);
});

test("OpenCode discovery rejects empty output and model identity mismatches", () => {
  assert.throws(() => parseOpenCodeModels("Provider not found", "openai"), /no models/);
  assert.throws(() => parseOpenCodeModels(output.replace("openai/gpt-6.1-sol", "openai/wrong-model"), "openai"), /identity/);
});

test("catalog refresh reuses unchanged optional providers but rejects changed providers without discovery", () => {
  const dir = mkdtempSync(join(tmpdir(), "agent-skills-model-discovery-"));
  const policyPath = join(dir, "catalog.yaml");
  const lockPath = join(dir, "catalog.lock.json");
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "pi"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  writeFileSync(join(bin, "opencode"), `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(output)});\n`, { mode: 0o755 });
  const policy = parseYaml(readFileSync(join(root, "harnesses/catalog.yaml"), "utf8"));
  const lock = JSON.parse(readFileSync(join(root, "harnesses/catalog.lock.json"), "utf8"));
  const env = {
    ...process.env, PATH: `${bin}:${process.env.PATH}`,
    CATALOG_POLICY_PATH: policyPath, CATALOG_LOCK_PATH: lockPath,
  };
  const run = () => spawnSync(process.execPath, [join(root, "scripts/catalog.mjs"), "refresh"], { cwd: root, env, encoding: "utf8" });
  try {
    policy.providers["openai-codex"].modelDefaults.name = "Updated OpenAI defaults";
    policy.selectors = { "openai-sol": policy.selectors["openai-sol"], "xai-chat": policy.selectors["xai-chat"] };
    policy.piScopes = { default: ["openai-sol", "xai-chat"] };
    policy.opencodeRoles = { primary: "openai-sol" };
    writeFileSync(policyPath, stringifyYaml(policy));
    writeFileSync(lockPath, JSON.stringify(lock));
    const refreshed = run();
    assert.equal(refreshed.status, 0, `${refreshed.stdout}\n${refreshed.stderr}`);
    const next = JSON.parse(readFileSync(lockPath, "utf8"));
    assert.deepEqual(next.providers.xai.models, lock.providers.xai.models);
    assert.equal(next.resolvedSelectors["openai-sol"].modelId, "gpt-6.1-sol");
    assert.doesNotMatch(JSON.stringify(next), /private-value/);

    policy.providers.xai.modelDefaults.contextWindow = 192000;
    writeFileSync(policyPath, stringifyYaml(policy));
    const before = readFileSync(lockPath, "utf8");
    const rejected = run();
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /xai discovery failed while catalog policy changed/);
    assert.equal(readFileSync(lockPath, "utf8"), before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
