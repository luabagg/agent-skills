---
name: thorough-pr-review
description: >
  Use when the user asks to review a pull request, evaluate diff-level
  merge-readiness, or audit the current branch before opening a PR. Triggers
  include "review this PR", "review my branch", "code review", or a GitHub PR URL
  paired with review intent. For pure security reviews, prefer `security-review`
  instead.
---

# Thorough PR Review

Review a code change for correctness, reliability, and scope alignment — with
evidence, not vibes.

## When NOT to use

- **Tiny changes** — a one-line typo or doc fix doesn't need the full template.
  One sentence is the right answer.
- **Mid-conflict PRs** — if the branch is actively being rebased or has unresolved
  conflicts, wait.
- **Re-reviewing unchanged code** — if the PR hasn't moved since a prior review,
  say so and don't repeat the work.
- **Pure security audit** — use `security-review` instead.

## Anti-hallucination rule

Framing biases agents toward finding problems. Resist it.

- If the change is small, correct, and follows convention, **say so and stop**.
  A three-line PR deserves a three-line review.
- Don't pad the output with nitpicks to feel thorough. Low-priority items
  should be genuinely useful, not filler.
- When uncertain, label the finding as a hypothesis and say what would confirm
  or refute it — don't assert.

## Workflow

### 1. Determine scope

If given a PR URL or number, extract the number from `/pull/<N>` and run:

```bash
gh pr view <number-or-url> --json title,body,url,number,files,commits,baseRefName,headRefName,reviews,comments
gh pr checks <number-or-url>
```

`reviews` / `comments` tell you if someone already reviewed — don't repeat them.
`checks` tells you what CI already caught.

If no PR is given, review the local branch:

```bash
git status
git branch --show-current
git log --oneline <base-branch>..HEAD
git diff <base-branch>...HEAD
```

### 2. Gather intent

Read the PR title and body. If a linked issue/ticket is mentioned, fetch it. You
are reviewing against stated intent — if intent is missing or unclear, ask the
user before proceeding.

### 3. Read in context

For each changed file, read the modified sections **with their surroundings** —
adjacent functions, callers, tests, configs. A line can look wrong in isolation
and be correct in context (or vice versa).

### 4. Evaluate

Walk the change through the heuristics in `references/heuristics.md`. Each
heuristic is a concrete check ("flag a new abstraction with only one caller"),
not a principle ("apply SRP"). Apply them where the change type calls for it —
don't mechanically scan all ten on a 20-line PR.

Also verify:
- **Alignment** — does the implementation match what the PR description says?
- **Scope** — does it do more than claimed (risky scope creep) or less (missing work)?
- **CI signal** — if checks are failing, surface the failure; don't re-derive it.
- **Tests** — do new paths have coverage? Are failing tests `@skip`/`xfail`-ed to hide problems?

### 5. Classify findings

| Severity | Meaning | Examples |
|---|---|---|
| **Critical** | Must fix before merge | Data loss, security hole, broken core flow, unsafe migration |
| **High** | Strongly recommended before merge | Real logic bug, missing error handling on a live path, test gap on risky behavior |
| **Medium** | Address for code health | Brittle design, notable readability or perf issue, meaningful coverage gap |
| **Low** | Nits, polish, suggestions | Naming, minor consistency, doc clarity |

Do not inflate severity. Style preference is not High. Uncertainty is not Critical.

### 6. Write output

Use the templates in `references/output-format.md`:
- **Short form** for Low severity: one-line-per-issue with `file:line`.
- **Long form** for Critical and High: issue / why it matters / suggested fix.
- Medium: author's choice based on depth needed.

Note what was done well — this isn't politeness, it's signal (the author knows
what parts you don't want changed in revision).

End with a clear recommendation: **Approve**, **Request changes**, or
**Needs discussion**, plus the top 1–3 blockers if not approving.

### 7. Posting inline comments (halt)

If the user asks you to post the review on the PR, **ask first before any write**
— this fires notifications to the author and is hard to unsend.

When approved, post as a **single pending review** (not per-line `pulls/comments`
calls). Shape and safety rules live in `references/posting-comments.md`.

## References

- `references/heuristics.md` — concrete, checkable heuristics by category.
- `references/output-format.md` — short-form and long-form templates.
- `references/posting-comments.md` — safe `gh` API shape for posting the review.
