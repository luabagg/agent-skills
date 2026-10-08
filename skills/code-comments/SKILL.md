---
name: code-comments
description: >
  Use when writing, editing, or reviewing a code comment: a function or type doc comment (JSDoc, docstring), a field or union member comment, a constant, an inline comment in a function body, a TODO, a file header, or a README sentence that states a measured fact.
---

# Code Comments

A comment has one of two jobs:

- A **documentation comment** sits above a declaration. It tells a caller what the code does, how to use it, and how it behaves. A caller does not read the body.
- An **implementation comment** sits inside a body. It tells a maintainer why the code is the way it is.

Write for a reader who knows the product but not the code, the library, or the field's jargon.
Most code needs neither kind. First try to make the code say it. Use a better name (see `code-naming`), extract a function, or return a typed result in place of a sentinel. Comment only what is left.

## Documentation comments: functions

Write one when a caller cannot write a correct call from the name and signature alone. A trivial function gets none.

1. The first sentence says what the caller gets or what the function changes. Start it with a third-person verb: "Returns…", "Looks up… and stores…". Do not start with an imperative ("Return…") or a noun phrase ("One row for each…"). Keep it to one fact.
2. Then state each fact the signature cannot show. Put two or more facts in a list, one per item. Write a case as `condition: effect`. Look for these facts:
   - when it returns null, an empty value, or a sentinel value
   - each error a caller can get, and when
   - each side effect: a write, a delete, a network call, a changed argument
   - the order of the results, a unit, a limit
   - a cost a caller would not expect, such as one query per item
3. Stop. Do not say how the body does its work. The body can change while the contract stays the same.

Then test each sentence after the first. If the name, the parameter names, or the types already say it, delete the sentence. The body does not count, because a caller does not read it.
A function that keeps more than four facts after the test often does too much. Extract a function before you cut a fact.

## Documentation comments: types, tables, fields, union members

- A type or table comment opens with what one value or row holds. A noun phrase is correct here: "One claim the internal API returned."
- Then state each invariant the names and types cannot express: fields that must agree, a sentinel value such as null or -1 and what it means, a unit, a range, a lifecycle rule.
- A field or union member gets a comment only when no better name can carry its meaning. Put that comment on the member. Do not list the members in the type comment.
- A type whose name and fields say what it holds gets no comment.

## Documentation comments: constants

1. Say what the value controls.
2. Say the limit the value must stay inside, or the failure it prevents.
3. If a smaller or larger value has a known cost, say it in one sentence.

How you found the value stays out. Dated measurements, averages from logs, and values you tried go in the commit message.

## Implementation comments

Write one only when a careful maintainer would otherwise "fix" correct code:

- a workaround for a bug or quirk in another system
- two statements whose order matters, when the order is not obvious
- a regular expression or an algorithm that no name can explain

Put it on the line above the statement it explains. Say why the code is there. Say what the code does only for a regular expression or an algorithm.
If a caller needs the fact to use the function, it goes in the documentation comment.
An ordinary group of steps gets no comment. Extract a named function.
When a literal argument has no clear meaning at the call site, use a named constant or an options object. If you cannot, write `/* name= */ value`.

## TODO comments

A TODO marks code that is temporary or good enough for now.

```ts
// TODO: https://github.com/acme/app/issues/123 - Remove this retry once the
// payer API stops returning 502 on the first call of the day.
```

- After `TODO: `, put the issue link, then ` - `, then the change. With no issue, write the change only.
- Name the event or date that ends it. "Later" and "eventually" are not events.
- Do not name a person or a team as the context.
- The text makes sense without the link.

## File headers

Write one only when a reader uses several declarations in the file together, and the code does not show how they relate. Say how they relate and what does not belong in the file. Do not summarize each function. That detail lives on the function.

## What stays out of a comment

- History. A comment describes the code as it is, not what it used to do or how it changed: "no longer", "previously", "was changed to", "the new version". Put history in the commit message.
- Evidence. Dated measurements, benchmark results, and experiments go in the commit message or the PR description.
- A pointer in place of a rule: "as in the snapshot", "see scripts/evaluate.ts", a ticket, a chat. State the rule. A link may add detail. It never replaces the rule.
- A rule another function owns. Describe the callee's result by its role, such as "the next claims to look up". Do not copy its current filter. The callee's comment owns the filter, and a copy goes false when the filter changes.
- An answer that lives only in code review. When a reviewer asks why, make the code clearer or add the comment. A reply in the review tool does not reach the next reader.

