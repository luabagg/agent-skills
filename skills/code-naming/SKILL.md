---
name: code-naming
description: >
  Use when naming or renaming TypeScript code: an export, a public API or barrel file, a type, an API request or response type, a function, a variable, a boolean flag, a result field, a constant, or a file. Also use when asked to propose better names, or when a proposed rename only adds a word to the old name.
---

# Code Naming

A name is read in imports, calls, conditions, and log lines. The definition, the file path, and the comment are not there. The name alone must tell the reader what they need to know at that line.

A good name is clear: the reader knows what it refers to. It is also precise: the reader knows what it does not refer to. It is long enough to say both at the place it is read, and no longer.

## Find a name

1. Describe the thing in one sentence, using the product's words. Include what it is or does, who did it, and what it is compared against, but only the parts the reader acts on.
   Example: "Someone other than this call signed in and saved this session."
   - The sentence says what happens, not how. How the code decides, and which items it picks today, go in a comment. See `code-comments`.
   - If you need two sentences, the code answers two questions. Split it before you name it. The sign: a result with two fields, and a parameter that only one of them uses.
   - Two steps of one action still fit in one sentence: `signInAndSaveSession`.
2. Write the line where the name is read. For an export, write the call without the import path. For a field, write it after its container. For a boolean, write the `if`.
   Example: a function returns a signed-in session, and we are naming its boolean field:
   ```ts
   const session = await getSignedInSession(login)
   if (session.___)
   ```
3. Compare the sentence with the line. Whatever the sentence says that the line doesn't is what the name has to add.
   Example: `session` already covers "this session". What's still missing is "saved by someone other than this call", so the field is `savedByOtherActor`.
4. Look for words the product or the codebase already uses: a UI label, a type, a union member, a reason code, a log line, a CLI flag, a README. A reader recognizes those and can search for them. A new word is fine when none of them fits.
   - Search the codebase for each word. If it already names a different thing, pick another word, even for a verb. See "Words that mean two things".
   - Use one word for one idea. If the module says "result", do not name the same thing "read".
   - Prefer the word a person sees in the product to the word for the mechanism: "wait time", not "cooldown". A library term is the last choice: `hasUnsavedChanges`, not `isDirty`.

### Example

Naming the boolean field on a payer login that says the payer suspended it.

Sentence: "The payer suspended this login."
Line: `if (login.___)`

| Candidate             | Fails because                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `active`              | It is true for the usual case, so the caller writes `if (!login.active)`. Make the flag true for the case the caller branches on. |
| `loginSuspended`      | It repeats the container.                                                                                                         |
| `blocked`             | It coins a word where the codebase already says "suspended".                                                                      |
| `suspendedByAvaility` | It is narrower than the fact. It ties a field that every payer's login has to one payer.                                          |
| `suspended`           | It leaves out who, when our own code can also suspend a login.                                                                    |
| `suspendedByPayer`    | Passes.                                                                                                                           |

## What a name carries

A name carries each fact the reader needs at the place it is read, and only those facts.

Put these in the name:

- what the function returns, or what the type or flag is
- a side effect the caller has to know about, when the verb doesn't already say it. A caller has to know when the effect changes what it can safely do: call twice, retry, skip in a dry run, run in a request. `signIn()` hides that it saves a session, so the name is `signInAndSaveSession()`. `deleteLogin()` already says it deletes, so it needs nothing more.
- the source or the target, when the place of use does not show it

Leave these out:

- what the place of use already says: the container, the parameter type, the module, the file path
- the rule that picks the items today, the order, and the edge cases. Name the role of the result. The comment holds the rule.
- the mechanism: the library call, the SQL clause, the data structure
- the type: `holidays`, not `holidayDateList`. A unit is not a type: `timeoutMs`, `widthInPixels`.
- effects only the function cares about: logging, metrics, a cache it fills and reads itself.

When you cannot decide whether a fact is missing, choose the longer name. A name that is too long costs one line. A name that misses a fact costs each reader a trip into the body.

| Name                                  | Problem                                                                    | Better                   |
| ------------------------------------- | -------------------------------------------------------------------------- | ------------------------ |
| `loadOpenUnpaidClaimsOlderThan30Days` | It spells out today's filter. The name goes false when the filter changes. | `loadClaimsToFollowUp`   |
| `hasPostedAtSet(payment)`             | It names the column the code reads. The page says "Posted".                | `isPosted(payment)`      |
| `signIn()`                            | It hides that it writes a session.                                         | `signInAndSaveSession()` |

When the code decides a label that the product shows, such as a status or an outcome, use that label's word. Do not add how the code decides it. If the page shows "Posted", the function is `isPosted`.

## Length follows scope

- An export, a type, or a field is read far from its definition. Its name carries every fact from "What a name carries".
- A local can be short when the reader sees where it is set and every use on one screen: `row` in a five-line loop, `err` in a `catch`.
- A local in a long function, or one used far from where it is set, is read like a field. Name it in full: `signedInSession`, not `result`.

## Exports

The exports of a module are its API contract. A reader of the call site must understand what an export does and returns without opening it.

1. Read every caller before you name an export. If every caller calls the same exports in the same order, they are one operation. Export one function that returns one result. A query on that result becomes a field of it: `isExpired(session)` becomes `session.expired`.
2. Put the complete action in the name. Stack verbs and objects when one verb is not enough: `lookUpAndStoreClaimStatuses`.
3. Do not shorten a name by removing a fact: the service, the product, the source, the target, the side effect. Do not remove a word because an argument at one call site repeats it. Imports, stack traces, and other call sites do not show that argument.
4. Count facts, not words. A word from the file path or the parameter type adds no fact. For each rename, write the question the new name answers that the old name left open. If you cannot write it, the rename failed.
5. Use one verb for one operation across the module. Do not use `load`, `fetch`, and `get` for the same operation. When the module already uses a verb for this operation, keep that verb and change only the facts after it: `loadFailedRunCountSince` beside `loadRunStats`, not `countFailedRunsSince`.
6. When a convention or a lint rule fixes an entrance file name (`index.ts`, `client.ts`), keep the name. State what the file guarantees in its header comment.
7. Before you export a new name, show the user the name at its call site. Offer alternatives when the first name needs a comment to be understood.

