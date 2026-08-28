const action = (executable, args, metadata = {}) => Object.freeze({
  executable,
  args: Object.freeze([...args]),
  ...metadata,
});

export const ACTIONS = Object.freeze({
  "global.add-curated-skills": action("npx", ["--yes", "skills", "add", "."], {
    cliArgs: ["install", "curated"], script: "install-curated-skills.mjs",
    summary: "Install curated skills",
  }),
  "global.add-instructions": action(process.execPath, ["scripts/install-agents.mjs"], {
    cliArgs: ["install", "agents"], script: "install-agents.mjs",
    summary: "Install global agent instructions",
  }),
  "pi.configure": action(process.execPath, ["scripts/setup-pi.mjs"], {
    cliArgs: ["setup", "pi"], script: "setup-pi.mjs", summary: "Configure Pi",
  }),
  "pi-catalog.configure": action(process.execPath, ["scripts/setup-pi.mjs", "--catalog-only"], {
    cliArgs: ["setup", "pi"], script: "setup-pi.mjs", summary: "Configure Pi catalog",
  }),
  "cursor.add-agents": action(process.execPath, ["scripts/setup-cursor.mjs"], {
    cliArgs: ["setup", "cursor"], script: "setup-cursor.mjs", summary: "Install Cursor agents",
  }),
  "opencode.configure-plugins-and-agents": action(process.execPath, ["scripts/setup-opencode.mjs"], {
    cliArgs: ["setup", "opencode"], script: "setup-opencode.mjs",
    summary: "Configure OpenCode plugins and agents",
  }),
});

export function resolveAction(id, extraArgs = []) {
  const base = ACTIONS[id];
  if (!base) throw new Error(`Unknown action ${JSON.stringify(id)}`);
  if (!Array.isArray(extraArgs) || extraArgs.some((arg) => typeof arg !== "string" || arg.length === 0)) {
    throw new Error("Action args must be non-empty strings");
  }
  return Object.freeze({ ...base, args: Object.freeze(base.args.concat(extraArgs)) });
}

export function actionIdForScript(script) {
  return Object.keys(ACTIONS).find((id) => ACTIONS[id].script === script);
}
