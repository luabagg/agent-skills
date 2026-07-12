#!/usr/bin/env node

import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
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

function validateManifest(value) {
  if (value.version !== 1) {
    throw new Error("harnesses/pi.json must have version 1.");
  }

  if (value.harness !== "pi") {
    throw new Error('harnesses/pi.json must have harness "pi".');
  }

  const packages = value.packages ?? [];
  const localExtensions = value.localExtensions ?? [];

  if (packages.length === 0 && localExtensions.length === 0) {
    throw new Error("harnesses/pi.json must define at least one package or localExtension.");
  }

  for (const pkg of packages) {
    if (!pkg.name || pkg.kind !== "pi-package" || typeof pkg.defaultEnabled !== "boolean") {
      throw new Error('Each pi package entry needs name, kind "pi-package", and defaultEnabled.');
    }
    if (!pkg.source) {
      throw new Error(`${pkg.name} is missing source.`);
    }
    if (!pkg.install) {
      throw new Error(`${pkg.name} is missing install command.`);
    }
  }

  for (const ext of localExtensions) {
    if (!ext.name || ext.kind !== "local-extension" || typeof ext.defaultEnabled !== "boolean") {
      throw new Error(
        'Each localExtension entry needs name, kind "local-extension", and defaultEnabled.',
      );
    }
    if (!ext.sourceFile) {
      throw new Error(`${ext.name} is missing sourceFile.`);
    }
    if (!ext.path) {
      throw new Error(`${ext.name} is missing path.`);
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

function expandTilde(p) {
  if (p.startsWith("~/")) {
    return resolve(join(homedir(), p.slice(2)));
  }
  return resolve(p);
}

function packagesToInstall() {
  const packages = manifest.packages ?? [];
  return packages.filter((pkg) => pkg.defaultEnabled || enableRecommended);
}

function localExtensionsToInstall() {
  const extensions = manifest.localExtensions ?? [];
  return extensions.filter((ext) => ext.defaultEnabled || enableRecommended);
}

function currentPackageSet(settings) {
  const list = settings?.packages;
  if (!Array.isArray(list)) {
    return new Set();
  }
  return new Set(
    list.map((entry) => (typeof entry === "string" ? entry : entry?.source)).filter(Boolean),
  );
}

function nextSettings(currentSettings, sources) {
  if (sources.length === 0) {
    return currentSettings;
  }
  const next = { ...currentSettings };
  const existing = Array.isArray(next.packages) ? [...next.packages] : [];
  const presentSources = new Set(
    existing.map((e) => (typeof e === "string" ? e : e?.source)).filter(Boolean),
  );
  for (const source of sources) {
    if (!presentSources.has(source)) {
      existing.push(source);
      presentSources.add(source);
    }
  }
  next.packages = existing;
  return next;
}

async function installLocalExtension(ext) {
  const source = resolve(harnessRoot, ext.sourceFile);
  const target = expandTilde(ext.path);

  if (!existsSync(source)) {
    throw new Error(`Missing local extension source: ${source}`);
  }

  const sourceContent = await readFile(source, "utf8");
  const targetContent = await readUtf8IfExists(target);
  const status =
    targetContent === null ? "missing" : targetContent === sourceContent ? "ok" : "stale";

  if (status === "ok") {
    console.log(`- ${ext.name} -> ${target} [ok]`);
    return false;
  }

  console.log(`- ${ext.name} -> ${target} [${status}]`);

  if (dryRun) {
    console.log(`  would ${status === "missing" ? "install" : "update"} from ${source}`);
    return true;
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, sourceContent, "utf8");
  console.log(`  ${status === "missing" ? "installed" : "updated"} from ${source}`);
  return true;
}

validateManifest(manifest);

const selectedPackages = packagesToInstall();
const selectedLocalExtensions = localExtensionsToInstall();
const currentContent = await readUtf8IfExists(settingsPath);
const currentSettings = currentContent ? JSON.parse(currentContent) : {};
const currentPackages = currentPackageSet(currentSettings);
const sourcesToAdd = selectedPackages
  .filter((pkg) => !currentPackages.has(pkg.source))
  .map((pkg) => pkg.source);
const updatedSettings = nextSettings(currentSettings, sourcesToAdd);
const settingsChanged = JSON.stringify(currentSettings) !== JSON.stringify(updatedSettings);

const packageCount = (manifest.packages ?? []).length;
const localExtCount = (manifest.localExtensions ?? []).length;

console.log(`Pi harness manifest: ${packageCount} packages, ${localExtCount} local extensions tracked.`);
console.log(`Harness root: ${harnessRoot}`);
console.log(`Settings: ${settingsPath}`);
console.log(`Extensions dir: ${extensionsDir}`);
console.log(`Mode: ${dryRun ? "dry-run" : "write"}`);

if (selectedPackages.length === 0) {
  console.log("No pi packages selected. Pass --enable-recommended to add recommended packages.");
} else {
  console.log("Selected pi packages:");
  for (const pkg of selectedPackages) {
    const status = currentPackages.has(pkg.source) ? "ok" : "missing";
    console.log(`- ${pkg.name} (${pkg.source}) [${status}]`);
  }
}

let changed = false;

if (!settingsChanged) {
  console.log("\nPi settings already matches selected package entries.");
} else {
  const nextContent = `${JSON.stringify(updatedSettings, null, 2)}\n`;

  if (dryRun) {
    console.log("\nWould update pi settings.json packages:");
    console.log(`  add: ${sourcesToAdd.join(", ")}`);
    console.log("\nWould write:");
    console.log(nextContent);
  } else {
    await mkdir(dirname(settingsPath), { recursive: true });
    if (currentContent !== null) {
      const backupPath = `${settingsPath}.bak-${new Date().toISOString().replaceAll(":", "-")}`;
      await copyFile(settingsPath, backupPath);
      console.log(`Backed up existing settings: ${backupPath}`);
    }

    await writeFile(settingsPath, nextContent, "utf8");
    console.log("Pi settings updated. Run `pi install` or restart pi to materialize missing packages.");
    changed = true;
  }
}

if (!dryRun && sourcesToAdd.length > 0) {
  for (const pkg of selectedPackages) {
    if (!sourcesToAdd.includes(pkg.source)) {
      continue;
    }
    console.log(`Running: ${pkg.install} (${pkg.name})`);
    try {
      execSync(pkg.install, { stdio: "inherit" });
    } catch (error) {
      console.warn(`Warning: ${pkg.install} failed for ${pkg.name}: ${error.message}`);
      console.warn("Package will be installed on next pi startup from settings.json packages.");
    }
  }
  changed = true;
}

if (selectedLocalExtensions.length === 0) {
  console.log("\nNo local extensions selected.");
} else {
  console.log("\nLocal extensions:");
  for (const ext of selectedLocalExtensions) {
    const didChange = await installLocalExtension(ext);
    if (didChange) {
      changed = true;
    }
  }
}

if (dryRun) {
  if (!settingsChanged && !changed) {
    console.log("\nPi harness already matches selected entries.");
  } else {
    console.log("\nDry-run complete. Re-run without --dry-run to apply.");
  }
  process.exit(0);
}

if (!changed) {
  console.log("\nPi harness already matches selected entries.");
} else {
  console.log("\nPi harness setup complete. Restart pi to load new/updated extensions.");
}
