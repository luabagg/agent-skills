# Model and Agent Catalog

Single source of truth for which models Pi Scope and OpenCode agents use.

## Day-to-day

Edit policy, preview, commit generated artifacts, then apply:

```bash
# 1. Edit policy only
$EDITOR harnesses/catalog.yaml

# 2. Preview live discovery vs committed lock
agent-skills models diff

# 3. Write lock + generated targets (commit both)
agent-skills models refresh

# 4. Apply to the local machine
agent-skills setup pi --catalog-only
agent-skills setup opencode
```

Offline validation (CI / pre-setup):

```bash
agent-skills models check
```

## What you edit vs what you never edit

| Path | Role | Edit? |
| --- | --- | --- |
| `harnesses/catalog.yaml` | Policy: providers, selectors, Pi scopes, OpenCode roles | **Yes** — only manual source |
| `harnesses/catalog.lock.json` | Resolved snapshots + selector resolutions | **No** — `models refresh` |
| `harnesses/pi/cursor-provider.json` | Generated Cursor provider for Pi | **No** — `models refresh` |
| `harnesses/pi/xai-subscription.ts` | xAI adapter / capability inference | Adapter code, not model lists |
| `~/.pi/agent/catalog.lock.json` | Installed lock copy used offline by adapters | Installed by `setup pi` |
| OpenCode agent frontmatter models | Rendered from roles at setup time | Installed by `setup opencode` |

## Mental model

```text
catalog.yaml          policy (human)
      │
      ▼
catalog.mjs           check | diff | refresh
      │
      ├─► catalog.lock.json
      └─► generated targets (cursor-provider.json)
              │
              ▼
setup-pi / setup-opencode
   consume lock only (never re-discover models)
```

- **Policy** decides *which* models matter (exact IDs or explicit `familyLatest`).
- **Lock** freezes *what* discovery last saw and *how* selectors resolved.
- **Setup** installs that freeze into harness config. Fresh machines work before provider login.

## Commands

| Command | Network | Writes | Purpose |
| --- | --- | --- | --- |
| `models check` | no | no | Policy + lock digests + selector resolution + agent templates + generated targets |
| `models diff` | yes (best-effort) | no | Live discovery preview; falls back to lock per provider if discovery fails |
| `models refresh` | yes (best-effort) | yes | Rewrite lock + generated targets; keep last snapshot if one provider is down |

```bash
agent-skills models check
agent-skills models diff
agent-skills models refresh
```

Normal `setup pi` / `setup opencode` always run `models check` first and refuse to apply a stale or invalid lock.

## Pi setup phases

Full Pi setup does more than the catalog. Split when you only need models:

| Phase | What it does | When |
| --- | --- | --- |
| **catalog** | `models check`, install lock, reconcile Scope `enabledModels`, merge model providers | Always |
| **packages** | Install selected `pi` packages from `harnesses/pi.json` | Default full setup |
| **extensions** | Install local extensions under `~/.pi/agent/` | Default full setup |
| **cursor-bridge** | OpenCursor bridge + systemd user service | Default full setup |

```bash
# Models only (fastest day-to-day after models refresh)
agent-skills setup pi --catalog-only

# Everything except Cursor bridge
agent-skills setup pi --skip-cursor-bridge

# Full harness (packages + extensions + bridge)
agent-skills setup pi
agent-skills setup pi --enable-recommended
```

## Ownership

| Data | Classification | Owner |
| --- | --- | --- |
| Cursor `/v1/models` IDs | discovery | live local bridge → snapshotted in lock |
| xAI subscription model IDs | discovery | `pi --list-models xai-subscription` → lock |
| Pi Scope membership | policy | `catalog.yaml` `piScopes` + `selectors` |
| OpenCode agent → model | policy | `catalog.yaml` `opencodeRoles` |
| Provider aliases (`cursor`, `xai-subscription`, `xai`) | policy | provider `harnessIds` |
| Context / cost when upstream omits them | fallback metadata | provider defaults, rules, same-ID fallbacks in YAML |
| Cursor Pi provider JSON | generated | `harnesses/pi/cursor-provider.json` |
| Concrete resolved model IDs | generated | `harnesses/catalog.lock.json` |
| Installed Pi Scope / provider files | install output | `scripts/setup-pi.mjs` |
| Installed OpenCode agent model frontmatter | install output | `scripts/setup-opencode.mjs` |
| xAI reasoning / Composer compatibility | adapter logic | `harnesses/pi/xai-subscription.ts` |

## Policy and lock contract

`harnesses/catalog.yaml` is schema version 1. It defines providers, discovery adapters, fallback metadata, exact or opted-in `familyLatest` selectors, Pi scopes, OpenCode roles, and generated targets. Unknown keys and invalid references fail validation.

`harnesses/catalog.lock.json` is generated and committed. It holds:

- normalized provider model snapshots
- policy digest + per-provider snapshot digests
- concrete selector resolutions

It deliberately omits timestamps, credentials, auth headers, machine paths, and volatile caches so identical policy + discovery produce byte-identical output.

### Resolution rules

- **Exact** selectors never fall forward to another ID. Missing exact model = error.
- **`familyLatest`** only when explicitly declared. Numeric dotted versions compare numerically; ambiguous ties fail.
- **Fallback metadata** may complete or admit only the **same** model ID. It cannot pick a replacement model.
- **Discovery failure on refresh**: keep that provider’s committed snapshot when policy digest is unchanged. Policy change + discovery failure refuses to bless stale metadata.

## Failure modes

| Symptom | Meaning | Fix |
| --- | --- | --- |
| `catalog.lock.json is stale for catalog.yaml` | Policy edited without refresh | `models refresh`, commit lock + targets |
| `selector … requires missing exact model` | Exact ID gone from discovery/fallbacks | Restore model, change selector, or add same-ID fallback |
| `stale generated target: harnesses/pi/cursor-provider.json` | Lock/targets out of sync | `models refresh` |
| Provider warning on `diff`/`refresh`, using lock | Live discovery unavailable | Expected offline; fix bridge/login when you need live data |
| Setup fails on `models check` | Invalid/stale catalog | Fix policy/lock before setup mutates user config |

## OpenCode roles

Agent templates use one placeholder:

```yaml
model: {{catalogRole:advisor}}
```

`opencodeRoles` in YAML maps role → selector. `setup opencode` renders the concrete `provider/model` into installed frontmatter from the lock.

## Safety

- Never commit live OAuth tokens, API keys, or machine-local cache paths.
- Cursor bridge binds to `127.0.0.1` only; treat as single-user trusted machine.
- Public repo: no private org IDs, internal URLs, or credentials in YAML/lock.
