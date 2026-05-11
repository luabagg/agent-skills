# Review heuristics

Concrete, checkable signals. Apply what fits the change type — don't run every
check on every PR.

## Correctness

- Does the diff match what the PR description says it does?
- Is there a happy-path test? A failure-path test? At least one edge case?
- Are there assumptions about input shape, nullability, or ordering that aren't
  validated at the boundary?
- Do state transitions cover all starting states, or only the common one?
- Are booleans and flags checked consistently (no `== true`, no `if x is not None:`
  mixed with `if x:` for the same variable type)?

## Readability and simplicity

- Any function with >4 parameters → suggest an options object or a split.
- Any function over ~50 lines or >3 levels of nesting → suggest extracting.
- Any variable name shorter than 3 chars outside a loop index (`i`, `j`, `_`) →
  flag for rename.
- Any new comment that restates the code (`// increment counter`) → suggest removal.
- Any `TODO` / `FIXME` / `XXX` without a linked issue or author → flag.
- Any commented-out code → flag for removal unless justified.

## Design and boundaries

- A new class that both parses HTTP input and writes to the database → flag
  mixed layers.
- A new abstraction (interface, protocol, base class) with exactly one
  implementation → flag as premature.
- A new utility used by only one caller → inline it unless there's a stated
  reason.
- Business logic inside a controller / route handler → suggest moving to a
  service.
- DB access in a service that should have gone through a repository/adapter →
  flag if the codebase uses that pattern.

## Data integrity and reliability

- Multi-step DB writes without a transaction → flag atomicity risk.
- Webhook/consumer/job handler without idempotency → flag retry safety.
- Migration that alters a large table without `postgresql_concurrently=True`
  (or equivalent non-blocking option) → flag lock risk.
- Migration without a downgrade path → flag if the repo requires downgrade.
- External API call inside a DB transaction → flag lock-holding during network I/O.
- New write with no handling for concurrent writer (no unique constraint, no
  `ON CONFLICT`, no advisory lock) → flag race if concurrency is plausible.

## Error handling

- `except Exception:` or `except:` without a specific reason → flag.
- Catch-and-rewrap as a new exception that loses the cause (`raise NewError(str(e))`
  instead of `raise NewError(...) from e`) → flag trace loss.
- Swallowing errors to return an empty result or `None` → flag silent-failure.
- Raising from an unrelated layer (`HTTPException` in a service) → flag
  boundary violation.

## Performance

- New query inside a loop over N rows → flag N+1.
- `SELECT *` / `load all columns` on a wide table just to read one field → flag.
- New unindexed filter on a large table → flag for index check.
- Unbounded in-memory accumulation (reading all rows before paginating) → flag.
- Synchronous call in a hot path where the rest of the path is async → flag.

## Security

(Use the dedicated `security-review` skill for full audits. Here, flag the
obvious.)

- User input interpolated into SQL, shell, or HTML without escaping → Critical.
- Secret, token, or key in the diff (even in a test file) → Critical.
- Authorization check missing on a new endpoint that returns user data → High.
- `eval` / `exec` / `pickle.loads` on untrusted input → Critical.
- PII / PHI in logs or error messages → High.

## Tests

- New behavior without a test → flag unless the path is trivially deducible.
- Test that passes a mock into the code under test and asserts the mock was
  called, but never asserts real behavior → flag tautology.
- Test that `@skip` / `xfail`s a case that used to pass → flag regression hiding.
- Test that mocks the system under test instead of its collaborators → flag.
- Assertion on a string that includes a timestamp or UUID without
  normalization → flag flakiness risk.

## Consistency with codebase

- New file that ignores the folder's existing patterns (naming, module
  structure, import order) → flag, unless the PR is explicitly restructuring.
- New dependency when an existing one already covers the use case → flag.
- New config pattern that diverges from existing config conventions → flag.
