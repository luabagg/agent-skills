#!/usr/bin/env node

import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readlink,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const enableRecommended = args.has("--enable-recommended");
const manifestPath = new URL("../harnesses/pi.json", import.meta.url);
const harnessRoot = resolve(fileURLToPath(new URL("../harnesses/pi/", import.meta.url)));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const piDir = resolve(join(homedir(), ".pi", "agent"));
const extensionsDir = resolve(join(piDir, "extensions"));
const settingsPath = resolve(join(piDir, "settings.json"));
const modelsPath = resolve(join(piDir, "models.json"));

function validateManifest(value) {
  if (value.version !== 1) throw new Error("harnesses/pi.json must have version 1.");
  if (value.harness !== "pi") throw new Error('harnesses/pi.json must have harness "pi".');

  const packages = value.packages ?? [];
  const localExtensions = value.localExtensions ?? [];
  if (packages.length === 0 && localExtensions.length === 0) {
    throw new Error("harnesses/pi.json must define at least one package or localExtension.");
  }

  for (const pkg of packages) {
    if (!pkg.name || pkg.kind !== "pi-package" || typeof pkg.defaultEnabled !== "boolean") {
      throw new Error('Each pi package entry needs name, kind "pi-package", and defaultEnabled.');
    }
    if (!pkg.source || !pkg.install) throw new Error(`${pkg.name} needs source and install.`);
  }

  for (const ext of localExtensions) {
    if (!ext.name || ext.kind !== "local-extension" || typeof ext.defaultEnabled !== "boolean") {
      throw new Error(
        'Each localExtension entry needs name, kind "local-extension", and defaultEnabled.',
      );
    }
    if (!ext.sourceFile || !ext.path) throw new Error(`${ext.name} needs sourceFile and path.`);
  }

  const settings = value.settings;
  if (settings) {
    if (!Array.isArray(settings.enabledModels)) {
      throw new Error("pi settings.enabledModels must be an array.");
    }
    if (!Array.isArray(settings.managedEnabledModelPrefixes)) {
      throw new Error("pi settings.managedEnabledModelPrefixes must be an array.");
    }
  }

  for (const provider of value.modelProviders ?? []) {
    if (!provider.name || !provider.sourceFile || typeof provider.defaultEnabled !== "boolean") {
      throw new Error("Each modelProvider needs name, sourceFile, and defaultEnabled.");
    }
  }

  const bridge = value.cursorBridge;
  if (bridge?.enabled) {
    for (const key of ["package", "configHome", "serviceTemplate", "systemdUnit"]) {
      if (!bridge[key]) throw new Error(`cursorBridge.${key} is required.`);
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

function expandTilde(value) {
  if (value.startsWith("~/")) return resolve(join(homedir(), value.slice(2)));
  return resolve(value);
}

function packagesToInstall() {
  return (manifest.packages ?? []).filter((pkg) => pkg.defaultEnabled || enableRecommended);
}

function localExtensionsToInstall() {
  return (manifest.localExtensions ?? []).filter(
    (ext) => ext.defaultEnabled || enableRecommended,
  );
}

function modelProvidersToInstall() {
  return (manifest.modelProviders ?? []).filter(
    (provider) => provider.defaultEnabled || enableRecommended,
  );
}

function currentPackageSet(settings) {
  const list = settings?.packages;
  if (!Array.isArray(list)) return new Set();
  return new Set(
    list.map((entry) => (typeof entry === "string" ? entry : entry?.source)).filter(Boolean),
  );
}

function nextSettings(currentSettings, sources) {
  const next = { ...currentSettings };
  const existing = Array.isArray(next.packages) ? [...next.packages] : [];
  const presentSources = new Set(
    existing.map((entry) => (typeof entry === "string" ? entry : entry?.source)).filter(Boolean),
  );
  for (const source of sources) {
    if (!presentSources.has(source)) {
      existing.push(source);
      presentSources.add(source);
    }
  }
  if (existing.length > 0) next.packages = existing;

  const managed = manifest.settings;
  if (managed) {
    const prefixes = managed.managedEnabledModelPrefixes;
    const enabled = Array.isArray(next.enabledModels) ? next.enabledModels : [];
    next.enabledModels = [
      ...enabled.filter(
        (entry) =>
          typeof entry === "string" && !prefixes.some((prefix) => entry.startsWith(prefix)),
      ),
      ...managed.enabledModels,
    ];
  }

  return next;
}

async function writeJsonWithBackup(filePath, nextValue, label) {
  const currentContent = await readUtf8IfExists(filePath);
  const nextContent = `${JSON.stringify(nextValue, null, 2)}\n`;
  if (currentContent === nextContent) {
    console.log(`${label} [ok]`);
    return false;
  }
  console.log(`${label} [${currentContent === null ? "missing" : "stale"}]`);
  if (dryRun) return true;

  await mkdir(dirname(filePath), { recursive: true });
  if (currentContent !== null) {
    const backupPath = `${filePath}.bak-${new Date().toISOString().replaceAll(":", "-")}`;
    await copyFile(filePath, backupPath);
    console.log(`  backed up: ${backupPath}`);
  }
  await writeFile(filePath, nextContent, "utf8");
  console.log(`  wrote: ${filePath}`);
  return true;
}

async function installLocalExtension(ext) {
  const source = resolve(harnessRoot, ext.sourceFile);
  const target = expandTilde(ext.path);
  if (!existsSync(source)) throw new Error(`Missing local extension source: ${source}`);

  const sourceContent = await readFile(source, "utf8");
  const targetContent = await readUtf8IfExists(target);
  const status = targetContent === null ? "missing" : targetContent === sourceContent ? "ok" : "stale";
  console.log(`- ${ext.name} -> ${target} [${status}]`);
  if (status === "ok") return false;
  if (dryRun) return true;

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, sourceContent, "utf8");
  console.log(`  ${status === "missing" ? "installed" : "updated"} from ${source}`);
  return true;
}

async function nextModels(currentModels, providers) {
  const next = { ...currentModels, providers: { ...(currentModels.providers ?? {}) } };
  for (const provider of providers) {
    const source = resolve(harnessRoot, provider.sourceFile);
    if (!existsSync(source)) throw new Error(`Missing provider source: ${source}`);
    next.providers[provider.name] = JSON.parse(await readFile(source, "utf8"));
  }
  return next;
}

function commandPath(name) {
  try {
    return execFileSync("which", [name], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function replaceTemplate(template, values) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Missing template value: ${key}`);
    return values[key];
  });
}

function systemdEnvironmentValue(value) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("%", "%%");
}

function commandSucceeds(command, args) {
  try {
    execFileSync(command, args, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
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

function packageParts(spec) {
  const separator = spec.lastIndexOf("@");
  if (separator <= 0) return { name: spec, version: null };
  return { name: spec.slice(0, separator), version: spec.slice(separator + 1) };
}

function globalPackageMatches(npmBin, spec) {
  const { name, version } = packageParts(spec);
  try {
    const output = execFileSync(npmBin, ["list", "--global", "--depth=0", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const installed = JSON.parse(output).dependencies?.[name]?.version;
    return Boolean(installed && (!version || installed === version));
  } catch {
    return false;
  }
}

async function setupCursorBridge() {
  const bridge = manifest.cursorBridge;
  if (!bridge?.enabled) return false;

  const configHome = expandTilde(bridge.configHome);
  const opencodeConfig = join(configHome, "opencode", "opencode.json");
  const pluginDir = join(configHome, "opencode", "plugin");
  const cursorAuthDir = join(homedir(), ".config", "cursor");
  const isolatedCursorDir = join(configHome, "cursor");
  const servicePath = expandTilde(bridge.systemdUnit);
  const refreshPath = expandTilde(bridge.refreshPath);
  const workspace = resolve(process.env[bridge.workspaceEnv] || homedir());

  console.log("\nCursor ACP provider bridge:");
  console.log(`- package: ${bridge.package}`);
  console.log(`- config: ${configHome}`);
  console.log(`- workspace: ${workspace}`);
  console.log(`- service: ${servicePath}`);

  const required = ["npm", "npx", "opencode", "cursor-agent", "curl", "systemctl"];
  const paths = Object.fromEntries(required.map((name) => [name, commandPath(name)]));
  const missing = required.filter((name) => !paths[name]);
  if (missing.length > 0) {
    console.warn(`  skipped: missing commands: ${missing.join(", ")}`);
    return false;
  }

  if (dryRun) {
    console.log(`  would install ${bridge.package} globally`);
    console.log(`  would configure isolated OpenCursor bridge and enable systemd user service`);
    return true;
  }

  let bridgeChanged = false;
  if (!globalPackageMatches(paths.npm, bridge.package)) {
    execFileSync(paths.npm, ["install", "--global", bridge.package], { stdio: "inherit" });
    bridgeChanged = true;
  } else {
    console.log(`  ${bridge.package} [ok]`);
  }

  const openCursor = commandPath("open-cursor");
  if (!openCursor) throw new Error("open-cursor missing after global install.");

  const pluginPath = join(pluginDir, "cursor-acp.js");
  if (!existsSync(opencodeConfig) || !existsSync(pluginPath)) {
    await mkdir(pluginDir, { recursive: true });
    execFileSync(
      openCursor,
      [
        "install",
        "--variants",
        "--compact",
        "--no-backup",
        "--config",
        opencodeConfig,
        "--plugin-dir",
        pluginDir,
      ],
      { stdio: "inherit" },
    );
    bridgeChanged = true;
  } else {
    console.log("  isolated OpenCursor config [ok]");
  }

  if (!(await symlinkMatches(isolatedCursorDir, cursorAuthDir))) {
    try {
      const existing = await lstat(isolatedCursorDir);
      if (existing.isSymbolicLink()) {
        await rm(isolatedCursorDir, { force: true });
      } else {
        const backup = `${isolatedCursorDir}.bak-${new Date().toISOString().replaceAll(":", "-")}`;
        await rename(isolatedCursorDir, backup);
        console.log(`  backed up existing Cursor config: ${backup}`);
      }
    } catch {
      // Missing target is expected on first setup.
    }
    await mkdir(dirname(isolatedCursorDir), { recursive: true });
    await symlink(cursorAuthDir, isolatedCursorDir, "dir");
    bridgeChanged = true;
  }
  if (!existsSync(cursorAuthDir)) {
    console.warn("  Cursor is not logged in. Run `cursor-agent login`, then restart the service.");
  }

  const serviceTemplate = await readFile(resolve(harnessRoot, bridge.serviceTemplate), "utf8");
  const service = replaceTemplate(serviceTemplate, {
    CURSOR_CONFIG_HOME: configHome,
    PATH: systemdEnvironmentValue(process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin"),
    OPENCODE_BIN: paths.opencode,
    CURL_BIN: paths.curl,
    WORKSPACE_URL: encodeURIComponent(workspace).replaceAll("%2F", "/"),
  });
  const currentService = await readUtf8IfExists(servicePath);
  const serviceChanged = currentService !== service;
  if (serviceChanged) {
    await mkdir(dirname(servicePath), { recursive: true });
    await writeFile(servicePath, service, "utf8");
    bridgeChanged = true;
  } else {
    console.log("  systemd service [ok]");
  }

  const refreshSource = resolve(harnessRoot, bridge.refreshScript);
  const refreshContent = await readFile(refreshSource, "utf8");
  const currentRefresh = await readUtf8IfExists(refreshPath);
  if (currentRefresh !== refreshContent) {
    await mkdir(dirname(refreshPath), { recursive: true });
    await writeFile(refreshPath, refreshContent, "utf8");
    bridgeChanged = true;
  }
  await chmod(refreshPath, 0o755);

  const serviceActive = commandSucceeds(paths.systemctl, [
    "--user",
    "is-active",
    "--quiet",
    "pi-cursor-provider.service",
  ]);
  if (serviceChanged) {
    execFileSync(paths.systemctl, ["--user", "daemon-reload"], { stdio: "inherit" });
  }
  if (!serviceActive || serviceChanged) {
    execFileSync(paths.systemctl, ["--user", "enable", "pi-cursor-provider.service"], {
      stdio: "inherit",
    });
    execFileSync(paths.systemctl, ["--user", "restart", "pi-cursor-provider.service"], {
      stdio: "inherit",
    });
    bridgeChanged = true;
  } else {
    console.log("  pi-cursor-provider.service [active]");
  }

  console.log(`  health: ${bridge.providerUrl.replace(/\/v1$/, "")}/health`);
  return bridgeChanged;
}

validateManifest(manifest);

const selectedPackages = packagesToInstall();
const selectedLocalExtensions = localExtensionsToInstall();
const selectedProviders = modelProvidersToInstall();
const currentSettingsContent = await readUtf8IfExists(settingsPath);
const currentSettings = currentSettingsContent ? JSON.parse(currentSettingsContent) : {};
const currentPackages = currentPackageSet(currentSettings);
const sourcesToAdd = selectedPackages
  .filter((pkg) => !currentPackages.has(pkg.source))
  .map((pkg) => pkg.source);
const updatedSettings = nextSettings(currentSettings, sourcesToAdd);

const currentModelsContent = await readUtf8IfExists(modelsPath);
const currentModels = currentModelsContent ? JSON.parse(currentModelsContent) : {};
const updatedModels = await nextModels(currentModels, selectedProviders);

console.log(
  `Pi harness: ${(manifest.packages ?? []).length} packages, ${(manifest.localExtensions ?? []).length} local extensions, ${(manifest.modelProviders ?? []).length} model providers.`,
);
console.log(`Harness root: ${harnessRoot}`);
console.log(`Mode: ${dryRun ? "dry-run" : "write"}`);

console.log("\nSelected pi packages:");
for (const pkg of selectedPackages) {
  console.log(`- ${pkg.name} (${pkg.source}) [${currentPackages.has(pkg.source) ? "ok" : "missing"}]`);
}

let changed = false;
changed = (await writeJsonWithBackup(settingsPath, updatedSettings, `Pi settings: ${settingsPath}`)) || changed;
changed = (await writeJsonWithBackup(modelsPath, updatedModels, `Pi models: ${modelsPath}`)) || changed;

if (!dryRun && sourcesToAdd.length > 0) {
  for (const pkg of selectedPackages) {
    if (!sourcesToAdd.includes(pkg.source)) continue;
    console.log(`Running: ${pkg.install} (${pkg.name})`);
    try {
      execSync(pkg.install, { stdio: "inherit" });
    } catch (error) {
      console.warn(`Warning: ${pkg.install} failed: ${error.message}`);
    }
  }
  changed = true;
}

console.log("\nLocal extensions:");
for (const ext of selectedLocalExtensions) {
  changed = (await installLocalExtension(ext)) || changed;
}

changed = (await setupCursorBridge()) || changed;

if (dryRun) {
  console.log("\nDry-run complete. Re-run without --dry-run to apply.");
} else if (!changed) {
  console.log("\nPi harness already matches selected entries.");
} else {
  console.log("\nPi harness setup complete. Restart pi to load updated models/extensions.");
}
