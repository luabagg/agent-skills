#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { parseJsonc, setJsoncValue } from "./lib/jsonc.mjs";
import { validateVector } from "./lib/manifest.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const enableRecommended = args.has("--enable-recommended");
const manifestPath = new URL("../harnesses/opencode.json", import.meta.url);
const harnessRoot = resolve(fileURLToPath(new URL("../harnesses/opencode/", import.meta.url)));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const catalogPath = new URL("../harnesses/catalog.yaml", import.meta.url);
const catalogLockPath = new URL("../harnesses/catalog.lock.json", import.meta.url);
const catalog = parseYaml(await readFile(catalogPath, "utf8"));
const catalogLock = JSON.parse(await readFile(catalogLockPath, "utf8"));

const configDir = resolve(join(homedir(), ".config", "opencode"));
const agentDir = resolve(join(configDir, "agent"));
const jsoncPath = resolve(join(configDir, "opencode.jsonc"));
const jsonPath = resolve(join(configDir, "opencode.json"));
const configPath = existsSync(jsoncPath) ? jsoncPath : existsSync(jsonPath) ? jsonPath : jsoncPath;
const MANAGED_AGENT_MARKER = "<!-- managed-by: agent-skills -->";

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

    if (agent.modelRole && !catalog.opencodeRoles?.[agent.modelRole]) {
      throw new Error(`${agent.name} references unknown catalog modelRole ${agent.modelRole}.`);
    }
  }

  for (const plugin of plugins) {
    if (!plugin.name || !plugin.kind || typeof plugin.defaultEnabled !== "boolean") {
      throw new Error("Each OpenCode plugin entry needs name, kind, and defaultEnabled.");
    }

    if (plugin.kind === "opencode-plugin" && !plugin.pluginEntry) {
      throw new Error(`${plugin.name} is missing pluginEntry.`);
    }

    if (plugin.kind === "manual-installer") {
      if (!plugin.install || plugin.displayOnly !== true) throw new Error(`${plugin.name} needs a display-only executable vector.`);
      validateVector(`${plugin.name}.install`, "opencode", plugin.install);
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

async function isSymlink(filePath) {
  try {
    return (await lstat(filePath)).isSymbolicLink();
  } catch {
    return false;
  }
}

function parseConfig(input, filePath) {
  return parseJsonc(input, filePath);
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

function resolvedRoleModel(role) {
  const selectorId = catalog.opencodeRoles?.[role];
  const resolved = catalogLock.resolvedSelectors?.[selectorId];
  if (!resolved) throw new Error(`Catalog lock has no resolved selector for OpenCode role ${role}.`);
  const providerPrefix = catalog.providers?.[resolved.provider]?.harnessIds?.opencode;
  if (!providerPrefix) throw new Error(`Catalog provider ${resolved.provider} has no OpenCode harness ID.`);
  return `${providerPrefix}/${resolved.modelId}`;
}

function renderAgentTemplate(agent, sourceContent) {
  if (!agent.modelRole) return sourceContent;
  const placeholder = `{{catalogRole:${agent.modelRole}}}`;
  const matches = sourceContent.match(new RegExp(`^model: \\{\\{catalogRole:${agent.modelRole}\\}\\}$`, "gm")) ?? [];
  if (matches.length !== 1) {
    throw new Error(`${agent.sourceFile} must contain exactly one model: ${placeholder} frontmatter entry.`);
  }
  return sourceContent.replace(`model: ${placeholder}`, `model: ${resolvedRoleModel(agent.modelRole)}`);
}

function markManagedAgent(content) {
  if (content.includes(MANAGED_AGENT_MARKER)) return content;
  if (content.startsWith("---\n")) {
    const frontmatterEnd = content.indexOf("\n---\n", 4);
    if (frontmatterEnd >= 0) {
      const insertAt = frontmatterEnd + 5;
      return `${content.slice(0, insertAt)}${MANAGED_AGENT_MARKER}\n${content.slice(insertAt)}`;
    }
  }
  return `${MANAGED_AGENT_MARKER}\n${content}`;
}

async function installAgentFile(agent) {
  const source = resolve(harnessRoot, agent.sourceFile);
  const target = resolve(join(agentDir, `${agent.name}.md`));

  if (!existsSync(source)) {
    throw new Error(`Missing agent template: ${source}`);
  }

  const sourceContent = renderAgentTemplate(agent, await readFile(source, "utf8"));
  const desiredContent = markManagedAgent(sourceContent);
  const currentContent = await readUtf8IfExists(target);

  if (await isSymlink(target)) {
    throw new Error(`Refusing to overwrite unmanaged symlink: ${target}`);
  }
  if (currentContent === desiredContent) {
    console.log(`ok ${target}`);
    return false;
  }
  if (currentContent !== null && !currentContent.includes(MANAGED_AGENT_MARKER)) {
    throw new Error(`Refusing to overwrite unmanaged file: ${target}`);
  }

  console.log(`${dryRun ? "would write" : "write"} ${target} <- ${source}`);
  if (!dryRun) {
    await mkdir(agentDir, { recursive: true });
    await writeFile(target, desiredContent, "utf8");
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
    console.log(`  ${plugin.install.executable} ${plugin.install.args.join(" ")} (display-only)`);
    if (plugin.notes) {
      console.log(`  ${plugin.notes}`);
    }
  }
}

execFileSync(process.execPath, [fileURLToPath(new URL("./catalog.mjs", import.meta.url)), "check"], {
  stdio: "inherit",
});
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

const nextContent = setJsoncValue(
  currentContent ?? "{}\n",
  ["plugin"],
  updatedConfig.plugin,
  configPath,
);

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
