# Full Polish Design

- **Status:** authoritative design
- **Date:** 2026-08-28
- **Scope:** this public personal collection repository and its Agentfolio adapter

## Goals and ownership

`personal-agent-skills` remains the source of truth for authored skills, global instructions, Pi, Cursor, OpenCode, and model policy. Agentfolio remains a generic caller: it discovers collection metadata and invokes the collection adapter; it does not acquire credentials, interpret harness manifests, or own setup policy. Clean breaks are intentional: there are no supported users or migrations.

The collection owns `collection.yaml`, `harnesses/{pi,cursor,opencode}.json`, `harnesses/catalog.yaml`, the generated lock/provider artifacts, `scripts/cli.mjs`, setup scripts, and tests. `curated-skills.json` and `curated-tools.json` remain inventories, not implicit installers.

## Architecture and data flow

1. The CLI parses a declarative command tree and produces an action request.
2. A single immutable action registry maps each public CLI/Agentfolio action to an executable plus argument vector, collection-specific validator, planner, mutator, and process runner.
3. Planning loads and validates repository inputs, resolves selected entries, computes filesystem/config deltas, and returns a redacted plan. It never writes, installs, starts, or authenticates.
4. Validation rejects malformed manifests, unsupported executable/subcommand combinations, unsafe paths, duplicate action IDs, unknown flags, and invalid catalog references before mutation.
5. Mutation applies the already validated delta in deterministic order, using ownership markers/safe symlink checks and atomic writes.
6. Process execution is a separate boundary. All child processes use `execFile`/`execFileSync` (or `spawn`/`spawnSync` with `shell: false`) and explicit `executable, args`; no manifest shell strings are interpreted.
7. Agentfolio `plan` calls the planner only. `apply` calls the same planner, then mutation/process execution; `--dry-run` stops before mutation and process execution. Adapter JSON includes `ok`, `summary`, `changed`, `command` (executable and args), and redacted diagnostics.

Suggested interfaces (module names are implementation targets, not new public products):

```js
const ACTIONS = Object.freeze({
  "global.add-curated-skills": { executable: "npx", args: ["--yes", "skills", "add", "..."], collection: "global" },
  "global.add-instructions": { executable: process.execPath, args: ["scripts/install-agents.mjs"], collection: "global" },
  "pi.configure": { executable: process.execPath, args: ["scripts/setup-pi.mjs"], collection: "pi" },
  "cursor.add-agents": { executable: process.execPath, args: ["scripts/setup-cursor.mjs"], collection: "cursor" },
  "opencode.configure-plugins-and-agents": { executable: process.execPath, args: ["scripts/setup-opencode.mjs"], collection: "opencode" },
});

plan(request) -> { ok, summary, changes, processes, warnings }
validate(request, collection) -> { ok, errors, warnings }
apply(plan, { dryRun }) -> { ok, changed, rollback }
runProcess({ executable, args, cwd, env }) -> { status, stdout, stderr }
```

The registry is the only dispatch table. `collection.yaml` references actions by stable IDs and carries data (profiles, summaries, source/catalog paths), not executable command text. Agentfolio adapter requests remain protocol version 1 and are translated to registry IDs after validating harness/action ownership.

## Manifest contract and validation

Replace `collection.yaml` adapter `command: [node, ...]` with strict fields: `executable` (a known executable ID such as `node` or `npx`) and `args` (non-empty strings, no shell operators or interpolation). Action declarations contain `action`, summary, and data paths. Manual installer entries must not contain `installCommands` shell strings; represent them as an executable and args vector, or mark them display-only and never execute them.

Validation is collection-specific:

- **global:** only the curated installer and instruction installer IDs; source paths must remain inside the collection and inventories must have expected arrays.
- **Pi:** `harness === "pi"`; package install is an executable/subcommand tuple (`pi install`, with package source as one argument); only approved Pi subcommands (`install`, `--list-models`) are accepted; local extension/provider source files must exist and resolve within `harnesses/pi`; bridge commands are allowlisted (`npm install --global`, `open-cursor install`, `systemctl --user ...`) with fixed flags; bridge URLs must be localhost.
- **Cursor:** `harness === "cursor"`; only agent source files under `harnesses/cursor/agents` and user-scope target names are accepted.
- **OpenCode:** `harness === "opencode"`; agent templates stay under `harnesses/opencode/agents`; plugin entries are data. Manual commands are validated vectors and remain opt-in/display-only unless explicitly supported by the registry.
- **catalog:** selectors, providers, roles, lock entries, generated targets, and model IDs must agree; discovery is an explicit `pi --list-models <provider>` vector.

