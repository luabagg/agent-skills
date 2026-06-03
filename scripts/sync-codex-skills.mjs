#!/usr/bin/env node

import { mkdir, readdir, readlink, symlink, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const sourceRoot = resolve(
  process.env.AGENT_SKILLS_ROOT ?? join(homedir(), ".agents", "skills"),
);
const codexRoot = resolve(
  process.env.CODEX_SKILLS_ROOT ?? join(homedir(), ".codex", "skills"),
);

function shouldSkip(name) {
  return name.startsWith(".") || name === "_archive";
}

async function ensureSymlink(source, destination) {
  if (!existsSync(destination)) {
    console.log(`${dryRun ? "would link" : "link"} ${destination} -> ${source}`);
    if (!dryRun) {
      await symlink(source, destination, "dir");
    }
    return;
  }

  let currentTarget = null;
  try {
    currentTarget = await readlink(destination);
  } catch {
    console.log(`skip ${destination}: exists and is not a symlink`);
    return;
  }

  const resolvedTarget = resolve(codexRoot, currentTarget);
  if (resolvedTarget === source) {
    console.log(`ok ${destination} -> ${source}`);
    return;
  }

  console.log(
    `${dryRun ? "would relink" : "relink"} ${destination}: ${resolvedTarget} -> ${source}`,
  );
  if (!dryRun) {
    await unlink(destination);
    await symlink(source, destination, "dir");
  }
}

if (!existsSync(sourceRoot)) {
  throw new Error(`Source skills directory does not exist: ${sourceRoot}`);
}

if (!dryRun) {
  await mkdir(codexRoot, { recursive: true });
}

const entries = await readdir(sourceRoot, { withFileTypes: true });
const activeSkills = entries
  .filter((entry) => !shouldSkip(entry.name))
  .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
  .sort((left, right) => left.name.localeCompare(right.name));

console.log(`Syncing ${activeSkills.length} active skills from ${sourceRoot} to ${codexRoot}.`);

for (const entry of activeSkills) {
  await ensureSymlink(
    join(sourceRoot, entry.name),
    join(codexRoot, entry.name),
  );
}

console.log("Codex skill sync complete.");
