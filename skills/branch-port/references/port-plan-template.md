# Port Plan

Produce this at the end of Phase 3. Share with the user. Wait for confirmation.

## Template

```markdown
## Port Plan

**Feature**: <short description>
**Source**: <source-branch> (fork point: <BASE short SHA>)
**Target**: <target-branch>

### Commit grouping (from source)
- Core logic: <commits>
- Tests: <commits>
- Config / env: <commits>
- Migrations / schema: <commits>
- Fixups / refactors on top of feature: <commits>

### range-diff findings
- <sha>: <title>: `=` identical on target, skip
- <sha>: <title>: `!` similar on target, **inspected**: <what's different + decision>
- (remaining commits are `-`, port normally)

### Files to create (new on source, absent on target)
- <path>: adaptation notes

### Files to modify (exist on both)
- <path>: what the feature changes + what target changed + adaptation plan

### Dependencies to add / update
- <pkg>@<version>: why

### Config / env vars
- <VAR_NAME>: purpose, default

### Migrations / schema
- <migration>: verified against target schema: yes/no

### Risks and open questions
- [ ] <question that changes the port strategy>
```

## Filled example

```markdown
## Port Plan

**Feature**: Per-user rate limiting on /api/search
**Source**: feature/rate-limit-search (fork point: a3f21de)
**Target**: main

### Commit grouping (from source)
- Core logic: 2 commits (RateLimiter class, wire into search handler)
- Tests: 1 commit (unit + integration)
- Config: 1 commit (add RATE_LIMIT_PER_MIN env var)
- Docs: 1 commit (update API.md)

### range-diff findings
- All 5 commits show as `-` (missing on target). Nothing to skip.

### Files to create
- src/ratelimit/limiter.ts: pure new file, no conflicts
- test/ratelimit/limiter.test.ts: pure new file

### Files to modify
- src/api/search.ts: source wraps the handler in `withRateLimit(...)`. Target
  has since extracted the handler into a class-based controller
  (SearchController). Adaptation: apply the rate limit as a decorator on the
  controller method, not as a wrapping HOF.
- src/config/index.ts: add RATE_LIMIT_PER_MIN with default 60.

### Dependencies to add / update
- None: feature uses only stdlib + existing deps.

### Config / env vars
- RATE_LIMIT_PER_MIN: default 60; set per-env in infra repo.

### Migrations / schema
- None.

### Risks and open questions
- [ ] Source's RateLimiter stores counters in-memory. Target has a Redis
      instance already wired for caching; the port should probably use Redis
      instead so limits are shared across replicas. Confirm with user.
- [ ] Source's tests mock a helper that target has deleted. Rewrite those
      tests against target's mocking conventions rather than restoring the helper.
```