Reject absolute paths, `..` escapes, empty args, shell metacharacters in executable/args, unapproved binaries/subcommands, duplicate names, and unknown manifest keys where strictness is needed. Error responses identify collection, action, field, and remediation without echoing secrets.

## Credentials and sensitive data

Authentication is harness/keychain-first: Pi providers use their native login/keychain (including `claude login`, Cursor `cursor-agent login`, and provider-native login). Environment API keys are a documented fallback only (`XAI_API_KEY` and equivalent provider variables), read by the child process but never copied into manifests, generated artifacts, plans, logs, snapshots, or repository files. Do not add token files or credential exports.

The repository ignores local env/secrets (`.env*`, local credential/config files, generated runtime state), and tracked examples contain placeholders only (for example `YOUR_API_KEY`, never a plausible token). Secret scanning rejects key-like material and credential-shaped URLs. Local sensitive configuration and backups are created with owner-only permissions (`0700` directories, `0600` files); permissions are verified after writes where supported. Diagnostics redact values matching known credential environment names, bearer/basic authorization, and token/key patterns before display or adapter response.

## Transaction, rollback, and safety

Every mutating operation first captures a per-run transaction manifest and bounded backups of files it will replace. Writes use temp files in the destination directory, restrictive mode, flush/close, then atomic rename. Existing unmanaged files and symlinks are never overwritten. On any failed mutation or child process, restore the transaction manifest in reverse order and report rollback status. Keep at most five backups per target, deleting oldest backups only after a successful committed replacement; never delete an unmanaged file.

Dry-run uses the same planning and validation paths but performs no writes, installs, service changes, process execution, or backup creation. Bridge setup must bind only to `127.0.0.1`; reject non-loopback control/provider URLs and workspace/config paths outside approved local locations. Do not copy Cursor credentials into the collection or bridge config.

## Tests, CI, and integration

Add Node test-runner coverage for:

- registry completeness and collection-specific executable/subcommand rejection;
- argument injection (shell operators, empty/extra args, path traversal) and `shell: false`/exec-file invocation;
- plan purity and dry-run non-mutation;
- secret redaction in stdout/stderr/errors/plans and no credential material in repository/manifests/generated files;
- keychain-first auth plus environment-key fallback without persistence;
- atomic mutation, owner-only permissions, unmanaged-file refusal, rollback after each failure point, and five-backup retention;
- localhost bridge acceptance and public/non-loopback rejection;
- Agentfolio protocol plan/apply/doctor behavior through the shared registry.

CI must run on the supported and current Node versions declared by `package.json#engines`, then `npm ci`, unit/integration tests, catalog check, secret scan, and non-mutating cross-repo smoke tests (`agentfolio doctor`, `agentfolio plan`, and dry-run apply in a temporary HOME). CI must fail on staged/generated credential files and on repository mutations during smoke tests.

## Documentation and onboarding

README and `docs/model-catalog.md` document the CLI-first flow, ownership boundaries, auth-first policy, dry-run/rollback behavior, localhost bridge threat model, and exact two-repository onboarding: clone this collection, install dependencies, install/verify Agentfolio from its canonical repository, then run `agentfolio doctor --collection .`, `agentfolio plan --profile ... --collection .`, and dry-run apply before apply. Keep one canonical onboarding path and remove conflicting/stale duplicated setup instructions.

Clean up package metadata: set the intentional package visibility, supported `engines`, repository/homepage/bugs metadata, and a coherent version. Remove obsolete compatibility surfaces and stale duplicated docs only when repository history/search proves they are no longer referenced. Do not broaden Agentfolio; do not add migrations, deprecation notices, release ceremony, new harnesses, telemetry, or speculative plugin orchestration.

## Exclusions

No implementation, config migration, credential migration, backward-compatibility shim, release workflow, user database, remote service, non-local bridge binding, automatic third-party installer execution, or new model/harness policy is part of this design. Agentfolio stays generic and collection-owned policy stays here.
