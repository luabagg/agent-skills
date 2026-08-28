import assert from "node:assert/strict";
import test from "node:test";
import { resolveAction } from "../scripts/lib/actions.mjs";

test("registry exposes the six collection actions", () => {
  for (const id of [
    "global.add-curated-skills",
    "global.add-instructions",
    "pi.configure",
    "pi-catalog.configure",
    "cursor.add-agents",
    "opencode.configure-plugins-and-agents",
  ]) {
    const action = resolveAction(id);
    assert.equal(typeof action.executable, "string", id);
    assert.ok(Array.isArray(action.args), id);
    assert.ok(action.args.every((arg) => typeof arg === "string" && arg.length > 0), id);
  }
});

test("registry rejects unknown action IDs", () => {
  assert.throws(() => resolveAction("pi.run-arbitrary-command"), /Unknown action/);
});
