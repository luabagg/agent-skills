#!/usr/bin/env node
import { assertNoTrackedSecrets } from "./lib/secrets.mjs";

try {
  assertNoTrackedSecrets();
  console.log("secret scan passed (tracked files only)");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
