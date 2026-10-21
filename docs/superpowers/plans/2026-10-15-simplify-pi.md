# Simplify Pi Implementation Plan

> **For agentic workers:** Execute this focused cleanup inline, then validate the collection before any live apply.

**Goal:** Remove Pi's Claude CLI and Cursor bridges and use the native model picker.

**Architecture:** Keep Pi packages and the xAI and environment-permission extensions. Remove bridge setup, generated Cursor provider configuration, and bridge-specific catalog entries. The catalog continues to generate its model lock.

**Tech Stack:** Node.js ES modules, YAML, JSON, Pi 1.2.0, Agentfolio.

**Spec:** The user's request in this conversation: remove Claude login from Pi, simplify the configuration, and remove the broken Cursor bridge.

## Global Constraints

- Preserve unrelated skill edits already in the worktree.
- Use collection-owned setup actions and dry-run before applying.
- Do not change native provider credentials or login state.
- The user selected offline completion. Preserve retained model snapshots and defer model upgrades and authenticated runtime checks.

### Task 1: Remove bridge-owned configuration and implementation

**Files:** `harnesses/pi.json`, `harnesses/catalog.yaml`, `scripts/setup-pi.mjs`, `scripts/catalog.mjs`, `scripts/cli.mjs`, `collection.yaml`.

- [x] Remove Claude CLI and Cursor integrations, generated Cursor provider output, and the custom picker.
- [x] Remove the obsolete bridge CLI flag and provider-generation paths.
- [x] Preserve package setup, catalog validation, backups, and unrelated Pi configuration.

### Task 2: Update documentation and obsolete coverage

**Files:** `README.md`, `docs/model-catalog.md`, `tests/cli.test.mjs`, `tests/bridge-safety.test.mjs`.

- [x] Document native model selection and cleanup commands for prior bridge installations.
- [x] Remove tests for deleted bridge behavior and update CLI checks.
- [x] Keep dry-run non-mutation and installer-failure coverage.

Rule: setup must preserve user configuration and dry-runs must not write. Established in the collection's setup contract. Failure would overwrite local preferences or mutate live harness files during preview.

### Task 3: Generate and verify

- [x] Run current Pi 1.2.0 through npm. Its model list requires provider login, so authenticated discovery is deferred.
- [x] Migrate the lock by removing Cursor only. Verify the previous policy digest, retained provider definitions, selectors, and snapshot digests before writing.
- [x] Run `agent-skills models check` and `agent-skills models diff`. The diff uses unchanged committed snapshots without Pi on PATH.
- [x] Run `npm test` and `agentfolio apply --profile pi --dry-run --collection .`.
- [x] Inspect `git diff --check` and the final diff.

Verification: `npm test` passed 70 tests, with one optional cross-repository smoke test skipped. Pi setup dry-run passed. Skill discovery found all nine personal skills. No live apply was run.

Do not commit or apply live changes as part of this cleanup.
