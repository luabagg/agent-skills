# Personal Agent Skills

Published source of truth for my global agent instructions, personal agent skills, curated third-party skill list, and related agent tooling references.

This repo has four jobs:

1. Own the global `AGENTS.md` guidance I want agents to inherit.
2. Own and publish skills I write in `skills/`.
3. Track the curated third-party skills I use in `curated-skills.json`.
4. Track non-skill tools and references I use in `curated-tools.json`.

Installs and updates use the open `skills` CLI from Vercel. The local curated installer is a thin wrapper around `curated-skills.json` and `npx skills add`:

```bash
npx skills --help
```

## Layout

```text
.
├── skills/                  # Personal skills authored in this repo
├── AGENTS.md                # Global agent instruction source of truth
├── curated-skills.json      # Third-party skills I use, with sources and selected skill names
├── curated-tools.json       # Non-skill tools, packages, apps, and reference docs I use
├── docs/skill-inventory.md  # Full curated skill/plugin/MCP inventory
├── schemas/                 # JSON schemas for repo metadata
├── .claude-plugin/          # Claude Code plugin metadata
├── .codex-plugin/           # Codex plugin metadata
├── .cursor-plugin/          # Cursor plugin metadata
└── package.json             # Convenience scripts around npx skills
```

## Install

Install the published personal skills globally for Cursor, Claude Code, and Codex:

```bash
npx skills add luabagg/agent-skills --global --agent cursor --agent claude-code --agent codex --skill '*'
```

That command installs only the personal skills stored in this repo's `skills/` directory. Curated third-party skills are references in `curated-skills.json`, so they must be installed from their upstream sources.

Without cloning this repo, install curated `skills-cli` entries by reading `curated-skills.json` and running `npx skills add` for sources where `preferredInstall` is `skills-cli`. Plugin-style entries are not installable through this repo's GitHub command; install those through each agent's plugin or connector marketplace.

For local development from a checkout, install from the working tree instead:

```bash
npm run install:personal
```

If the `skills` CLI installs into `~/.agents/skills` but Codex does not pick those skills up, mirror the active skill tree into `~/.codex/skills`:

```bash
npm run sync:codex-skills
```

The sync preserves Codex's `.system` skills, skips archives and dot directories, and refuses to overwrite a real directory that already exists in `~/.codex/skills`.

By default, `npx skills` may install with symlinks so the installed agent paths point back to the source. If an agent or filesystem has trouble with symlinks, copy instead:

```bash
npm run install:personal:copy
```

List the skills exposed by the local checkout:

```bash
npm run skills:list
```

## Personal Skills

Add personal skills under `skills/<skill-name>/SKILL.md`.

Each skill should have the standard frontmatter:

```markdown
---
name: my-skill
description: What this skill does. Use when ...
---
```

Current personal skills:

| Skill | Purpose |
| --- | --- |
| `branch-port` | Port a feature across heavily diverged branches without unsafe merges |
| `memory-palace` | Ingest, query, and lint the personal Obsidian knowledge vault |
| `thorough-pr-review` | Review PRs and branches for correctness, reliability, and merge-readiness |

Every published skill in `skills/` must be public-safe. Do not include private dashboards, tokens, org IDs, internal URLs, generated memory context, or workflow details that only make sense inside a private environment. External IDs or URLs are acceptable only when they are intentionally part of the skill's public purpose or point back to this repo's own public references.

## Curated Third-Party Skills

Third-party skills are referenced, not copied, unless I intentionally fork or customize them.

For the full curated map of installed skills, plugin packs, MCP-only tools, and not-installed decisions, see `docs/skill-inventory.md`.

The curated list currently tracks:

