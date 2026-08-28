#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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
  assert.match(out, /codegraph/);
});

test("list tools --json returns array payload", () => {
  const result = runCli(["list", "tools", "--json"]);
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.ok(Array.isArray(payload));
  assert.ok(payload.some((tool) => tool.name === "codegraph"));
});

test("list tools --kind filters and rejects unknown kinds", () => {
  const ok = runCli(["list", "tools", "--kind", "cli"]);
  assert.equal(ok.status, 0);
  const out = combined(ok);
  assert.match(out, /codegraph/);
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
  const home = mkdtempSync(join(tmpdir(), "agent-skills-install-all-"));
  try {
    const result = runCli(["install", "all", "--dry-run"], { env: { HOME: home } });
    assert.equal(result.status, 0);
    const out = combined(result);
    assert.match(out, /skills add/);
    assert.match(out, /AGENTS|agents|Global AGENTS|symlink|copy/i);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("verify stays isolated from the live home directory", () => {
  const result = runCli(["verify"]);
  const out = combined(result);
  assert.equal(result.status, 0, out);
  assert.match(out, /catalog check passed/);
  assert.match(out, /agent-skills-verify-/);
  assert.doesNotMatch(out, /Refusing to overwrite unmanaged file/);
});

test("install agents --dry-run reports unmanaged files without a stack", () => {
  const home = mkdtempSync(join(tmpdir(), "agent-skills-unmanaged-"));
  const unmanaged = join(home, ".codex", "AGENTS.md");
  mkdirSync(join(home, ".codex"), { recursive: true });
  writeFileSync(unmanaged, "# unmanaged local instructions\n");
  try {
    const result = runCli(["install", "agents", "--dry-run"], { env: { HOME: home } });
    assert.equal(result.status, 1);
    const out = combined(result);
    assert.match(out, /Refusing to overwrite unmanaged file/);
    assert.doesNotMatch(out, /at installManagedFile/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("install agents refuses a symlink it does not own", () => {
  const home = mkdtempSync(join(tmpdir(), "agent-skills-unmanaged-link-"));
  const local = join(home, "local-agents.md");
  const target = join(home, ".codex", "AGENTS.md");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(local, "# local instructions\n");
  symlinkSync(local, target);
  try {
    const result = runCli(["install", "agents", "--dry-run"], { env: { HOME: home } });
    assert.equal(result.status, 1);
    assert.match(combined(result), /Refusing to overwrite unmanaged file/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("install agents refuses an unmanaged Copilot wrapper", () => {
  const home = mkdtempSync(join(tmpdir(), "agent-skills-copilot-wrapper-"));
  const target = join(home, ".copilot", "instructions", "global-agent.instructions.md");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, "# personal Copilot instructions\n");
  try {
    const result = runCli(["install", "agents", "--dry-run"], { env: { HOME: home } });
    assert.equal(result.status, 1);
    assert.match(combined(result), /Refusing to overwrite unmanaged file/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("install agents preserves valid trailing-comma OpenCode JSONC", () => {
  const home = mkdtempSync(join(tmpdir(), "agent-skills-jsonc-"));
  const configDir = join(home, ".config", "opencode");
  const configPath = join(configDir, "opencode.jsonc");
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, "{\n  // keep this comment\n  \"plugin\": [],\n}\n");
  try {
    const result = runCli(["install", "agents", "--copy"], { env: { HOME: home } });
    assert.equal(result.status, 0, combined(result));
    const content = readFileSync(configPath, "utf8");
    assert.doesNotMatch(content, /,,/);
    assert.match(content, /keep this comment/);
    assert.match(content, /\"instructions\"/);
    assert.ok(readdirSync(configDir).some((name) => name.startsWith("opencode.jsonc.bak-")));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("setup cursor refuses to replace an unmanaged agent", () => {
  const home = mkdtempSync(join(tmpdir(), "agent-skills-cursor-agent-"));
  const target = join(home, ".cursor", "agents", "coder.md");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, "# personal Cursor agent\n");
  try {
    const result = runCli(["setup", "cursor", "--dry-run"], { env: { HOME: home } });
    assert.equal(result.status, 1);
    assert.match(combined(result), /Refusing to overwrite unmanaged file/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("setup cursor copy mode refuses an unmanaged symlink with a managed-looking target", () => {
  const home = mkdtempSync(join(tmpdir(), "agent-skills-cursor-link-"));
  const local = join(home, "local-cursor-agent.md");
  const target = join(home, ".cursor", "agents", "coder.md");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(local, "<!-- managed-by: agent-skills -->\n# personal Cursor agent\n");
  symlinkSync(local, target);
  try {
    const result = runCli(["setup", "cursor", "--copy", "--dry-run"], { env: { HOME: home } });
    assert.equal(result.status, 1);
    assert.match(combined(result), /Refusing to overwrite unmanaged symlink/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("setup opencode refuses to replace an unmanaged agent", () => {
  const home = mkdtempSync(join(tmpdir(), "agent-skills-opencode-agent-"));
  const target = join(home, ".config", "opencode", "agent", "brainstorming.md");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, "# personal OpenCode agent\n");
  try {
    const result = runCli(["setup", "opencode", "--dry-run"], { env: { HOME: home } });
    assert.equal(result.status, 1);
    assert.match(combined(result), /Refusing to overwrite unmanaged file/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("setup opencode preserves JSONC comments when adding plugins", () => {
  const home = mkdtempSync(join(tmpdir(), "agent-skills-opencode-jsonc-"));
  const configDir = join(home, ".config", "opencode");
  const configPath = join(configDir, "opencode.jsonc");
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, "{\n  // preserve this plugin note\n  \"plugin\": [\"existing-plugin\"],\n}\n");
  try {
    const result = runCli(["setup", "opencode", "--enable-recommended"], { env: { HOME: home } });
    assert.equal(result.status, 0, combined(result));
    const content = readFileSync(configPath, "utf8");
    assert.match(content, /preserve this plugin note/);
    assert.match(content, /existing-plugin/);
    assert.match(content, /opencode-mission-control/);
    assert.ok(readdirSync(configDir).some((name) => name.startsWith("opencode.jsonc.bak-")));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("setup opencode refuses an unmanaged symlink with a managed-looking target", () => {
  const home = mkdtempSync(join(tmpdir(), "agent-skills-opencode-link-"));
  const local = join(home, "local-opencode-agent.md");
  const target = join(home, ".config", "opencode", "agent", "brainstorming.md");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(local, "<!-- managed-by: agent-skills -->\n# personal OpenCode agent\n");
  symlinkSync(local, target);
  try {
    const result = runCli(["setup", "opencode", "--dry-run"], { env: { HOME: home } });
    assert.equal(result.status, 1);
    assert.match(combined(result), /Refusing to overwrite unmanaged symlink/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("setup pi propagates package installer failures", () => {
  const home = mkdtempSync(join(tmpdir(), "agent-skills-pi-failure-"));
  const bin = join(home, "bin");
  const fakePi = join(bin, "pi");
  mkdirSync(bin, { recursive: true });
  writeFileSync(fakePi, "#!/bin/sh\nexit 23\n", { mode: 0o755 });
  try {
    const result = runCli(["setup", "pi", "--skip-cursor-bridge"], {
      env: { HOME: home, PATH: `${bin}:${process.env.PATH}` },
    });
    assert.notEqual(result.status, 0);
    assert.match(combined(result), /failed|status 23|Command failed/i);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
