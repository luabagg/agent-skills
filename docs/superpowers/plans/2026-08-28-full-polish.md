# Full Polish Implementation Plan

> **Required sub-skill:** `writing-plans` (required for this plan; implementation agents must read and follow it before changing code).

## Goal

Replace unsafe manifest shell strings with strict executable/argument vectors, centralize CLI and Agentfolio dispatch, separate planning/validation/mutation/process execution, and add credential, rollback, localhost-bridge, CI, and onboarding safeguards without changing collection ownership or adding compatibility work.

## Architecture

`collection.yaml` declares profiles and action IDs. `harnesses/pi.json`, `harnesses/cursor.json`, and `harnesses/opencode.json` declare collection data, never shell commands. `scripts/lib/actions.mjs` is the one action registry consumed by `scripts/cli.mjs` and `scripts/agentfolio-adapter.mjs`. `scripts/lib/manifest.mjs` validates collection-specific executable/subcommand vectors. `scripts/lib/plan.mjs` reads state and produces a delta; `scripts/lib/mutate.mjs` applies a delta through `scripts/lib/transaction.mjs`; `scripts/lib/process.mjs` runs only explicit executable/args with `shell: false`. A dry-run performs validation and planning only. A failed mutation or child process rolls back the transaction.

## Tech Stack

Node.js ESM built-ins (`node:child_process`, `node:fs`, `node:fs/promises`, `node:path`, `node:crypto`), existing `yaml` and `jsonc-parser` dependencies, and the Node built-in test runner. Existing entry points are `scripts/cli.mjs`, `scripts/agentfolio-adapter.mjs`, `scripts/setup-pi.mjs`, `scripts/setup-opencode.mjs`, `scripts/setup-cursor.mjs`, `scripts/install-agents.mjs`, and `scripts/catalog.mjs`.

## Spec

[`../specs/2026-08-28-full-polish-design.md`](../specs/2026-08-28-full-polish-design.md)

## Global Constraints

- Work only in `/home/luabagg/development/.worktrees/agent-skills-full-polish`.
- Modify implementation/config only in the implementation tasks below; this plan revision itself changes only this plan.
- Keep authored skills/instructions/Pi/Cursor/OpenCode/model policy in this collection. Agentfolio remains generic.
- No shell command strings, `shell: true`, `execSync` for manifest data, `eval`, migration, deprecation layer, release ceremony, telemetry, or new harness policy.
- Never persist API keys, tokens, credentials, environment values, or plausible secret examples in the repository, manifests, generated files, plans, logs, or adapter responses.
- Preserve unmanaged files and symlinks. Dry-run creates no files, backups, services, package installs, or child processes.
- Every task is independently reviewable. Run its exact tests before its exact conventional commit.

---

### Task 1: Lock strict vector and registry contracts with failing tests

**Create:** `tests/manifest-contract.test.mjs`; `tests/action-registry.test.mjs`.

**Modify:** none.

**Test paths:** `tests/manifest-contract.test.mjs`; `tests/action-registry.test.mjs`.

**Interfaces Consumes:** `collection.yaml` adapter and action declarations; `harnesses/pi.json` package entries; `harnesses/opencode.json` plugin entries; future exports from `scripts/lib/actions.mjs` and `scripts/lib/manifest.mjs`.

**Interfaces Produces:** failing contract assertions that define `executable: string`, `args: string[]`, no `command`/`install`/`installCommands`, and stable registry IDs.

- [ ] **Step 1: Create the manifest fixture loader and strict field assertions.** Read YAML with the existing `parse as parseYaml` import shape and JSON with `JSON.parse`; assert the current unsafe fields are rejected.

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { parse as parseYaml } from "yaml";

const root = resolve(import.meta.dirname, "..");
const collection = parseYaml(readFileSync(resolve(root, "collection.yaml"), "utf8"));
const pi = JSON.parse(readFileSync(resolve(root, "harnesses/pi.json"), "utf8"));
const opencode = JSON.parse(readFileSync(resolve(root, "harnesses/opencode.json"), "utf8"));

test("collection adapter has executable and args and no shell command", () => {
  const adapter = collection.adapters["agent-skills"];
  assert.equal(typeof adapter.executable, "string");
  assert.deepEqual(adapter.args, ["./scripts/agentfolio-adapter.mjs"]);
  assert.equal(Object.hasOwn(adapter, "command"), false);
});

