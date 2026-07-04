#!/usr/bin/env node

import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const enableRecommended = args.has("--enable-recommended");
const manifestPath = new URL("../harnesses/opencode.json", import.meta.url);
const harnessRoot = resolve(fileURLToPath(new URL("../harnesses/opencode/", import.meta.url)));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const configDir = resolve(join(homedir(), ".config", "opencode"));
const agentDir = resolve(join(configDir, "agent"));
const jsoncPath = resolve(join(configDir, "opencode.jsonc"));
const jsonPath = resolve(join(configDir, "opencode.json"));
const configPath = existsSync(jsoncPath) ? jsoncPath : existsSync(jsonPath) ? jsonPath : jsoncPath;

function validateManifest(value) {
  if (value.version !== 1) {
    throw new Error("harnesses/opencode.json must have version 1.");
  }

  if (value.harness !== "opencode") {
    throw new Error('harnesses/opencode.json must have harness "opencode".');
  }

  const plugins = value.plugins ?? [];
  const agents = value.agents ?? [];

  if (plugins.length === 0 && agents.length === 0) {
    throw new Error("harnesses/opencode.json must define at least one plugin or agent.");
  }

  for (const agent of agents) {
    if (!agent.name || agent.kind !== "agent" || typeof agent.defaultEnabled !== "boolean") {
      throw new Error("Each OpenCode agent entry needs name, kind \"agent\", and defaultEnabled.");
    }

    if (!agent.sourceFile) {
      throw new Error(`${agent.name} is missing sourceFile.`);
    }
  }

  for (const plugin of plugins) {
    if (!plugin.name || !plugin.kind || typeof plugin.defaultEnabled !== "boolean") {
      throw new Error("Each OpenCode plugin entry needs name, kind, and defaultEnabled.");
    }

    if (plugin.kind === "opencode-plugin" && !plugin.pluginEntry) {
      throw new Error(`${plugin.name} is missing pluginEntry.`);
    }

    if (plugin.kind === "manual-installer" && !Array.isArray(plugin.installCommands)) {
      throw new Error(`${plugin.name} is missing installCommands.`);
    }
  }
}

async function readUtf8IfExists(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function stripJsonc(input) {
  let output = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += char;
  }

  return removeTrailingCommas(output);
}

function removeTrailingCommas(input) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === ",") {
      let nextIndex = index + 1;
      while (/\s/.test(input[nextIndex] ?? "")) {
        nextIndex += 1;
      }
      if (input[nextIndex] === "}" || input[nextIndex] === "]") {
        continue;
      }
    }

    output += char;
  }

  return output;
}

function parseConfig(input, filePath) {
  if (!input) {
    return {};
  }

  try {
    return JSON.parse(stripJsonc(input));
  } catch (error) {
    throw new Error(`Unable to parse ${filePath}: ${error.message}`);
  }
}

function pluginsToEnable() {
  const plugins = manifest.plugins ?? [];
  return plugins.filter(
    (plugin) => plugin.kind === "opencode-plugin" && (plugin.defaultEnabled || enableRecommended),
  );
}

function agentsToInstall() {
  const agents = manifest.agents ?? [];
  return agents.filter((agent) => agent.kind === "agent" && (agent.defaultEnabled || enableRecommended));
}

async function installAgentFile(agent) {
  const source = resolve(harnessRoot, agent.sourceFile);
  const target = resolve(join(agentDir, `${agent.name}.md`));

  if (!existsSync(source)) {
    throw new Error(`Missing agent template: ${source}`);
  }

  const sourceContent = await readFile(source, "utf8");
  const currentContent = await readUtf8IfExists(target);

  if (currentContent === sourceContent) {
    console.log(`ok ${target}`);
    return false;
  }

  console.log(`${dryRun ? "would write" : "write"} ${target} <- ${source}`);
  if (!dryRun) {
    await mkdir(agentDir, { recursive: true });
    await writeFile(target, sourceContent, "utf8");
  }

  return true;
}

function nextConfig(currentConfig, selectedPlugins) {
  if (selectedPlugins.length === 0) {
    return currentConfig;
  }

  const next = { ...currentConfig };
  const existing = next.plugin ?? [];

  if (!Array.isArray(existing)) {
    throw new Error('OpenCode config field "plugin" must be an array before setup can update it.');
  }

  const pluginSet = new Set(existing);
  for (const plugin of selectedPlugins) {
    pluginSet.add(plugin.pluginEntry);
  }

  next.plugin = [...pluginSet];
  return next;
}

function printManualInstallers() {
  const installers = (manifest.plugins ?? []).filter((plugin) => plugin.kind === "manual-installer");
  if (installers.length === 0) {
    return;
  }

  console.log("\nManual installers:");
  for (const plugin of installers) {
    console.log(`- ${plugin.name}`);
    for (const command of plugin.installCommands) {
      console.log(`  ${command}`);
    }
    if (plugin.notes) {
      console.log(`  ${plugin.notes}`);
    }
  }
}

validateManifest(manifest);

const selectedPlugins = pluginsToEnable();
const selectedAgents = agentsToInstall();
const currentContent = await readUtf8IfExists(configPath);
const currentConfig = parseConfig(currentContent, configPath);
const updatedConfig = nextConfig(currentConfig, selectedPlugins);
const configChanged = JSON.stringify(currentConfig) !== JSON.stringify(updatedConfig);

const pluginCount = (manifest.plugins ?? []).length;
const agentCount = (manifest.agents ?? []).length;

console.log(`OpenCode harness manifest: ${pluginCount} plugins, ${agentCount} agents tracked.`);
console.log(`Config path: ${configPath}`);
console.log(`Agent dir: ${agentDir}`);
console.log(`Mode: ${dryRun ? "dry-run" : "write"}`);

if (selectedAgents.length === 0) {
  console.log("No OpenCode agents selected for install.");
  console.log("Pass --enable-recommended to install recommended agent files.");
} else {
  console.log("Selected OpenCode agents:");
  for (const agent of selectedAgents) {
    console.log(`- ${agent.name}`);
  }
}

if (selectedPlugins.length === 0) {
  console.log("No OpenCode plugins selected for config mutation.");
  console.log("Pass --enable-recommended to add recommended opencode-plugin entries.");
} else {
  console.log("Selected OpenCode plugin entries:");
  for (const plugin of selectedPlugins) {
    console.log(`- ${plugin.pluginEntry}`);
  }
}

printManualInstallers();

let agentsChanged = false;
for (const agent of selectedAgents) {
  if (await installAgentFile(agent)) {
    agentsChanged = true;
  }
}

if (!configChanged && !agentsChanged) {
  console.log("\nOpenCode harness already matches selected entries.");
  process.exit(0);
}

if (!configChanged) {
  console.log("\nOpenCode config already matches selected plugin entries.");
  process.exit(0);
}

const nextContent = `${JSON.stringify(updatedConfig, null, 2)}\n`;

if (dryRun) {
  console.log("\nWould write OpenCode config:");
  console.log(nextContent);
  process.exit(0);
}

await mkdir(dirname(configPath), { recursive: true });
if (currentContent !== null) {
  const backupPath = `${configPath}.bak-${new Date().toISOString().replaceAll(":", "-")}`;
  await copyFile(configPath, backupPath);
  console.log(`Backed up existing config: ${backupPath}`);
}

await writeFile(configPath, nextContent, "utf8");
console.log("OpenCode config updated.");
