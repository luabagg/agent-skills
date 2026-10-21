---
name: cognitive-refactor
description: >
  Use when restructuring code so a reader can follow it: a complexity threshold fails, a function is long, nested, or full of else-if branches, a flag parameter or a constant parameter clutters a call, a function or task does two jobs, a result is a sentinel or a bag of answers, or files mix unrelated flows.
---

# Cognitive Refactor

A complexity score counts branches. A reader counts the places they must open to answer one question: functions, files, and conditions they must hold in mind. Refactor to reduce the places. A change that lowers the score and adds places is a regression.

## Control flow

1. Handle each special case first, and return or throw at once. The main path then runs without nesting.
2. When a function picks one of several outcomes, each branch returns its outcome. Do not write `else` or `else if` after a branch that returns.
3. When every branch tests one value, use a `switch` on it. Give a `switch` on a union a `default` that assigns the value to `never`, so a new member fails to compile.
4. Keep nesting to two levels. Deeper code needs a guard clause or an extracted function.
5. Write the positive case: `if (isPosted)`, not `if (!isUnposted)`. Put a long condition in a named boolean first.

```ts
// Wrong: the fee travels through three levels before it returns.
function shippingFeeCents(order: Order): number {
  let fee = 0
  if (order.items.length > 0) {
    if (order.country === "BR") {
      if (order.totalCents < FREE_SHIPPING_MINIMUM_CENTS) {
        fee = DOMESTIC_FEE_CENTS
      }
    } else {
      fee = INTERNATIONAL_FEE_CENTS
    }
  }
  return fee
}

// Right: each case returns where it is decided.
function shippingFeeCents(order: Order): number {
  if (order.items.length === 0) return 0
  if (order.country !== "BR") return INTERNATIONAL_FEE_CENTS
  if (order.totalCents >= FREE_SHIPPING_MINIMUM_CENTS) return 0
  return DOMESTIC_FEE_CENTS
}
```

## One unit, one job

A function, a task, or a module does one job. Two steps of one action are one job: `signInAndSaveSession`.

These are the signs of two jobs:

- The name hides one of the effects, or joins two unrelated effects with "and".
- One job has a risk or a cost the other does not have, such as an email sent, money charged, or an account changed.
- A parameter serves only one field of the result. `loadAvailityClaimStatusPollingCounts(name, since)` returned `{ openNow, cappedSince }`, and only `cappedSince` used `since`. Split it into one count per question.
- A decision and its writes sit in one function.

Split the jobs into units with their own names. Connect them with a call or an event that a reader of the first unit can see. Make the decision a pure function: it takes typed values and returns the outcome. The caller does the writes.

```ts
// Wrong: the export task also deletes files, and its name hides that.
export const nightlyExportTask = inngest.createFunction(
  { id: "nightly-export" },
  { cron: "0 3 * * *" },
  async () => {
    await writeOrdersExport(await loadOrders())
    await deleteExportsOlderThan(EXPORT_RETENTION_DAYS)
  },
)

// Right: each task names its job and fails on its own.
export const exportOrdersNightlyTask = inngest.createFunction(
  { id: "export-orders-nightly" },
  { cron: "0 3 * * *" },
  async () => writeOrdersExport(await loadOrders()),
)
export const deleteExpiredExportsTask = inngest.createFunction(
  { id: "delete-expired-exports" },
  { cron: "0 4 * * *" },
  async () => deleteExportsOlderThan(EXPORT_RETENTION_DAYS),
)
```

## Parameters

- Delete a parameter that always gets the same value. Use the constant inside the function.
- Delete a loop or a collection that models a choice the code never has, such as a loop that always runs once. Add it back when the second case is real.
- Replace a boolean parameter with two functions or with a union of named values: `renderInvoice(invoice, "draft")`, not `renderInvoice(invoice, true)`.
- When a function takes several values that belong together, or several optional values, pass one object and destructure it.

## Extracting functions

- Extract a block when a name can say what it computes, and the caller then reads as steps at one level: load, compute, store. The extracted function takes its inputs and returns its whole result. The block then needs no comment.
- Do not extract when the name only repeats the code, or when the caller must open the helper to know what it returns.
- Do not merge two similar blocks into one helper until they share a rule, not only lines.
- A function over about 40 lines, or nested past two levels, is a signal to look for a step to extract. It is not a limit.

## Loops: split by stage, not by field

A loop that reads several facts from each item stays one loop:

1. One function owns the loop for one stage. It can be the caller, or a function extracted for that stage that returns the whole stage result.
2. A helper inside the loop takes one item, or one item and the running result, and returns the new result. `widenServiceWindow(serviceWindow, row)` is a rule. `findEarliestDate(rows.map(...))` is a hidden loop.
3. When items must be checked before they are used, add one pass per stage: validate, then accumulate. One pass per field is the failure this section exists for.
4. Reach the complexity target by moving branches into per-item helpers. Moving the loop into per-field helpers does not count.

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

