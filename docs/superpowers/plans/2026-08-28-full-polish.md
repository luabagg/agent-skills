# Full Polish Implementation Plan

> **For implementation agents:** execute tasks in order. Keep each task independently reviewable, run its stated tests, and make the stated conventional commit before continuing.

**Spec:** [`../specs/2026-08-28-full-polish-design.md`](../specs/2026-08-28-full-polish-design.md)

## Global constraints

- Work only in `/home/luabagg/development/.worktrees/agent-skills-full-polish`.
- Collection ownership stays in `collection.yaml`, `harnesses/pi.json`, `harnesses/cursor.json`, `harnesses/opencode.json`, `harnesses/catalog.yaml`, `scripts/`, and `tests/`; Agentfolio remains generic.
- Planning/validation/mutation/process execution are separate. No shell command strings, `shell: true`, `eval`, credentials in tracked/generated output, migrations, compatibility shims, or new harness policy.
- Preserve unmanaged files and symlinks; dry-run must not write, execute installers/services, or create backups.
- Use Node built-ins and existing `yaml`/`jsonc-parser`; do not add a framework.
- After every task: `npm test` must pass, `git diff --check` must pass, and the task commit must contain only that task.

## Current interfaces and exact paths

- Public entry: `package.json#bin.agent-skills` -> `scripts/cli.mjs`; current parser registry is `COMMANDS` in `scripts/cli.mjs`.
- Agentfolio JSON stdin/stdout entry: `scripts/agentfolio-adapter.mjs`, exported `handleRequest(request, { run, root })`; current protocol is `protocolVersion: 1`, operations `doctor|plan|apply`.
- Process helper: `scripts/lib/command.mjs` exports `npx`, `shellQuote`, `windowsQuote`, and `runCommand`; `scripts/install-personal-skills.mjs` and `scripts/install-curated-skills.mjs` currently call `runCommand`.
- Setup entry points: `scripts/setup-pi.mjs`, `scripts/setup-opencode.mjs`, and `scripts/setup-cursor.mjs`; instruction installer: `scripts/install-agents.mjs`; model catalog: `scripts/catalog.mjs`.
- Current unsafe manifest fields to replace: `collection.yaml:18` `command`; `harnesses/pi.json` package `install` strings; `harnesses/opencode.json:57` `installCommands` string array. Existing Pi bridge invokes `execSync(pkg.install)` at `scripts/setup-pi.mjs:536-537`.
- Existing tests: `tests/cli.test.mjs` and `tests/agentfolio-adapter.test.mjs`. Existing plans/docs: `docs/cli-dispatcher-plan.md`, `docs/model-catalog.md`, `README.md`.

## Task 1: Lock the new contracts with failing tests

**Files:** add `tests/manifest-contract.test.mjs`, `tests/action-registry.test.mjs`; update `package.json` only if the existing glob does not discover the new tests.

1. Write tests that load `collection.yaml`, all three harness JSON manifests, and assert every executable is a strict `{ executable, args }` vector, args are non-empty strings, and no `command`, `install`, or `installCommands` field remains.
2. Add tests for registry IDs `global.add-curated-skills`, `global.add-instructions`, `pi.configure`, `cursor.add-agents`, and `opencode.configure-plugins-and-agents`; assert each resolves to executable plus args and unknown IDs fail.
3. Add injection fixtures (`;`, `&&`, `|`, newline, `$()`, backticks, empty args, `../`) and assert validation rejects them.
4. Run `node --test tests/manifest-contract.test.mjs tests/action-registry.test.mjs` and confirm it fails because the current manifests/registry do not satisfy the contract. Commit: `test: define strict action and manifest contracts`.

## Task 2: Add the shared action registry and process boundary

**Files:** add `scripts/lib/actions.mjs`, `scripts/lib/process.mjs`; update `scripts/cli.mjs`, `scripts/agentfolio-adapter.mjs`, `scripts/lib/command.mjs`.

1. Implement named exports with these shapes:

