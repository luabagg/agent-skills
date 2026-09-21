---
name: testing-business-rules
description: >
  Use when adding, reviewing, or deleting tests, deciding whether a function needs coverage, or when a suite enumerates branches, signs, empty values, or implementation steps without naming the behavior at risk.
---

# Testing Business Rules

A test earns its place by protecting a meaningful behavior or contract, not by demonstrating today's implementation. A rule can be a product decision, a technical guarantee, or a consumer expectation.

## Quick reference

| Keep coverage for | Reject or reshape |
| --- | --- |
| Domain behavior, API/provider contracts, numeric or ordering guarantees | Assertions that merely restate the implementation |
| Validation, authorization, privacy, data integrity | Input permutations with no distinct risk |
| Idempotency, retries, discard policies, persistence and queue integration | Private helper calls or incidental call order |
| Observed regressions, including obvious mistakes | Duplicate coverage with no additional failure detection |
| Boundaries with a named consequence | Snapshots that freeze incidental output |

Currency rounding can be a contract even when it uses simple arithmetic. Coverage metrics reveal gaps; they do not justify tests.

## Procedure

### 1. Name the rule before writing the test

Record these in the test plan or review, not as boilerplate comments:

```text
Rule: an empty tenant ID must never grant access to another tenant's records.
Established in: tenant-isolation security contract.
Failure: a caller reads another tenant's private records.
```

Find evidence in requirements, API documentation, callers, history, or incidents, not current output alone. Missing evidence requires investigation with owners and consumers, not coverage removal. Temporary characterization tests can support legacy refactoring; label unconfirmed assumptions instead of declaring permanent contracts.

### 2. Find the coverage gap

Identify the wrong behavior this test would catch. Compare failure modes, not lines executed: happy-path coverage does not cover an authorization bypass.

Keep regressions that protect valid rules and add detection, including obvious mistakes, manually detectable bugs, and bad decisions.

### 3. Choose the smallest honest boundary

Use a public function or module for local rules. Use focused integration tests for collaboration, serialization, persistence, or queue guarantees. Use route/full-flow tests for behavior smaller tests cannot establish.

Prefer fast, deterministic real dependencies. Use a maintained fake when real dependencies are costly or unavailable; use stubs or mocks for controlled responses or contract-relevant interactions. Double at the existing dependency seam. Internal versus external is not the deciding factor: never replace the behavior or collaboration this test claims to verify.

A mocked database cannot prove transaction semantics. A mocked billing service cannot prove duplicate-charge prevention. Exercise the relevant production collaboration and verify doubles against real contracts separately. Keep tests isolated from live services; control clocks, randomness, and asynchronous completion instead of sleeping.

### 4. Write one focused behavior per test

Name the condition and promised outcome:

- Weak: `handles empty input`
- Better: `denies cross-tenant access when the tenant ID is empty`

Use multiple assertions when they jointly establish one outcome. Use named parameterized cases for meaningful variants of one rule. Choose distinct, non-default values to expose ignored or swapped inputs; include zero, negative, empty, and boundary values when they challenge the contract.

Assert observable results, state, or contractual interactions. Derive expected values independently of production logic. Avoid private structure and call order unless order itself is the guarantee. Names should explain arrange/act/assert; comments explain only non-obvious reasons.

### 5. Verify, then prune

Observe new tests fail for the intended missing behavior, then pass with the implementation. Check that existing tests would reject a plausible rule-breaking change. Run focused tests and relevant integration tests; report gaps.

Never delete by title: rename a poorly named security test. Remove a test only if it protects no valid contract or another test detects the same failure mode. Verify that conclusion first. Preserve distinct integration risks even when local tests cover the rule.

## Report

Summarize by rule, not every parameterized row:

```text
Protects: <rule; evidence; failure consequence>
Boundary: <function | module | integration | route/task; why; doubles>
Changed: <added/kept/renamed/removed; equivalent coverage for removals>
Verified: <commands and results; gaps or unconfirmed assumptions>
```

## Google guidance

This is a local policy informed by Google's [Testing on the Toilet](https://testing.googleblog.com/search/label/TotT), not a formal Google standard:

- [Test Behavior, Not Implementation](https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html): public contracts survive implementation changes, including simple arithmetic APIs.
- [Test Behaviors, Not Methods](https://testing.googleblog.com/2014/04/testing-on-toilet-test-behaviors-not.html): separate behaviors, not one test per method or assertion.
- [Don't Overuse Mocks](https://testing.googleblog.com/2013/05/testing-on-toilet-dont-overuse-mocks.html): prefer real dependencies or fakes when practical; mocks can drift and obscure intent.
- [Just Say No to More End-to-End Tests](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html): related Google Testing Blog guidance on fast, reliable unit tests and focused integration tests.
- [Choosing Values for Robust Tests](https://testing.googleblog.com/2026/06/choosing-values-for-robust-tests.html): distinct, non-default inputs and meaningful boundary cases expose false positives.