test("Pi and OpenCode manifests contain no shell-string installer fields", () => {
  for (const pkg of pi.packages) assert.equal(Object.hasOwn(pkg, "install"), false, pkg.name);
  for (const plugin of opencode.plugins) {
    assert.equal(Object.hasOwn(plugin, "installCommands"), false, plugin.name);
  }
});
```

Run `node --test tests/manifest-contract.test.mjs`; **expected FAIL:** `adapter.executable` is `undefined` or the old `command` field is present.

- [ ] **Step 2: Create registry tests with exact required IDs and vector shape.** Use `assert.deepEqual` for the five IDs and reject an unknown ID.

```js
import assert from "node:assert/strict";
import test from "node:test";
import { resolveAction } from "../scripts/lib/actions.mjs";

test("registry exposes the five collection actions", () => {
  for (const id of [
    "global.add-curated-skills",
    "global.add-instructions",
    "pi.configure",
    "cursor.add-agents",
    "opencode.configure-plugins-and-agents",
  ]) {
    const action = resolveAction(id);
    assert.equal(typeof action.executable, "string", id);
    assert.ok(Array.isArray(action.args), id);
    assert.ok(action.args.every((arg) => typeof arg === "string" && arg.length > 0), id);
  }
});

test("registry rejects unknown action IDs", () => {
  assert.throws(() => resolveAction("pi.run-arbitrary-command"), /Unknown action/);
});
```

Run `node --test tests/action-registry.test.mjs`; **expected FAIL:** module `scripts/lib/actions.mjs` does not exist.

- [ ] **Step 3: Add injection fixtures and exact rejection assertions.** Test `;`, `&&`, `|`, newline, `$()`, backticks, empty strings, and `../` as individual values.

```js
import { validateVector } from "../scripts/lib/manifest.mjs";
for (const value of [";", "&&", "|", "\n", "$(id)", "`id`", "", "../escape"]) {
  assert.throws(() => validateVector("pi.packages[0].install", "pi", ["install", value]), /unsafe|empty|path/i);
}
```

Run `node --test tests/manifest-contract.test.mjs tests/action-registry.test.mjs`; **expected FAIL:** imports are not implemented.

- [ ] **Step 4: Commit only the failing contract tests.**

```bash
git add tests/manifest-contract.test.mjs tests/action-registry.test.mjs
git commit -m "test: define strict action and manifest contracts"
```

### Task 2: Implement the shared registry and explicit process runner

**Create:** `scripts/lib/actions.mjs`; `scripts/lib/process.mjs`.

**Modify:** `scripts/cli.mjs`; `scripts/agentfolio-adapter.mjs`; `scripts/lib/command.mjs`.

**Test paths:** `tests/action-registry.test.mjs`; `tests/agentfolio-adapter.test.mjs`; `tests/cli.test.mjs`.

**Interfaces Consumes:** command names currently in `COMMANDS` in `scripts/cli.mjs`; duplicated `ACTIONS` in `scripts/agentfolio-adapter.mjs`; `runCommand(command, options)` in `scripts/lib/command.mjs`.

**Interfaces Produces:** `ACTIONS`, `resolveAction(id, extraArgs)`, `runProcess({ executable, args, cwd, env, stdio })`; the same CLI and protocol-v1 output with one dispatch source.

- [ ] **Step 1: Add the registry with concrete base vectors and metadata.** Export an immutable object and resolve relative script paths from `root` without joining untrusted strings.

```js
export const ACTIONS = Object.freeze({
  "global.add-curated-skills": Object.freeze({ executable: "npx", args: ["--yes", "skills", "add", "."] }),
  "global.add-instructions": Object.freeze({ executable: process.execPath, args: ["scripts/install-agents.mjs"] }),
  "pi.configure": Object.freeze({ executable: process.execPath, args: ["scripts/setup-pi.mjs"] }),
  "cursor.add-agents": Object.freeze({ executable: process.execPath, args: ["scripts/setup-cursor.mjs"] }),
  "opencode.configure-plugins-and-agents": Object.freeze({ executable: process.execPath, args: ["scripts/setup-opencode.mjs"] }),
});

