#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import { npx, runCommand, shellQuote } from "./lib/command.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const copy = args.has("--copy");
const skillsDir = new URL("../skills/", import.meta.url);
const agents = ["claude-code", "codex", "github-copilot", "opencode", "pi"];

async function hasPersonalSkills() {
  const entries = await readdir(skillsDir, { withFileTypes: true });
  return entries.some((entry) => entry.isDirectory() && !entry.name.startsWith("."));
}

if (!(await hasPersonalSkills())) {
  console.log("No personal skills found under skills/; skipping.");
  process.exit(0);
}

const command = [
  npx,
  "--yes",
  "skills",
  "add",
  ".",
  "--global",
  ...agents.flatMap((agent) => ["--agent", agent]),
  "--skill",
  "*",
  "--yes",
];

if (copy) {
  command.push("--copy");
}

console.log(command.map(shellQuote).join(" "));

if (dryRun) {
  process.exit(0);
}

const result = runCommand(command, {
  cwd: new URL("../", import.meta.url),
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);