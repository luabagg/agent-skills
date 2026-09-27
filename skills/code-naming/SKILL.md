---
name: code-naming
description: >
  Use when naming or renaming TypeScript code: an export, a public API or barrel file, a type, a function, a variable, a boolean flag, a result field, or a constant. Also use when asked to propose better names, or when a proposed rename only adds a word to the old name.
---

# Code Naming

A name is read where it is used: in an import, a call, an `if`, a log line. The definition, the file path, and the comment are not there. Choose the name for that place.

## Find a name

1. Write the complete fact as one sentence in the product's words. Say what happened, who did it, and relative to what, when the reader acts on each part.
   "Someone other than this call fulfilled or expired the item."
   If the sentence holds two separate answers, the function answers two questions. Split it with `cognitive-refactor` before you name it. The sign: a result with two fields, and a parameter that only one field uses. Two steps of one action are one answer: `signInAndSaveSession`.
2. Write the line where the name is read. For an export, write the call without the import path. For a field, write it after its container. For a boolean, write the `if`.
   `if (fulfilledOrExpired.___)`
3. The name is the part of the sentence that the line does not say yet. The container says "fulfilled or expired". The rest is "by someone other than this call": `byOtherActor`.
4. Take each word from the codebase: a type, a union member, a reason code, a log line, a CLI flag, a README. Use one word for one idea. If the module says "result", do not name the same thing "read". When the codebase has two words for one idea, use the one that names the effect a person sees, not the mechanism: "wait time", not "cooldown".
5. Put each candidate on the line from step 2. Compare the line with the sentence from step 1.

| Candidate | Fails because |
| --- | --- |
| `byThisCall` | It is true for the usual case, so the caller writes `if (!fulfilledOrExpired.byThisCall)`. Make the flag true for the case the caller branches on. |
| `wasAlready` | It is incomplete. Already what, and by whom? |
| `alreadyClosed` | It repeats the container: "closed" means "fulfilled or expired". Only "already" is new, and it says when, not who. |
| `expiredByOtherAgent` | It is narrower than the fact. It leaves out fulfillment, and "agent" leaves out a person or a script. |
| `beforeThisCall` | It says when. The reader asks who. |
| `byOtherActor` | Passes. "Actor" covers an earlier run, a person, and a script. |

The log line then says the same fact in the same words: `` `was already ${fulfilledOrExpired.as} by another actor` ``.

## Length follows scope

A name carries the facts the reader cannot see from where they read it.

- An export, a type, or a field is read far from its definition. Its name carries every fact.
- A local can be short when the reader sees where it is set and every use on one screen, in a small function or block: `row` in a five-line loop, `err` in a `catch`.
- A local in a long function, or one used many times far from where it is set, is read like a field. Name it in full: `fulfilledOrExpired`, not `result`.

## Exports

The exports of a module are its API contract. A reader of the call site must understand what an export does and returns without opening it. Name every exported function, type, and constant for that reader.

1. Read every caller before you name an export. If every caller calls the same exports in the same order, they are one operation. Export one function that returns one result. A query on that result becomes a field of it: `isExpired(session)` becomes `session.expired`.
2. Put the complete action in the name. Stack verbs and objects when one verb is not enough.
3. Say what a function returns, what a type describes, and what a flag means.
4. Prefer a long, exact name over a short one that needs the comment or the body. Length is not a cost. A missing fact is.
5. Do not shorten a name by removing a fact: the service, the product, the source, the target, the side effect. Do not remove a word because an argument at one call site repeats it. Imports, stack traces, and other call sites do not show that argument.
6. Count facts, not words. `build`, `make`, `map`, `process`, `handle`, `format`, `compute`, and `get` name an operation on data, not a fact. Use the rule the function applies (`merge`, `resolve`, `choose`) and the result the caller receives. A word from the file path or the parameter type is one the reader already has. For each rename, write the question the new name answers that the old name left open. If you cannot write it, the rename failed.
7. Use one word for one idea across all exports of a module. Do not use `load`, `fetch`, and `get` for the same operation. When the module already uses a verb for this operation, keep that verb and add the missing facts after it: `loadFailedRunCountSince` beside `loadRunStats`, not `countFailedRunsSince`.
8. When a convention or a lint rule fixes an entrance file name (`index.ts`, `client.ts`), keep the name. State what the file guarantees in its header comment.
9. Before you export a new name, show the user the name at its call site. Offer alternatives when the first name needs a comment to be understood.

