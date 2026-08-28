import assert from "node:assert/strict";
import test from "node:test";
import { plan, validate } from "../scripts/lib/plan.mjs";
import { applyPlan } from "../scripts/lib/mutate.mjs";

test("planner returns a pure validated delta", () => {
  let reads = 0;
  const result = plan({ actionId: "cursor.add-agents", summary: "preview" }, {
    readDesiredChanges: () => { reads += 1; return [{ path: "/tmp/example", content: "x" }]; },
  });
  assert.equal(result.ok, true);
  assert.equal(reads, 1);
  assert.equal(result.summary, "preview");
  assert.equal(result.processes.length, 1);
});

test("invalid action requests fail validation", () => {
  assert.throws(() => validate({ actionId: "unknown" }), /Unknown action/);
});

test("dry-run apply invokes neither mutation nor process runner", async () => {
  let mutations = 0;
  let processes = 0;
  const result = await applyPlan(plan({ actionId: "cursor.add-agents" }), {
    dryRun: true,
    mutate: () => { mutations += 1; },
    runProcess: () => { processes += 1; },
  });
  assert.equal(result.changed, false);
  assert.equal(mutations, 0);
  assert.equal(processes, 0);
});
