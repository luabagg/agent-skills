---
name: code-comments
description: >
  Use when writing or reviewing a code comment, a type comment, a tuned constant, a file header, or a README sentence that states a measured fact.
---

# Code Comments

A comment carries what names, types, and structure cannot.
Write it for a reader who knows the product but not the code, the library, or the field's jargon.
Most code needs no comment.
When one is needed, it reads without the body: a reader who has not opened the function must understand every sentence.

## When to comment

Write a comment when one of these is true:

- The code owns a guarantee, constraint, side effect, or failure mode a reader cannot see from the signature.
- The code does something a reader would call a mistake: a provider bug, a compliance rule, a value chosen from evidence.
- The code follows an order that matters and the order is not obvious.
- A value is tuned and a different value has a known cost.

## When not to comment

- A trivial function gets no comment.
- Do not comment a type whose name and fields say what it holds. Rename a field before you explain it.
- Do not comment an ordinary block inside a function. Extract a named function instead.
- Do not narrate the implementation or write a full docstring.
- A file gets a header only when it is an index, or when the file-level rule is not the sum of its functions' comments.

## Shape

- A function gets at most one comment, above it. The first sentence says what the function does. The sentences after it carry the rule, edge case, guarantee, or failure the signature cannot show.
- The first sentence may overlap the name. It exists so the reader does not have to open the body. "Do not restate the name" applies to the sentences after it.
- A type or table comment opens with what it holds, then states the invariant its fields cannot express: two fields that must agree, a unit, a range, a lifecycle rule. Do not comment fields or union members.
- A tuned constant states the failure the value prevents.
- When a comment lists an order or several distinct points, write a list. Do not join the points into one paragraph.

## The test, per sentence

Write the comment. Then read each sentence after the first and ask: where else does the reader get this fact?

- From the signature or the body below: delete the sentence.
- From a neighboring function or the type: delete the sentence.
- Nowhere: keep it.

Length is not the test. Never trade a fact for brevity.
A comment that still needs more than four sentences after the test usually marks a function that does too much. Extract before you cut.

## One reason, one place

- A reason lives once, next to the mechanism it explains. The function that takes the lock explains the lock. A caller names the effect it depends on, not the reason again.
- When a fact lives in a comment and a README, keep the words identical. Two phrasings drift into two claims.

## Words

- Remove all mannered prose. Say what the code does. When a literal phrase is available, use it.
- Use plain words. Name the effect in the product, not the mechanism.
  Write "one letter may differ in a word of seven or more letters", not "edit tolerance 0.15".
- Do not use field jargon. If a term has no plain form, define it in the comment.
- Write complete, direct sentences of 20 words or fewer. Every sentence has a subject and a verb. No em dashes.
- "Null unless every line reports it" and "Dates the row" are fragments. They make sense only after reading the body.

## Facts

- A comment is self-contained. It never points to a script, a ticket, or a chat to be understood. Scripts and links vanish. The comment stays.
- A tuned value states the failure it prevents.
  "A looser setting let 'student' match 'presidential' and pushed one-word payers out of the list."
- A number is a rounded plain statement of what was measured against what.
  "About 4 in 5 new texts", never "> 80%" when the measurement was 79.6%.

## Bad: too much

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

## Bad: too little

```ts
// Null unless every line reports it. A partial sum would reach the merge as fact.
function sumAmountsIfFullyReported(
  amounts: (string | null)[],
): number | null | "invalid"
```

Neither sentence has a subject. "Null" is the return value, but the reader learns that only from the body.
The comment passed the deletion test and failed the reader.

## Good

```ts
// Sums the amounts in cents. Returns null when any amount is missing, so a
// partial total never reaches the merge as if it were the whole.
function sumAmountsIfFullyReported(
  amounts: (string | null)[],
): number | null | "invalid"
```

The first sentence says the job. The second carries the one rule the signature cannot show.

## Check

Read the comment as the user would.
Can a reader who has not opened the body tell what the function does from the first sentence? If not, write it.
If a later sentence needs the code, the library docs, or a second file to make sense, rewrite it.
If deleting the comment loses nothing, delete it.
