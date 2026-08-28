# SDD ledger — plan: docs/superpowers/plans/2026-08-28-full-polish.md

## Preflight

| Scope | Produces | Consumes | Finding |
|---|---|---|---|
| Tasks 1→10 | registry, vector manifests, pure planning, transactions, credentials, bridge safety, docs, CI | each subsequent task consumes prior interfaces | Reviewed and corrected before approval; no open plan conflicts |

Ruling: Execute repository plan as one sequential writer with task-scoped commits, then independent whole-branch review — minimizes conflicting low-cost agents while preserving task boundaries — cost if wrong: reviewer may find issues that per-task review would have caught earlier.
Task 1: complete (commit 06fce74, tests `node --test tests/manifest-contract.test.mjs tests/action-registry.test.mjs`)
Task 2: complete (commit c023bcb, tests `node --test tests/action-registry.test.mjs tests/agentfolio-adapter.test.mjs tests/cli.test.mjs`)
Task 3: complete (commit 1d385e7, tests `node --test tests/manifest-contract.test.mjs tests/manifest-validation.test.mjs tests/agentfolio-adapter.test.mjs tests/cli.test.mjs`)
Task 4: complete (commit d14207e, tests `node --test tests/planning.test.mjs tests/agentfolio-adapter.test.mjs tests/cli.test.mjs`)
Task 5: complete (commit ffae9b2, tests `node --test tests/transaction.test.mjs tests/planning.test.mjs`)
Task 6: complete (commit cf7e8e8, tests `node --test tests/secrets.test.mjs tests/agentfolio-adapter.test.mjs`)
Task 7: complete (commit cf77cde, tests `node --test tests/bridge-safety.test.mjs tests/transaction.test.mjs tests/cli.test.mjs`)
Task 8: complete (commit 60815e6, tests `node --test tests/docs-contract.test.mjs`)
Task 9: complete (commit 5663205, tests `npm test && npm run secret-scan`)
Task 10: complete (commit cca3c45, tests `npm test; node scripts/catalog.mjs check; git diff --check; npm run secret-scan; AGENTFOLIO_BIN=/home/luabagg/development/.worktrees/agentfolio-full-polish/bin/agentfolio.mjs node --test tests/cross-repo-smoke.test.mjs; git status --short`)
Ruling: The collection action contract now keeps only action, summary, and config at action level; manifest/catalog/lock/source/args are opaque config data consumed by the adapter. Agentfolio is pinned to owning fix edd8d96f0e2069ebcc7a7eb33746a7de2e81df84.
Test evidence: strict manifest-shape and doctor config asset tests pass; cross-repo smoke runs doctor, plan, and dry-run apply with zero skipped tests and verifies clean git state.
