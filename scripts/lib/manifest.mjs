import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const SAFE = /^[A-Za-z0-9_./:@=*-]+$/;
const RULES = {
  global: { npx: new Set(["--yes", "skills", "add", "."]) },
  pi: { pi: new Set(["install", "--list-models"]) },
  opencode: { bunx: new Set(["oh-my-openagent", "install"]) },
};

export function validateVector(field, collection, vector) {
  if (!vector || typeof vector !== "object" || typeof vector.executable !== "string" || !Array.isArray(vector.args)) {
    throw new Error(`${field} must contain executable and args`);
  }
  if (!vector.args.length || vector.args.some((arg) => typeof arg !== "string" || !arg || !SAFE.test(arg))) {
    throw new Error(`${field} contains unsafe or empty argument`);
  }
  if (vector.args.some((arg) => arg === ".." || arg.startsWith("../") || arg.includes("/../") || isAbsolute(arg))) {
    throw new Error(`${field} contains path traversal or absolute path`);
  }
  const allowed = RULES[collection]?.[vector.executable];
  if (!allowed || !allowed.has(vector.args[0])) throw new Error(`${field} has unsupported executable/subcommand`);
  return vector;
}

function assertKeys(value, allowed, field) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${field}.${key} is an unknown manifest key`);
}

function inside(root, candidate, field) {
  const resolved = resolve(root, candidate);
  if (relative(root, resolved).startsWith("..") || isAbsolute(relative(root, resolved)) || !existsSync(resolved)) {
    throw new Error(`${field} must exist inside ${root}`);
  }
}

export function validateCollectionManifest(collection, value) {
  if (!value || typeof value !== "object") throw new Error(`${collection} manifest must be an object`);
  if (collection === "pi") {
    if (value.harness !== "pi") throw new Error("pi.harness must be pi");
    for (const [i, pkg] of (value.packages ?? []).entries()) {
      if (!pkg.name || pkg.kind !== "pi-package" || !pkg.source) throw new Error(`pi.packages[${i}] is malformed`);
      validateVector(`pi.packages[${i}].install`, "pi", pkg.install);
      if (pkg.install.args.at(-1) !== pkg.source) throw new Error(`pi.packages[${i}].install must end with source`);
    }
    for (const [i, ext] of (value.localExtensions ?? []).entries()) {
      if (!ext.sourceFile) throw new Error(`pi.localExtensions[${i}].sourceFile is required`);
      inside(resolve("harnesses/pi"), ext.sourceFile, `pi.localExtensions[${i}].sourceFile`);
    }
  } else if (collection === "opencode") {
    if (value.harness !== "opencode") throw new Error("opencode.harness must be opencode");
    const names = new Set();
    for (const [i, agent] of (value.agents ?? []).entries()) {
      if (names.has(agent.name)) throw new Error(`opencode.agents[${i}].name is duplicated`);
      names.add(agent.name); inside(resolve("harnesses/opencode"), agent.sourceFile, `opencode.agents[${i}].sourceFile`);
    }
    for (const [i, plugin] of (value.plugins ?? []).entries()) if (plugin.install) validateVector(`opencode.plugins[${i}].install`, "opencode", plugin.install);
  } else if (collection === "cursor") {
    if (value.harness !== "cursor") throw new Error("cursor.harness must be cursor");
    const names = new Set();
    for (const [i, agent] of (value.agents ?? []).entries()) {
      if (names.has(agent.name)) throw new Error(`cursor.agents[${i}].name is duplicated`);
      names.add(agent.name); inside(resolve("harnesses/cursor"), agent.sourceFile, `cursor.agents[${i}].sourceFile`);
    }
  }
  return { ok: true, warnings: [] };
}
