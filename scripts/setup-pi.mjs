#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { validateVector } from "./lib/manifest.mjs";
import { spawnInherited } from "./lib/process.mjs";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const enableRecommended = args.has("--enable-recommended");
const catalogOnly = args.has("--catalog-only");
const unknownArgs = [...args].filter(
  (arg) => !["--dry-run", "--enable-recommended", "--catalog-only"].includes(arg),
);
if (unknownArgs.length > 0) {
  console.error(
    `Unknown setup-pi flag(s): ${unknownArgs.join(", ")}. Supported: --dry-run, --enable-recommended, --catalog-only.`,
  );
  process.exit(1);
}
const manifestPath = new URL("../harnesses/pi.json", import.meta.url);
const harnessRoot = resolve(fileURLToPath(new URL("../harnesses/pi/", import.meta.url)));
const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const catalogPath = new URL("../harnesses/catalog.yaml", import.meta.url);
const catalogLockPath = new URL("../harnesses/catalog.lock.json", import.meta.url);
const catalog = parseYaml(await readFile(catalogPath, "utf8"));
const catalogLock = JSON.parse(await readFile(catalogLockPath, "utf8"));

const piDir = resolve(join(homedir(), ".pi", "agent"));
const settingsPath = resolve(join(piDir, "settings.json"));
const installedCatalogLockPath = resolve(join(piDir, "catalog.lock.json"));

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
    validateVector(`${pkg.name}.install`, "pi", pkg.install);
    if (pkg.install.args.at(-1) !== pkg.source) throw new Error(`${pkg.name}.install must end with source.`);
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
  if (settings && (!settings.catalogScope || !catalog.piScopes?.[settings.catalogScope])) {
    throw new Error("pi settings.catalogScope must reference a catalog piScope.");
  }
  if (settings?.defaultSelector && !catalog.piScopes[settings.catalogScope].includes(settings.defaultSelector)) {
    throw new Error("pi settings.defaultSelector must belong to the selected catalog Scope.");
  }
  if (settings?.defaultThinkingLevel && !["off", "minimal", "low", "medium", "high", "xhigh", "max"].includes(settings.defaultThinkingLevel)) {
    throw new Error("pi settings.defaultThinkingLevel is invalid.");
  }
}

