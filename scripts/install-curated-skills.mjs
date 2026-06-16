#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const copy = args.has("--copy");
const curatedPath = new URL("../curated-skills.json", import.meta.url);
const curated = JSON.parse(await readFile(curatedPath, "utf8"));
const agents = curated.agents ?? [];

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

if (agents.length === 0) {
  throw new Error("curated-skills.json must list at least one agent.");
}

const installableSourceTypes = new Set(["github", "git"]);
const installable = [];
const skipped = [];

for (const source of curated.sources ?? []) {
  if (
    source.preferredInstall === "skills-cli" &&
    installableSourceTypes.has(source.sourceType)
  ) {
    installable.push(source);
  } else {
    skipped.push(source);
  }
}

console.log(`Found ${installable.length} skills-cli sources to install.`);

for (const source of installable) {
  const command = [
    npx,
    "--yes",
    "skills",
    "add",
    source.source,
    "--global",
    ...agents.flatMap((agent) => ["--agent", agent]),
    ...source.skills.flatMap((skill) => ["--skill", skill]),
    "--yes",
  ];

  if (copy) {
    command.push("--copy");
  }

  console.log(`\n${source.name}`);
  console.log(command.map(shellQuote).join(" "));

  if (dryRun) {
    continue;
  }

  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (skipped.length > 0) {
  console.log("\nSkipped non-skills-cli sources:");
  for (const source of skipped) {
    console.log(
      `- ${source.name}: preferredInstall=${source.preferredInstall}, sourceType=${source.sourceType}`,
    );
  }
  console.log("Install skipped plugin-style entries through the relevant agent/plugin marketplace.");
}
