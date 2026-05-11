# Skill Inventory

This is the curated operating map of skills, plugin packs, MCP-only tools, and tools that are intentionally out of scope.

## Skill groups

### Core coding

- `test-driven-development` — before feature or bugfix code.
- `systematic-debugging` — before fixing bugs, regressions, or unexpected test failures.
- `verification-before-completion` — before claiming a task is complete.
- `python-lint-typecheck` — Python lint/typecheck work with ruff and mypy.
- `backend-layering` — backend organization across controllers, services, schemas, models, constants, exceptions, and utils.
- `receiving-code-review` — handling review feedback.
- `thorough-pr-review` — PR review and merge-readiness audit.
- `executing-plans` — executing written implementation plans.
- `writing-plans` — creating implementation plans.

### Git, branch, and PR

- `using-git-worktrees` — isolated feature work.
- `branch-port` — moving a feature between branches when rebasing or merging is impractical.
- `finishing-a-development-branch` — finishing branch work and deciding integration path.
- `gh-address-comments` / `github:gh-address-comments` — resolving GitHub PR review comments.
- `gh-fix-ci` / `github:gh-fix-ci` — debugging failing GitHub Actions.
- `github:yeet` — Codex only: commit, push, and open a PR.

### Parallel and agent workflow

- `dispatching-parallel-agents` — splitting independent tasks across parallel agents.
- `using-superpowers` — framework entry skill for the superpowers agent toolkit.

### Frontend and design

- `brainstorming` — before creative feature or component work.
- `frontend-design` — generate production-grade, distinctive frontend UI. From the `frontend-design` plugin.
- `figma-use` — fetch and read Figma context (alias: `figma`).
- `figma-implement-design` — implement a Figma design with visual fidelity.
- `figma-code-connect` — create/maintain Code Connect templates mapping Figma components to code.
- `figma-create-design-system-rules` — generate codebase-specific design system rules.
- `figma-create-new-file` — create a new Figma file from scratch.
- `figma-generate-design` — translate an existing app screen into a Figma design.
- `figma-generate-diagram` — generate FigJam diagrams. Prerequisite: load before every `generate_diagram` call.
- `figma-generate-library` — build or update a professional design system library from codebase.
- `figma-use-figjam` — FigJam-specific operations via the Figma MCP.
- `browser-use:browser` — inspect and test localhost or browser UI.

### Web fetching and content extraction

- `defuddle` — extract clean markdown from web pages via Defuddle CLI, removing navigation/ads. Prefer over WebFetch for HTML pages; use WebFetch directly for `.md` URLs.

### Documents and structured files

- `json-canvas` — Obsidian JSON Canvas.
- `obsidian-markdown` — Obsidian markdown.
- `obsidian-bases` — Obsidian Bases.
- `obsidian-cli` — Obsidian vault CLI.

### Knowledge and notes

- `memory-palace` — curated Obsidian knowledge vault: ingest, query, and lint.
- `notion-research-documentation` / `notion:notion-research-documentation` — Notion research synthesis.
- `notion:notion-knowledge-capture`, `notion:notion-meeting-intelligence`, and `notion:notion-spec-to-implementation` are referenced in skill catalogs but not currently installed.

### Episodic memory: claude-mem plugin

These skills ship with the `claude-mem` plugin (`thedotmack/claude-mem`). They operate on cross-session work transcripts, the episodic layer, complementing the vault semantic layer.

- `mem-search` — search past session transcripts.
- `learn-codebase` — front-load the current repo into memory.
- `smart-explore` — structured codebase exploration.
- `knowledge-agent` — answer questions from memory corpus.
- `pathfinder` — navigate and map a codebase.
- `make-plan` — create implementation plans from memory context.
- `do` — execute a task with memory-grounded context.
- `babysit` — monitor and supervise a long-running agent task.
- `timeline-report` — summarize work history over a time window.
- `version-bump` — bump package versions using memory of prior bumps.
- `how-it-works` — explain how claude-mem itself works.

