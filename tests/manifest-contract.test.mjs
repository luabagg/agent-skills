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

test("Pi and OpenCode manifests contain executable vectors, not shell strings", () => {
  for (const pkg of pi.packages) {
    assert.equal(Object.hasOwn(pkg, "installCommands"), false, pkg.name);
    assert.equal(pkg.install.executable, "pi");
    assert.ok(pkg.install.args.every((arg) => typeof arg === "string" && arg.length > 0));
  }
  for (const plugin of opencode.plugins) {
    assert.equal(Object.hasOwn(plugin, "installCommands"), false, plugin.name);
    if (plugin.install) assert.ok(Array.isArray(plugin.install.args));
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
