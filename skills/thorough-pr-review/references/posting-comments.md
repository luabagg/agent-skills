# Posting the review on the PR

Posting fires notifications to the PR author and other subscribers. This is a
user-visible, hard-to-unsend action. Follow the safety rules.

## Safety rules

- **Ask the user explicitly before posting.** One review approval is not
  standing authorization to post future reviews.
- **Prefer a single pending review** over per-line `pulls/comments` calls —
  the latter fires one notification per comment.
- **Never approve** the PR on behalf of the user unless they said "approve".
  Default to `COMMENT` event.
- **Don't self-request-changes** on a user's own PR without explicit ask.

## Preferred command — `gh pr review`

For the common case (summary + inline comments as a single review), use the
`gh` CLI:

```bash
# Submit as a plain comment review (no approval, no changes-requested)
gh pr review <number-or-url> --comment --body "$(cat review.md)"

# Request changes
gh pr review <number-or-url> --request-changes --body "$(cat review.md)"

# Approve (only when user explicitly asks)
gh pr review <number-or-url> --approve --body "$(cat review.md)"
```

This posts the top-level review body. For inline comments tied to specific
lines, use the API form below.

## Inline comments via API (when line-anchored feedback helps)

The correct endpoint is `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews`
with a `comments[]` array — this creates a single review with line-anchored
comments in one notification.

Required per comment:
- `path` — the file path
- `line` — the line number in the **new** file
- `side` — `"RIGHT"` for the new file (typical), `"LEFT"` for the old file
- `body` — the comment text

Example:

```bash
gh api -X POST repos/<owner>/<repo>/pulls/<pull_number>/reviews \
  -F event=COMMENT \
  -F body='Overall the change is on-scope. See inline comments.' \
  -F 'comments[][path]=src/limiter.ts' \
  -F 'comments[][line]=42' \
  -F 'comments[][side]=RIGHT' \
  -F 'comments[][body]=This should use the shared Redis client, not a new one.' \
  -F 'comments[][path]=src/api/search.ts' \
  -F 'comments[][line]=88' \
  -F 'comments[][side]=RIGHT' \
  -F 'comments[][body]=Missing auth check on this handler.'
```

`event` values:
- `COMMENT` — default, no approval signal
- `APPROVE` — approve the PR (only when user asked)
- `REQUEST_CHANGES` — block merge

## What NOT to do

- **Do not** loop `gh api repos/.../pulls/<pr>/comments` per finding. That uses
  the *standalone* PR-comment endpoint — each call fires its own notification
  and the comments are not grouped as a review.
- **Do not** post a review, then edit it by deleting and re-posting. Edit via
  `PATCH /repos/{owner}/{repo}/pulls/comments/{comment_id}` if needed, or
  discuss with the user before re-posting.
- **Do not** post if `gh pr view --json reviews` shows the same findings were
  already raised by another reviewer. Summarize instead.
