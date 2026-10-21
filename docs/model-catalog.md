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

# Rewrite generated model lock
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
| `harnesses/pi/xai.ts` | xAI adapter and capability inference | Adapter code |
| `scripts/agentfolio-adapter.mjs` | Maps Agentfolio harness actions to setup commands | Adapter code |

## Command contract

| Command | Network | Writes | Purpose |
| --- | --- | --- | --- |
| `agent-skills models check` | no | no | Validate policy, lock digests, selectors, and templates |
| `agent-skills models diff` | best effort | no | Preview live discovery, falling back to committed provider snapshots |
| `agent-skills models refresh` | best effort | collection files | Rewrite model lock |
| `agentfolio apply --profile pi-catalog --dry-run` | adapter-dependent | no | Preview catalog/Scope apply |
| `agentfolio apply --profile pi --dry-run` | adapter-dependent | no | Preview full Pi harness apply |
| `agentfolio apply --profile pi` | adapter-dependent | live configuration | Execute the collection-owned Pi workflow |

Agentfolio does not implement model semantics. It plans `pi:configure` or `pi-catalog:configure` and dispatches them to this repository's adapter. Use `pi-catalog` after `models refresh` when packages and extensions are already installed. Pi setup manages the Scope and lock, and leaves user-owned `models.json` untouched. Use the native `/model` picker and `/login` for direct providers.

## Policy and lock rules

- Exact selectors never fall forward to another model ID.
- `familyLatest` selection is allowed only when explicitly declared.
- Fallback metadata may complete only the same model ID.
- Refresh keeps a provider's committed snapshot when discovery fails and policy is unchanged.
- Provider-policy digests allow an unchanged optional provider to keep its snapshot while another provider changes.
- Changed provider policy plus failed discovery does not bless stale metadata. Legacy locks without provider-policy digests require unchanged whole-policy digests for fallback.
- Generated files omit credentials, timestamps, and machine-local cache paths.

OpenAI discovery reads model metadata from the authenticated OpenCode CLI. Only model names, capabilities, limits, and prices enter the lock. Provider headers, options, and credentials are excluded. Pi uses its own native authentication even when OpenCode supplied the catalog metadata.

## OpenCode roles

Templates use:

```yaml
model: {{catalogRole:advisor}}
```

`opencodeRoles` maps roles to selectors. The OpenCode collection action renders concrete provider/model IDs from the committed lock.

The `primary` and `explore` roles also supply native agent defaults in `harnesses/opencode.json`. Setup applies Build at medium effort, Plan at high effort, and Explore at low effort. Coder and Advisor use their template effort settings. Existing agent settings are preserved except for these managed model selections.

Pi's `settings.defaultSelector` chooses its default provider and model from the same lock. `settings.defaultThinkingLevel` selects the startup effort. Scope and default settings apply through both `pi` and `pi-catalog`.

## Safety

- Never commit OAuth tokens, API keys, private org IDs, or machine-local caches.
- Commit `catalog.yaml` and its lock together after refresh.

## Ownership and safe onboarding

The collection owns policy, manifests, generated lock files, and setup behavior. Agentfolio only discovers the collection and invokes its adapter. Use the canonical two-repository flow: clone this collection, run `npm ci`, install or verify Agentfolio from its canonical repository, then run `agentfolio doctor --collection .`, `agentfolio plan --profile pi --collection .`, and the dry-run apply before applying. Authentication is native keychain/login first; fallback environment keys are never persisted. Planning and dry-run are non-mutating, and failed mutation rolls back managed files.