```js
export const ACTIONS = Object.freeze({
  "global.add-curated-skills": { executable: "npx", args: ["--yes", "skills", "add", "."] },
  "global.add-instructions": { executable: process.execPath, args: ["scripts/install-agents.mjs"] },
  "pi.configure": { executable: process.execPath, args: ["scripts/setup-pi.mjs"] },
  "cursor.add-agents": { executable: process.execPath, args: ["scripts/setup-cursor.mjs"] },
  "opencode.configure-plugins-and-agents": { executable: process.execPath, args: ["scripts/setup-opencode.mjs"] },
});
export function resolveAction(id, extraArgs = []) { /* validate then return vector */ }
export function runProcess({ executable, args, cwd, env, stdio }) { /* execFile, shell:false */ }
```

2. Keep action metadata and collection validators in the registry; remove duplicated `ACTIONS` and CLI-to-script mapping from the adapter/CLI.
3. Preserve public command output and protocol v1 response fields while routing through the registry. Ensure request args are cloned and validated, never concatenated.
4. Add unit tests with injected runner proving exact executable/args and no shell option. Run `npm test`, `node --test tests/action-registry.test.mjs`, expect all pass. Commit: `refactor: centralize collection action execution`.

## Task 3: Convert manifests and enforce collection-specific validation

**Files:** update `collection.yaml`, `harnesses/pi.json`, `harnesses/opencode.json`, `scripts/setup-pi.mjs`, `scripts/setup-opencode.mjs`, `scripts/setup-cursor.mjs`; add `scripts/lib/manifest.mjs` and tests.

1. Change `collection.yaml.adapters.agent-skills` to strict `executable: node` and `args: [./scripts/agentfolio-adapter.mjs]`; reference registry action IDs from harness actions.
2. Replace each Pi package `install` with `{ executable: "pi", args: ["install", "npm:..."] }`; replace OpenCode `installCommands` with vector data that remains display-only/manual unless registry-approved.
3. Implement `validateCollectionManifest(collectionId, value)` with allowlists: Pi permits `install` and `--list-models`; bridge allows fixed `npm`, `open-cursor`, `systemctl --user` vectors; Cursor/OpenCode source roots cannot escape their harness directories; global accepts only declared installer IDs.
4. Validate action names, paths, duplicate entries, args, shell metacharacters, absolute paths, and traversal before any setup code runs. Include field-qualified errors.
5. Run `node --test tests/manifest-contract.test.mjs tests/agentfolio-adapter.test.mjs tests/cli.test.mjs`; expect pass. Commit: `refactor: make collection manifests executable vectors`.

## Task 4: Split plan, validation, mutation, and process execution

**Files:** add `scripts/lib/plan.mjs`, `scripts/lib/mutate.mjs`; update the four installer/setup scripts and `scripts/agentfolio-adapter.mjs`.

1. Export `validate(request)`, `plan(request)`, `applyPlan(plan, options)`, and `runProcess(...)`; planners return `{ ok, summary, changes, processes, warnings }` and perform no writes.
2. Refactor `install-agents`, `setup-pi`, `setup-opencode`, `setup-cursor`, and catalog writes so they compute deltas first; adapter plan calls only `plan`, apply calls plan then `applyPlan`, dry-run skips mutation/process execution.
3. Replace Pi `execSync(pkg.install)` with `runProcess({ executable: pkg.install.executable, args: pkg.install.args })`; replace every remaining command-string execution in `scripts/` with explicit vectors.
4. Add tests that snapshot tracked files and injected runner calls for plan/dry-run. Run `npm test`; expect no repository or temporary HOME changes from dry-run. Commit: `refactor: separate planning from mutations`.

## Task 5: Implement secure transactions, rollback, and backup retention

**Files:** add `scripts/lib/transaction.mjs`; update mutation callers and tests.

1. Implement `beginTransaction(targets)`, `atomicWrite(path, bytes, mode)`, `recordBackup(path)`, `rollback(transaction)`, and `pruneBackups(path, 5)`.
2. Use temp files beside targets, `0600` files/`0700` newly-created sensitive directories, reverse-order rollback, and no overwrite of unmanaged paths/symlinks.
3. On process or mutation failure, restore all changed targets and return rollback details; prune only oldest managed backups after success.
4. Add failure-injection tests for first write, later write, and child process failure, plus permission and five-backup assertions. Run `node --test tests/transaction.test.mjs`; expect pass. Commit: `feat: add transactional rollback for local setup`.

## Task 6: Add credential policy, redaction, and local secret handling

**Files:** add `scripts/lib/secrets.mjs`; update `harnesses/pi/xai.ts`, `harnesses/pi/claude.ts`, setup scripts, `.gitignore`, and examples/docs as needed.

