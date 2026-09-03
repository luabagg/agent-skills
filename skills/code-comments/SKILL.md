---
name: code-comments
description: >
  Use when writing or reviewing a code comment, a type comment, a tuned constant, or a README sentence that states a measured fact.
---

# Code Comments

A comment carries what names, types, and structure cannot.
Write it for a reader who knows the product but not the code, the library, or the field's jargon.
Comment only when the code cannot say it. Most code needs no comment.

## When to comment

Write a comment when one of these is true:

- The code owns a guarantee, constraint, side effect, or failure mode a reader cannot see from the signature.
- The code does something a reader would call a mistake: a provider bug, a compliance rule, a value chosen from evidence.
- The code follows an order that matters and the order is not obvious.
- A value is tuned and a different value has a known cost.

## When not to comment or when to delete

- Do not comment a function whose name and signature say what it does.
- Do not comment a type whose name and fields say what it holds. Make types self-describing. Rename a field before you explain it.
- Do not comment an ordinary block inside a function. Extract a named function instead.
- Do not restate a name, narrate the implementation, or write a full docstring.

## Placement

- A function gets at most one comment, above the function. The first sentence states the function's objective. The next sentences cite the behavior a reader would not expect. Do not put that behavior in a comment inside the body.
- A type gets a comment only when it holds an invariant the fields cannot express. Examples: two fields that must agree, a unit, a range, a lifecycle rule. Do not comment fields or union members.
- A tuned constant gets a comment that states the failure the value prevents.
- When a comment lists an order or several distinct points, write a numbered or bulleted list. Do not join the points into one paragraph.

## Words

- Remove all mannered prose. Say what the code does. When a literal phrase is available, use it.
- Use plain words. Name the effect in the product, not the mechanism.
  Write "one letter may differ in a word of seven or more letters", not "edit tolerance 0.15".
- Do not use field jargon. If a term has no plain form, define it in the comment.
- Write complete, direct sentences of 20 words or fewer. No fragments. No em dashes.

## Facts

- A comment is self-contained. It never points to a script, a ticket, or a chat to be understood. Scripts and links vanish. The comment stays.
- A tuned value states the failure it prevents.
  "A looser setting let 'student' match 'presidential' and pushed one-word payers out of the list."
- A number is a rounded plain statement of what was measured against what.
  "About 4 in 5 new texts", never "> 80%" when the measurement was 79.6%.
- When a fact lives in a comment and a README, keep the words identical. Two phrasings drift into two claims.

## Bad

```ts
// A payer suggestion shown in the review picker.
type SenderSuggestion = {
  // The payer's id.
  payerId: string
  // The payer's display name.
  name: string
}

// 30 slots holds the reviewer-settled payer > 80% of the time. See
// scripts/evaluate-recall.ts.
const PAYER_SHORTLIST_LIMIT = 30

// Builds review-picker suggestions.
export function getSenderSuggestions(input: ExtractedSender) {
  const suggestions = new Map<string, SenderSuggestion>()
  // Reviewer decision goes first so it leads the list.
  addSuggestion(suggestions, findPayerIdChosenByReviewers(input))
  // Skip fuzzy matches. Reviewers could not confirm them by name.
  addAll(suggestions, findPayerIdsWithNameContaining(input.extractedPayerName))
  // ...
}
```

The type comment and field comments repeat the names.
The constant comment points to a script and rounds up a measurement.
The function comment says nothing the name does not say, and the surprising rules hide inside the body.

## Good

```ts
type SenderSuggestion = {
  payerId: string
  name: string
}

// Slots the model reads. Measured against reviewer picks: 30 slots hold the
// reviewer's payer for about 4 in 5 new texts.
const PAYER_SHORTLIST_LIMIT = 30

// Payers the picker offers before the reviewer types, in this order:
//
// 1. The payer reviewers chose for this same text before.
// 2. Directory payers whose name contains the extracted payer name.
// 3. Directory payers whose name contains the extracted sender name.
//
// Every entry is one a reviewer can confirm by reading the name, so fuzzy
// matches stay out.
export function getSenderSuggestions(input: ExtractedSender) {
  const payerIds = [
    findPayerIdChosenByReviewers(input),
    ...findPayerIdsWithNameContaining(input.extractedPayerName),
    ...findPayerIdsWithNameContaining(input.extractedSenderName),
  ]
  // ...
}
```

The type has no comment because its fields describe it.
The function comment states the objective, then cites the order and the exclusion a reader would question.

## Check

Read the comment as the user would.
If it needs the code, the library docs, or a second file to make sense, rewrite it.
If deleting the comment loses nothing, delete it.
