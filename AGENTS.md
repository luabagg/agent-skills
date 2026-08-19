# Agent Instructions

This repository is the public source of truth for Luan Baggio's personal agent skills, curated third-party skill list, and related agent tooling references.

## Repository Model

- This repo is Agentfolio collection #1. `collection.yaml` is the inventory.
- Personal skills live in `skills/<skill-name>/SKILL.md`.
- Use `agentfolio-operator` to choose Agentfolio commands. Do not edit live `~/.pi` files by hand.
- Third-party skills that `npx skills` can install belong in `curated-skills.json` `sources`.
- Plugin-style skill references belong in `curated-skills.json` `pluginReferences`.
- Non-skill tools belong in `curated-tools.json`.
- Harness manifests live under `harnesses/` and stay opt-in.
- Do not copy third-party skill folders into `skills/` unless you fork the skill.
- Do not commit tokens, org IDs, internal URLs, API keys, or generated memory.

## Repository Editing Rules

- Use `npx skills` / `agent-skills list skills` to verify skill discovery after changing `skills/`.
- Validate JSON manifests after edits.
- Keep `node_modules/` out of git.
- Treat `package-lock.json` as the npm dependency lockfile for repo tooling.
