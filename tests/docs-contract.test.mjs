import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("README contains canonical onboarding commands", () => {
  const readme = readFileSync("README.md", "utf8");
  for (const command of [
    "git clone https://github.com/luabagg/agent-skills.git",
    "npm ci",
    "agentfolio doctor",
    "agentfolio plan --profile default",
    "agentfolio apply --profile default --dry-run",
  ])assert.match(readme, new RegExp(command.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  assert.match(readme, /keychain|native login/i);
});

test("package metadata declares supported Node and repository", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.match(pkg.engines.node, />=20/);
  assert.equal(pkg.repository.type, "git");
  assert.ok(pkg.bugs.url);
});
