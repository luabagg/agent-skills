# Git quick reference

Assumes `BASE` is exported (Phase 1 of SKILL.md).

## Setup

```bash
git fetch --all --prune
export BASE=$(git merge-base <source> <target>)
```

## Inspect source

```bash
# Feature's commits
git log --oneline "$BASE"..<source>

# File surface (sorted by size)
git diff --stat "$BASE" <source>

# Full diff of the feature
git diff "$BASE" <source>

# Snapshot a file as it is on source
git show <source>:<path>

# How a single file evolved across the feature's commits
git log -p "$BASE"..<source> -- <path>
```

## Inspect target

```bash
# Commits target has that source doesn't
git log --oneline "$BASE"..<target>

# File as it is on target (right now)
git show <target>:<path>

# Diff a single file across the two branches
git diff <source> <target> -- <path>
```

## Detect overlap

```bash
# Which source commits already exist on target
git range-diff "$BASE"..<source> "$BASE"..<target>
```

Output legend:
- `=` identical patch on target → skip
- `!` similar but different patch on target → inspect manually
- `-` only on source → port
- `+` only on target → not relevant

## Review port before committing

```bash
# Summary of what the port changed vs clean target
git diff --stat origin/<target>...HEAD

# Full diff
git diff origin/<target>...HEAD
```

The `...` (three dots) matters. It diffs from the merge-base, so
target-branch changes that happened after you branched don't pollute the output.

## Preserving authorship

```bash
# Keep the original author on the port commit
git commit --author="Original Author <email>" -m "port: <feature>"

# Or add trailers for multiple contributors
# (in the commit message, blank line then):
#   Co-Authored-By: Name <email>
```
