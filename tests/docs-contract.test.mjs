import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("README contains canonical onboarding commands", () => {
  const readme = readFileSync("README.md", "utf8");
  for (const command of [
    "npm ci",
    "agentfolio doctor --collection .",
    "agentfolio plan --profile pi --collection .",
    "agentfolio apply --profile pi --dry-run --collection .",
  ]) assert.match(readme, new RegExp(command.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  assert.match(readme, /keychain|native login/i);
});

test("package metadata declares supported Node and repository", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.match(pkg.engines.node, />=20/);
  assert.equal(pkg.repository.type, "git");
  assert.ok(pkg.bugs.url);
});
