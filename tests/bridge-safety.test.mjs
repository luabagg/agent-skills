import assert from "node:assert/strict";
import test from "node:test";
import { planBridge, renderService, validateBridgeConfig, validateWorkspace } from "../scripts/setup-pi.mjs";

test("bridge accepts only fixed loopback endpoints", () => {
  assert.doesNotThrow(() => validateBridgeConfig({ controlUrl: "http://127.0.0.1:32125", providerUrl: "http://127.0.0.1:32124/v1" }));
  for (const controlUrl of ["http://0.0.0.0:32125", "http://localhost:32125", "https://127.0.0.1:32125", "http://127.0.0.2:32125"]) {
    assert.throws(() => validateBridgeConfig({ controlUrl, providerUrl: "http://127.0.0.1:32124/v1" }), /loopback|localhost|port|http/i);
  }
});

test("workspace and template substitutions cannot inject shell syntax", () => {
  assert.throws(() => validateWorkspace("/tmp/$(touch-pwned)", "/home/user"), /workspace|unsafe/i);
  assert.doesNotMatch(renderService("WORKSPACE={{WORKSPACE}}", { WORKSPACE: "/home/user/project" }), /\$\(|`/);
});

test("bridge plan contains no Cursor credential bytes", () => {
  const bridgePlan = planBridge({ controlUrl: "http://127.0.0.1:32125", providerUrl: "http://127.0.0.1:32124/v1", cursorAuthDir: "/home/user/.config/cursor" });
  assert.doesNotMatch(JSON.stringify(bridgePlan), /accessToken|refreshToken|apiKey/i);
});
