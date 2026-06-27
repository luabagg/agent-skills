# Agent Instructions

This repository is the public source of truth for Luan Baggio's personal agent skills, curated third-party skill list, and related agent tooling references.

## Repository Model

- Personal skills live in `skills/<skill-name>/SKILL.md`.
- Third-party skills that are installable by `npx skills` are referenced in `curated-skills.json` `sources`.
- Plugin-style or harness-specific skill references belong in `curated-skills.json` `pluginReferences`, not in installable `sources`.
- Non-skill tools, CLIs, packages, apps, and documentation are referenced in `curated-tools.json`.
- Harness-specific setup manifests live under `harnesses/` and must stay opt-in; do not add them to the default `npm run setup` flow without an explicit user request.
- Do not copy installed third-party skill folders into `skills/` unless the skill is intentionally forked or customized.
- Keep public safety in mind. Do not commit private dashboards, tokens, org IDs, internal URLs, API keys, or generated memory context.

## Repository Editing Rules

- Use `npx skills` / `npm run skills:list` to verify skill discovery after changing `skills/`.
- Validate JSON manifests after edits.
- Keep `node_modules/` out of git.
- Treat `package-lock.json` as the npm dependency lockfile for repo tooling.