| Name                  | At the call site                           | Problem                                                             | Better                                              |
| --------------------- | ------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------- |
| `checkClaims(claims)` | `const result = await checkClaims(claims)` | Checks what, against what, and returns what?                        | `lookUpClaimStatusForClaims(claims)`                |
| `isUnchanged(diff)`   | `if (isUnchanged(diff))`                   | Unchanged against what? Every caller calls it right after the diff. | A field of the diff result: `diff.matchesCheckedIn` |

## Types and fields

- A type is named by what it is.
- A type's plurality matches what one instance holds. `CignaWatchlistItemsToExpire` described one item. The plural read as a list.
- A field completes its container and does not repeat it: `session.savedByOtherActor`, not `session.sessionSavedByOtherActor`.
- The fields of a write type are the actions the write does: `fulfill`, `expire`. `fulfillment` names a record, not an action.
- Name the types of one API endpoint `<name>Request` and `<name>Response`. The request is what we send. The response is what the other system answers. Use this pair for every endpoint in the module. Do not mix in `Params`, `Input`, `Result`, or a bare name.
- A prefix such as the service name goes on every type of the module, or on none. Follow what the module already does.
- A constant is named by its role, not its value: `MAX_LOOKUPS_PER_STEP`, not `TEN`. It uses the format word the codebase already uses. An expired reason is `<code>: <detail>`, so the constant is `REREAD_CAP_EXPIRED_REASON_CODE`, not `REREAD_CAP_REASON_PREFIX`.

## Files

- A file name says what the file holds. Use the word a person searches for: the product's or the page's word.
- A file that wraps an external endpoint keeps the endpoint's word and adds the product word in front. The Stripe transfers endpoint behind the Payouts page is `payouts-transfers.ts`.
- Follow the case style the project uses for file names.

## Functions by role

- A function is named by what it does, not by when it runs. `handleUpload` and `onSync` name the trigger. Name the effect: `storeFileAndQueueVirusScan`.
- In React, a component's event handler keeps the convention: the prop is `onSubmit`, and the local function is `handleSubmit`.
- A boolean is true for the case the caller branches on, so the caller never writes `!flag`.

## Spelling

- Write an acronym as one word: `loadHttpUrl`, `parseJsonBody`. Keep the platform's spelling only when an API requires it: `XMLHttpRequest`.
- Do not use an abbreviation a reader outside the project would not know. Do not drop letters from a word.
- These words name no fact. Do not use them as a name or as the noun of a name: `data`, `info`, `item`, `entry`, `result`, `value`, `state`, `evidence`, `manager`, `helper`, `util`, `process`, `handle`. Use what the thing is.

## Words that mean two things

1. List the words that mean two things in the module. Example: "claim" is the payer's printed entry on an EOP and also our submitted claim record. "Sync" can be the act of syncing and also a stored sync record.
2. Whichever meaning the codebase already uses on its own keeps the plain word, like `claimId` for our claim. The other meaning always gets its owner in front: `eopClaimRow`, `derivedEopClaims`.
   When the two meanings are a noun and a verb, avoid the word in new names altogether. If "sync" already names a stored record, a new function shouldn't "sync" anything. It "copies" or "pulls" instead. Older names can keep the word until someone gets around to renaming them.
3. When the double meaning comes from a table or type you can still rename, propose that rename. Every name built on it inherits the confusion.
4. A name for a relation names both ends and puts a word between them: `EopToClaimMatch`, `linksFromDocumentToRecord`, `rowsPayingClaim`. Read the name as one compound noun. `EopClaimMatch` reads as "(EOP claim) match", so it fails. `EopToClaimMatch` cannot be read that way, so it passes.

A field inside the type cannot repair the type's name. The name appears without its fields in imports and signatures.

## Rationalizations

| Excuse                                           | Reality                                                                                   |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| "The longer name is more exact"                  | Count facts. A filter, an order, or a mechanism in the name is a fact for the comment.    |
| "The name must say how it decides"               | The caller needs what it decides. The comment says how.                                   |
| "The argument at the call site already says it"  | Imports, stack traces, and other call sites do not show the argument.                     |
| "The current name is fine, keep it"              | Write the sentence from step 1. If the call does not say all of it, the name is not fine. |
| "The current name is the product's word"         | Keep it. If it misses a fact, flag that to the user.                                      |
| "The comment explains the flag"                  | The `if` and the log line do not show the comment.                                        |
| "A new word is clearer than the codebase's word" | A reader cannot search for a word only your name uses.                                    |

## Red flags

- A word in the name appears nowhere else in the codebase or the product.
- A word in the name already names a different thing in the module, as a verb or as a noun.
- The name lists a filter, an order, a condition, or a constant value: `WithoutInvoiceYet`, `SortedByDueDate`, `OlderThan30Days`, `retryThreeTimes`.
- The name uses a library or database term where the product has a word.
- The rename keeps the verb and adds a noun from the file path or the type.
- The rename is shorter because it removed the service, the product, the source, or the target.
- The caller reads a boolean as `!flag`.
- A field name repeats what its container already says.
- A short local name used across a long function.
- Every caller calls one export right after another export.
- A relation name reads as one compound noun.
- A plural type name whose fields describe one instance.
