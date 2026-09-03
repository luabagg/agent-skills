# Output format

Two templates. Match the template to the depth needed, not the other way around.

## Short form (use for Low, often for Medium)

One bullet per issue:

```
- `src/patient/service.py:142`: `d` is cryptic; suggest `days_remaining`. (Low)
- `src/api/routes.py:88`: missing response_model on GET /patients/{id}. (Medium)
- `tests/test_search.py:34`: asserts the mock was called but not the return value. (Medium)
```

File, line, one-line issue, severity in parens. No ceremony.

## Long form (use for Critical and High)

```markdown
### [Short title]

**Severity**: Critical
**Location**: `src/payments/refund.py:57-74`

**Issue**

The refund call to the payment processor happens before the DB row is marked as
`refunded`. If the network call succeeds but the DB commit fails (retry on a
transient error, process crash, etc.), the customer is refunded but the system
has no record.

**Why it matters**

Double-refunds on retry, or silent reconciliation mismatches. Finance will catch
it eventually, but only after the fact.

**Suggested fix**

Wrap the DB update and the external call in an outbox pattern: commit the intent
in the same transaction as the business write, then have a worker drain the
outbox with idempotency keys. Or, at minimum, make the external call with a
deterministic idempotency key derived from the refund row's UUID so retries are
safe.
```

## Review summary (at the top)

```markdown
# Review: <PR title or branch>

**Scope**: PR #1234 / `feat/rate-limit` (12 files, +340 -80)
**Intent**: Add per-user rate limiting to /api/search (matches description).
**CI**: 2 checks passing, 1 failing (typecheck, see details).
**Prior reviews**: 1 reviewer requested changes on 2026-04-20; their comments
are addressed in the latest commit.

**Overall**: Change is on-scope and tests cover the main path. One Critical
(outbox/idempotency on the payment call) and two High must be fixed before
merge. Positive: clean separation between limiter and search handler.

**Recommendation**: Request changes.

**Top blockers**:
1. Refund-before-commit race (see Critical below)
2. Missing auth check on /admin/limits (High)
3. Typecheck failing on `limiter.ts:12` (High)
```

## Positive observations

Always include 1 to 3 concrete things done well. Reasons:
- Signals what the author shouldn't change in revision.
- Counteracts review-as-fault-finding framing.
- Makes the feedback easier to act on without defensiveness.

Keep them specific: *"the `RateLimiter` interface is small enough to mock in
tests without a helper"*, not *"good code quality"*.