async function readUtf8IfExists(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function expandTilde(value) {
  if (value.startsWith("~/")) return resolve(join(homedir(), value.slice(2)));
  return resolve(value);
}

function currentPackageSet(settings) {
  const list = settings?.packages;
  if (!Array.isArray(list)) return new Set();
  return new Set(
    list.map((entry) => (typeof entry === "string" ? entry : entry?.source)).filter(Boolean),
  );
}

function resolvedScope(scopeId) {
  const selectors = catalog.piScopes[scopeId];
  const enabledModels = [];
  const managedPrefixes = new Set();
  for (const selectorId of selectors) {
    const resolved = catalogLock.resolvedSelectors?.[selectorId];
    if (!resolved) throw new Error(`Catalog lock is missing selector ${selectorId}.`);
    const prefix = catalog.providers?.[resolved.provider]?.harnessIds?.pi;
    if (!prefix) throw new Error(`Catalog provider ${resolved.provider} has no Pi harness ID.`);
    managedPrefixes.add(`${prefix}/`);
    enabledModels.push(`${prefix}/${resolved.modelId}`);
  }
  return { enabledModels, managedPrefixes: [...managedPrefixes] };
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
    const resolved = resolvedScope(managed.catalogScope);
    const enabled = Array.isArray(next.enabledModels) ? next.enabledModels : [];
    next.enabledModels = [
      ...enabled.filter(
        (entry) =>
          typeof entry === "string" &&
          !resolved.managedPrefixes.some((prefix) => entry.startsWith(prefix)),
      ),
      ...resolved.enabledModels,
    ];
    if (managed.defaultSelector) {
      const selected = catalogLock.resolvedSelectors[managed.defaultSelector];
      next.defaultProvider = catalog.providers[selected.provider].harnessIds.pi;
      next.defaultModel = selected.modelId;
    }
    if (managed.defaultThinkingLevel) next.defaultThinkingLevel = managed.defaultThinkingLevel;
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

async function installCatalogLock() {
  const sourceContent = await readFile(catalogLockPath, "utf8");
  const currentContent = await readUtf8IfExists(installedCatalogLockPath);
  const status = currentContent === null ? "missing" : currentContent === sourceContent ? "ok" : "stale";
  console.log(`Catalog lock -> ${installedCatalogLockPath} [${status}]`);
  if (status === "ok") return false;
  if (dryRun) return true;
  await mkdir(dirname(installedCatalogLockPath), { recursive: true });
  await writeFile(installedCatalogLockPath, sourceContent, "utf8");
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

async function main() {
  execFileSync(process.execPath, [fileURLToPath(new URL("./catalog.mjs", import.meta.url)), "check"], {
    stdio: "inherit",
  });
  validateManifest(manifest);

  const selectedPackages = catalogOnly ? [] : (manifest.packages ?? []).filter(
    (pkg) => pkg.defaultEnabled || enableRecommended,
  );
  const selectedLocalExtensions = catalogOnly ? [] : (manifest.localExtensions ?? []).filter(
    (ext) => ext.defaultEnabled || enableRecommended,
  );
  const currentSettingsContent = await readUtf8IfExists(settingsPath);
  const currentSettings = currentSettingsContent ? JSON.parse(currentSettingsContent) : {};
  const currentPackages = currentPackageSet(currentSettings);
  const sourcesToAdd = selectedPackages
    .filter((pkg) => !currentPackages.has(pkg.source))
    .map((pkg) => pkg.source);
  const updatedSettings = nextSettings(currentSettings, sourcesToAdd);

  console.log(
    `Pi harness: ${(manifest.packages ?? []).length} packages, ${(manifest.localExtensions ?? []).length} local extensions.`,
  );
  console.log(`Harness root: ${harnessRoot}`);
  console.log(`Mode: ${dryRun ? "dry-run" : "write"}`);
  console.log(`Phases: ${catalogOnly ? "catalog" : "catalog, packages, extensions"}`);
  if (catalogOnly) {
    console.log("Catalog-only: applying lock and Scope models; skipping packages/extensions.");
  } else {
    console.log("\nSelected pi packages:");
    for (const pkg of selectedPackages) {
      console.log(`- ${pkg.name} (${pkg.source}) [${currentPackages.has(pkg.source) ? "ok" : "missing"}]`);
    }
  }

  let changed = await writeJsonWithBackup(settingsPath, updatedSettings, `Pi settings: ${settingsPath}`);
  changed = (await installCatalogLock()) || changed;

  for (const pkg of selectedPackages) {
    if (!sourcesToAdd.includes(pkg.source)) continue;
    if (dryRun) {
      console.log(` would run: ${pkg.install.executable} ${pkg.install.args.join(" ")} (${pkg.name})`);
    } else {
      console.log(`Running: ${pkg.install.executable} ${pkg.install.args.join(" ")} (${pkg.name})`);
      const result = await spawnInherited({ executable: pkg.install.executable, args: pkg.install.args, cwd: repoRoot, env: process.env });
      if (result.status !== 0) throw new Error(`Command failed with status ${result.status}: ${pkg.name}`);
    }
    changed = true;
  }

  if (!catalogOnly) {
    console.log("\nLocal extensions:");
    for (const ext of selectedLocalExtensions) {
      changed = (await installLocalExtension(ext)) || changed;
    }
  }

  if (dryRun) {
    console.log("\nDry-run complete. Re-run without --dry-run to apply.");
  } else if (!changed) {
    console.log("\nPi harness already matches selected entries.");
  } else if (catalogOnly) {
    console.log("\nPi catalog apply complete. Restart pi to load updated Scope models.");
  } else {
    console.log("\nPi harness setup complete. Restart pi to load updated models/extensions.");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
