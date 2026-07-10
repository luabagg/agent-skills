---
name: branch-port
description: Port a feature across heavily diverged branches when rebase/merge is impractical.
---

# Branch Port

Port a feature from source to target when rebase/merge won't work cleanly. Approach:
**understand first, re-implement second** — never paste source files over target.

## When NOT to use

- `git cherry-pick <sha>` applies cleanly → do that.
- Rebase has a few conflicts → resolve them, don't re-architect.
- Close ancestor (hours/days) → plain merge.
- Feature is one or two commits → cherry-pick each.

This skill is for long-lived divergence, major target refactors, or features that
mix code still needed with code target has obsoleted.

## Rules (read first)

- **Never** `git checkout <source-branch> -- <file>` — discards target's evolution.
- **Never** `git diff <source> | git apply` across diverged branches.
- **Halt** at Phase 4 (Port Plan) and wait for user confirmation before writing code.
- Ambiguous conflict → stop and ask.
- Schema/migration changes need explicit verification against target's schema state.
- If Phase 5 discovery invalidates the Port Plan, **stop and re-plan** — don't push
  through a broken plan.
- Don't `@skip` / `xfail` failing ported tests to get green. Rewrite them for target
  conventions or surface the failure to the user.
- Keep the port as a single reviewable commit or a small focused series.

## Phase 1 — Context

```bash
git fetch --all --prune
export BASE=$(git merge-base <source> <target>)
git log --oneline "$BASE"..<source>
```

Ask the user **only for missing info** (source, target, scope). If the trigger
message provided it, skip the question.

Detect overlap — has any of the feature already been applied to target?

```bash
git range-diff "$BASE"..<source> "$BASE"..<target>
```

Reading the output:
- `=` → identical patch on target. **Skip**.
- `!` → similar-but-different patch on target. **Inspect manually** — could be a
  partial backport, a whitespace tweak, or a different implementation. Don't skip blind.
- `-` → only on source. **Port**.
- `+` → only on target. Not relevant to the port.

## Phase 2 — Understand the feature

```bash
git diff --stat "$BASE" <source>       # prioritize by surface area
git diff "$BASE" <source> -- <path>    # drill into files that matter
```

For each significant file, read final source state and, if it went through major
rewrites mid-feature, its evolution (commands in `references/git-commands.md`).

Inventory beyond code — dependencies, env vars, API contracts, migrations. These
all land in the Port Plan.

## Phase 3 — Analyze the target

What target has changed since the fork:

```bash
git log --oneline "$BASE"..<target>
git show <target>:<path>   # for each file the feature touches
```

For each touched file, decide: does it still exist? Has surrounding code been
restructured? Are there target-only utilities the ported code should adopt? Are
there target conventions (naming, module layout, framework idioms) to follow?

Diff the project's dependency manifest between branches to flag drift (missing
packages, version conflicts, renames).

## Phase 4 — Port Plan (halt)

Produce a written plan covering:
- Commit grouping of the source (core / tests / config / migrations / fixups)
- `range-diff` findings (what to skip, what to inspect)
- Files to create, files to modify (with the adaptation for each)
- Dependencies, config/env, migrations
- Open questions and risks

Template and a filled example: `references/port-plan-template.md`.

**Wait for user confirmation before writing code.** Getting answers wrong mid-port
costs hours.

## Phase 5 — Re-implement

Order: manifest → new files → modified shared files → config/env → tests → docs.

For each modified file: read target's current version first, apply the feature's
*logic* into it, follow target's conventions. Run the project's typecheck/build/lint
between major groups; stop and fix on failure.

If discovery here invalidates Phase 4, stop and re-plan with the user.

## Phase 6 — Verify

Run the feature's tests on target. Adapt where target conventions demand it; don't
skip to get green.

Review the full port surface:

```bash
git diff --stat origin/<target>...HEAD   # summary
git diff origin/<target>...HEAD          # full diff
```

Walk the diff with the user and name what needs manual smoke-testing: the feature's
primary behavior plus regression surface in files the port touched.

## Authorship

If preserving original author matters for your team, see
`references/git-commands.md` for `--author=` and `Co-Authored-By:` patterns.

## References

- `references/port-plan-template.md` — Port Plan template and worked example.
- `references/git-commands.md` — git commands used across phases.
