#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ACTIONS = Object.freeze({
  global: Object.freeze({
    "add-curated-skills": {
      cliArgs: ["install", "curated"],
      script: "install-curated-skills.mjs",
      checkId: "install-curated-skills",
      summary: "Install curated skills",
    },
    "add-instructions": {
      cliArgs: ["install", "agents"],
      script: "install-agents.mjs",
      checkId: "install-agents",
      summary: "Install global agent instructions",
    },
  }),
  pi: Object.freeze({
    configure: {
      cliArgs: ["setup", "pi"],
      script: "setup-pi.mjs",
      checkId: "setup-pi",
      summary: "Configure Pi",
    },
  }),
  "pi-catalog": Object.freeze({
    configure: {
      cliArgs: ["setup", "pi"],
      script: "setup-pi.mjs",
      checkId: "setup-pi",
      summary: "Configure Pi catalog",
    },
  }),
  cursor: Object.freeze({
    "add-agents": {
      cliArgs: ["setup", "cursor"],
      script: "setup-cursor.mjs",
      checkId: "setup-cursor",
      summary: "Install Cursor agents",
    },
  }),
  opencode: Object.freeze({
    "configure-plugins-and-agents": {
      cliArgs: ["setup", "opencode"],
      script: "setup-opencode.mjs",
      checkId: "setup-opencode",
      summary: "Configure OpenCode plugins and agents",
    },
  }),
});

function failure(error, extra = {}) {
  return { ok: false, error, ...extra };
}

function resolveAction(request) {
  const harnessId = request.harness?.id;
  const actionName = request.action?.name;
  const implementation = ACTIONS[harnessId]?.[actionName];
  if (!implementation) {
    return failure(`Unsupported action ${JSON.stringify(actionName)} for harness ${JSON.stringify(harnessId)}`);
  }
  return { ok: true, harnessId, actionName, implementation };
}

/** Handle one Agentfolio adapter request. Exported for contract tests. */
export function handleRequest(request, { run = spawnSync, root } = {}) {
  if (!request || request.protocolVersion !== 1) {
    return failure("Unsupported or missing Agentfolio adapter protocolVersion");
  }
  const collectionRoot = resolve(root ?? request.collection?.root ?? moduleRoot);
  const harnessId = request.harness?.id;

  if (request.operation === "doctor") {
    const implementations = ACTIONS[harnessId];
    if (!implementations) return failure(`Unsupported harness ${JSON.stringify(harnessId)}`);
    const declaredActions = request.harness.actions?.length
      ? request.harness.actions
      : Object.keys(implementations).map((action) => ({ action }));
    const checks = [];

    for (const [index, config] of declaredActions.entries()) {
      const implementation = implementations[config.action];
      if (!implementation) {
        checks.push({
          id: `action-${index}-${config.action ?? "missing"}`,
          ok: false,
          required: true,
          detail: `Unsupported action ${JSON.stringify(config.action)} for harness ${JSON.stringify(harnessId)}`,
        });
        continue;
      }

      const scriptPath = resolve(collectionRoot, "scripts", implementation.script);
      checks.push({
        id: implementation.checkId,
        ok: existsSync(scriptPath),
        required: true,
        detail: scriptPath,
      });

      for (const field of ["manifest", "catalog", "lock", "source"]) {
        if (config[field] === undefined) continue;
        const assetPath = typeof config[field] === "string"
          ? resolve(collectionRoot, config[field])
          : String(config[field]);
        checks.push({
          id: `${config.action}.${field}`,
          ok: typeof config[field] === "string" && existsSync(assetPath),
          required: true,
          detail: assetPath,
        });
      }
    }

    return { ok: true, checks };
  }

  if (!["plan", "apply"].includes(request.operation)) {
    return failure(`Unsupported operation ${JSON.stringify(request.operation)}`);
  }

  const resolved = resolveAction(request);
  if (!resolved.ok) return resolved;
  const { implementation } = resolved;
  const extraArgs = request.action.config.args ?? [];
  if (!Array.isArray(extraArgs) || extraArgs.some((arg) => typeof arg !== "string" || !arg)) {
    return failure("action args must be an array of non-empty strings");
  }
  const displayCommand = ["agent-skills", ...implementation.cliArgs, ...extraArgs];
  const summary = request.action.config.summary ?? implementation.summary;

  if (request.operation === "plan") {
    return { ok: true, summary, changed: false, command: displayCommand };
  }

  const cliPath = resolve(collectionRoot, "scripts", "cli.mjs");
  const args = [cliPath, ...implementation.cliArgs, ...extraArgs];
  if (request.dryRun) args.push("--dry-run");
  const result = run(process.execPath, args, {
    cwd: collectionRoot,
    encoding: "utf8",
    env: process.env,
  });
  if (result.error) return failure(result.error.message, { status: 1, stderr: result.error.message });
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim()
      || `Setup failed for ${harnessId}`;
    return failure(detail, {
      status: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      command: displayCommand,
    });
  }
  const response = {
    ok: true,
    summary,
    status: 0,
    command: displayCommand,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
  if (request.dryRun) response.changed = false;
  return response;
}

function main() {
  try {
    const input = readFileSync(0, "utf8");
    const request = JSON.parse(input);
    process.stdout.write(`${JSON.stringify(handleRequest(request))}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify(failure(error.message))}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
