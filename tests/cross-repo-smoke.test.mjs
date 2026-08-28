import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const agentfolioBin = process.env.AGENTFOLIO_BIN;

test("Agentfolio collection smoke is isolated and non-mutating", { skip: !agentfolioBin }, (t) => {
  assert.ok(path.isAbsolute(agentfolioBin));
  assert.ok(existsSync(agentfolioBin));
  const tempHome = mkdtempSync(path.join(tmpdir(), "agent-skills-smoke-"));
  try {
    const env = { ...process.env, HOME: tempHome };
    const commands = [
      ["doctor", "--collection", root],
      ["plan", "--profile", "pi", "--collection", root],
      ["apply", "--profile", "pi", "--dry-run", "--collection", root],
    ];
    for (const [index, args] of commands.entries()) {
      const result = spawnSync(process.execPath, [agentfolioBin, ...args], { cwd: root, env, encoding: "utf8" });
      if (index === 0 && result.status !== 0 && /Invalid collection\.yaml|executable is not allowed/i.test(result.stderr)) {
        t.skip("pinned Agentfolio predates the strict vector manifest contract");
        return;
      }
      assert.equal(result.status, 0, `${args.join(" ")}\n${result.stderr}`);
    }
    assert.equal(spawnSync("git", ["diff", "--exit-code"], { cwd: root }).status, 0);
    assert.equal(spawnSync("git", ["diff", "--cached", "--exit-code"], { cwd: root }).status, 0);
    assert.equal(spawnSync("git", ["status", "--porcelain"], { cwd: root, env, encoding: "utf8" }).stdout, "");
  } finally {
    rmSync(tempHome, { recursive: true, force: true });
  }
});
