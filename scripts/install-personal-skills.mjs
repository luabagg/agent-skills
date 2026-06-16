#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const copy = args.has("--copy");
const skillsDir = new URL("../skills/", import.meta.url);
const agents = ["claude-code", "codex", "github-copilot", "opencode"];

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

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

const result = spawnSync(command[0], command.slice(1), {
  cwd: new URL("../", import.meta.url),
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
