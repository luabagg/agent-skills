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
Most code needs neither. First try to make the code say it. Use a better name (see `code-naming`), extract a function, or return a typed result in place of a sentinel. Comment only what is left.

## When to write a documentation comment

- **If the name and signature already say it all, write no comment.** For a type, that means its name and fields.
- **Exports get one by default.** Their callers live in other files and read only the import and the signature. Leave an export without one only when the rule above clearly holds.

## Documentation comments: functions

1. The first sentence says what the caller gets or what the function changes. Start it with a third-person verb: "Returns…", "Looks up… and stores…". Do not start with an imperative ("Return…") or a noun phrase ("One row for each…"). Keep it to one fact.
2. Then list the other facts a caller needs, one bullet each. Each bullet is a fact about the behavior, not a step of the body and not something the signature already says. A surprising null, error, side effect, or cost often qualifies.
   ```ts
   // Uses spare potatoes to raise demand across workforces.
   // - Only potatoes older than a week count as spare.
   // - A workforce with no stock gets nothing.
   ```
   Not: "- Takes the input", "- Catches exceptions", "- Returns the potato count".
3. Stop. Do not say how the body does its work. The body can change while the contract stays the same.

Then test each sentence after the first. If the name, the parameter names, or the types already say it, delete the sentence. The body does not count, because a caller does not read it.
A function that keeps more than four facts after the test often does too much. Extract a function before you cut a fact.

## Documentation comments: types, tables, fields, union members

- Open with what one value or row holds: "One claim the internal API returned." Then add what the names and types can't say: fields that must agree, what null or -1 means, a unit, a range, a lifecycle rule.
- Comment a field or union member only when a better name can't carry its meaning. Put the comment on the member, not in a list on the type.
- When the members only make sense together, like the methods of one interface, write one comment on the type instead.

## Documentation comments: constants

1. Say what the value controls.
2. Say the limit the value must stay inside, or the failure it prevents.
3. If a smaller or larger value has a known cost, say it in one sentence.

## Implementation comments

Write one only when a careful maintainer would otherwise "fix" correct code: a workaround for another system's quirk, an order that matters but isn't obvious, or a regular expression or algorithm no name can explain.

- Put it on the line above the statement and say why the code is there.
- Keep it to one line. If it needs several, the code is probably the problem: rename, extract a function, or use a named constant first.
- A fact a caller needs goes in the documentation comment instead.
- A literal argument with no clear meaning at the call site becomes a named constant or an options object. If it can't, write `/* name= */ value`.

## TODO comments

A TODO marks code that is temporary or good enough for now.

```ts
// TODO: https://github.com/acme/app/issues/123 - Remove this retry once the
// payer API stops returning 502 on the first call of the day.
```

- After `TODO: `, put the issue link, then `-`, then the change. With no issue, write the change only.
- Name the event or date that ends it. "Later" and "eventually" are not events.
- Do not name a person or a team as the context.
- The text makes sense without the link.

## File headers

Write one only when a reader uses several declarations in the file together, and the code does not show how they relate. Say how they relate and what does not belong in the file. Do not summarize each function. That detail lives on the function.

## What stays out of a comment

- History. A comment describes the code as it is, not what it used to do or how it changed: "no longer", "previously", "was changed to", "the new version". Put history in the commit message.
- Evidence. How you found a value, dated measurements, averages from logs, benchmark results, and values you tried go in the commit message or the PR description.
- External references: a ticket, a chat, a URL, another file, "as in the snapshot". Add one only when the reader really needs it, and state the rule in the comment anyway. A link may add detail. It never replaces the rule.
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

### A noun phrase hides what the function does

Bad:

```ts
// One line for each item of the order, or one line that says why there is none.
function buildInvoiceLines(order: Order): InvoiceLine[]
```

Good:

```ts
// Returns the invoice lines for an order.
// - Each item gets its own line.
// - An order with no items gets one line whose note says why.
function buildInvoiceLines(order: Order): InvoiceLine[]
```

### Fragments leave the caller guessing

Bad, since nothing says when it returns `"invalid"`:

```ts
// Null unless every price is there.
function sumPricesInCents(prices: (string | null)[]): number | null | "invalid"
```

Good:

```ts
// Returns the total of the prices, in cents.
// - A missing price makes it return null, never a partial total.
// - A price that is not a number makes it return "invalid".
function sumPricesInCents(prices: (string | null)[]): number | null | "invalid"
```

### A constant comment that tells its history

Bad:

```ts
// Measured on 2026-09-12: a page took 2.1s on average, so 25 pages finish in
// about 50s. See scripts/measure-pages.ts.
const PAGES_PER_STEP = 25
```

Good:

```ts
// One step must finish inside the 60s request limit.
const PAGES_PER_STEP = 25
```

### An implementation comment that stops a "fix"

A caller gets the right date either way, so the documentation comment leaves it out:

```ts
// Returns the date in a MM/DD/YY or MM/DD/YYYY field.
export function parseShortDate(text: string): Date {
  const [month, day, year] = text.split("/")
  // Date reads a two-digit year like "25" as 1925.
  const fullYear = year.length === 2 ? `20${year}` : year
  return new Date(`${fullYear}-${month}-${day}`)
}
```

### Comment only the member whose name leaves something out

Every name here says enough except `"payment-pending"`, which doesn't tell you the order ships by itself:

```ts
type UnshippedReason =
  | "bad-address"
  | "out-of-stock"
  // Ships automatically when the payment clears. Don't retry the shipment.
  | "payment-pending"
```

### Members that only make sense together

```ts
// Holds the cart between visits. Changes made by one tab show up in the others.
export interface CartStore {
  load(): Cart
  save(cart: Cart): void
}
```

## Check

- Function: does the first sentence start with a third-person verb and say what the caller gets?
- Can a caller write a correct call from the signature and the comment alone?
- Does each later sentence carry a fact the name, signature, or types cannot show?
- Does each implementation comment say why?
- Does the comment hold history, a measurement, or a pointer in place of a rule? Move it or rewrite it.
- If you delete the comment, does the reader lose anything? If not, delete it.