## One fact, one place

- A reason lives once, next to the mechanism it explains. The function that takes the lock explains the lock. A caller names the effect it depends on, not the reason again.
- When a fact lives in a comment and a README, keep the words identical. Two phrasings drift into two claims.
- When a change adds a case, find every comment and doc that lists the cases, and add it.

## Words

- The first sentence of a documentation comment may be a verb phrase or a noun phrase. Every other sentence has a subject and a verb.
- Write sentences of 20 words or fewer, with capital letters and periods. No em dashes. No mannered prose.
- Use plain words. Name the effect in the product, not the mechanism.
  Write "one letter may differ in a word of seven or more letters", not "edit tolerance 0.15".
- Do not use field jargon. If a term has no plain form, define it in the comment.
- Round a number to a plain statement of what was measured against what: "about 4 in 5 new texts", not "> 80%" for 79.6%.

## Syntax

- Write documentation comments in the form the codebase already uses. Look at the documentation comments in neighboring files. A style guide or lint rule in the repo overrides them.
- When the codebase writes `//` above declarations, write `//`. Do not add `/** */`, even in a new file.
- Only when the codebase has no documentation comments yet, write `/** */` in TypeScript or a docstring in Python.
- Write implementation comments as `//` lines, also when they take several lines.
- Add a `@param` or `@returns` tag only when it carries a fact. Never repeat a name or a type.
- Start a list on the line after the sentence that introduces it. Do not put an empty comment line before the first item.

## Reviewing comments

1. Read the code first. A comment that disagrees with the code is the most serious finding.
2. For each finding, give the location, the section of this skill it breaks, and the fix: a rewrite, "delete", or a code change that makes the comment unnecessary.
3. Then give each full rewritten comment.

## Examples

A noun-phrase opener hides what the function does:

```ts
// One row for each claim of the answer that the PCN names, or one row that
// says why there is none.
function convertClaimStatusResultToClaimRows(result: ClaimStatusResult): ClaimRow[]
```

```ts
// Returns table rows for a lookup result:
// - "found": one row per claim Availity matched to the PCN.
// - "unconfirmed": one row per claim that may be the PCN's.
// - Any other result: one row with empty claim columns. Its outcome and
//   detail say why no claim came back.
function convertClaimStatusResultToClaimRows(result: ClaimStatusResult): ClaimRow[]
```

Fragments leave a caller with questions. Here, nothing says when the function returns `"invalid"`:

```ts
// Null unless every line reports it. A partial sum would reach the merge as fact.
function sumAmountsIfFullyReported(amounts: (string | null)[]): number | null | "invalid"
```

```ts
// Sums the amounts in cents.
// - Any amount is missing: returns null. It never returns a partial total.
// - Any amount is not a number: returns "invalid".
function sumAmountsIfFullyReported(amounts: (string | null)[]): number | null | "invalid"
```

A constant comment that tells the history of the value:

```ts
// Measured on 2026-09-12 logs: a page took 2.1s on average and 9s at most,
// so 25 pages finish in about 50s. See scripts/measure-pages.ts.
const PAGES_PER_STEP = 25
```

```ts
// Pages one step reads. A step must finish inside the 60s request limit.
const PAGES_PER_STEP = 25
```

An implementation comment that stops a maintainer from "fixing" the code. A caller gets the right date either way, so the documentation comment does not mention it:

```ts
// Returns the date in a remittance file's MM/DD/YY or MM/DD/YYYY field.
export function parseRemitDate(text: string): Date {
  const [month, day, year] = text.split("/")
  // Some portal exports write a two-digit year, and Date reads "25" as 1925.
  const fullYear = year.length === 2 ? `20${year}` : year
  return new Date(`${fullYear}-${month}-${day}`)
}
```

Union members carry their own comments. `"duplicate"` needs none:

```ts
// Why a payment row was not posted.
type UnpostedReason =
  // The row names no claim we sent.
  | "unknown-claim"
  // The payer paid more than it billed. A refund usually follows, so the row
  // waits.
  | "overpaid"
  | "duplicate"
```

## Check

- Function: does the first sentence start with a third-person verb and say what the caller gets?
- Can a caller write a correct call from the signature and the comment alone?
- Does each later sentence carry a fact the name, signature, or types cannot show?
- Does each implementation comment say why?
- Does the comment hold history, a measurement, or a pointer in place of a rule? Move it or rewrite it.
- If you delete the comment, does the reader lose anything? If not, delete it.
