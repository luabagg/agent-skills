# Personal Agent Skills

Public source of truth for my global agent instructions, personal skills, curated third-party skill references, and non-skill tool references.

![Setup Script Execution](docs/setup-command.png)

This repo supports:

- Claude Code
- Codex
- Copilot
- OpenCode

## Layout

```text
.
|-- AGENTS.md                # Repo-scoped instructions for working in this repo
|-- AGENTS.global.md         # Global agent instructions, distributed to ~/.codex, ~/.claude, etc.
|-- CLAUDE.md -> AGENTS.md   # Symlink so Claude loads repo-scoped rules in this repo
|-- skills/                  # Personal skills authored here
|-- curated-skills.json      # Installable skill sources plus reference-only plugin inventory
|-- curated-tools.json       # Non-skill tools, CLIs, packages, and docs I use
|-- harnesses/               # Opt-in harness-specific setup manifests
|-- scripts/                 # Install helpers
|-- package.json             # Small npm command surface
`-- README.md
```

## Install

Install package dependencies from a local checkout:

```bash
npm install
```

Install global skills and instructions:

```bash
npm run setup
```

Default mode uses symlinks where the target tool supports normal files. Use copy mode when symlinks are not desirable:

```bash
npm run setup:copy
```

What `npm run setup` does:

- Installs personal skills from `skills/` for `claude-code`, `codex`, `github-copilot`, and `opencode` using `npx skills`.
- Installs curated third-party skills from `curated-skills.json` `sources`.
- Installs global `AGENTS.global.md` guidance for Claude, Codex, Copilot, and OpenCode.

## Commands

```bash
npm run skills:list                 # list personal skills authored in this repo
npm run skills:list:installed       # list all globally installed skills
npm run skills:list:installed:json  # same, machine-readable JSON
npm run install:skills              # install only personal skills
npm run install:curated             # install only curated skills-cli sources
npm run install:curated:dry-run     # print curated install commands; do not run them
npm run install:agents              # install global AGENTS.global.md for Claude/Codex/Copilot/OpenCode
npm run setup                       # full symlink setup (personal + curated + agents)
npm run setup:copy                  # full copy setup
npm run setup:memory-palace         # persist the default memory-palace vault path
npm run setup:opencode              # opt-in OpenCode harness setup (agents/plugins config)
npm run setup:opencode:dry-run      # preview OpenCode harness setup
npm run update:skills               # update already-installed skills only
npm run verify                      # non-destructive verification pass
```

## Personal Skills

Personal skills live in `skills/<skill-name>/SKILL.md`.

Current personal skills:

| Skill | Purpose |
| --- | --- |
| `branch-port` | Port a feature across heavily diverged branches without unsafe merges |
| `memory-palace` | Ingest, query, and lint the personal Obsidian knowledge vault |
| `natural-copy-editing` | Rewrite, polish, translate, and correct text in a natural voice |
| `thorough-pr-review` | Review PRs and branches for correctness, reliability, and merge-readiness |

List skills:

```bash
npm run skills:list                 # personal skills in this repo only
npm run skills:list:installed       # everything currently installed globally
npm run skills:list:installed:json  # JSON form of the global install inventory
```

`skills:list` uses `npx skills add . --list` (package contents).
`skills:list:installed` uses `npx skills list -g` (global install state across agents).

### Memory Palace Vault Path

Configure the default vault path once so the `memory-palace` skill works from any current directory:

```bash
npm run setup:memory-palace -- --vault /mnt/c/Users/<you>/Documents/<vault>
```

If you are running from WSL and your vault lives on Windows, paste the Windows path from Explorer:

```bash
npm run setup:memory-palace -- --vault "C:\Users\user-name\Documents\Obsidian Vaults\obsidian-vault"
```

The setup script converts it to a WSL-accessible path before saving it.

The setting is saved at `~/.agents/memory-palace/config.json`:

```json
{
  "vaultPath": "/mnt/c/Users/<you>/Documents/<vault>",
  "configuredAt": "2026-06-15T00:00:00.000Z",
  "sourceInput": "C:\\Users\\<you>\\Documents\\<vault>"
}
```

Resolution precedence inside the skill is:

1. explicit vault path in the current user request
2. `MEMORY_PALACE_VAULT`
3. `~/.agents/memory-palace/config.json`
4. current-directory detection as a fallback

On WSL, Windows paths like `C:\Users\...` are expected and are converted to `/mnt/c/Users/...` before validation and saving. The saved path must already be accessible from WSL.

## Curated References

`curated-skills.json` tracks two different inventories:

- `sources` are third-party skill sources installable by `npx skills`. `npm run install:curated` only uses this list.
- `pluginReferences` are plugin-style or harness-specific skill references. They are tracked for awareness only and are not installed by `npm run setup` or `npm run install:curated`.

Harness-specific setup stays separate from the default setup flow unless explicitly added later.

`curated-tools.json` tracks non-skill tools, CLIs, packages, and docs I use. It is a reference catalog only; it does not drive installation.

## Harness-Specific Setup

Harness-specific setup is opt-in and separate from `npm run setup`.

OpenCode setup is tracked in `harnesses/opencode.json` and exposed through:

```bash
npm run setup:opencode:dry-run
npm run setup:opencode
```

The OpenCode setup script validates the manifest, installs tracked agent files into `~/.config/opencode/agent/` (for example `brainstorming`, `writing`, and `coder`), prints manual installer commands for broad tools such as OMO / oh-my-openagent, and only mutates OpenCode config for explicitly selected plugin entries. It does not run third-party plugin installers automatically.

Use `-- --enable-recommended` when you want recommended `opencode-plugin` entries added to OpenCode config:

```bash
npm run setup:opencode:dry-run -- --enable-recommended
npm run setup:opencode -- --enable-recommended
```

## Global Instructions

`AGENTS.global.md` is the source of truth for global agent behavior. `npm run install:agents` is **not** OpenCode-only: it distributes the same file to every supported harness. OpenCode-specific agents/plugins live in `setup:opencode` instead.

`npm run install:agents` targets:

- Codex: `~/.codex/AGENTS.md`
- Claude: `~/.claude/AGENTS.md` plus `~/.claude/CLAUDE.md` importing `@AGENTS.md`
- Copilot: `~/.copilot/AGENTS.md` plus `~/.copilot/instructions/global-agent.instructions.md`
- OpenCode: `~/.config/opencode/AGENTS.md` plus a global config `instructions` entry

Default mode symlinks those targets back to this repo. `npm run setup:copy` copies file contents instead.

`AGENTS.md` is repo-scoped and only applies when working inside this repository. opencode and Codex pick it up natively via the project `AGENTS.md`; Claude picks it up via the repo-root `CLAUDE.md` symlink -> `AGENTS.md`.

After changing OpenCode config, restart OpenCode. Running sessions keep using already-loaded config.

## Verify

Run the non-destructive repo checks:

```bash
npm run verify
```

Optional runtime checks:

```bash
codex --ask-for-approval never "Summarize current instructions."
```

For OpenCode, inspect `~/.config/opencode/opencode.jsonc` and confirm the `instructions` array includes `~/.config/opencode/AGENTS.md`.

## Safety

This repository is public. Do not add private dashboards, tokens, org IDs, internal URLs, API keys, or generated local memory context.
