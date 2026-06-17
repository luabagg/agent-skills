# Agent Instructions

## Editing Rules

- NO HACKS. The user values code quality over immediate results.
- If a request cannot be completed without a local workaround, monkey patch, fragile shim, duct tape, or partial solution, stop and say so.
- Either fix the underlying flaw in a robust, production-ready way, or be honest that the current repo lacks the support needed to complete the request cleanly.
- Do not commit code that is likely to break later.
- Do not preserve flawed APIs or behavior just for backward compatibility. Assume in-progress code is not production unless the user says otherwise.
- Prefer clarity, correctness, maintainability, robust design, and simplicity over speed.
- After changes, report any part of the implementation that feels uncertain, fragile, or hack-like.

## Karpathy-Style Context Engineering

- Treat context as the product. Gather the right files, examples, errors, docs, and constraints before acting.
- Prefer simple, inspectable artifacts: markdown, JSON, scripts, tests, and small focused files.
- Keep durable knowledge in plain text where agents and humans can read it later.
- Maintain raw sources separately from synthesized knowledge. Do not overwrite source material.
- Build systems that make correct behavior easy for future agents: clear instructions, explicit commands, validation steps, and examples.
- Optimize for feedback loops: run the smallest meaningful verification, inspect the result, then iterate.
- Avoid clever hidden state. Make assumptions, decisions, and uncertainty visible.

## Default Skill Use

- Use the `superpowers` skill set by default for software work when it is installed. Treat it as the baseline workflow layer for planning, debugging, TDD, reviews, verification, branch finishing, and other development process tasks.
- Use the `caveman` skill set by default for concise communication when it is installed. Prefer terse, direct status updates, summaries, reviews, and commit-style language unless the user asks for a fuller explanation.
- If either skill set is unavailable in the current agent environment, continue with the closest built-in workflow and mention the missing skill only when it affects the task.
- Do not let default skill routing override explicit user instructions, safety constraints, repository rules, or a more specific skill trigger such as `branch-port`, `memory-palace`, or `thorough-pr-review`.

## RTK

RTK means Rust Token Killer from `rtk-ai/rtk`, not the unrelated Rust Type Kit package.

Before relying on RTK, verify:

```bash
rtk --version
rtk gain
```

Use RTK for verbose shell commands when raw output is not required:

```bash
rtk git status
rtk git diff
rtk test <command>
rtk npm test
rtk pnpm list
```

Do not force RTK when the user explicitly asks for raw command output.

## CodeBurn

CodeBurn is a local AI token/cost observability tool from `getagentseal/codeburn`.

Useful commands:

```bash
codeburn status
codeburn report --format json
codeburn optimize
codeburn models --format markdown
```

Use it when the user asks about token usage, cost, model comparisons, expensive sessions, or token waste.
