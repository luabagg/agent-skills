---
name: cognitive-refactor
description: >
  Use when restructuring code so a reader can follow it: a cognitive or cyclomatic complexity threshold fails, a long function or loop needs helpers extracted, a type, module, or function must be named where one domain word means two things, or a module written quickly needs clear contracts.
---

# Cognitive Refactor

A complexity score counts branches. A reader counts the places they must open to answer one question. Refactor to reduce the places. A change that lowers the score and raises the places is a regression.

## Loops: split by stage, not by field

A loop that reads several facts from each item stays one loop. The shape of the result:

1. The function that owns the result owns the loop.
2. A helper takes one item, or one item and the running result, and returns the new result. `widenServiceWindow(serviceWindow, row)` is a rule. `findEarliestDate(rows.map(...))` is a hidden loop.
3. When items must be checked before they are used, add one pass per stage: validate, then accumulate. Two passes by stage. One pass per field is the failure this section exists for.
4. Reach the complexity target by moving branches into per-item helpers. Moving the loop into helpers does not count.

```ts
// Wrong shape: one pass per field. A reader follows one row through six functions.
const billed = sumCents(rows.map((row) => row.billedAmount))
const paid = sumCents(rows.map((row) => row.paidAmount))
const serviceWindow = getServiceWindow(rows)
const claimNumbers = collectDistinct(rows.map((row) => row.claimNumber))

// Right shape: one pass to validate, one pass to accumulate, helpers per row.
const rowMissingMoney = rows.find(isMissingMoney)
if (rowMissingMoney) {
  return { ok: false, reason: "missing-money" }
}
let totals = EMPTY_TOTALS
let serviceWindow = EMPTY_WINDOW
const claimNumbers = new Set<string>()
for (const row of rows) {
  totals = addRowMoney(totals, row)
  serviceWindow = widenServiceWindow(serviceWindow, row)
  addIfPresent(claimNumbers, row.claimNumber)
}
```

Check: pick one item and count the functions a reader opens to learn what happens to it. The loop and the helpers it calls fit on one screen.

## Names: a relation names both ends

1. List the words that mean two things in the module. Example: "claim" is the payer's printed entry on an EOP and also our submitted claim record.
2. The side the codebase already writes bare keeps the bare word (`claimId`). The other side carries its owner in every name (`eopClaimRow`, `derivedEopClaims`).
3. A name for a relation between two things names both ends and puts a word between them: `EopToClaimMatch`, `linksFromDocumentToRecord`, `rowsPayingClaim`. Test: read the name as one compound noun. `EopClaimMatch` reads as "(EOP claim) match", so it fails. `EopToClaimMatch` cannot be read that way, so it passes.
4. A type is named by what it is. `evidence`, `info`, `data`, `item`, `entry`, `result` are not what it is.

The name is read in imports, signatures, and log lines, where its fields are not visible. A field inside the type cannot repair the type's name.

## Rationalizations

| Excuse | Reality |
| --- | --- |
| "N passes are negligible for a handful of rows" | Cost is not the objection. The reader now reassembles one row from N functions. |
| "Each helper owns its loop and guards" | A helper that takes the collection hides a loop. A helper that takes one item names a rule. |
| "Extracted unchanged, so equivalence checks by inspection" | Inspection now spans N functions and N argument lists. |
| "The field inside the type blocks the double reading" | The type name appears without its fields in every import and signature. |
| "Bare 'claim' is ours everywhere else" | True. So the other side carries the qualifier, and the relation name separates the two. |

## Red flags

- `helper(rows.map((row) => row.x))` to compute one field.
- The main function has no loop and the file has four.
- A type name that relates two things and still reads as one compound noun.
- A module, type, or function named with `evidence`, `info`, `data`, `item`, `helper`, or `util`.

For comments on the result, use `code-comments`.