Before you extract a helper for a loop, check whether the loop only rebuilds a `Map`, a `Set`, or a grouping that a built-in returns. If it does, delete the loop and the type that describes its shape.

First check the runtime. `Map.groupBy` and `Object.groupBy` need ES2024 in `lib` and Node 21 or later. Read `engines` in `package.json` and `lib` in `tsconfig.json`. If the project cannot use the built-in, keep one short loop at the call site, or use a helper the repo already has.

```ts
// Wrong: 20 lines build a workspace-by-PCN map by hand, with a second Set
// for the PCNs that turned out ambiguous.
export function getUniqueClaimWorkspaceByPcn(claims) {
  const workspaceIdByPcn = new Map<string, string>()
  const ambiguousPcns = new Set<string>()
  for (const claim of claims) {
    // ...
  }
  return { workspaceIdByPcn, ambiguousPcns }
}

// Right, on ES2024: the built-in groups, and the call site reads the rule.
const claimsByPcn = Map.groupBy(claims, (claim) => claim.patientControlNumber)
const matches = claimsByPcn.get(item.itemKey)
if (matches === undefined) return skip(item, "unmatched")
if (matches.length !== 1) return skip(item, "ambiguous")
return match(item, matches[0])
```

Check: look for a deleted function in the diff. If the helper only moved, the loop did not get simpler.

## Contracts: a result type names every outcome

A function that decides something is often written first as `T | null`. A caller learns what `null` means only from the `if` around the call. When there is more than one way to say "no", name every outcome.

```ts
// Wrong: null means "keep it open" only because the one caller reads it that way.
function decideCignaWatchlistItemExpiry(...): { reason: string } | null

// Right: the type names both outcomes. The caller switches on `action`.
type CignaWatchlistItemExpiryDecision =
  | { action: "expire"; reason: string }
  | { action: "keep-open" }
function decideCignaWatchlistItemExpiry(...): CignaWatchlistItemExpiryDecision
```

- Decide on typed values. When the caller holds a typed result, pass it in. Do not decide on a string read back from storage.
- A type states which outcomes exclude each other. A write fulfills the item or expires it, never both. With `never`, a write that sets both does not compile:

  ```ts
  export type WatchlistItemStateWrite = { state: WatchlistItemState } & (
    | { fulfill?: WatchlistItemFulfillment; expire?: never }
    | { expire?: WatchlistItemExpiration; fulfill?: never }
  )
  ```

- A container is a contract too. `Set<CignaWatchlistItemToExpire>` promised no duplicates, but nothing could make one. An array dropped that promise, and the `.size` and `Array.from()` calls it forced at each call site.
- A return value carries every fact the caller acts on. `updateWatchlistItemState` returned `fulfilledReason: string | null`. The caller could not tell a fulfillment from an expiry, or its own write from another actor's. It now returns `{ as: "fulfilled" | "expired"; reason; byOtherActor }`, and the caller's log states all three.

Check: read the call site. If the caller needs a comment to know what a value of the result means, the contract is still a sentinel.

## Files and folders

- A file holds one flow or one concept. The flow's private helpers stay in its file.
- A flow lives in the module whose data it changes. Rendering an invoice PDF lives in `billing/`, not in `email/`, even when the email module sends it.
- Add a file only when two modules share code, or when one file holds two flows. Each new file is one more place to open.

## Rationalizations

| Excuse | Reality |
| --- | --- |
| "N passes are negligible for a handful of rows" | Cost is not the objection. The reader now reassembles one row from N functions. |
| "Each helper owns its loop and guards" | A helper that takes the collection for one field hides a loop. A helper that takes one item names a rule. |
| "Extracted unchanged, so equivalence checks by inspection" | Inspection now spans N functions and N argument lists. |
| "The hand-rolled map is one small function" | The reader still opens it to learn that the language already groups. |
| "It returns null today, and the caller already handles it" | A second caller cannot tell "not decided" from "decided no". |
| "The else makes both branches explicit" | A branch that returns already ends. The `else` only adds a level. |
| "Keeping both jobs in one task avoids a second schedule" | The reader of the first job does not know the second one runs. |
| "The parameter keeps it flexible for later" | It models a choice nobody makes. Add it when the second case is real. |

## Red flags

- `else` or `else if` after a branch that returns.
- Code nested past two levels.
- A `switch` on a union without a `never` check in `default`.
- `helper(rows.map((row) => row.x))` to compute one field.
- A hand-rolled `Map` or `Set` loop where a built-in the runtime supports would do.
- A decision function that returns `T | null` where `null` means more than "absent".
- A decision made on a string read back from storage while the typed value is in hand.
- A name that hides one of its effects.
- A parameter that always gets the same value, or a loop that always runs once.
- A boolean parameter.
- A write type whose optional fields can all be set, when the domain allows only one.
- A parameter that only one field of the result uses.

For names, use `code-naming`. For comments on the result, use `code-comments`.
