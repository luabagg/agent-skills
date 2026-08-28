import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { assertNoTrackedSecrets, redact, resolveAuth } from "../scripts/lib/secrets.mjs";

test("redact removes environment secret and bearer value", () => {
  const env = { XAI_API_KEY: "env-value" };
  assert.doesNotMatch(redact("XAI_API_KEY=env-value Bearer bearer-value", env), /env-value|bearer-value/);
});

test("keychain wins over environment fallback without exposing values", async () => {
  const auth = await resolveAuth({ keychain: async () => "keychain-value", env: { XAI_API_KEY: "env-value" } });
  assert.equal(auth.source, "keychain");
  assert.doesNotMatch(JSON.stringify(auth), /keychain-value|env-value/);
});

test("environment is a fallback and missing auth is unconfigured", async () => {
  assert.deepEqual(await resolveAuth({ env: { XAI_API_KEY: "value" } }), { source: "environment", configured: true });
  assert.deepEqual(await resolveAuth({ env: {} }), { source: "none", configured: false });
});

test("tracked-secret scan allows placeholders and rejects key-shaped values", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-skills-secret-"));
  const safe = join(dir, "safe"); const unsafe = join(dir, "unsafe");
  await writeFile(safe, "YOUR_API_KEY");
  await writeFile(unsafe, "api_key=sk-1234567890123456");
  assert.doesNotThrow(() => assertNoTrackedSecrets([safe]));
  assert.throws(() => assertNoTrackedSecrets([unsafe]), /secret detected/);
});