1. Implement `redact(text, env = process.env)` and `assertNoTrackedSecrets(paths)`; redact known API-key env values, bearer/basic auth, token/key patterns, and credential URLs from errors/plans/logs.
2. Ensure native keychain/login is attempted/documented first; env API keys are fallback reads only and never serialized or written. Add explicit placeholder-only local example if an example is needed.
3. Ignore `.env`, `.env.*`, local credential/config/runtime state, and transaction backups; verify tracked files contain no real credential material.
4. Add tests for keychain-first ordering, fallback env use, redacted adapter responses, and repository scan. Run `node --test tests/secrets.test.mjs`; expect pass. Commit: `feat: enforce credential-safe setup diagnostics`.

## Task 7: Harden localhost bridge and filesystem boundaries

**Files:** update `harnesses/pi.json`, bridge templates under `harnesses/pi/`, `scripts/setup-pi.mjs`, and add `tests/bridge-safety.test.mjs`.

1. Validate control/provider URLs with `new URL`; accept only `http:` loopback literals `127.0.0.1` (and the fixed configured ports), reject wildcard/public/hostname bindings.
2. Validate workspace/config paths and systemd template substitutions without shell expansion; preserve `PI_CURSOR_WORKSPACE` as an argument/value only.
3. Ensure bridge setup never copies Cursor auth; set sensitive local paths/dirs to owner-only mode and retain explicit login instructions.
4. Run `node --test tests/bridge-safety.test.mjs tests/transaction.test.mjs`; expect pass. Commit: `fix: constrain local Cursor bridge boundaries`.

## Task 8: Update metadata, docs, and canonical onboarding

**Files:** `package.json`, `README.md`, `docs/model-catalog.md`, `docs/cli-dispatcher-plan.md`, `skills/agentfolio-operator/SKILL.md`, and stale docs proven unreferenced by search/history.

1. Set `engines.node` to the supported/current tested range, correct package version/visibility, and repository/homepage/bugs metadata; run `npm install --package-lock-only` and commit the resulting lockfile only when dependency metadata changes it.
2. Document ownership, strict vectors, auth-first policy, redaction, rollback, dry-run, localhost bridge risk, and exactly this onboarding sequence: clone collection; `npm ci`; install Agentfolio from its canonical repository; `agentfolio doctor --collection .`; `agentfolio plan --profile pi --collection .`; `agentfolio apply --profile pi --dry-run --collection .`; apply after review.
3. Remove stale duplicated instructions only after `git grep` and `git log -- <path>` show no references; do not add compatibility prose. Run `git grep -nE 'installCommands|execSync\([^)]*install|command: \[' -- ':!docs/superpowers'` and expect no unsafe contract matches. Commit: `docs: document full-polish ownership and onboarding`.

## Task 9: CI and integration gates

**Files:** add/update `.github/workflows/ci.yml`, `package.json`, and tests under `tests/`.

1. Matrix supported/current Node versions; run `npm ci`, `npm test`, `node scripts/catalog.mjs check`, the repository secret scan command, and `git diff --exit-code` after non-mutating smoke.
2. Add cross-repo smoke using a temporary HOME and canonical Agentfolio checkout: `agentfolio doctor --collection .`, `agentfolio plan --profile default --collection .`, and dry-run apply; assert no files, credentials, or services changed.
3. Run exact local gates: `npm ci`; `npm test`; `npm run lint` if declared; `node scripts/catalog.mjs check`; `git diff --check`; `git status --short`. Commit: `ci: gate full-polish safety checks`.

## Task 10: Final self-review and evidence

1. Run `git diff --check`, `npm test`, catalog check, manifest/action/secret/bridge/transaction tests, and the non-mutating two-repo smoke with isolated HOME.
2. Review `git log --oneline --max-count=10` and `git diff --stat main...HEAD` plus `git diff --name-only main...HEAD`; ensure only intended implementation/config/docs changes are present and no generated secrets/backups are tracked.
3. Run `git status --short`; expected output is empty after commits. Inspect every changed file for scope creep, stale docs, credential leakage, shell execution, and missing rollback paths.
4. Commit any corrections as conventional commits, then report commands, outputs, residual risks, and commit hashes. Final review must explicitly confirm `collection.yaml` and all harness manifests are vector-only and Agentfolio remains generic.
