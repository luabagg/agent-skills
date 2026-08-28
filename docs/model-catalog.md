# Model and Agent Catalog

`harnesses/catalog.yaml` is the policy source for Pi Scope and OpenCode agent models. Model discovery and generated targets are collection-owned behavior implemented by `agent-skills`.

## Day-to-day

```bash
# Edit policy
$EDITOR harnesses/catalog.yaml

# Validate offline
agent-skills models check

# Preview live discovery against the committed lock
agent-skills models diff

# Rewrite generated lock and provider targets
agent-skills models refresh

# Preview/apply harness configuration through Agentfolio
agentfolio apply --profile pi-catalog --dry-run --collection .
agentfolio apply --profile pi --dry-run --collection .
agentfolio apply --profile pi --collection .
agentfolio apply --profile opencode --dry-run --collection .
```

## Ownership

| Path | Role | Edit? |
| --- | --- | --- |
| `harnesses/catalog.yaml` | Providers, selectors, Pi scopes, OpenCode roles | Yes |
| `harnesses/catalog.lock.json` | Resolved provider snapshots and selectors | Generated |
| `harnesses/pi/cursor-provider.json` | Cursor provider configuration for Pi | Generated |
| `harnesses/pi/xai.ts` | xAI adapter and capability inference | Adapter code |
| `harnesses/pi/claude.ts` | Claude CLI bridge | Adapter code |
| `scripts/agentfolio-adapter.mjs` | Maps Agentfolio harness actions to setup commands | Adapter code |

## Command contract

| Command | Network | Writes | Purpose |
| --- | --- | --- | --- |
| `agent-skills models check` | no | no | Validate policy, lock digests, selectors, templates, and generated targets |
| `agent-skills models diff` | best effort | no | Preview live discovery, falling back to committed provider snapshots |
| `agent-skills models refresh` | best effort | collection files | Rewrite lock and generated targets |
| `agentfolio apply --profile pi-catalog --dry-run` | adapter-dependent | no | Preview catalog/Scope/provider apply |
| `agentfolio apply --profile pi --dry-run` | adapter-dependent | no | Preview full Pi harness apply |
| `agentfolio apply --profile pi` | adapter-dependent | live configuration | Execute the collection-owned Pi workflow |

Agentfolio does not implement model semantics. It plans `pi:configure` or `pi-catalog:configure` and dispatches them to this repository's adapter. Use `pi-catalog` after `models refresh` when packages and extensions are already installed.

## Policy and lock rules

- Exact selectors never fall forward to another model ID.
- `familyLatest` selection is allowed only when explicitly declared.
- Fallback metadata may complete only the same model ID.
- Refresh keeps a provider's committed snapshot when discovery fails and policy is unchanged.
- Policy changes plus failed discovery do not bless stale metadata.
- Generated files omit credentials, timestamps, and machine-local cache paths.

## OpenCode roles

Templates use:

```yaml
model: {{catalogRole:advisor}}
```

`opencodeRoles` maps roles to selectors. The OpenCode collection action renders concrete provider/model IDs from the committed lock.

## Safety

- Never commit OAuth tokens, API keys, private org IDs, or machine-local caches.
- Keep bridge services bound to localhost.
- Commit `catalog.yaml`, its lock, and generated targets together after refresh.
