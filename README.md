# Personal Agent Skills

Public source of truth for my personal agent skills and the third-party skills I want on my machines.

This repo has two jobs:

1. Own and publish skills I write in `skills/`.
2. Track the curated third-party skills I use in `curated-skills.json`.
3. Track non-skill tools and references I use in `curated-tools.json`.

It intentionally does not include a custom installer. Installs and updates use the open `skills` CLI from Vercel:

```bash
npx skills --help
```

## Layout

```text
.
├── skills/                  # Personal skills authored in this repo
├── AGENTS.md                # Public-safe guidance for agents working in this repo
├── curated-skills.json      # Third-party skills I use, with sources and selected skill names
├── curated-tools.json       # Non-skill tools, packages, apps, and reference docs I use
├── docs/skill-inventory.md  # Full curated skill/plugin/MCP inventory
├── schemas/                 # JSON schemas for repo metadata
├── .claude-plugin/          # Claude Code plugin metadata
├── .codex-plugin/           # Codex plugin metadata
├── .cursor-plugin/          # Cursor plugin metadata
└── package.json             # Convenience scripts around npx skills
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

List skills available from this repo:

```bash
pnpm skills:list
```

Install personal skills globally for Cursor, Claude Code, and Codex:

```bash
pnpm install:personal
```

By default, `npx skills` may install with symlinks so the installed agent paths point back to the canonical source. If an agent or filesystem has trouble with symlinks, copy instead:

```bash
pnpm install:personal:copy
```

Once this repository is pushed, the same install can be done from GitHub:

```bash
npx skills add luabagg/agent-skills --global --agent cursor --agent claude-code --agent codex --skill '*'
```

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
| `cursor-public/sentry` | `sentry` for read-only Sentry issue and event investigation |
| GitHub plugin skills | `gh-address-comments` and `gh-fix-ci` for PR comments and GitHub Actions CI triage |
| Notion plugin skills | `notion-research-documentation` for Notion research and documentation |
| Figma plugin skills | `figma` and `figma-implement-design` for Figma MCP and design implementation |
| Linear plugin skills | `linear` for Linear issue, project, and team workflows |

Install the curated third-party set globally:

```bash
pnpm install:curated
```

The install script covers sources that `npx skills` can install directly. Plugin-style skills are tracked in `curated-skills.json` as references and should be installed through their agent/plugin marketplace flow.

Install personal plus curated skills:

```bash
pnpm install:all
```

Update globally installed skills managed by `npx skills`:

```bash
pnpm update:skills
```

## Curated Tools And References

Not everything belongs in `skills/`. Use `curated-tools.json` for tools, packages, apps, CLIs, and reference docs that agents should know I use, but that are not themselves agent skills.

Examples:

| Tool | Type | How it is referenced |
| --- | --- | --- |
| `@google/design.md` | npm package / CLI | Installed as a dependency; use `npx @google/design.md lint DESIGN.md` or `npm run design:lint` |
| `rtk` | CLI | `rtk-ai/rtk`; use as a token-saving proxy for verbose shell commands |
| `codeburn` | CLI | `getagentseal/codeburn`; use to visualize token usage, cost, models, and waste |

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

## AGENTS.md

This repo includes a public-safe `AGENTS.md` for agents working inside this repository. It documents the source-of-truth model and tool guidance without copying generated local memory context or private project instructions.

## Reference vs Fork

Use `curated-skills.json` when the upstream skill works as-is.

Fork a third-party skill into `skills/` only when I need to change its behavior. When forking, keep the original source in the skill body or references so the upstream lineage is clear.

## Private/Internal Skills

Some local skills may contain company-specific IDs, dashboard URLs, or workflow details that should not be published as-is. Keep those out of this public repo until they are sanitized into reusable templates.

## Plugin Metadata

The `.claude-plugin/`, `.cursor-plugin/`, and `.codex-plugin/` manifests describe this repo as a skills package for agents that understand plugin metadata.

The curated third-party skills are not bundled into those plugin manifests. They are installed separately through the package scripts so their upstreams remain clear and independently updateable.
