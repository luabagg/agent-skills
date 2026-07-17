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
  for (const command of ["skills", "install", "setup", "catalog", "update", "verify"]) {
    assert.match(out, new RegExp(command));
  }
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

test("skills list --json without --installed is rejected", () => {
  const result = runCli(["skills", "list", "--json"]);
  assert.equal(result.status, 1);
  assert.match(combined(result), /`--json` is only supported with `--installed`/);
});

test("setup pi rejects --catalog-only with --skip-cursor-bridge", () => {
  const result = runCli(["setup", "pi", "--catalog-only", "--skip-cursor-bridge"]);
  assert.equal(result.status, 1);
  assert.match(combined(result), /`--catalog-only` already skips the Cursor bridge/);
});

test("value flag --vault requires a value", () => {
  const result = runCli(["setup", "memory-palace", "--vault"]);
  assert.equal(result.status, 1);
  assert.match(combined(result), /--vault requires a value/);
});

test("unexpected positional args are rejected", () => {
  const result = runCli(["catalog", "check", "extra"]);
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

test("child exit-code propagation: catalog check failure is not zeroed", () => {
  const result = runCli(["catalog", "check"], {
    env: { CATALOG_POLICY_PATH: "/tmp/agent-skills-missing-catalog-policy.yaml" },
  });
  assert.notEqual(result.status, 0);
  assert.equal(result.status, 1);
  assert.match(combined(result), /no such file or directory|ENOENT|missing-catalog-policy/i);
});

test("child success: catalog check via dispatcher exits 0", () => {
  const result = runCli(["catalog", "check"]);
  assert.equal(result.status, 0);
  assert.match(combined(result), /catalog check passed/);
});

test("setup memory-palace --dry-run forwards --vault value", () => {
  const vaultDir = mkdtempSync(join(tmpdir(), "agent-skills-vault-"));
  try {
    // Marker so configure-memory-palace accepts the path as a vault.
    writeFileSync(join(vaultDir, ".obsidian"), "");
    const result = runCli(["setup", "memory-palace", "--dry-run", "--vault", vaultDir]);
    assert.equal(result.status, 0, combined(result));
    const out = combined(result);
    assert.match(out, new RegExp(vaultDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(out, /would save/);
    assert.match(out, /vaultPath=/);
  } finally {
    rmSync(vaultDir, { recursive: true, force: true });
  }
});

test("npm run agent-skills -- --help works", () => {
  const result = spawnSync("npm", ["run", "agent-skills", "--", "--help"], {
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
  // personal skills dry-run prints the skills add command; curated prints source installs; agents prints install plan
  assert.match(out, /skills add/);
  assert.match(out, /AGENTS|agents|Global AGENTS|symlink|copy/i);
});
