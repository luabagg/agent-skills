# Personal Agent Skills

Public source of truth for my global agent instructions, personal skills, curated third-party skill references, and non-skill tool references.

![Setup Script Execution](docs/setup-command.png)

This repo supports:

- Claude Code
- Codex
- Copilot
- OpenCode
- Pi
- Cursor

## Layout

```text
.
|-- AGENTS.md                # Repo-scoped instructions for working in this repo
|-- AGENTS.global.md         # Global agent instructions, distributed to ~/.codex, ~/.claude, etc.
|-- CLAUDE.md -> AGENTS.md   # Symlink so Claude loads repo-scoped rules in this repo
|-- skills/                  # Personal skills authored here
|-- curated-skills.json      # Installable skill sources plus reference-only plugin inventory
|-- curated-tools.json       # Non-skill tools, CLIs, packages, and docs I use
|-- harnesses/               # Opt-in harness manifests + catalog.yaml / catalog.lock.json
|-- docs/                    # Model catalog contract + CLI notes
|-- scripts/                 # agent-skills CLI + install/setup helpers
|-- package.json             # agent-skills bin entry
`-- README.md
```

## Install

From a local checkout:

```bash
npm install
```

Then use the `agent-skills` CLI (via PATH after link/install, or `npx agent-skills` / `npm exec -- agent-skills` from the repo):

```bash
agent-skills install all
```

Default mode uses symlinks where the target tool supports normal files. Use copy mode when symlinks are not desirable:

```bash
agent-skills install all --copy
```

What `install all` does:

- Installs personal skills from `skills/` for `claude-code`, `codex`, `github-copilot`, `opencode`, and `pi` using `npx skills`.
- Installs curated third-party skills from `curated-skills.json` `sources`.
- Installs global `AGENTS.global.md` guidance for Claude, Codex, Copilot, OpenCode, and Pi.

## Commands

```text
agent-skills
├── list skills|curated|tools [...]
├── install skills|curated|agents|all [--copy] [--dry-run]
├── setup opencode|pi|cursor [flags]
├── config memory-palace --vault <path> [--dry-run]
├── models check|diff|refresh
├── update
└── verify
```

```bash
agent-skills --help
agent-skills list tools
agent-skills install all
agent-skills setup pi --catalog-only
agent-skills models check
agent-skills verify
```

From a checkout without a global link:

```bash
npx agent-skills --help
# or
npm exec -- agent-skills --help
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
agent-skills list skills                 # personal skills in this repo only
agent-skills list skills --installed     # everything currently installed globally
agent-skills list skills --installed --json
```

`list skills` uses `npx skills add . --list` (package contents).
`list skills --installed` uses `npx skills list -g` (global install state across agents).

### Memory Palace Vault Path

Configure the default vault path once so the `memory-palace` skill works from any current directory:

```bash
agent-skills config memory-palace --vault /mnt/c/Users/<you>/Documents/<vault>
```

If you are running from WSL and your vault lives on Windows, paste the Windows path from Explorer:

```bash
agent-skills config memory-palace --vault "C:\Users\user-name\Documents\Obsidian Vaults\obsidian-vault"
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

- `sources` are third-party skill sources installable by `npx skills`. `agent-skills install curated` only uses this list.
- `pluginReferences` are plugin-style or harness-specific skill references. They are tracked for awareness only and are not installed by `agent-skills install all` or `agent-skills install curated`.

Browse them:

```bash
agent-skills list curated                 # installable sources
agent-skills list curated --plugins       # plugin references only
agent-skills list curated --json
```

Harness-specific setup stays separate from the default setup flow unless explicitly added later.

`curated-tools.json` tracks non-skill tools, CLIs, packages, and docs I use. It is a reference catalog only; it does not drive installation.

```bash
agent-skills list tools
agent-skills list tools --kind cli
agent-skills list tools --json
```

## Harness-Specific Setup

Harness setup is opt-in and separate from `agent-skills install all` (skills + global agents only).

```bash
agent-skills --help
agent-skills setup opencode --dry-run
agent-skills setup pi --catalog-only
agent-skills setup cursor --dry-run
agent-skills models check
```

### Model catalog

Policy lives in `harnesses/catalog.yaml`. The lock and generated Cursor provider are produced by model commands — do not edit them by hand.

```bash
agent-skills models check     # offline validate
agent-skills models diff      # live preview
agent-skills models refresh   # write lock + generated targets
agent-skills setup pi --catalog-only   # apply models/Scope only
```

Contract, failure modes, and Pi phase flags: [`docs/model-catalog.md`](docs/model-catalog.md).

### OpenCode

Tracked in `harnesses/opencode.json`. Setup installs agent files, prints manual plugin installer hints, and only mutates config for selected plugins.

```bash
agent-skills setup opencode --dry-run
agent-skills setup opencode
agent-skills setup opencode --enable-recommended
```

Agent templates use `{{catalogRole:<role>}}`; setup renders concrete models from the catalog lock.

### Pi

Tracked in `harnesses/pi.json` with extensions under `harnesses/pi/`.

```bash
# Models / Scope / providers only (usual after models refresh)
agent-skills setup pi --catalog-only

# Full harness without Cursor bridge
agent-skills setup pi --skip-cursor-bridge

# Full harness + optional recommended entries
agent-skills setup pi --dry-run
agent-skills setup pi --enable-recommended
PI_CURSOR_WORKSPACE="$PWD" agent-skills setup pi
```

Phases: **catalog** (always) → packages → extensions → cursor-bridge (skippable). Setup consumes the committed lock only; it does not re-discover models.

Cursor credentials stay local via `cursor-agent login`. Bridge ports bind to `127.0.0.1`. After bridge config changes, run `models diff` / `models refresh` if model IDs changed, then re-apply with `--catalog-only`.

### Cursor subagents

Tracked in `harnesses/cursor.json` (`harnesses/cursor/agents/`).

```bash
agent-skills setup cursor --dry-run
agent-skills setup cursor
agent-skills setup cursor --copy
```

Cursor has no global `AGENTS.md` / `~/.cursor/rules/*.mdc` install path — User Rules stay in the Customize UI. This harness only installs user-scope subagents under `~/.cursor/agents/`.

### Global instructions targets

`AGENTS.global.md` is the source of truth. `agent-skills install agents` distributes it to:

- Codex: `~/.codex/AGENTS.md`
- Claude: `~/.claude/AGENTS.md` plus `~/.claude/CLAUDE.md` importing `@AGENTS.md`
- Copilot: `~/.copilot/AGENTS.md` plus `~/.copilot/instructions/global-agent.instructions.md`
- OpenCode: `~/.config/opencode/AGENTS.md` plus a global config `instructions` entry
- Pi: `~/.pi/agent/AGENTS.md`

Default mode symlinks; `--copy` copies. Repo-scoped `AGENTS.md` applies only inside this repository.

After changing OpenCode config, restart OpenCode. Running sessions keep already-loaded config.

## Verify

Run the non-destructive repo checks:

```bash
agent-skills verify
```

Optional runtime checks:

```bash
codex --ask-for-approval never "Summarize current instructions."
```

For OpenCode, inspect `~/.config/opencode/opencode.jsonc` and confirm the `instructions` array includes `~/.config/opencode/AGENTS.md`.

## Safety

This repository is public. Do not add private dashboards, tokens, org IDs, internal URLs, API keys, or generated local memory context.