export function resolveAction(id, extraArgs = []) {
  const base = ACTIONS[id];
  if (!base) throw new Error(`Unknown action ${JSON.stringify(id)}`);
  if (!Array.isArray(extraArgs) || extraArgs.some((arg) => typeof arg !== "string" || arg.length === 0)) {
    throw new Error("Action args must be non-empty strings");
  }
  return { executable: base.executable, args: base.args.concat(extraArgs) };
}
```

Run `node --test tests/action-registry.test.mjs`; **expected PASS:** registry IDs and unknown-action assertions pass.

- [ ] **Step 2: Add a process runner that cannot invoke a shell.** Use `execFile` for asynchronous production execution and retain an injectable runner for tests.

```js
import { execFile } from "node:child_process";

export function runProcess({ executable, args, cwd, env, stdio = "inherit" }) {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { cwd, env, shell: false, stdio }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stdout, stderr }));
      else resolve({ status: 0, stdout, stderr });
    });
  });
}
```

Run `node --test tests/cli.test.mjs tests/agentfolio-adapter.test.mjs`; **expected PASS:** existing routing remains green and injected calls contain separate args.

- [ ] **Step 3: Route both callers through `resolveAction`.** Remove adapter-local `ACTIONS` and replace direct script/external mapping in CLI with IDs; preserve `request.action.config.args` as an array.

```js
const action = resolveAction("cursor.add-agents", []);
assert.deepEqual(action.args, ["scripts/setup-cursor.mjs"]);
```

Run `npm test`; **expected PASS:** all current CLI and adapter tests pass.

- [ ] **Step 4: Commit only the registry/process refactor.**

```bash
git add scripts/lib/actions.mjs scripts/lib/process.mjs scripts/cli.mjs scripts/agentfolio-adapter.mjs scripts/lib/command.mjs tests/action-registry.test.mjs tests/agentfolio-adapter.test.mjs tests/cli.test.mjs
git commit -m "refactor: centralize collection action execution"
```

### Task 3: Convert manifests and add collection-specific validators

**Create:** `scripts/lib/manifest.mjs`; `tests/manifest-validation.test.mjs`.

**Modify:** `collection.yaml`; `harnesses/pi.json`; `harnesses/opencode.json`; `harnesses/cursor.json`; `scripts/setup-pi.mjs`; `scripts/setup-opencode.mjs`; `scripts/setup-cursor.mjs`.

**Test paths:** `tests/manifest-contract.test.mjs`; `tests/manifest-validation.test.mjs`.

**Interfaces Consumes:** YAML collection adapter/action declarations; Pi package/provider/bridge objects; OpenCode plugin/agent objects; Cursor agent objects.

**Interfaces Produces:** `validateVector(field, collection, vector)`, `validateCollectionManifest(collection, value)`, and strict vector-only manifest data.

- [ ] **Step 1: Convert the three known unsafe shapes.** Set `collection.yaml` adapter to `executable: node` plus `args: [./scripts/agentfolio-adapter.mjs]`; change every Pi `install` to `{ executable: "pi", args: ["install", source] }`; change OpenCode manual installer data to `{ executable: "bunx", args: ["oh-my-openagent", "install"] }` with display-only semantics.

```yaml
adapters:
  agent-skills:
    executable: node
    args: [./scripts/agentfolio-adapter.mjs]
```

```json
{
  "name": "pi-web-access",
  "kind": "pi-package",
  "source": "npm:pi-web-access",
  "install": { "executable": "pi", "args": ["install", "npm:pi-web-access"] }
}
```

Run `node --test tests/manifest-contract.test.mjs`; **expected PASS:** no old shell fields remain and vectors have non-empty string args.

- [ ] **Step 2: Implement vector validation and path-root checks.** Reject shell metacharacters, absolute paths, traversal, unsupported executables, and unsupported subcommands with field-qualified errors.

```js
const SAFE = /^[A-Za-z0-9_./:@=*-]+$/;
const RULES = {
  global: { npx: new Set(["--yes", "skills", "add", "."]) },
  pi: { pi: new Set(["install", "--list-models"]) },
  opencode: { bunx: new Set(["oh-my-openagent", "install"]) },
};