| Source | Purpose |
| --- | --- |
| `obra/superpowers` | Development workflow skills: brainstorming, planning, TDD, debugging, reviews, and branch finishing |
| `JuliusBrussee/caveman` | Compressed communication, commit, review, and compression skills |
| `kepano/obsidian-skills` | Obsidian, Markdown, Bases, Canvas, and Defuddle skills |
| `vercel-labs/skills` | `find-skills` for discovering more skills |
| `emilkowalski/skill` | `emil-design-eng` for UI polish, component design, and animation guidance |
| `kunchenguid/gnhf` | `gnhf` for launching, supervising, and reviewing long-running agent-managed coding runs |
| `cursor-public/sentry` | `sentry` for read-only Sentry issue and event investigation |
| GitHub plugin skills | `gh-address-comments` and `gh-fix-ci` for PR comments and GitHub Actions CI triage |
| Notion plugin skills | `notion-research-documentation` for Notion research and documentation |
| Figma plugin skills | `figma` and `figma-implement-design` for Figma MCP and design implementation |
| Linear plugin skills | `linear` for Linear issue, project, and team workflows |

Install the curated third-party set globally:

```bash
npm run install:curated
```

The install script reads `curated-skills.json` and installs sources where `preferredInstall` is `skills-cli`. Plugin-style skills are tracked as references and should be installed through their agent/plugin marketplace flow.

Preview the generated curated install commands without installing:

```bash
npm run install:curated:dry-run
```

Preview the Codex skill sync without changing `~/.codex/skills`:

```bash
npm run sync:codex-skills:dry-run
```

Install personal plus curated skills:

```bash
npm run install:all
```

Update globally installed skills managed by `npx skills`:

```bash
npm run update:skills
```

## Curated Tools And References

Not everything belongs in `skills/`. Use `curated-tools.json` for tools, packages, apps, CLIs, and reference docs that agents should know I use, but that are not themselves agent skills.

Examples:

| Tool | Type | How it is referenced |
| --- | --- | --- |
| `@google/design.md` | npm package / CLI | Installed as a dependency; use `npx @google/design.md lint DESIGN.md` or `npm run design:lint` |
| `rtk` | CLI | `rtk-ai/rtk`; use as a token-saving proxy for verbose shell commands |
| `codeburn` | CLI | `getagentseal/codeburn`; use to visualize token usage, cost, models, and waste |
| `gnhf` | CLI plus skill | `kunchenguid/gnhf`; use for bounded long-running agent loops with concrete stop conditions |
| `autoskills` | CLI | Use `npx autoskills` or `npm run autoskills` for automatic context-aware skill discovery |

`@google/design.md` is a good example: it is a design-system format and linter, not an agent skill. Keeping it in `curated-tools.json` lets this repo remember the tool and the commands without exposing it as something an agent should invoke as a skill.

Design.md commands:

```bash
npm run design:lint
npx @google/design.md diff DESIGN.md DESIGN-v2.md
```

RTK commands:

```bash
npm run rtk:verify
npm run rtk:stats
```

CodeBurn commands:

```bash
npm run codeburn:status
npm run codeburn:optimize
```

GNHF commands:

```bash
npm run gnhf:verify
gnhf --worktree --max-iterations 5 "improve this branch and stop when relevant checks pass"
```

Autoskills commands:

```bash
npx autoskills
npm run autoskills
```

## AGENTS.md

`AGENTS.md` is the public global agent-instruction source of truth for this setup. It should describe durable cross-agent behavior, default skill routing, editing rules, and public-safe tool guidance.

It is not just repo-local guidance. Keep it suitable for reuse by global agent configuration flows and do not copy generated local memory context or private project instructions into it.

## Reference vs Fork

Use `curated-skills.json` when the upstream skill works as-is.

Fork a third-party skill into `skills/` only when I need to change its behavior. When forking, keep the original source in the skill body or references so the upstream lineage is clear.

## Plugin Metadata

The `.claude-plugin/`, `.cursor-plugin/`, and `.codex-plugin/` manifests describe this repo as a skills package for agents that understand plugin metadata.

The curated third-party skills are not bundled into those plugin manifests. They are installed separately through the package scripts so their upstreams remain clear and independently updateable.
