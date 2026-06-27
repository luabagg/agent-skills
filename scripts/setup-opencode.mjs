#!/usr/bin/env node

import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const enableRecommended = args.has("--enable-recommended");
const manifestPath = new URL("../harnesses/opencode.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const configDir = resolve(join(homedir(), ".config", "opencode"));
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

  if (!Array.isArray(value.plugins) || value.plugins.length === 0) {
    throw new Error("harnesses/opencode.json must define at least one plugin.");
  }

  for (const plugin of value.plugins) {
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
  return manifest.plugins.filter(
    (plugin) => plugin.kind === "opencode-plugin" && (plugin.defaultEnabled || enableRecommended),
  );
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
  const installers = manifest.plugins.filter((plugin) => plugin.kind === "manual-installer");
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
const currentContent = await readUtf8IfExists(configPath);
const currentConfig = parseConfig(currentContent, configPath);
const updatedConfig = nextConfig(currentConfig, selectedPlugins);
const changed = JSON.stringify(currentConfig) !== JSON.stringify(updatedConfig);

console.log(`OpenCode harness manifest: ${manifest.plugins.length} plugins tracked.`);
console.log(`Config path: ${configPath}`);
console.log(`Mode: ${dryRun ? "dry-run" : "write"}`);

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

if (!changed) {
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
