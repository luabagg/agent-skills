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

test("collection actions keep data fields under config", () => {
  const allowed = new Set(["action", "summary", "config"]);
  for (const [harnessName, harness] of Object.entries(collection.harnesses)) {
    for (const [index, declared] of harness.actions.entries()) {
      assert.deepEqual(Object.keys(declared).filter((key) => !allowed.has(key)), [], `${harnessName}[${index}]`);
      assert.equal(typeof declared.action, "string");
      assert.equal(typeof declared.summary, "string");
      assert.equal(typeof declared.config, "object", `${harnessName}[${index}] config`);
      for (const key of ["manifest", "catalog", "lock", "source", "args"]) {
        assert.equal(Object.hasOwn(declared, key), false, `${harnessName}.${key}`);
      }
    }
  }
  assert.deepEqual(collection.harnesses["pi-catalog"].actions[0].config, {
    manifest: "./harnesses/pi.json",
    catalog: "./harnesses/catalog.yaml",
    lock: "./harnesses/catalog.lock.json",
  });
});

test("Pi and OpenCode manifests contain executable vectors, not shell strings", () => {
  for (const pkg of pi.packages) {
    assert.equal(Object.hasOwn(pkg, ["install", "Commands"].join("")), false, pkg.name);
    assert.equal(pkg.install.executable, "pi");
    assert.ok(pkg.install.args.every((arg) => typeof arg === "string" && arg.length > 0));
  }
  for (const plugin of opencode.plugins) {
    assert.equal(Object.hasOwn(plugin, ["install", "Commands"].join("")), false, plugin.name);
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
