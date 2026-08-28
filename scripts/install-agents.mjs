#!/usr/bin/env node

import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  readlink,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { insertJsoncObjectProperty, parseJsonc } from "./lib/jsonc.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const copy = args.has("--copy");
const sourceFile = resolve(fileURLToPath(new URL("../AGENTS.global.md", import.meta.url)));
const mode = copy ? "copy" : "symlink";
const MANAGED_MARKER = "<!-- managed-by: agent-skills -->";

const targets = {
  codexAgents: resolve(join(homedir(), ".codex", "AGENTS.md")),
  claudeAgents: resolve(join(homedir(), ".claude", "AGENTS.md")),
  claudeClaude: resolve(join(homedir(), ".claude", "CLAUDE.md")),
  copilotAgents: resolve(join(homedir(), ".copilot", "AGENTS.md")),
  copilotInstructions: resolve(
    join(homedir(), ".copilot", "instructions", "global-agent.instructions.md"),
  ),
  opencodeAgents: resolve(join(homedir(), ".config", "opencode", "AGENTS.md")),
  opencodeJsonc: resolve(join(homedir(), ".config", "opencode", "opencode.jsonc")),
  opencodeJson: resolve(join(homedir(), ".config", "opencode", "opencode.json")),
  piAgents: resolve(join(homedir(), ".pi", "agent", "AGENTS.md")),
};

async function ensureParent(filePath) {
  if (!dryRun) {
    await mkdir(dirname(filePath), { recursive: true });
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

async function installManagedFile(source, target) {
  await ensureParent(target);

  if (!existsSync(target)) {
    console.log(`${mode} ${target} <- ${source}`);
    if (!dryRun) {
      if (mode === "copy") {
        await copyFile(source, target);
      } else {
        await symlink(source, target);
      }
    }
    return;
  }

  let currentLink = null;
  try {
    currentLink = await readlink(target);
  } catch {
    // Existing path is not a symlink. Treat identical content as already managed.
  }

  const currentContent = await readUtf8IfExists(target);
  const sourceContent = await readFile(source, "utf8");
  if (currentLink !== null) {
    const resolved = resolve(dirname(target), currentLink);
    if (mode === "symlink" && resolved === source) {
      console.log(`ok ${target}`);
      return;
    }
    if (sameTextContent(currentContent ?? "", sourceContent)) {
      console.log(`ok ${target} (content matches)`);
      return;
    }
    throw new Error(`Refusing to overwrite unmanaged file: ${target}`);
  }
  if (sameTextContent(currentContent ?? "", sourceContent)) {
    console.log(`ok ${target}`);
    return;
  }

  if (currentContent !== null && currentContent.trim().length === 0) {
    console.log(`replace empty ${target}`);
    if (!dryRun) {
      if (mode === "copy") {
        await copyFile(source, target);
      } else {
        await unlink(target);
        await symlink(source, target);
      }
    }
    return;
  }

  throw new Error(`Refusing to overwrite unmanaged file: ${target}`);
}

async function ensureClaudeWrapper() {
  await ensureParent(targets.claudeClaude);
  const importLine = "@AGENTS.md";
  const current = await readUtf8IfExists(targets.claudeClaude);

  if (current?.includes(importLine)) {
    console.log(`ok ${targets.claudeClaude}`);
    return;
  }

  if (current?.trim().length) {
    throw new Error(`Refusing to overwrite unmanaged file: ${targets.claudeClaude}`);
  }

  const next = `${importLine}\n`;
  console.log(`write ${targets.claudeClaude}`);
  if (!dryRun) {
    await writeFile(targets.claudeClaude, next, "utf8");
  }
}

async function ensureCopilotWrapper() {
  await ensureParent(targets.copilotInstructions);
  const body = await readFile(sourceFile, "utf8");
  const next = `---\napplyTo: "**"\n---\n\n${MANAGED_MARKER}\n${body}`;
  const current = await readUtf8IfExists(targets.copilotInstructions);

  if (current === next) {
    console.log(`ok ${targets.copilotInstructions}`);
    return;
  }
  if (current !== null && !current.includes(MANAGED_MARKER)) {
    throw new Error(`Refusing to overwrite unmanaged file: ${targets.copilotInstructions}`);
  }

  console.log(`write ${targets.copilotInstructions}`);
  if (!dryRun) {
    await writeFile(targets.copilotInstructions, next, "utf8");
  }
}

function toJsonArray(items) {
  return `[${items.map((item) => `\n    ${JSON.stringify(item)}`).join(",")}${items.length ? "\n  " : ""}]`;
}

async function ensureOpenCodeConfig() {
  const configPath = existsSync(targets.opencodeJsonc) ? targets.opencodeJsonc : targets.opencodeJson;
  await ensureParent(configPath);

  const current = await readUtf8IfExists(configPath);
  if (!current) {
    const next = `{\n  "$schema": "https://opencode.ai/config.json",\n  "instructions": ${toJsonArray([targets.opencodeAgents])}\n}\n`;
    console.log(`write ${configPath}`);
    if (!dryRun) {
      await writeFile(configPath, next, "utf8");
    }
    return;
  }

  const config = parseJsonc(current, configPath);
  if (Array.isArray(config.instructions) && config.instructions.includes(targets.opencodeAgents)) {
    console.log(`ok ${configPath}`);
    return;
  }
  if (Object.hasOwn(config, "instructions")) {
    throw new Error(
      `OpenCode config already has instructions. Add ${targets.opencodeAgents} manually to ${configPath}`,
    );
  }

  const next = insertJsoncObjectProperty(
    current,
    "instructions",
    [targets.opencodeAgents],
    configPath,
  );
  console.log(`update ${configPath}`);
  if (!dryRun) {
    const backupPath = `${configPath}.bak-${new Date().toISOString().replaceAll(":", "-")}`;
    await copyFile(configPath, backupPath);
    console.log(`backup ${backupPath}`);
    await writeFile(configPath, next, "utf8");
  }
}

if (!existsSync(sourceFile)) {
  throw new Error(`Missing source instructions file: ${sourceFile}`);
}

console.log(`Installing global AGENTS in ${mode} mode from ${sourceFile}`);

try {
  await installManagedFile(sourceFile, targets.codexAgents);
  await installManagedFile(sourceFile, targets.claudeAgents);
  await installManagedFile(sourceFile, targets.copilotAgents);
  await installManagedFile(sourceFile, targets.opencodeAgents);
  await installManagedFile(sourceFile, targets.piAgents);
  await ensureClaudeWrapper();
  await ensureCopilotWrapper();
  await ensureOpenCodeConfig();
} catch (error) {
  if (dryRun && error instanceof Error && error.message.startsWith("Refusing to overwrite unmanaged file:")) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

console.log("Global AGENTS install complete.");
console.log(`Relative source path: ${relative(process.cwd(), sourceFile)}`);