export function validateVector(field, collection, vector) {
  if (!vector || typeof vector !== "object" || typeof vector.executable !== "string" || !Array.isArray(vector.args)) {
    throw new Error(`${field} must contain executable and args`);
  }
  if (!vector.args.length || vector.args.some((arg) => typeof arg !== "string" || !arg || !SAFE.test(arg))) {
    throw new Error(`${field} contains unsafe or empty argument`);
  }
  const allowed = RULES[collection]?.[vector.executable];
  if (!allowed || !allowed.has(vector.args[0])) throw new Error(`${field} has unsupported executable/subcommand`);
  if (vector.args.some((arg) => arg === ".." || arg.startsWith("../") || arg.includes("/../"))) {
    throw new Error(`${field} contains path traversal`);
  }
  return vector;
}
```

Run `node --test tests/manifest-validation.test.mjs`; **expected PASS:** valid Pi install and invalid `sh -c`, `pi shell`, and `../escape` cases produce the asserted errors.

- [ ] **Step 3: Add harness-specific assertions.** Assert Pi package source is the final install argument, source files stay under the relevant harness root, and OpenCode/Cursor agent names are unique.

```js
test("Pi package vectors use pi install", () => {
  const pi = JSON.parse(readFileSync(resolve(root, "harnesses/pi.json"), "utf8"));
  for (const pkg of pi.packages) {
    assert.equal(pkg.install.executable, "pi");
    assert.deepEqual(pkg.install.args.slice(0, 1), ["install"]);
    assert.equal(pkg.install.args.at(-1), pkg.source);
  }
});
```

Run `npm test`; **expected PASS:** all manifest, CLI, and adapter tests pass.

- [ ] **Step 4: Commit the manifest contract.**

```bash
git add collection.yaml harnesses/pi.json harnesses/opencode.json harnesses/cursor.json scripts/lib/manifest.mjs scripts/setup-pi.mjs scripts/setup-opencode.mjs scripts/setup-cursor.mjs tests/manifest-contract.test.mjs tests/manifest-validation.test.mjs
git commit -m "refactor: make collection manifests executable vectors"
```

### Task 4: Separate planning, validation, mutation, and process execution

**Create:** `scripts/lib/plan.mjs`; `scripts/lib/mutate.mjs`; `tests/planning.test.mjs`.

**Modify:** `scripts/agentfolio-adapter.mjs`; `scripts/cli.mjs`; `scripts/setup-pi.mjs`; `scripts/setup-opencode.mjs`; `scripts/setup-cursor.mjs`; `scripts/install-agents.mjs`; `scripts/catalog.mjs`.

**Test paths:** `tests/planning.test.mjs`; `tests/agentfolio-adapter.test.mjs`; `tests/cli.test.mjs`.

**Interfaces Consumes:** validated action vectors and current target readers in setup/install scripts.

**Interfaces Produces:** `validate(request)`, `plan(request)`, `applyPlan(plan, options)`, and a dry-run path with zero runner/mutation calls.

- [ ] **Step 1: Create the plan shape and pure planner.** Make `plan(request, { root, home, read })` return changes/processes without writing.

```js
export function plan(request, context) {
  const action = resolveAction(request.actionId, request.extraArgs ?? []);
  const changes = context.readDesiredChanges(request, action);
  return { ok: true, summary: request.summary, changes, processes: [], warnings: [] };
}
```

Run `node --test tests/planning.test.mjs`; **expected FAIL:** planner module is absent.

- [ ] **Step 2: Make adapter plan pure and apply two-phase.** Assert plan never invokes the injected runner; assert dry-run apply returns `changed: false` and invokes neither runner nor mutation.

```js
test("plan never runs child process", () => {
  let calls = 0;
  const response = handleRequest(request("plan", "cursor", { action: "add-agents" }), { run: () => { calls += 1; } });
  assert.equal(response.ok, true);
  assert.equal(calls, 0);
});
```

Run `node --test tests/agentfolio-adapter.test.mjs`; **expected PASS:** plan and dry-run purity assertions pass.

- [ ] **Step 3: Replace the remaining shell-string Pi execution.** Change `execSync(pkg.install)` at current `scripts/setup-pi.mjs:536-537` to `runProcess({ executable: pkg.install.executable, args: pkg.install.args, cwd: repoRoot, env: process.env })`; make catalog discovery `execFileSync("pi", ["--list-models", piProvider])` remain an explicit vector.

```js
await runProcess({ executable: pkg.install.executable, args: pkg.install.args, cwd: repoRoot, env: process.env });
```

Run `git grep -n 'execSync(pkg.install)' -- scripts`; **expected PASS:** exit status 1 and no matching lines. Run `npm test`; **expected PASS:** existing tests remain green.

- [ ] **Step 4: Commit the execution-boundary refactor.**

```bash
git add scripts/lib/plan.mjs scripts/lib/mutate.mjs scripts/agentfolio-adapter.mjs scripts/cli.mjs scripts/setup-pi.mjs scripts/setup-opencode.mjs scripts/setup-cursor.mjs scripts/install-agents.mjs scripts/catalog.mjs tests/planning.test.mjs tests/agentfolio-adapter.test.mjs tests/cli.test.mjs
git commit -m "refactor: separate planning from mutations"
```

### Task 5: Add atomic transactions, rollback, permissions, and bounded backups

**Create:** `scripts/lib/transaction.mjs`; `tests/transaction.test.mjs`.

**Modify:** `scripts/lib/mutate.mjs`; `scripts/setup-pi.mjs`; `scripts/setup-opencode.mjs`; `scripts/setup-cursor.mjs`; `scripts/install-agents.mjs`.

**Test paths:** `tests/transaction.test.mjs`.

**Interfaces Consumes:** planned `changes`; existing backup naming `${filePath}.bak-${timestamp}`; ownership-marker and symlink checks in setup/install scripts.

**Interfaces Produces:** `beginTransaction(targets)`, `atomicWrite(path, content, mode)`, `rollback(transaction)`, `pruneBackups(path, limit = 5)`.

- [ ] **Step 1: Implement transaction records and atomic writes.** Create temp files beside the target, write with mode `0o600`, rename atomically, and record original bytes/stat state.

```js
export async function atomicWrite(filePath, content, mode = 0o600) {
  const tempPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(tempPath, content, { encoding: "utf8", mode });
  await rename(tempPath, filePath);
  return filePath;
}
```

Run `node --test tests/transaction.test.mjs`; **expected FAIL:** transaction exports and tests do not exist.

- [ ] **Step 2: Add reverse rollback and unmanaged-target refusal.** Before mutation, use `lstat`; reject an existing unmanaged regular file or symlink, and restore changed targets in reverse order after injected failure.

```js
test("rollback restores earlier target after second write fails", async () => {
  const tx = await beginTransaction([first, second]);
  await atomicWrite(first, "new-first\n");
  await assert.rejects(() => applySecondAndRollback(tx), /injected failure/);
  assert.equal(readFileSync(first, "utf8"), "old-first\n");
});
```

Run `node --test tests/transaction.test.mjs`; **expected PASS:** rollback restores bytes and preserves unmanaged files.

- [ ] **Step 3: Enforce sensitive local modes and five-backup retention.** Set new config directories to `0o700`, files to `0o600`, and remove only oldest managed backups after successful replacement.

```js
test("backup retention keeps five managed backups", async () => {
  await createManagedBackups(target, 7);
  await pruneBackups(target, 5);
  assert.equal(listManagedBackups(target).length, 5);
});
```

Run `node --test tests/transaction.test.mjs`; **expected PASS:** mode and retention assertions pass.

- [ ] **Step 4: Commit transaction support.**

```bash
git add scripts/lib/transaction.mjs scripts/lib/mutate.mjs scripts/setup-pi.mjs scripts/setup-opencode.mjs scripts/setup-cursor.mjs scripts/install-agents.mjs tests/transaction.test.mjs
git commit -m "feat: add transactional rollback for local setup"
```

### Task 6: Enforce credential-first auth and redacted diagnostics

**Create:** `scripts/lib/secrets.mjs`; `tests/secrets.test.mjs`.

**Modify:** `harnesses/pi/xai.ts`; `harnesses/pi/claude.ts`; `scripts/setup-pi.mjs`; `scripts/agentfolio-adapter.mjs`; `.gitignore`.

**Test paths:** `tests/secrets.test.mjs`; `tests/agentfolio-adapter.test.mjs`.

**Interfaces Consumes:** Pi provider login/keychain behavior; `XAI_API_KEY`; Claude CLI bridge; adapter `stdout`, `stderr`, and `error` response fields.

**Interfaces Produces:** `redact(text, env)`, `assertNoTrackedSecrets(paths)`, and diagnostics with secret values removed.

- [ ] **Step 1: Implement deterministic redaction.** Replace values of known environment variables and bearer/basic/token/key patterns before logs or protocol responses.

```js
const SECRET_NAMES = ["XAI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "CURSOR_API_KEY"];
export function redact(text, env = process.env) {
  let output = String(text ?? "");
  for (const name of SECRET_NAMES) if (env[name]) output = output.replaceAll(env[name], `[redacted:${name}]`);
  return output.replace(/(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted]");
}
```

Run `node --test tests/secrets.test.mjs`; **expected FAIL:** module is absent.

- [ ] **Step 2: Assert keychain-first and env fallback without persistence.** Test provider auth selection with a fake keychain result, then fake env fallback; assert neither value occurs in serialized plan, error, or file contents.

```js
test("keychain wins over environment fallback", async () => {
  const auth = await resolveAuth({ keychain: async () => "keychain-value", env: { XAI_API_KEY: "env-value" } });
  assert.equal(auth.source, "keychain");
  assert.doesNotMatch(JSON.stringify(auth), /keychain-value|env-value/);
});
```

Run `node --test tests/secrets.test.mjs`; **expected PASS:** keychain-first and fallback assertions pass.

- [ ] **Step 3: Add ignore rules and scan assertions.** Ignore `.env`, `.env.*`, local credentials, runtime state, and managed backup suffixes; scan tracked paths and fail on real key-shaped values while allowing `YOUR_API_KEY`.

```gitignore
.env
.env.*
!.env.example
*.bak-*
.cursor-auth/
.pi-auth/
```

Run `node --test tests/secrets.test.mjs tests/agentfolio-adapter.test.mjs`; **expected PASS:** redaction and tracked-secret tests pass.

- [ ] **Step 4: Commit credential safeguards.**

```bash
git add scripts/lib/secrets.mjs tests/secrets.test.mjs harnesses/pi/xai.ts harnesses/pi/claude.ts scripts/setup-pi.mjs scripts/agentfolio-adapter.mjs .gitignore
git commit -m "feat: enforce credential-safe setup diagnostics"
```

### Task 7: Harden the localhost Cursor bridge

**Create:** `tests/bridge-safety.test.mjs`.

**Modify:** `harnesses/pi.json`; bridge templates under `harnesses/pi/`; `scripts/setup-pi.mjs`.

**Test paths:** `tests/bridge-safety.test.mjs`; `tests/transaction.test.mjs`.

**Interfaces Consumes:** `cursorBridge.controlUrl`, `cursorBridge.providerUrl`, `PI_CURSOR_WORKSPACE`, `serviceTemplate`, and `refreshScript` values in `scripts/setup-pi.mjs`.

**Interfaces Produces:** `validateBridgeConfig(value)` accepting only fixed loopback HTTP endpoints and safe local substitutions.

- [ ] **Step 1: Add URL validation tests.** Accept `http://127.0.0.1:32125` and `http://127.0.0.1:32124/v1`; reject `0.0.0.0`, `localhost`, public addresses, HTTPS, and changed ports.

```js
test("bridge accepts only fixed loopback endpoints", () => {
  assert.doesNotThrow(() => validateBridgeConfig({ controlUrl: "http://127.0.0.1:32125", providerUrl: "http://127.0.0.1:32124/v1" }));
  for (const controlUrl of ["http://0.0.0.0:32125", "http://localhost:32125", "https://127.0.0.1:32125", "http://127.0.0.2:32125"]) {
    assert.throws(() => validateBridgeConfig({ controlUrl, providerUrl: "http://127.0.0.1:32124/v1" }), /loopback|localhost|port|http/i);
  }
});
```

Run `node --test tests/bridge-safety.test.mjs`; **expected FAIL:** validator export is absent.

- [ ] **Step 2: Validate workspace and template substitutions without shell expansion.** Use `resolve` plus an allowed local root, preserve `PI_CURSOR_WORKSPACE` as a value, and assert generated service content contains no `$()` or backticks.

```js
test("workspace substitution cannot inject shell syntax", () => {
  assert.throws(() => validateWorkspace("/tmp/$(touch-pwned)"), /workspace|unsafe/i);
  assert.doesNotMatch(renderService({ workspace: "/home/user/project" }), /\$\(|`/);
});
```

Run `node --test tests/bridge-safety.test.mjs`; **expected PASS:** safety assertions pass.

- [ ] **Step 3: Preserve auth isolation and permissions.** Ensure setup creates only an auth-directory symlink to the native Cursor config, never copies credentials, and applies owner-only permissions to bridge config/service files.

```js
test("bridge plan does not include Cursor credential bytes", () => {
  const plan = planBridge({ cursorAuthDir: "/home/user/.config/cursor" });
  assert.doesNotMatch(JSON.stringify(plan), /accessToken|refreshToken|apiKey/i);
});
```

Run `node --test tests/bridge-safety.test.mjs tests/transaction.test.mjs`; **expected PASS:** bridge and transaction tests pass.

- [ ] **Step 4: Commit bridge safety.**

```bash
git add harnesses/pi.json harnesses/pi/*.template scripts/setup-pi.mjs tests/bridge-safety.test.mjs tests/transaction.test.mjs
git commit -m "fix: constrain local Cursor bridge boundaries"
```

### Task 8: Clean metadata and publish one canonical onboarding path

**Create:** none.

**Modify:** `package.json`; `README.md`; `docs/model-catalog.md`; `docs/cli-dispatcher-plan.md`; `skills/agentfolio-operator/SKILL.md`; stale duplicated docs identified by `git grep` and `git log`.

**Test paths:** `tests/docs-contract.test.mjs`.

**Interfaces Consumes:** `package.json#bin.agent-skills`; current README commands; Agentfolio commands in `collection.yaml`; model catalog commands in `scripts/catalog.mjs`.

**Interfaces Produces:** supported `engines.node`, repository metadata, one exact two-repository onboarding flow, and docs with no obsolete shell-string guidance.

- [ ] **Step 1: Add documentation contract assertions against exact onboarding commands.**

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("README contains canonical onboarding commands", () => {
  const readme = readFileSync("README.md", "utf8");
  for (const command of [
    "npm ci",
    "agentfolio doctor --collection .",
    "agentfolio plan --profile pi --collection .",
    "agentfolio apply --profile pi --dry-run --collection .",
  ]) assert.match(readme, new RegExp(command.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  assert.match(readme, /keychain|native login/i);
});
```

Run `node --test tests/docs-contract.test.mjs`; **expected FAIL:** new test file does not exist.

- [ ] **Step 2: Set metadata and document ownership/auth/rollback.** Add `engines.node`, repository/homepage/bugs fields, and document that `npm ci` installs this collection while Agentfolio is installed from its canonical repository; document dry-run, rollback, redaction, and bridge localhost assumptions.

```json
"engines": { "node": ">=20.19.0" },
"repository": { "type": "git", "url": "https://github.com/luabagg/agent-skills.git" },
"bugs": { "url": "https://github.com/luabagg/agent-skills/issues" }
```

Run `node --test tests/docs-contract.test.mjs`; **expected PASS:** metadata and onboarding assertions pass.

- [ ] **Step 3: Prove stale documentation references before removal.** Run `git grep -nE 'installCommands|command: \\[|execSync\\([^)]*install' -- ':!docs/superpowers'`, `git log --all --oneline -- docs/cli-dispatcher-plan.md`, and `git log --all --oneline -- docs/model-catalog.md`; delete only those named documentation paths if each has zero live references, and document no compatibility alias.

Run `npm test`; **expected PASS:** all tests pass and the stale-string grep exits 1.

- [ ] **Step 4: Commit docs and metadata only.**

```bash
git add package.json README.md docs/model-catalog.md docs/cli-dispatcher-plan.md skills/agentfolio-operator/SKILL.md tests/docs-contract.test.mjs
git commit -m "docs: document full-polish ownership and onboarding"
```

### Task 9: Add CI and non-mutating cross-repository gates

**Create:** `.github/workflows/ci.yml`; `tests/cross-repo-smoke.test.mjs`.

**Modify:** `package.json`; `package-lock.json` only when `npm install --package-lock-only` changes dependency metadata.

**Test paths:** `tests/cross-repo-smoke.test.mjs`; CI workflow.

**Interfaces Consumes:** package scripts `test`, `test:cli`; `scripts/catalog.mjs check`; Agentfolio `doctor`, `plan`, and dry-run `apply`; temporary HOME behavior in `scripts/cli.mjs`.

**Interfaces Produces:** matrix CI for supported/current Node, secret scan, catalog check, and a smoke test that proves no local mutation.

- [ ] **Step 1: Add the exact CI workflow.** Run `npm ci`, `npm test`, `node scripts/catalog.mjs check`, `git diff --check`, secret scan, and the smoke test on Node 20 and Node 22.

```yaml
name: CI
on: [push, pull_request]
jobs:
  verify:
    strategy:
      matrix: { node: [20, 22] }
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }}, cache: npm }
      - run: npm ci
      - run: npm test
      - run: node scripts/catalog.mjs check
      - run: git diff --check
      - run: npm run secret-scan
      - run: node --test tests/cross-repo-smoke.test.mjs
```

Run `node --test tests/cross-repo-smoke.test.mjs`; **expected FAIL:** smoke test and script are absent.

- [ ] **Step 2: Add a non-mutating smoke test with isolated HOME.** Spawn Agentfolio against the collection root and assert doctor/plan/dry-run status zero plus unchanged repository status.

```js
const commands = [
  ["doctor", "--collection", root],
  ["plan", "--profile", "pi", "--collection", root],
  ["apply", "--profile", "pi", "--dry-run", "--collection", root],
];
for (const args of commands) {
  const result = spawnSync("agentfolio", args, { cwd: root, env: Object.assign({}, process.env, { HOME: tempHome }), encoding: "utf8" });
  assert.equal(result.status, 0, `${args.join(" ")}\\n${result.stderr}`);
}
assert.equal(spawnSync("git", ["diff", "--exit-code"], { cwd: root }).status, 0);
```

Run `node --test tests/cross-repo-smoke.test.mjs`; **expected PASS:** all three commands return zero and `git diff --exit-code` returns zero.

- [ ] **Step 3: Add `secret-scan` as a deterministic repository-only check.** The script must reject credential-shaped strings while allowing `YOUR_API_KEY`, and must inspect tracked files only.

```json
"secret-scan": "node scripts/secret-scan.mjs"
```

Run `npm run secret-scan`; **expected PASS:** tracked collection files contain no detected secrets. Run `npm test`; **expected PASS:** full suite passes.

- [ ] **Step 4: Commit CI and smoke gates.**

```bash
git add .github/workflows/ci.yml tests/cross-repo-smoke.test.mjs package.json package-lock.json scripts/secret-scan.mjs
npm test
git commit -m "ci: gate full-polish safety checks"
```

### Task 10: Run final self-review and produce acceptance evidence

**Create:** none.

**Modify:** only corrections found by the checks; no implementation/config changes are permitted for this documentation-only execution.

**Test paths:** all files changed by Tasks 1-9; current plan path `docs/superpowers/plans/2026-08-28-full-polish.md`.

**Interfaces Consumes:** all task contracts; Git history and working-tree state.

**Interfaces Produces:** clean working tree, passing safety gates, and a review record with changed files and residual risks.

- [ ] **Step 1: Run the complete exact validation set.**

```bash
npm test
node scripts/catalog.mjs check
git diff --check
npm run secret-scan
node --test tests/cross-repo-smoke.test.mjs
git status --short
```

Expected: each test/check exits `0`; `git status --short` is empty.

- [ ] **Step 2: Inspect the final scope and history.**

```bash
git diff --stat main HEAD
git diff --name-only main HEAD
git log --oneline --max-count=10
```

Expected: only intended collection implementation, tests, CI, and docs paths appear; no credentials, backups, or unrelated files appear.

- [ ] **Step 3: Run the plan self-check with exact metrics.** Count headings, checkboxes, code fences, placeholder tokens, and header fields; fail if any expected value is missing.

```bash
plan=docs/superpowers/plans/2026-08-28-full-polish.md
printf 'tasks='; grep -Ec '^### Task [0-9]+:' "$plan"
printf 'checkboxes='; grep -Ec '^- \[ \] \*\*Step [0-9]+:' "$plan"
printf 'code_fences='; grep -Ec '^```' "$plan"
printf 'placeholders='; (grep -Eio 'TODO|TBD|FIXME|PLACEHOLDER' "$plan" || true) | wc -l
printf 'header='; test "$(head -31 "$plan" | grep -Ec '^(# Full Polish|> \\*\\*Required sub-skill|## Goal|## Architecture|## Tech Stack|## Spec|## Global Constraints|---)')" -eq 8 && echo yes || echo no
head -31 "$plan"
```

Expected: `tasks=10`, `checkboxes=40`, `header=yes`, an even positive `code_fences` count, `placeholders=0`, and the first sections are title, required sub-skill note, Goal, Architecture, Tech Stack, Spec, Global Constraints, separator.

- [ ] **Step 4: Commit only any final correction and verify no staged files.**

```bash
git diff --check
git status --short
git diff --cached --exit-code
```

Expected: all commands exit `0`, with empty status and no staged diff. If this plan requires a correction, use `git add docs/superpowers/plans/2026-08-28-full-polish.md && git commit -m "docs: tighten full-polish implementation plan"`, then rerun every command in this step.
