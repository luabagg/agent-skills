#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { npx, runCommand } from "./lib/command.mjs";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const node = process.execPath;

const FLAG_SPECS = {
  dryRun: { name: "--dry-run", description: "Preview without writing" },
  copy: { name: "--copy", description: "Copy files instead of symlinking" },
  enableRecommended: {
    name: "--enable-recommended",
    description: "Include recommended/optional harness entries",
  },
  catalogOnly: {
    name: "--catalog-only",
    description: "Pi only: apply catalog lock, Scope models, and model providers",
  },
  skipCursorBridge: {
    name: "--skip-cursor-bridge",
    description: "Pi only: skip Cursor ACP bridge install",
  },
  installed: { name: "--installed", description: "List globally installed skills" },
  json: { name: "--json", description: "Machine-readable JSON output" },
  vault: {
    name: "--vault",
    description: "Memory Palace vault path",
    takesValue: true,
  },
};

const COMMANDS = {
  skills: {
    description: "List personal or installed skills",
    subcommands: {
      list: {
        description: "List skills (repo personal skills by default)",
        flags: ["installed", "json"],
        run(flags) {
          if (flags.installed) {
            const args = [npx, "--yes", "skills", "list", "--global"];
            if (flags.json) args.push("--json");
            return external(args);
          }
          if (flags.json) {
            fail("`--json` is only supported with `--installed`.");
          }
          return external([npx, "--yes", "skills", "add", ".", "--list"]);
        },
      },
    },
  },
  install: {
    description: "Install skills, agents, or everything default",
    subcommands: {
      skills: {
        description: "Install personal skills from skills/",
        flags: ["copy", "dryRun"],
        run: (flags) => script("install-personal-skills.mjs", packFlags(flags, ["copy", "dryRun"])),
      },
      curated: {
        description: "Install curated third-party skill sources",
        flags: ["copy", "dryRun"],
        run: (flags) => script("install-curated-skills.mjs", packFlags(flags, ["copy", "dryRun"])),
      },
      agents: {
        description: "Install global AGENTS.global.md into supported harnesses",
        flags: ["copy", "dryRun"],
        run: (flags) => script("install-agents.mjs", packFlags(flags, ["copy", "dryRun"])),
      },
      all: {
        description: "Install personal skills, curated skills, and global agents",
        flags: ["copy", "dryRun"],
        run(flags) {
          const shared = packFlags(flags, ["copy", "dryRun"]);
          return sequence([
            () => script("install-personal-skills.mjs", shared),
            () => script("install-curated-skills.mjs", shared),
            () => script("install-agents.mjs", shared),
          ]);
        },
      },
    },
  },
  setup: {
    description: "Opt-in harness and tool setup",
    subcommands: {
      "memory-palace": {
        description: "Persist the default memory-palace vault path",
        flags: ["dryRun", "vault"],
        run(flags, rest) {
          const args = packFlags(flags, ["dryRun"]);
          if (flags.vault) {
            args.push("--vault", flags.vault);
          }
          // Forward any leftover args (legacy: --vault path as two tokens already handled).
          args.push(...rest);
          return script("configure-memory-palace.mjs", args);
        },
      },
      opencode: {
        description: "Install OpenCode agents/plugins from harnesses/opencode.json",
        flags: ["dryRun", "enableRecommended"],
        run: (flags) =>
          script("setup-opencode.mjs", packFlags(flags, ["dryRun", "enableRecommended"])),
      },
      pi: {
        description: "Install Pi packages, catalog Scope, extensions, and optional Cursor bridge",
        flags: ["dryRun", "enableRecommended", "catalogOnly", "skipCursorBridge"],
        run(flags) {
          if (flags.catalogOnly && flags.skipCursorBridge) {
            fail("`--catalog-only` already skips the Cursor bridge; omit `--skip-cursor-bridge`.");
          }
          return script(
            "setup-pi.mjs",
            packFlags(flags, ["dryRun", "enableRecommended", "catalogOnly", "skipCursorBridge"]),
          );
        },
      },
      cursor: {
        description: "Install Cursor user-scope subagents",
        flags: ["dryRun", "copy"],
        run: (flags) => script("setup-cursor.mjs", packFlags(flags, ["dryRun", "copy"])),
      },
    },
  },
  catalog: {
    description: "Validate or refresh the model/agent catalog",
    subcommands: {
      check: {
        description: "Offline validation of policy, lock, and generated targets",
        run: () => script("catalog.mjs", ["check"]),
      },
      diff: {
        description: "Live discovery preview without writing",
        run: () => script("catalog.mjs", ["diff"]),
      },
      refresh: {
        description: "Refresh lock and generated targets from live discovery",
        run: () => script("catalog.mjs", ["refresh"]),
      },
    },
  },
  update: {
    description: "Update already-installed skills globally",
    run: () => external([npx, "--yes", "skills", "update", "--global", "--yes"]),
  },
  verify: {
    description: "Non-destructive verification pass",
    run() {
      return sequence([
        () => script("catalog.mjs", ["check"]),
        () => external([npx, "--yes", "skills", "add", ".", "--list"]),
        () => external([npx, "--yes", "skills", "list", "--global"]),
        () => script("install-curated-skills.mjs", ["--dry-run"]),
        () => script("install-agents.mjs", ["--dry-run"]),
      ]);
    },
  },
};

