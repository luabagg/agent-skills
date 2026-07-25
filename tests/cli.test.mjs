#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { shellQuote, windowsQuote } from "../scripts/lib/command.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = resolve(repoRoot, "scripts/cli.mjs");
const node = process.execPath;

function runCli(args, options = {}) {
  return spawnSync(node, [cliPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...(options.env ?? {}) },
    input: options.input,
  });
}

function combined(result) {
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

test("root --help exits 0 and lists top-level commands", () => {
  const result = runCli(["--help"]);
  assert.equal(result.status, 0);
  const out = combined(result);
  assert.match(out, /agent-skills/);
  for (const command of ["list", "install", "setup", "config", "models", "update", "verify"]) {
    assert.match(out, new RegExp(`\\b${command}\\b`));
  }
  assert.match(out, /list skills/);
  assert.match(out, /list tools/);
  assert.match(out, /config memory-palace/);
  assert.match(out, /models check/);
  // Old top-level surfaces should be gone.
  assert.doesNotMatch(out, /^\s*catalog\b/m);
  assert.doesNotMatch(out, /\bsetup memory-palace\b/);
  assert.doesNotMatch(out, /^\s*skills\b/m);
});

test("empty argv prints root help and exits 0", () => {
  const result = runCli([]);
  assert.equal(result.status, 0);
  assert.match(combined(result), /Usage:/);
});

test("unknown command exits non-zero with actionable message", () => {
  const result = runCli(["nope"]);
  assert.equal(result.status, 1);
  assert.match(combined(result), /Unknown command `nope`/);
  assert.match(combined(result), /agent-skills --help/);
});

test("missing install subcommand prints help and exits non-zero", () => {
  const result = runCli(["install"]);
  assert.equal(result.status, 1);
  assert.match(combined(result), /Subcommands:/);
  assert.match(combined(result), /curated/);
});

test("install --help exits 0", () => {
  const result = runCli(["install", "--help"]);
  assert.equal(result.status, 0);
  assert.match(combined(result), /install skills\|curated|curated/);
});

test("unknown install subcommand exits non-zero", () => {
  const result = runCli(["install", "widgets"]);
  assert.equal(result.status, 1);
  assert.match(combined(result), /Unknown `install` subcommand `widgets`/);
});

test("unknown flag is rejected with allowed list", () => {
  const result = runCli(["setup", "pi", "--bogus"]);
  assert.equal(result.status, 1);
  assert.match(combined(result), /Unknown flag --bogus/);
  assert.match(combined(result), /--dry-run/);
});

test("list skills --json without --installed is rejected", () => {
  const result = runCli(["list", "skills", "--json"]);
  assert.equal(result.status, 1);
  assert.match(combined(result), /`--json` is only supported with `--installed`/);
});

test("list tools prints curated tools table", () => {
  const result = runCli(["list", "tools"]);
  assert.equal(result.status, 0);
  const out = combined(result);
  assert.match(out, /NAME\s+KIND\s+DESCRIPTION/);
  assert.match(out, /headroom/);
  assert.match(out, /codegraph/);
});

test("list tools --json returns array payload", () => {
  const result = runCli(["list", "tools", "--json"]);
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.ok(Array.isArray(payload));
  assert.ok(payload.some((tool) => tool.name === "headroom"));
});

test("list tools --kind filters and rejects unknown kinds", () => {
  const ok = runCli(["list", "tools", "--kind", "cli"]);
  assert.equal(ok.status, 0);
  const out = combined(ok);
  assert.match(out, /headroom/);
  assert.doesNotMatch(out, /@google\/design\.md/);

  const bad = runCli(["list", "tools", "--kind", "nope"]);
  assert.equal(bad.status, 1);
  assert.match(combined(bad), /Unknown kind `nope`/);
});

test("list curated prints sources; --plugins switches inventory", () => {
  const sources = runCli(["list", "curated"]);
  assert.equal(sources.status, 0);
  assert.match(combined(sources), /superpowers|caveman/);

  const plugins = runCli(["list", "curated", "--plugins"]);
  assert.equal(plugins.status, 0);
  assert.match(combined(plugins), /sentry|github-review-workflows|NAME/);
});

test("setup pi rejects --catalog-only with --skip-cursor-bridge", () => {
  const result = runCli(["setup", "pi", "--catalog-only", "--skip-cursor-bridge"]);
  assert.equal(result.status, 1);
  assert.match(combined(result), /`--catalog-only` already skips the Cursor bridge/);
});

test("value flag --vault requires a value", () => {
  const result = runCli(["config", "memory-palace", "--vault"]);
  assert.equal(result.status, 1);
  assert.match(combined(result), /--vault requires a value/);
});

test("unexpected positional args are rejected", () => {
  const result = runCli(["models", "check", "extra"]);
  assert.equal(result.status, 1);
  assert.match(combined(result), /Unexpected arguments: extra/);
});

test("flag forwarding: install curated --dry-run reaches installer and stays dry", () => {
  const result = runCli(["install", "curated", "--dry-run"]);
  assert.equal(result.status, 0);
  const out = combined(result);
  assert.match(out, /npx --yes skills add/);
  assert.doesNotMatch(out, /Installing skill/i);
});

test("flag forwarding: setup opencode --dry-run does not claim apply", () => {
  const result = runCli(["setup", "opencode", "--dry-run"]);
  assert.equal(result.status, 0);
  const out = combined(result);
  assert.match(out, /Mode: dry-run/);
});

test("dry-run safety: setup pi --dry-run does not mutate repo files", () => {
  const trackedPaths = [
    "harnesses/catalog.lock.json",
    "harnesses/catalog.yaml",
    "harnesses/pi.json",
    "package.json",
  ].map((relative) => resolve(repoRoot, relative));

  const before = Object.fromEntries(
    trackedPaths.map((path) => {
      const stat = statSync(path);
      return [path, { mtimeMs: stat.mtimeMs, size: stat.size, hash: readFileSync(path) }];
    }),
  );

  const result = runCli(["setup", "pi", "--dry-run"]);
  assert.equal(result.status, 0);
  assert.match(combined(result), /Dry-run complete/);

  for (const path of trackedPaths) {
    const stat = statSync(path);
    assert.equal(stat.mtimeMs, before[path].mtimeMs, `${path} mtime changed during dry-run`);
    assert.equal(stat.size, before[path].size, `${path} size changed during dry-run`);
    assert.deepEqual(readFileSync(path), before[path].hash, `${path} content changed during dry-run`);
  }
});

test("child exit-code propagation: models check failure is not zeroed", () => {
  const result = runCli(["models", "check"], {
    env: { CATALOG_POLICY_PATH: "/tmp/agent-skills-missing-catalog-policy.yaml" },
  });
  assert.notEqual(result.status, 0);
  assert.equal(result.status, 1);
  assert.match(combined(result), /no such file or directory|ENOENT|missing-catalog-policy/i);
});

test("child success: models check via dispatcher exits 0", () => {
  const result = runCli(["models", "check"]);
  assert.equal(result.status, 0);
  assert.match(combined(result), /catalog check passed/);
});

test("config memory-palace --dry-run forwards --vault value", () => {
  const vaultDir = mkdtempSync(join(tmpdir(), "agent-skills-vault-"));
  try {
    writeFileSync(join(vaultDir, ".obsidian"), "");
    const result = runCli(["config", "memory-palace", "--dry-run", "--vault", vaultDir]);
    assert.equal(result.status, 0, combined(result));
    const out = combined(result);
    assert.match(out, new RegExp(vaultDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(out, /would save/);
    assert.match(out, /vaultPath=/);
  } finally {
    rmSync(vaultDir, { recursive: true, force: true });
  }
});

test("npx agent-skills --help works", () => {
  const result = spawnSync("npx", ["agent-skills", "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(result.status, 0);
  assert.match(combined(result), /agent-skills/);
});

test("shellQuote leaves safe tokens alone and quotes the rest", () => {
  assert.equal(shellQuote("safe_token-1"), "safe_token-1");
  assert.equal(shellQuote("has space"), "'has space'");
  assert.equal(shellQuote("it's"), "'it'\\''s'");
});

test("windowsQuote leaves safe tokens alone and double-quotes the rest", () => {
  assert.equal(windowsQuote("safe*token"), "safe*token");
  assert.equal(windowsQuote("has space"), '"has space"');
  assert.equal(windowsQuote('say "hi"'), '"say \\"hi\\""');
});

test("sequence fail-fast: install all --dry-run runs ordered installers", () => {
  const result = runCli(["install", "all", "--dry-run"]);
  assert.equal(result.status, 0);
  const out = combined(result);
  assert.match(out, /skills add/);
  assert.match(out, /AGENTS|agents|Global AGENTS|symlink|copy/i);
});
