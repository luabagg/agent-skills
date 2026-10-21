# Modern Models and OpenCode Implementation Plan

**Goal:** Update the model catalog and OpenCode defaults while keeping the existing Pi packages.

**Scope:** User-requested tasks 2 and 3 from this conversation. Keep Pi's five packages. Preserve existing credentials, MCP configuration, plugins, and unrelated skill edits.

## Tasks

- [x] Discover OpenAI models through authenticated OpenCode without copying credentials into Pi.
- [x] Add provider-policy digests so unchanged optional providers can reuse their snapshots while another provider changes.
- [x] Replace GPT-5.6 Scope entries with current GPT-6 models and generate the model lock.
- [x] Configure native OpenCode Build, Plan, and Explore defaults through the collection-owned setup action.
- [x] Update Coder and Advisor to authenticated OpenAI models, remove unsupported temperature overrides, and make brainstorming self-contained.
- [x] Shorten global workflow instructions while retaining code-quality, verification, and communication preferences.
- [x] Verify catalog parsing, stale-provider rejection, JSONC preservation, dry-run safety, and setup idempotency.
- [x] Validate the emitted configuration with current OpenCode, preview the collection actions, and apply the supported OpenCode configuration.

## Checks

Use `npm test`, `agent-skills models check`, `agent-skills models diff`, and Agentfolio dry-runs. Run a minimal authenticated OpenCode model call after applying. Pi authentication and a Pi model call require a separate native Pi login; OpenCode credentials stay in OpenCode.

## Results

- `npm test`: 74 passed; one optional cross-repository smoke test skipped.
- OpenCode 1.19.0 accepted the generated config and resolved the expected native and custom agent settings.
- An authenticated OpenCode request using the configured default model returned `MODEL_OK`.
- Agentfolio applied the OpenCode, Pi catalog, and full Pi profiles after dry-run previews.
- Pi 1.2.0 is installed. All five packages are installed; an RPC startup check returned their registered commands without extension errors.
- The user chose to sign into Pi later. `pi auth check --provider openai-codex --json` reports `credentials_not_configured`. Pi's authenticated model call is deferred.

## Contracts at risk

- A changed provider must not silently reuse stale metadata.
- A change to one provider must not require credentials for unchanged optional providers.
- OpenCode setup must preserve unrelated JSONC settings, comments, plugins, and instructions.
- Defaults must be rendered from the same committed model lock as specialist agents.
