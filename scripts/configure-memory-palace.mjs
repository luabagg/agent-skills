#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const printOnly = args.includes("--print");
const help = args.includes("--help") || args.includes("-h");
const configPath = resolve(join(homedir(), ".agents", "memory-palace", "config.json"));

function argValue(name) {
  const equals = args.find((arg) => arg.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

function usage() {
  console.log(`Usage: node scripts/configure-memory-palace.mjs --vault <path>

Options:
  --vault <path>   Obsidian vault path to persist
  --print          Print persisted config path and value
  --dry-run        Validate and show what would be saved
  --help           Show this help

Environment:
  MEMORY_PALACE_VAULT can provide the vault path when --vault is omitted.

WSL:
  Paste the Windows path from Explorer, for example:
    C:\\Users\\luanb\\Documentos\\Obsidian Vaults\\obsidian-vault

  When running under WSL, this script converts it to:
    /mnt/c/Users/luanb/Documentos/Obsidian Vaults/obsidian-vault
`);
}

function isWindowsPath(value) {
  return /^[A-Za-z]:[\\/]/.test(value);
}

async function isWsl() {
  if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
  try {
    const version = await readFile("/proc/version", "utf8");
    return /microsoft|wsl/i.test(version);
  } catch {
    return false;
  }
}

function expandHome(value) {
  if (value === "~") return homedir();
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return join(homedir(), value.slice(2));
  }
  return value;
}

async function normalizeVaultPath(value) {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) throw new Error("Vault path cannot be empty.");

  if (isWindowsPath(trimmed) && (await isWsl())) {
    const drive = trimmed[0].toLowerCase();
    const rest = trimmed.slice(2).replaceAll("\\", "/").replace(/^\/+/, "");
    return `/mnt/${drive}/${rest}`;
  }

  if (isWindowsPath(trimmed)) {
    return trimmed.replaceAll("\\", "/");
  }

  return resolve(expandHome(trimmed));
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function validateVaultPath(path) {
  if (!(await isDirectory(path))) {
    throw new Error(`Vault path is not a directory: ${path}`);
  }

  const markers = [
    ".obsidian",
    "wiki",
    "wiki/index.md",
    "raw",
    "AGENTS.md",
  ];
  const present = markers.filter((marker) => existsSync(join(path, marker)));
  const looksLikeVault =
    present.includes(".obsidian") ||
    (present.includes("wiki") && present.includes("raw")) ||
    (present.includes("wiki") && present.includes("AGENTS.md")) ||
    present.includes("wiki/index.md");

  if (!looksLikeVault) {
    throw new Error(
      `Path does not look like the memory palace vault: ${path}\n` +
        `Expected .obsidian, wiki/index.md, or wiki plus raw/AGENTS.md markers.`,
    );
  }
}

async function readConfig() {
  try {
    return JSON.parse(await readFile(configPath, "utf8"));
  } catch {
    return null;
  }
}

async function promptForVaultPath() {
  const rl = createInterface({ input, output });
  try {
    return await rl.question("Memory palace vault path (WSL: paste the Windows path from Explorer): ");
  } finally {
    rl.close();
  }
}

if (help) {
  usage();
  process.exit(0);
}

if (printOnly) {
  const config = await readConfig();
  console.log(`Config: ${configPath}`);
  console.log(`Vault: ${config?.vaultPath ?? "not configured"}`);
  process.exit(config?.vaultPath ? 0 : 1);
}

const provided = argValue("--vault") ?? process.env.MEMORY_PALACE_VAULT ?? (process.stdin.isTTY ? await promptForVaultPath() : null);

if (!provided) {
  usage();
  throw new Error("Provide --vault <path> or set MEMORY_PALACE_VAULT.");
}

const normalizedPath = await normalizeVaultPath(provided);
await validateVaultPath(normalizedPath);

const config = {
  vaultPath: normalizedPath,
  configuredAt: new Date().toISOString(),
  sourceInput: provided,
};

console.log(`${dryRun ? "would save" : "save"} ${configPath}`);
console.log(`vaultPath=${normalizedPath}`);

if (!dryRun) {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