Read each name at its call site. If the sentence is incomplete, the name is incomplete.

| Name | At the call site | Problem | Better |
| --- | --- | --- | --- |
| `signIn()` | `await signIn()` | Hides that it writes a session. | `signInAndSaveSession()` |
| `checkClaims(claims)` | `const result = await checkClaims(claims)` | Checks what, against what, and returns what? | `lookUpClaimStatusForClaims(claims)` |
| `isUnchanged(diff)` | `if (isUnchanged(diff))` | Unchanged against what? Every caller calls it right after the diff. | A field of the diff result: `diff.matchesCheckedIn` |
| `loadAvailityClaimStatusPollingCounts(name, since)` | `if (polling.cappedSince > 0)` | Two answers in one call, and only `cappedSince` uses `since`. "Capped" names the mechanism, not what happened. | `loadAvailityClaimStatusStillPollingCount(name)` and `loadAvailityClaimStatusGaveUpCount(name, since)` |

## Types and fields

- A type is named by what it is. `evidence`, `info`, `data`, `item`, `entry`, and `result` are not what it is.
- A type's plurality matches what one instance holds. `CignaWatchlistItemsToExpire` described one item. The plural read as a list.
- A field completes its container and does not repeat it: `fulfilledOrExpired.as`, `fulfilledOrExpired.byOtherActor`.
- The fields of a write type are the actions the write does: `fulfill`, `expire`. `fulfillment` names a record, not an action.
- A constant uses the format word the codebase already uses. An expired reason is `<code>: <detail>`, so the constant is `REREAD_CAP_EXPIRED_REASON_CODE`, not `REREAD_CAP_REASON_PREFIX`.

## Words that mean two things

1. List the words that mean two things in the module. Example: "claim" is the payer's printed entry on an EOP and also our submitted claim record.
2. The side the codebase already writes bare keeps the bare word (`claimId`). The other side carries its owner in every name (`eopClaimRow`, `derivedEopClaims`).
3. A name for a relation names both ends and puts a word between them: `EopToClaimMatch`, `linksFromDocumentToRecord`, `rowsPayingClaim`. Read the name as one compound noun. `EopClaimMatch` reads as "(EOP claim) match", so it fails. `EopToClaimMatch` cannot be read that way, so it passes.

A field inside the type cannot repair the type's name. The name appears without its fields in imports and signatures.

## Rationalizations

| Excuse | Reality |
| --- | --- |
| "The name is too long" | A long name costs one line. A missing fact costs each reader a trip into the body. |
| "The argument at the call site already says it" | Imports, stack traces, and other call sites do not show the argument. |
| "The new name is more specific" | Count facts, not words. A word from the file path or the type adds no fact. |
| "It matches the pattern the module already uses" | A pattern of operation verbs is still operation verbs. Fix the name first. |
| "The current name is fine, keep it" | Write the sentence from step 1. If the call does not say all of it, the name is not fine. |
| "The comment explains the flag" | The `if` and the log line do not show the comment. |
| "The field inside the type blocks the double reading" | The type name appears without its fields in every import and signature. |
| "Bare 'claim' is ours everywhere else" | True. So the other side carries the qualifier, and the relation name separates the two. |

## Red flags

- The rename keeps the verb and adds a noun from the file path or the type.
- The rename is shorter because it removed the service, the product, the source, or the target.
- The caller reads a boolean as `!flag`.
- A field name repeats what its container already says.
- A short local name used across a long function.
- Every caller calls one export right after another export.
- A name uses `evidence`, `info`, `data`, `item`, `helper`, or `util`.
- A relation name reads as one compound noun.
- A plural type name whose fields describe one instance.

## Check

Close the definition. Read each name on the line where it is used. Say the sentence from step 1. If the line does not say it, rename.

For the structure around the name, use `cognitive-refactor`. For a comment next to it, use `code-comments`.
