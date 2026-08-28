---
name: agentfolio-operator
description: Use when configuring this Agentfolio collection, selecting Pi/Cursor/OpenCode harness workflows, changing model policy, or choosing plan/apply commands.
---

# Agentfolio Operator

Agentfolio orchestrates `collection.yaml`; this repository's adapter owns harness behavior. Never hand-edit live harness configuration when a declared action exists.

## Start with the collection

Run these commands from the collection checkout (or set `AGENTFOLIO_COLLECTION`):

```bash
agentfolio doctor --collection .
agentfolio list harnesses --collection .
agentfolio plan --collection .
```

Agentfolio also discovers the nearest `collection.yaml` or uses `AGENTFOLIO_COLLECTION`.

## Profiles

| Intent | Profile |
| --- | --- |
| Personal + curated skills and global instructions | `default` |
| Personal skills only | `skills` |
| Personal skills plus Pi configuration | `pi` |
| Committed Pi model lock, Scope, and providers only | `pi-catalog` |
| Personal skills plus Cursor agents | `cursor` |
| Personal skills plus OpenCode plugins and agents | `opencode` |
| Personal skills plus global, Pi, Cursor, and OpenCode | `all` |

Preview before applying:

```bash
agentfolio plan --profile pi
agentfolio apply --profile pi --dry-run
agentfolio apply --profile pi-catalog --dry-run
agentfolio apply --profile pi
```

## Collection-owned model commands

Model discovery and generated catalog files are implemented by `agent-skills`, not Agentfolio core:

```bash
agent-skills models check
agent-skills models diff
agent-skills models refresh
```

Edit `harnesses/catalog.yaml`; generated lock/provider targets are outputs. Run `models check`, preview with `models diff`, and use `models refresh` only when the policy and discovery results are ready to commit. Apply Pi changes through `agentfolio apply --profile pi --dry-run`.

## Decision rules

- Change workflow intent in `collection.yaml`; change execution semantics in `scripts/agentfolio-adapter.mjs` or the relevant setup script.
- Use `agentfolio list harnesses`, `plan`, `doctor`, and `verify` for inspection.
- Treat direct `agent-skills setup|install` commands as adapter implementations or debugging surfaces.
- Keep credentials outside the collection. Never copy OAuth tokens, API keys, or login state.
- Dry-run first unless the user explicitly requests an immediate apply.
- Stop on the first failed action and preserve unmanaged user configuration.
- Restart a harness when its extensions or providers changed.