function fail(message) {
  console.error(message);
  throw new CLIError(1);
}

class CLIError extends Error {
  constructor(code) {
    super(`CLI exited with ${code}`);
    this.code = code;
  }
}

function packFlags(flags, names) {
  const args = [];
  for (const name of names) {
    const spec = FLAG_SPECS[name];
    if (!spec) continue;
    if (spec.takesValue) {
      if (flags[name] != null && flags[name] !== false) {
        args.push(spec.name, String(flags[name]));
      }
      continue;
    }
    if (flags[name]) args.push(spec.name);
  }
  return args;
}

function script(name, args = []) {
  return runNode([resolve(scriptsDir, name), ...args]);
}

function runNode(args) {
  const result = spawnSync(node, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function external(command) {
  const result = runCommand(command, { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function sequence(steps) {
  for (const step of steps) {
    const code = step();
    if (code !== 0) return code;
  }
  return 0;
}

function printRootHelp() {
  console.log(`agent-skills — personal skills, harness setup, and model catalog

Usage:
  agent-skills <command> [subcommand] [flags]
  npm run agent-skills -- <command> ...

Commands:
  skills list [--installed] [--json]
  install skills|curated|agents|all [--copy] [--dry-run]
  setup memory-palace|opencode|pi|cursor [flags]
  catalog check|diff|refresh
  update
  verify

Day-to-day model catalog:
  agent-skills catalog check
  agent-skills catalog diff
  agent-skills catalog refresh
  agent-skills setup pi --catalog-only

Run \`agent-skills <command> --help\` for details.`);
}

function printCommandHelp(name, command) {
  if (command.subcommands) {
    console.log(`agent-skills ${name}

${command.description}

Subcommands:`);
    for (const [subName, sub] of Object.entries(command.subcommands)) {
      const flagText = (sub.flags ?? [])
        .map((flag) => {
          const spec = FLAG_SPECS[flag];
          return spec.takesValue ? `${spec.name} <value>` : `[${spec.name}]`;
        })
        .join(" ");
      console.log(`  ${subName.padEnd(14)} ${sub.description}${flagText ? `\n${"".padEnd(16)}${flagText}` : ""}`);
    }
    return;
  }

  const flagText = (command.flags ?? [])
    .map((flag) => {
      const spec = FLAG_SPECS[flag];
      return `  ${spec.takesValue ? `${spec.name} <value>` : spec.name.padEnd(22)} ${spec.description}`;
    })
    .join("\n");
  console.log(`agent-skills ${name}

${command.description}
${flagText ? `\nFlags:\n${flagText}` : ""}`);
}

function parseFlags(tokens, allowedNames) {
  const allowed = new Set(allowedNames ?? []);
  const flags = Object.fromEntries([...allowed].map((name) => [name, FLAG_SPECS[name]?.takesValue ? null : false]));
  const rest = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "--help" || token === "-h") {
      return { help: true, flags, rest };
    }
    if (!token.startsWith("--")) {
      rest.push(token);
      continue;
    }

    const matched = [...allowed].find((name) => FLAG_SPECS[name].name === token);
    if (!matched) {
      fail(`Unknown flag ${token}. Allowed: ${[...allowed].map((name) => FLAG_SPECS[name].name).join(", ") || "(none)"}.`);
    }
    const spec = FLAG_SPECS[matched];
    if (spec.takesValue) {
      const value = tokens[index + 1];
      if (!value || value.startsWith("--")) {
        fail(`${spec.name} requires a value.`);
      }
      flags[matched] = value;
      index += 1;
    } else {
      flags[matched] = true;
    }
  }

  return { help: false, flags, rest };
}

function main(argv) {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    printRootHelp();
    return 0;
  }

  const [name, ...rest] = argv;
  const command = COMMANDS[name];
  if (!command) {
    fail(`Unknown command \`${name}\`.\nRun \`agent-skills --help\` for usage.`);
  }

  if (command.subcommands) {
    if (rest.length === 0 || rest[0] === "--help" || rest[0] === "-h") {
      printCommandHelp(name, command);
      return rest.length === 0 ? 1 : 0;
    }
    const [subName, ...subRest] = rest;
    const sub = command.subcommands[subName];
    if (!sub) {
      fail(`Unknown \`${name}\` subcommand \`${subName}\`.\nRun \`agent-skills ${name} --help\`.`);
    }
    const parsed = parseFlags(subRest, sub.flags ?? []);
    if (parsed.help) {
      printCommandHelp(`${name} ${subName}`, sub);
      return 0;
    }
    if (parsed.rest.length > 0 && name !== "setup" && subName !== "memory-palace") {
      fail(`Unexpected arguments: ${parsed.rest.join(" ")}`);
    }
    return sub.run(parsed.flags, parsed.rest);
  }

  const parsed = parseFlags(rest, command.flags ?? []);
  if (parsed.help) {
    printCommandHelp(name, command);
    return 0;
  }
  if (parsed.rest.length > 0) {
    fail(`Unexpected arguments: ${parsed.rest.join(" ")}`);
  }
  return command.run(parsed.flags, parsed.rest);
}

try {
  const code = main(process.argv.slice(2));
  process.exit(code ?? 0);
} catch (error) {
  if (error instanceof CLIError) process.exit(error.code);
  throw error;
}