### Communication

- Slack — MCP tools available (`slack_send_message`, `slack_read_channel`, `slack_search_public`, etc.). No dedicated local skill file installed.
- Gmail — MCP tools available (`search_threads`, `get_thread`, `create_draft`, `list_labels`).
- `oncall-handoff` — weekly on-call handoff docs. Keep private unless sanitized; local version contains internal workflow details.

### Product and project tools

- `linear` / `linear:linear` — Linear issues and projects plus MCP tools.
- `sentry` / `sentry:sentry` — production error inspection plus MCP tools.
- incident.io — MCP tools available: incident creation/update, escalations, alerts, on-call schedules, follow-ups. No local skill file; use MCP tools directly.

### IDE integration

- JetBrains — MCP tools available: file read/write, run configurations, database queries, terminal, symbol search. No local skill file.

### Media and creative artifacts

- `imagegen` — generate or edit bitmap images. Not currently installed.
- `hyperframes:*` — videos, animations, GSAP. Not currently installed.

### Skill authoring and meta

- `writing-skills` — create, edit, and verify skill files; TDD for process docs.
- `find-skills` — discover or install skills from the marketplace.
- `plugin-creator` / `skill-installer` — not currently installed; use `writing-skills` and `find-skills` instead.
- `openai-docs` — current OpenAI API/product docs. Not currently installed.

### Compression and style

- `caveman` — terse response mode.
- `caveman-commit` — terse commit messages.
- `caveman-review` — terse PR comments.
- `caveman-compress` / `compress` — compress memory files.
- `caveman-help` — caveman reference card.

### Utilities

- `defuddle` — also listed under web fetching.

## Installed plugin packs

| Plugin | Version | What it brings |
| --- | --- | --- |
| `github` | latest | GitHub MCP: issues, PRs, repo management |
| `figma` | `2.1.30` | Full Figma skill suite and MCP |
| `frontend-design` | latest | `frontend-design` skill |
| `context7` | latest | Library docs MCP (`context7__query-docs`) |
| `claude-mem` (`thedotmack`) | `13.0.0` | Episodic memory skills and MCP search tools |
| `ralph-loop` | `1.0.0` | `/ralph-loop` autonomous loop command |

## Not installed or out of scope

| Item | Notes |
| --- | --- |
| `build-macos-apps:*` | Not relevant: no macOS app dev |
| `documents:*`, `presentations:*`, `spreadsheets:*` | Not installed |
| `imagegen` | Not installed |
| `hyperframes:*` | Not installed |
| `notion:notion-knowledge-capture`, `notion:notion-meeting-intelligence`, `notion:notion-spec-to-implementation` | Notion plugin not installed; only `notion-research-documentation` is present |
| `openai-docs`, `skill-creator`, `plugin-creator` | Superseded by `writing-skills` and `find-skills` |
| Spotify MCP | Available via MCP but no skill routing needed |

## Token optimization: RTK

RTK (Rust Token Killer) is a CLI proxy injected via Claude Code hook that filters and compresses command output before it hits the context window. It saves 60-90% tokens on typical dev operations.

### How it works

All shell commands are automatically rewritten by the hook:

```text
git status  ->  rtk git status
```

### Meta commands

Call `rtk` directly for meta commands; these are not rewritten by the hook.

```bash
rtk gain              # Token savings analytics
rtk gain --history    # Command history + per-command savings
rtk discover          # Scan Claude Code history for missed RTK opportunities
rtk proxy <cmd>       # Run a command without RTK filtering (debug)
rtk --version         # Verify installation
```

### Name collision warning

If `rtk gain` fails with "unknown subcommand", `rtk` may point to `reachingforthejack/rtk` (Rust Type Kit) instead of Rust Token Killer. Use `which rtk` and `rtk gain` to verify.
