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

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const copy = args.has("--copy");
const sourceFile = resolve(fileURLToPath(new URL("../AGENTS.md", import.meta.url)));
const mode = copy ? "copy" : "symlink";

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

  try {
    const current = await readlink(target);
    const resolved = resolve(dirname(target), current);
    if (mode === "symlink" && resolved === source) {
      console.log(`ok ${target}`);
      return;
    }

    console.log(`replace ${target}`);
    if (!dryRun) {
      await unlink(target);
      if (mode === "copy") {
        await copyFile(source, target);
      } else {
        await symlink(source, target);
      }
    }
    return;
  } catch {
    // Existing path is not a symlink. Treat identical content as already managed.
  }

  const currentContent = await readUtf8IfExists(target);
  const sourceContent = await readFile(source, "utf8");
  if (currentContent === sourceContent) {
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

  const next = current?.trim().length ? `${importLine}\n\n${current}` : `${importLine}\n`;
  console.log(`write ${targets.claudeClaude}`);
  if (!dryRun) {
    await writeFile(targets.claudeClaude, next, "utf8");
  }
}

async function ensureCopilotWrapper() {
  await ensureParent(targets.copilotInstructions);
  const body = await readFile(sourceFile, "utf8");
  const next = `---\napplyTo: "**"\n---\n\n${body}`;
  const current = await readUtf8IfExists(targets.copilotInstructions);

  if (current === next) {
    console.log(`ok ${targets.copilotInstructions}`);
    return;
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

  if (current.includes(targets.opencodeAgents)) {
    console.log(`ok ${configPath}`);
    return;
  }

  const trimmed = current.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    throw new Error(`Unsupported OpenCode config format: ${configPath}`);
  }

  if (/"instructions"\s*:/.test(current)) {
    throw new Error(
      `OpenCode config already has instructions. Add ${targets.opencodeAgents} manually to ${configPath}`,
    );
  }

  const body = trimmed.slice(0, -1).trimEnd();
  const insertion = `,\n  "instructions": ${toJsonArray([targets.opencodeAgents])}`;
  const next = `${body}${insertion}\n}\n`;
  console.log(`update ${configPath}`);
  if (!dryRun) {
    await writeFile(configPath, next, "utf8");
  }
}

if (!existsSync(sourceFile)) {
  throw new Error(`Missing source instructions file: ${sourceFile}`);
}

console.log(`Installing global AGENTS in ${mode} mode from ${sourceFile}`);

await installManagedFile(sourceFile, targets.codexAgents);
await installManagedFile(sourceFile, targets.claudeAgents);
await installManagedFile(sourceFile, targets.copilotAgents);
await installManagedFile(sourceFile, targets.opencodeAgents);
await ensureClaudeWrapper();
await ensureCopilotWrapper();
await ensureOpenCodeConfig();

console.log("Global AGENTS install complete.");
console.log(`Relative source path: ${relative(process.cwd(), sourceFile)}`);
