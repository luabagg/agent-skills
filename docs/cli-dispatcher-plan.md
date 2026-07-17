# Agent Skills CLI Dispatcher Plan

## Goal

Replace the large public `package.json` script surface with one consistent `agent-skills` command while keeping the existing focused implementation scripts behind it.

## Proposed interface

```text
agent-skills
├── skills
│   └── list [--installed] [--json]
├── install
│   ├── skills [--copy] [--dry-run]
│   ├── curated [--copy] [--dry-run]
│   ├── agents [--copy] [--dry-run]
│   └── all [--copy] [--dry-run]
├── setup
│   ├── memory-palace [--dry-run]
│   ├── opencode [--dry-run] [--enable-recommended]
│   └── pi [--dry-run] [--enable-recommended]
├── catalog
│   ├── check
│   ├── diff
│   └── refresh
├── update
└── verify
```

## Usage

Through npm:

```bash
npm run agent-skills -- setup pi --dry-run
npm run agent-skills -- install curated --dry-run
npm run agent-skills -- catalog check
npm run agent-skills -- skills list --installed --json
npm run agent-skills -- verify
```

Through the package executable:

```bash
npm exec -- agent-skills setup pi --dry-run
```

After a global installation:

```bash
agent-skills setup pi --dry-run
```

## Package configuration

Reduce the public npm scripts to conventional entry points:

```json
{
  "bin": {
    "agent-skills": "./scripts/cli.mjs"
  },
  "scripts": {
    "agent-skills": "node scripts/cli.mjs",
    "setup": "node scripts/cli.mjs install all",
    "verify": "node scripts/cli.mjs verify"
  }
}
```

## Dispatcher behavior

`scripts/cli.mjs` parses the command tree, validates flags, prints help, and delegates to existing scripts or external commands.

Examples:

| CLI command | Delegated operation |
| --- | --- |
| `skills list` | `npx --yes skills add . --list` |
| `skills list --installed` | `npx --yes skills list --global` |
| `install skills` | `scripts/install-personal-skills.mjs` |
| `install curated` | `scripts/install-curated-skills.mjs` |
| `install agents` | `scripts/install-agents.mjs` |
| `setup memory-palace` | `scripts/configure-memory-palace.mjs` |
| `setup opencode` | `scripts/setup-opencode.mjs` |
| `setup pi` | `scripts/setup-pi.mjs` |
| `catalog check/diff/refresh` | `scripts/catalog.mjs` |
| `update` | `npx --yes skills update --global --yes` |
| `verify` | Ordered internal verification workflow |

Delegation should use `execFileSync` or `spawnSync` with argument arrays rather than shell command strings.

## Status

Implemented in `scripts/cli.mjs` with thin `package.json` aliases. Domain scripts remain the owners of install/setup/catalog logic. Pi gained `--catalog-only` and `--skip-cursor-bridge` so model apply is not tied to full harness install. See [`docs/model-catalog.md`](model-catalog.md).

CLI coverage lives in `tests/cli.test.mjs` (`npm run test:cli` / `npm test`). Dispatcher verification (`--help`, dry-run setup/install, `catalog check`, `verify`, `npm exec -- agent-skills`) was run successfully through the unified entrypoint.

## Implementation steps

- [x] Inventory supported flags and exit behavior in every existing script.
- [x] Add `scripts/cli.mjs` with a declarative command registry.
- [x] Implement nested command parsing and contextual `--help` output.
- [x] Validate options per command and reject unsupported combinations clearly.
- [x] Delegate commands using the current Node executable and explicit argument arrays.
- [x] Implement `install all` as ordered orchestration with fail-fast behavior.
- [x] Implement `verify` as ordered orchestration without duplicated shell command strings.
- [x] Add the `agent-skills` executable under `package.json#bin`.
- [x] Reduce `package.json#scripts` to `agent-skills`, `setup`, and `verify`.
- [x] Update README examples to use the dispatcher.
- [x] Add CLI tests for routing, help, invalid commands, flag forwarding, dry-run safety, and child exit-code propagation.
- [x] Run all existing setup/catalog verification through the dispatcher and confirm behavior remains idempotent.

## Command rules

- `--dry-run` must never mutate files or install packages.
- `--copy` is valid only for installers that support copy mode.
- `--enable-recommended` is valid only for Pi and OpenCode setup.
- `--json` requires `skills list --installed`.
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
│   ├── cli-args.mjs
│   ├── command-runner.mjs
│   └── command-registry.mjs
├── install-personal-skills.mjs
├── install-curated-skills.mjs
├── install-agents.mjs
├── configure-memory-palace.mjs
├── setup-opencode.mjs
├── setup-pi.mjs
└── catalog.mjs
```

Do not merge all implementation logic into `cli.mjs`. The dispatcher owns routing and orchestration; existing scripts continue owning their domains.

## Verification

```bash
npm run agent-skills -- --help
npm run agent-skills -- setup pi --dry-run
npm run agent-skills -- setup opencode --dry-run
npm run agent-skills -- install curated --dry-run
npm run agent-skills -- catalog check
npm run agent-skills -- verify
npm exec -- agent-skills --help
```

Also verify:

- Existing user configuration remains unchanged during dry-runs.
- Repeated setup commands remain idempotent.
- Invalid commands return concise actionable errors.
- Windows/WSL paths are passed as argument values without shell quoting problems.
- Existing unrelated working-tree changes are preserved.
