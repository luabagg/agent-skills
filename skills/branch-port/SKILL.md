---
name: branch-port
description: Port a feature across heavily diverged branches when rebase/merge is impractical.
---

# Branch Port

Port a feature from a source branch to a target branch when rebase or merge will not apply cleanly. Understand the feature first, then re-implement it. Never paste source files over the target.

## When NOT to use

- `git cherry-pick <sha>` applies cleanly: do that.
- Rebase has a few conflicts: resolve them. Do not re-architect.
- The branches share a recent ancestor (hours or days): use a plain merge.
- The feature is one or two commits: cherry-pick each.

Use this skill for long-lived divergence, major target refactors, or features that mix code the target still needs with code the target has made obsolete.

## Rules (read first)

- Never run `git checkout <source-branch> -- <file>`. It discards the target's evolution.
- Never run `git diff <source> | git apply` across diverged branches.
- Halt at Phase 4 (Port Plan). Wait for user confirmation before you write code.
- If a conflict is ambiguous, stop and ask.
- Verify schema and migration changes against the target's schema state.
- If Phase 5 discovery invalidates the Port Plan, stop and re-plan. Do not push through a broken plan.
- Do not mark failing ported tests `@skip` or `xfail` to get green. Rewrite them for target conventions or report the failure to the user.
- Keep the port as one reviewable commit or a small focused series.

## Phase 1: Context

```bash
git fetch --all --prune
export BASE=$(git merge-base <source> <target>)
git log --oneline "$BASE"..<source>
```

Ask the user only for missing information (source, target, scope). If the trigger message provided it, skip the question.

Detect overlap. Has any part of the feature already reached the target?

```bash
git range-diff "$BASE"..<source> "$BASE"..<target>
```

Read the output:

- `=`: identical patch on target. Skip.
- `!`: similar but different patch on target. Inspect manually. It could be a partial backport, a whitespace tweak, or a different implementation. Do not skip it blind.
- `-`: only on source. Port.
- `+`: only on target. Not relevant to the port.

## Phase 2: Understand the feature

```bash
git diff --stat "$BASE" <source>       # prioritize by surface area
git diff "$BASE" <source> -- <path>    # drill into files that matter
```

For each significant file, read its final source state. If it went through major rewrites mid-feature, read its evolution too (commands in `references/git-commands.md`).

Inventory the non-code parts: dependencies, env vars, API contracts, migrations. All of these go in the Port Plan.

## Phase 3: Analyze the target

Find what the target changed since the fork:

```bash
git log --oneline "$BASE"..<target>
git show <target>:<path>   # for each file the feature touches
```

For each touched file, decide: Does it still exist? Was the surrounding code restructured? Are there target-only utilities the ported code should use? Which target conventions (naming, module layout, framework idioms) apply?

Diff the project's dependency manifest between branches to find drift: missing packages, version conflicts, renames.

## Phase 4: Port Plan (halt)

Write a plan that covers:

- Commit grouping of the source (core, tests, config, migrations, fixups)
- `range-diff` findings (what to skip, what to inspect)
- Files to create and files to modify, with the adaptation for each
- Dependencies, config and env, migrations
- Open questions and risks

Template and a filled example: `references/port-plan-template.md`.

Wait for user confirmation before you write code. A wrong answer mid-port costs hours.

## Phase 5: Re-implement

Order: manifest, new files, modified shared files, config and env, tests, docs.

For each modified file: read the target's current version first. Apply the feature's logic into it. Follow the target's conventions. Run the project's typecheck, build, and lint between major groups. Stop and fix on failure.

If discovery here invalidates Phase 4, stop and re-plan with the user.

## Phase 6: Verify

Run the feature's tests on the target. Adapt them where target conventions require it. Do not skip them to get green.

Review the full port surface:

```bash
git diff --stat origin/<target>...HEAD   # summary
git diff origin/<target>...HEAD          # full diff
```

Walk the diff with the user. Name what needs manual smoke-testing: the feature's primary behavior plus the regression surface in files the port touched.

## Authorship

If preserving the original author matters for your team, see `references/git-commands.md` for `--author=` and `Co-Authored-By:` patterns.

## References

- `references/port-plan-template.md`: Port Plan template and worked example.
- `references/git-commands.md`: git commands used across phases.
