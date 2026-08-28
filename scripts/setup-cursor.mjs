#!/usr/bin/env node

import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, readlink, rm, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const mode = args.has("--copy") ? "copy" : "symlink";
const manifestPath = new URL("../harnesses/cursor.json", import.meta.url);
const harnessRoot = resolve(fileURLToPath(new URL("../harnesses/cursor/", import.meta.url)));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const agentDir = resolve(join(homedir(), ".cursor", "agents"));
const MANAGED_MARKER = "<!-- managed-by: agent-skills -->";

function validateManifest(value) {
  if (value.version !== 1) throw new Error("harnesses/cursor.json must have version 1.");
  if (value.harness !== "cursor") throw new Error('harnesses/cursor.json must have harness "cursor".');

  const agents = value.agents ?? [];
  if (agents.length === 0) throw new Error("harnesses/cursor.json must define at least one agent.");

  for (const agent of agents) {
    if (!agent.name || agent.kind !== "agent" || typeof agent.defaultEnabled !== "boolean") {
      throw new Error('Each Cursor agent entry needs name, kind "agent", and defaultEnabled.');
    }
    if (!agent.sourceFile) throw new Error(`${agent.name} is missing sourceFile.`);
  }
}

async function readUtf8IfExists(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function normalizeText(content) {
  return content.replace(/\r\n/g, "\n").replace(/\n+$/, "");
}

function sameTextContent(left, right) {
  return normalizeText(left) === normalizeText(right);
}

async function symlinkMatches(target, source) {
  try {
    const info = await lstat(target);
    if (!info.isSymbolicLink()) return false;
    return resolve(dirname(target), await readlink(target)) === resolve(source);
  } catch {
    return false;
  }
}

async function isSymlink(target) {
  try {
    return (await lstat(target)).isSymbolicLink();
  } catch {
    return false;
  }
}

function managedCopy(content) {
  if (content.includes(MANAGED_MARKER)) return content;
  if (content.startsWith("---\n")) {
    const frontmatterEnd = content.indexOf("\n---\n", 4);
    if (frontmatterEnd >= 0) {
      const insertAt = frontmatterEnd + 5;
      return `${content.slice(0, insertAt)}${MANAGED_MARKER}\n${content.slice(insertAt)}`;
    }
  }
  return `${MANAGED_MARKER}\n${content}`;
}

async function installAgentFile(agent) {
  const source = resolve(harnessRoot, agent.sourceFile);
  const target = resolve(join(agentDir, `${agent.name}.md`));

  if (!existsSync(source)) throw new Error(`Missing agent template: ${source}`);

  const sourceContent = await readFile(source, "utf8");
  const desiredContent = mode === "copy" ? managedCopy(sourceContent) : sourceContent;

  if (!existsSync(target)) {
    console.log(`${mode} ${target} <- ${source}`);
    if (!dryRun) {
      await mkdir(agentDir, { recursive: true });
      if (mode === "copy") {
        await writeFile(target, desiredContent, "utf8");
      } else {
        await symlink(source, target);
      }
    }
    return true;
  }

  if (mode === "symlink" && (await symlinkMatches(target, source))) {
    console.log(`ok ${target}`);
    return false;
  }
  if (await isSymlink(target)) {
    throw new Error(`Refusing to overwrite unmanaged symlink: ${target}`);
  }

  const currentContent = await readUtf8IfExists(target);
  if (sameTextContent(currentContent ?? "", desiredContent)) {
    console.log(`ok ${target} (content matches)`);
    return false;
  }
  if (mode !== "copy" || !currentContent?.includes(MANAGED_MARKER)) {
    throw new Error(`Refusing to overwrite unmanaged file: ${target}`);
  }

  console.log(`replace ${target}`);
  if (!dryRun) {
    await rm(target, { force: true });
    await writeFile(target, desiredContent, "utf8");
  }
  return true;
}

validateManifest(manifest);

const selectedAgents = (manifest.agents ?? []).filter((agent) => agent.defaultEnabled);

console.log(`Cursor harness manifest: ${selectedAgents.length} agents selected.`);
console.log(`Agent dir: ${agentDir}`);
console.log(`Mode: ${dryRun ? "dry-run" : "write"} (${mode})`);

if (selectedAgents.length === 0) {
  console.log("No Cursor agents selected for install.");
  process.exit(0);
}

console.log("\nSelected Cursor agents:");
for (const agent of selectedAgents) {
  console.log(`- ${agent.name}`);
}

let changed = false;
for (const agent of selectedAgents) {
  if (await installAgentFile(agent)) changed = true;
}

if (!changed) {
  console.log("\nCursor harness already matches selected entries.");
} else if (dryRun) {
  console.log("\nDry-run complete. Re-run without --dry-run to apply.");
} else {
  console.log("\nCursor harness setup complete. Restart Cursor to load updated subagents.");
}