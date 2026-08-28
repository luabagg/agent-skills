#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ACTIONS, resolveAction } from "./lib/actions.mjs";
import { plan as createPlan } from "./lib/plan.mjs";

import { redact } from "./lib/secrets.mjs";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function failure(error, extra = {}) {
  return { ok: false, error, ...extra };
}

function actionIdFor(request) {
  return `${request.harness?.id ?? ""}.${request.action?.name ?? ""}`;
}

function resolveRequestedAction(request) {
  const id = actionIdFor(request);
  if (!ACTIONS[id]) return failure(`Unsupported action ${JSON.stringify(request.action?.name)} for harness ${JSON.stringify(request.harness?.id)}`);
  return { ok: true, id, action: ACTIONS[id] };
}

/** Handle one Agentfolio adapter request. Exported for contract tests. */
export function handleRequest(request, { run = spawnSync, root } = {}) {
  if (!request || request.protocolVersion !== 1) return failure("Unsupported or missing Agentfolio adapter protocolVersion");
  const collectionRoot = resolve(root ?? request.collection?.root ?? moduleRoot);
  const harnessId = request.harness?.id;

  if (request.operation === "doctor") {
    if (!Object.keys(ACTIONS).some((id) => id.startsWith(`${harnessId}.`))) return failure(`Unsupported harness ${JSON.stringify(harnessId)}`);
    const declaredActions = request.harness.actions?.length
      ? request.harness.actions : Object.keys(ACTIONS).filter((id) => id.startsWith(`${harnessId}.`)).map((id) => ({ action: id.split(".").slice(1).join(".") }));
    const checks = [];
    for (const [index, config] of declaredActions.entries()) {
      const id = `${harnessId}.${config.action}`;
      const action = ACTIONS[id];
      if (!action) {
        checks.push({ id: `action-${index}-${config.action ?? "missing"}`, ok: false, required: true,
          detail: `Unsupported action ${JSON.stringify(config.action)} for harness ${JSON.stringify(harnessId)}` });
        continue;
      }
      const scriptPath = resolve(collectionRoot, action.args.find((arg) => arg.startsWith("scripts/")) ?? "scripts/cli.mjs");
      checks.push({ id: (action.script ?? id).replace(/\.mjs$/, ""), ok: existsSync(scriptPath), required: true, detail: scriptPath });
      for (const field of ["manifest", "catalog", "lock", "source"]) {
        if (config[field] === undefined) continue;
        const assetPath = typeof config[field] === "string" ? resolve(collectionRoot, config[field]) : String(config[field]);
        checks.push({ id: `${config.action}.${field}`, ok: typeof config[field] === "string" && existsSync(assetPath), required: true, detail: assetPath });
      }
    }
    return { ok: true, checks };
  }

  if (!["plan", "apply"].includes(request.operation)) return failure(`Unsupported operation ${JSON.stringify(request.operation)}`);
  const resolved = resolveRequestedAction(request);
  if (!resolved.ok) return resolved;
  const extraArgs = request.action?.config?.args ?? [];
  if (!Array.isArray(extraArgs) || extraArgs.some((arg) => typeof arg !== "string" || !arg)) return failure("action args must be an array of non-empty strings");
  if (resolved.id === "pi-catalog.configure" && extraArgs.includes("--catalog-only")) return failure("pi-catalog.configure supplies --catalog-only; do not pass it twice");
  const action = resolveAction(resolved.id, extraArgs);
  const displayCommand = ["agent-skills", ...resolved.action.cliArgs, ...extraArgs];
  const summary = request.action?.config?.summary ?? resolved.action.summary;
  if (request.operation === "plan") {
    const result = createPlan({ actionId: resolved.id, extraArgs, summary }, { processes: [{ executable: action.executable, args: action.args }] });
    return { ...result, changed: false, command: displayCommand };
  }

  const cliPath = resolve(collectionRoot, "scripts", "cli.mjs");
  const args = [cliPath, ...resolved.action.cliArgs, ...extraArgs];
  if (request.dryRun) args.push("--dry-run");
  const result = run(process.execPath, args, { cwd: collectionRoot, encoding: "utf8", env: process.env });
  const stdout = redact(result.stdout ?? "", process.env);
  const stderr = redact(result.stderr ?? "", process.env);
  if (result.error) return failure(redact(result.error.message, process.env), { status: 1, stderr });
  if (result.status !== 0) {
    const detail = [stderr, stdout].filter(Boolean).join("\n").trim() || `Setup failed for ${harnessId}`;
    return failure(detail, { status: result.status ?? 1, stdout, stderr, command: displayCommand });
  }
  const response = { ok: true, summary, status: 0, command: displayCommand, stdout, stderr };
  if (request.dryRun) response.changed = false;
  return response;
}

function main() {
  try { process.stdout.write(`${JSON.stringify(handleRequest(JSON.parse(readFileSync(0, "utf8"))))}\n`); }
  catch (error) { process.stdout.write(`${JSON.stringify(failure(error.message))}\n`); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
