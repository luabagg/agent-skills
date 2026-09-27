---
name: cognitive-refactor
description: >
  Use when restructuring code so a reader can follow it: a cognitive or cyclomatic complexity threshold fails, a long function or loop needs helpers extracted, a function returns a sentinel or a bag of unrelated answers, or a module written quickly needs clear contracts.
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

## Loops: a built-in beats a hand-rolled accumulator

Before extracting a helper for a loop, check whether the loop only rebuilds a `Map`, `Set`, or grouping that a built-in already returns. When it does, delete the loop and the type that describes its shape. Keeping the helper does not make the code simpler. It adds one more place to open for a fact the language already tracks.

```ts
// Wrong: 20 lines walk `claims` by hand to build a workspace-by-PCN map,
// with a second Set to remember which PCNs turned out ambiguous.
export function getUniqueClaimWorkspaceByPcn(claims) {
  const workspaceIdByPcn = new Map<string, string>()
  const ambiguousPcns = new Set<string>()
  for (const claim of claims) {
    // ...
  }
  return { workspaceIdByPcn, ambiguousPcns }
}

// Right: the built-in groups; the call site reads the invariant directly
// and no exported type describes the group-by result.
const claimsByPcn = Map.groupBy(claims, (claim) => claim.patientControlNumber)
const matches = claimsByPcn.get(item.itemKey)
if (matches == null) {
  // unmatched
} else if (matches.length !== 1) {
  // ambiguous
}
```

Check: grep the diff for a deleted function. A real simplification removes the hand-rolled helper; if it only moved, the loop did not get simpler.

## Contracts: a result type names every outcome

A function that decides something is often written first as `T | null`, and a caller learns what `null` means only by reading the `if` around the call. Once there is more than one way to say "no," or a second caller might exist, name every outcome instead of overloading the absent value.

```ts
// Wrong: null means "keep it open" only because the one caller checks it
// that way today. A second caller cannot tell null from "not decided yet".
function decideCignaWatchlistItemExpiry(...): { reason: string } | null

// Right: the return type states both outcomes, and the function name asks
// the question the type answers.
type CignaWatchlistItemDecision =
  | { result: "expire"; reason: string }
  | { result: "keep-opened" }
function shouldExpireCignaWatchlistItem(...): CignaWatchlistItemDecision
```

A container is a contract too. `Set<CignaWatchlistItemToExpire>` promised deduplication that nothing produced duplicates to need; switching to `CignaWatchlistItemToExpire[]` dropped the promise along with the `.size` and `Array.from()` calls it forced at every call site.

A type states which outcomes exclude each other. A write fulfills the item or expires it, never both. With `never`, a write that sets both does not compile.

```ts
export type WatchlistItemStateWrite = { state: WatchlistItemState } & (
  | { fulfill?: WatchlistItemFulfillment; expire?: never }
  | { expire?: WatchlistItemExpiration; fulfill?: never }
)
```

A return value carries every fact the caller acts on. `updateWatchlistItemState` returned `fulfilledReason: string | null`. The caller could not tell a fulfillment from an expiry, or its own write from another actor's write. It now returns `{ as: "fulfilled" | "expired"; reason; byOtherActor }`, and the caller's log states all three.

One function answers one question. `loadAvailityClaimStatusPollingCounts(name, since)` returned `{ openNow, cappedSince }`, and only `cappedSince` used `since`. When a parameter serves only one field of the result, split the function: one count per question.

Check: rename the function to a yes/no question (`should...`, `is...`, `can...`). If the current return type cannot answer that question without a comment at the call site, the contract is still a sentinel.

## Rationalizations

| Excuse | Reality |
| --- | --- |
| "N passes are negligible for a handful of rows" | Cost is not the objection. The reader now reassembles one row from N functions. |
| "Each helper owns its loop and guards" | A helper that takes the collection hides a loop. A helper that takes one item names a rule. |
| "Extracted unchanged, so equivalence checks by inspection" | Inspection now spans N functions and N argument lists. |
| "The hand-rolled map/set is one small function" | The reader still has to open it to learn the language already does that grouping. |
| "It returns null today, and the caller already handles it" | A second caller cannot tell "not decided" from "decided no." |

## Red flags

- `helper(rows.map((row) => row.x))` to compute one field.
- The main function has no loop and the file has four.
- A hand-rolled `Map`/`Set` builder loop where `Map.groupBy`, `Object.groupBy`, or a `Set` constructor would do.
- A decision function returning `T | null` where `null` carries meaning beyond absence.
- A write type whose optional fields can all be set, when the domain allows only one.
- A parameter that only one field of the result uses.

For names, use `code-naming`. For comments on the result, use `code-comments`.
