---
name: agentfolio-operator
description: Use when configuring Agentfolio collections, Pi/Cursor/Claude harness setup, model catalog changes, or deciding which agentfolio command/profile to run.
---

# Agentfolio Operator

Use an agent for **intent**. Use Agentfolio commands for **authority**.

Do not hand-edit `~/.pi/agent/settings.json`, `~/.pi/agent/models.json`, systemd units, or unmanaged JSON/JSONC. Call the commands below.

## Resolve the collection first

```bash
agentfolio doctor --collection <path>
agentfolio plan --collection <path>
```

If `--collection` is omitted, Agentfolio walks up for `collection.yaml` or uses `AGENTFOLIO_COLLECTION`.

This user's personal collection is typically:

```text
/home/luabagg/development/agent-skills
```

## Command map

| User intent | Command | Mutates |
| --- | --- | --- |
| Inspect inventory | `agentfolio list skills\|harnesses\|tools\|plugins` | no |
| Preview skills + chezmoi | `agentfolio plan` | no |
| Health | `agentfolio doctor` / `agentfolio verify` | no |
| Apply skills + instruction files | `agentfolio apply --dry-run` then `agentfolio apply` | yes |
| Validate model lock | `agentfolio models check` | no |
| Preview model discovery | `agentfolio models diff` | no |
| Rewrite lock + generated Cursor provider | `agentfolio models refresh` | collection files |
| Pi catalog/scope/models only | `agentfolio apply --profile pi-catalog --dry-run` | live `~/.pi` if not dry-run |
| Full Pi setup | `agentfolio apply --profile pi --dry-run` | packages, extensions, `~/.pi`, maybe bridge |
| Cursor ACP bridge only | `agentfolio apply --profile cursor-bridge --dry-run` | service/config |
| Same as `pi` profile | `agentfolio setup pi` | yes |

Always dry-run first unless the user explicitly asked to apply now.

## Profiles

```text
default        skills-cli + chezmoi
pi             Pi packages + local extensions + catalog + optional Cursor bridge
pi-catalog     committed lock, Scope models, filtered model providers
cursor-bridge  Cursor ACP/OpenCursor bridge only
```

Flags that compose with Pi setup:

```bash
--catalog-only
--skip-cursor-bridge
--dry-run
--json
```

## Decision rules

- **xAI models / Scope tab / grok-4.6**: edit `harnesses/catalog.yaml`, then `models check`, then `models refresh` only if discovery/policy is ready. Apply with `--profile pi-catalog`.
- **Limit Cursor models**: keep them out of `piScopes.default` and leave `includeModelsFromPiScope: default` on the Cursor provider. Do not prune `cursor-provider.json` by hand unless refresh generated it.
- **Claude in Pi**: use `claude-cli` only. Tell the user to run `claude login` themselves. Never implement unofficial Claude OAuth. Never copy Claude credentials.
- **Cursor bridge**: require `cursor-agent`, `opencode`, `systemctl`. If `cursor-agent` is not logged in, skip or stop and say so. Prefer `--profile cursor-bridge` instead of full Pi setup.
- **Missing chezmoi**: plan/doctor may warn. Do not invent file copies; install chezmoi or use a local `destinationDir`.
- **Skills install**: use `npx skills` via `agentfolio apply` (local skills) or an explicit curated `npx skills add <source> --skill ...`. Do not copy skill trees by hand.

## Safety

- `--dry-run` must mutate nothing.
- Stop on the first failed command.
- Preserve unmanaged user config. If a command refuses to overwrite, do not `--force` unless the user asked.
- Credentials stay outside the collection (`~/.pi/agent/auth.json`, `claude login`, `cursor-agent login`).
- Restart `pi` after extension or model-provider changes.

## After a successful apply

Tell the user:

1. what profile ran
2. what changed
3. whether they need `pi` restart
4. remaining manual logins (`/login xai`, `claude login`, `cursor-agent login`)
