import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { parse as parseYaml } from "yaml";
import { validateVector } from "../scripts/lib/manifest.mjs";

const root = resolve(import.meta.dirname, "..");
const collection = parseYaml(readFileSync(resolve(root, "collection.yaml"), "utf8"));
const pi = JSON.parse(readFileSync(resolve(root, "harnesses/pi.json"), "utf8"));
const opencode = JSON.parse(readFileSync(resolve(root, "harnesses/opencode.json"), "utf8"));

test("collection adapter has executable and args and no shell command", () => {
  const adapter = collection.adapters["agent-skills"];
  assert.equal(typeof adapter.executable, "string");
  assert.deepEqual(adapter.args, ["./scripts/agentfolio-adapter.mjs"]);
  assert.equal(Object.hasOwn(adapter, "command"), false);
});

test("Pi and OpenCode manifests contain no shell-string installer fields", () => {
  for (const pkg of pi.packages) {
    assert.equal(Object.hasOwn(pkg, "install"), false, pkg.name);
    assert.ok(pkg.install === undefined || typeof pkg.install === "object");
  }
  for (const plugin of opencode.plugins) {
    assert.equal(Object.hasOwn(plugin, "installCommands"), false, plugin.name);
  }
});

test("unsafe vector values are rejected", () => {
  for (const value of [";", "&&", "|", "\n", "$(id)", "`id`", "", "../escape"]) {
    assert.throws(
      () => validateVector("pi.packages[0].install", "pi", { executable: "pi", args: ["install", value] }),
      /unsafe|empty|path/i,
    );
  }
});
