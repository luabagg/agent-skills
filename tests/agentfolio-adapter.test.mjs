import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { handleRequest } from "../scripts/agentfolio-adapter.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const adapterPath = resolve(repoRoot, "scripts", "agentfolio-adapter.mjs");

function request(operation, harness, action, dryRun = false) {
  return {
    protocolVersion: 1,
    operation,
    dryRun,
    collection: { name: "personal-agent-skills", version: 1, root: repoRoot },
    harness: { id: harness, actions: action ? [action] : [] },
    action: action ? { index: 0, name: action.action, config: action } : null,
  };
}

test("plans collection-owned harness actions without executing setup", () => {
  let called = false;
  const run = () => { called = true; };
  const pi = handleRequest(request("plan", "pi", { action: "configure" }), { run });
  const cursor = handleRequest(request("plan", "cursor", { action: "add-agents" }), { run });
  const opencode = handleRequest(
    request("plan", "opencode", { action: "configure-plugins-and-agents" }),
    { run },
  );
  const curated = handleRequest(
    request("plan", "global", { action: "add-curated-skills" }),
    { run },
  );
  const instructions = handleRequest(
    request("plan", "global", { action: "add-instructions" }),
    { run },
  );

  assert.equal(called, false);
  assert.deepEqual(pi.command, ["agent-skills", "setup", "pi"]);
  assert.deepEqual(cursor.command, ["agent-skills", "setup", "cursor"]);
  assert.deepEqual(opencode.command, ["agent-skills", "setup", "opencode"]);
  assert.deepEqual(curated.command, ["agent-skills", "install", "curated"]);
  assert.deepEqual(instructions.command, ["agent-skills", "install", "agents"]);
});

test("apply propagates dry-run to existing setup implementation", () => {
  let invocation;
  const run = (command, args, options) => {
    invocation = { command, args, options };
    return { status: 0, stdout: "preview", stderr: "" };
  };
  const response = handleRequest(
    request("apply", "cursor", { action: "add-agents" }, true),
    { run },
  );

  assert.equal(response.ok, true);
  assert.equal(response.changed, false);
  assert.equal(invocation.command, process.execPath);
  assert.deepEqual(invocation.args.slice(-3), ["setup", "cursor", "--dry-run"]);
  assert.equal(invocation.options.cwd, repoRoot);
});

test("apply reports setup failures through protocol response", () => {
  const response = handleRequest(
    request("apply", "pi", { action: "configure" }),
    { run: () => ({ status: 2, stdout: "preview", stderr: "Refusing to overwrite unmanaged file: /tmp/AGENTS.md" }) },
  );
  assert.equal(response.ok, false);
  assert.equal(response.status, 2);
  assert.equal(response.stderr, "Refusing to overwrite unmanaged file: /tmp/AGENTS.md");
  assert.match(response.error, /Refusing to overwrite unmanaged file/);
});

test("successful real applies omit changed when the child cannot report it", () => {
  const response = handleRequest(
    request("apply", "cursor", { action: "add-agents" }),
    { run: () => ({ status: 0, stdout: "Cursor harness already matches selected entries.", stderr: "" }) },
  );
  assert.equal(response.ok, true);
  assert.equal(Object.hasOwn(response, "changed"), false);
});

test("doctor validates selected harness implementation", () => {
  const response = handleRequest(request("doctor", "opencode", null));
  assert.equal(response.ok, true);
  assert.ok(response.checks.some((check) => check.id === "setup-opencode" && check.ok));
});

test("doctor accepts the catalog-only Pi harness", () => {
  const response = handleRequest(request("doctor", "pi-catalog", null));
  assert.equal(response.ok, true);
  assert.ok(response.checks.some((check) => check.id === "setup-pi" && check.ok));
});

test("doctor reports unknown declared actions", () => {
  const current = request("doctor", "pi", null);
  current.harness.actions = [{ action: "unknown" }];
  const response = handleRequest(current);
  assert.equal(response.ok, true);
  assert.ok(response.checks.some((check) => check.id.includes("unknown") && !check.ok));
});

test("doctor validates declared action assets", () => {
  const current = request("doctor", "global", null);
  current.harness.actions = [{ action: "add-instructions", config: { source: "./missing-instructions.md" } }];
  const response = handleRequest(current);
  assert.equal(response.ok, true);
  assert.ok(response.checks.some((check) => check.id.includes("source") && !check.ok));
});

test("rejects unknown collection action", () => {
  const response = handleRequest(request("plan", "pi", { action: "unknown" }));
  assert.equal(response.ok, false);
  assert.match(response.error, /Unsupported action/);
});

test("plan forwards catalog-only args without executing setup", () => {
  let called = false;
  const response = handleRequest(
    request("plan", "pi", { action: "configure", args: ["--catalog-only"] }),
    { run: () => { called = true; } },
  );
  assert.equal(called, false);
  assert.deepEqual(response.command, ["agent-skills", "setup", "pi", "--catalog-only"]);
});

test("process entrypoint implements JSON stdin stdout protocol", () => {
  const result = spawnSync(process.execPath, [adapterPath], {
    cwd: repoRoot,
    encoding: "utf8",
    input: JSON.stringify(request("plan", "cursor", { action: "add-agents" })),
  });
  assert.equal(result.status, 0, result.stderr);
  const response = JSON.parse(result.stdout);
  assert.equal(response.ok, true);
  assert.deepEqual(response.command, ["agent-skills", "setup", "cursor"]);
});
