import assert from "node:assert/strict";
import test from "node:test";
import { validateCollectionManifest, validateVector } from "../scripts/lib/manifest.mjs";

test("valid Pi install vector is accepted", () => {
  assert.doesNotThrow(() => validateVector("package.install", "pi", { executable: "pi", args: ["install", "npm:example"] }));
});

test("unsupported executable and subcommand are rejected", () => {
  assert.throws(() => validateVector("x", "pi", { executable: "sh", args: ["-c", "echo unsafe"] }), /unsupported|unsafe/i);
  assert.throws(() => validateVector("x", "pi", { executable: "pi", args: ["shell"] }), /unsupported/i);
  assert.throws(() => validateVector("x", "pi", { executable: "pi", args: ["install", "../escape"] }), /path|unsafe/i);
});

test("collection-specific validation rejects duplicate agent names", () => {
  assert.throws(() => validateCollectionManifest("cursor", {
    harness: "cursor", agents: [
      { name: "coder", sourceFile: "agents/coder.md" },
      { name: "coder", sourceFile: "agents/advisor.md" },
    ],
  }), /duplicated/);
});
