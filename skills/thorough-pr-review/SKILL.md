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

Review a code change for correctness, reliability, and scope alignment. Back each finding with evidence.

## When NOT to use

- **Tiny changes.** A one-line typo or doc fix does not need the full template. One sentence is the right answer.
- **Mid-conflict PRs.** If the branch is being rebased or has unresolved conflicts, wait.
- **Re-reviewing unchanged code.** If the PR has not changed since a prior review, say so and stop.
- **Pure security audit.** Use `security-review` instead.

## Anti-hallucination rule

Review framing biases agents toward finding problems. Resist it.

- If the change is small, correct, and follows convention, say so and stop. A three-line PR deserves a three-line review.
- Do not pad the output with nitpicks. Each Low item must be useful.
- When uncertain, label the finding as a hypothesis. Say what would confirm or refute it.

## Workflow

### 1. Determine scope

If given a PR URL or number, extract the number from `/pull/<N>` and run:

```bash
gh pr view <number-or-url> --json title,body,url,number,files,commits,baseRefName,headRefName,reviews,comments
gh pr checks <number-or-url>
```

`reviews` and `comments` show whether someone already reviewed. Do not repeat their findings. `checks` shows what CI already caught.

If no PR is given, review the local branch:

```bash
git status
git branch --show-current
git log --oneline <base-branch>..HEAD
git diff <base-branch>...HEAD
```

### 2. Gather intent

Read the PR title and body. If a linked issue or ticket is mentioned, fetch it. You review against stated intent. If intent is missing or unclear, ask the user before you continue.

### 3. Read in context

For each changed file, read the modified sections with their surroundings: adjacent functions, callers, tests, configs. A line can look wrong in isolation and be correct in context, or the reverse.

### 4. Evaluate

Walk the change through the heuristics in `references/heuristics.md`. Each heuristic is a concrete check ("flag a new abstraction with only one caller"), not a principle ("apply SRP"). Apply the checks that fit the change type. Do not scan all ten on a 20-line PR.

Also verify:

- **Alignment.** Does the implementation match the PR description?
- **Scope.** Does it do more than claimed (scope creep) or less (missing work)?
- **CI signal.** If checks fail, report the failure. Do not re-derive it.
- **Tests.** Do new paths have coverage? Are failing tests marked `@skip` or `xfail` to hide problems?

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

- **Short form** for Low severity: one line per issue with `file:line`.
- **Long form** for Critical and High: issue, why it matters, suggested fix.
- **Medium:** choose the form that fits the depth needed.

Note what was done well. This is signal, not politeness. The author learns which parts to leave alone in revision.

End with one recommendation: **Approve**, **Request changes**, or **Needs discussion**. If not approving, list the top 1 to 3 blockers.

### 7. Post inline comments (halt)

If the user asks you to post the review on the PR, ask before any write. Posting notifies the author and is hard to undo.

When approved, post one pending review, not per-line `pulls/comments` calls. Shape and safety rules are in `references/posting-comments.md`.

## References

- `references/heuristics.md`: concrete, checkable heuristics by category.
- `references/output-format.md`: short-form and long-form templates.
- `references/posting-comments.md`: safe `gh` API shape for posting the review.
