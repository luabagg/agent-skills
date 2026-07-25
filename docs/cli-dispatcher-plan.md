# Agent Skills CLI Dispatcher Plan

## Goal

One consistent `agent-skills` command for browse, install, harness setup, config, and model catalog work. Domain scripts stay behind the dispatcher.

## Interface

```text
agent-skills
├── list
│   ├── skills [--installed] [--json]
│   ├── curated [--plugins] [--json]
│   └── tools [--kind <kind>] [--json]
├── install
│   ├── skills [--copy] [--dry-run]
│   ├── curated [--copy] [--dry-run]
│   ├── agents [--copy] [--dry-run]
│   └── all [--copy] [--dry-run]
├── setup
│   ├── opencode [--dry-run] [--enable-recommended]
│   ├── pi [--dry-run] [--enable-recommended] [--catalog-only] [--skip-cursor-bridge]
│   └── cursor [--dry-run] [--copy]
├── config
│   └── memory-palace [--dry-run] --vault <path>
├── models
│   ├── check
│   ├── diff
│   └── refresh
├── update
└── verify
```

## Usage

From a linked/global install:

```bash
agent-skills list tools
agent-skills list curated
agent-skills setup pi --dry-run
agent-skills install curated --dry-run
agent-skills models check
agent-skills list skills --installed --json
agent-skills config memory-palace --vault ~/vault --dry-run
agent-skills verify
```

From a local checkout:

```bash
npx agent-skills setup pi --dry-run
# or
npm exec -- agent-skills setup pi --dry-run
```

## Package configuration

Public entry is the bin. Keep only what npm needs for tests and local invocation:

```json
{
  "bin": {
    "agent-skills": "./scripts/cli.mjs"
  },
  "scripts": {
    "agent-skills": "node scripts/cli.mjs",
    "test": "node --test tests/**/*.test.mjs",
    "test:cli": "node --test tests/cli.test.mjs"
  }
}
```

## Dispatcher behavior

`scripts/cli.mjs` parses the command tree, validates flags, prints help, and delegates to existing scripts or external commands.

| CLI command | Delegated operation |
| --- | --- |
| `list skills` | `npx --yes skills add . --list` |
| `list skills --installed` | `npx --yes skills list --global` |
| `list curated` | read `curated-skills.json` sources |
| `list curated --plugins` | read `curated-skills.json` pluginReferences |
| `list tools` | read `curated-tools.json` |
| `install skills` | `scripts/install-personal-skills.mjs` |
| `install curated` | `scripts/install-curated-skills.mjs` |
| `install agents` | `scripts/install-agents.mjs` |
| `setup opencode` | `scripts/setup-opencode.mjs` |
| `setup pi` | `scripts/setup-pi.mjs` |
| `setup cursor` | `scripts/setup-cursor.mjs` |
| `config memory-palace` | `scripts/configure-memory-palace.mjs` |
| `models check/diff/refresh` | `scripts/catalog.mjs` |
| `update` | `npx --yes skills update --global --yes` |
| `verify` | Ordered internal verification workflow |

Delegation uses `execFileSync` / `spawnSync` with argument arrays rather than shell command strings.

## Status

Implemented in `scripts/cli.mjs`. Domain scripts remain the owners of install/setup/catalog logic. Browse commands (`list *`) are read-only. Pi gained `--catalog-only` and `--skip-cursor-bridge` so model apply is not tied to full harness install. See [`docs/model-catalog.md`](model-catalog.md).

CLI coverage lives in `tests/cli.test.mjs`.

## Implementation steps

- [x] Inventory supported flags and exit behavior in every existing script.
- [x] Add `scripts/cli.mjs` with a declarative command registry.
- [x] Implement nested command parsing and contextual `--help` output.
- [x] Validate options per command and reject unsupported combinations clearly.
- [x] Delegate commands using the current Node executable and explicit argument arrays.
- [x] Implement `install all` as ordered orchestration with fail-fast behavior.
- [x] Implement `verify` as ordered orchestration without duplicated shell command strings.
- [x] Add the `agent-skills` executable under `package.json#bin`.
- [x] Noun-first browse surface: `list skills|curated|tools`.
- [x] Rename model surface to `models`; move vault setup to `config`.
- [x] Document CLI-first usage; drop public npm-script alias surface.
- [x] Add CLI tests for routing, help, invalid commands, flag forwarding, dry-run safety, and child exit-code propagation.

## Command rules

- `--dry-run` must never mutate files or install packages.
- `--copy` is valid only for installers that support copy mode.
- `--enable-recommended` is valid only for Pi and OpenCode setup.
- `--json` on `list skills` requires `--installed`.
- `--plugins` is valid only for `list curated`.
- `--kind` is valid only for `list tools`.
- Unknown commands, targets, and flags exit non-zero and print relevant help.
- Child process failures propagate their original non-zero status.
- `install all` stops on the first failure.
- Credentials and environment variables pass through without being printed.

## Internal structure

Keep the dispatcher small and declarative:

```text
scripts/
├── cli.mjs
├── lib/
│   └── command.mjs
├── install-personal-skills.mjs
├── install-curated-skills.mjs
├── install-agents.mjs
├── configure-memory-palace.mjs
├── setup-opencode.mjs
├── setup-pi.mjs
├── setup-cursor.mjs
└── catalog.mjs
```

Do not merge all implementation logic into `cli.mjs`. The dispatcher owns routing and orchestration; existing scripts continue owning their domains.

## Verification

```bash
agent-skills --help
agent-skills list tools
agent-skills list curated --plugins
agent-skills setup pi --dry-run
agent-skills setup opencode --dry-run
agent-skills install curated --dry-run
agent-skills models check
agent-skills verify
npx agent-skills --help
```

Also verify:

- Existing user configuration remains unchanged during dry-runs.
- Repeated setup commands remain idempotent.
- Invalid commands return concise actionable errors.
- Windows/WSL paths are passed as argument values without shell quoting problems.
- Existing unrelated working-tree changes are preserved.
