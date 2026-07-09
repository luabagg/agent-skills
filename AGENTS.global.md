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

## Default Communication

- No slop grenades: do not paste AI-generated walls of text where a human would answer in one sentence or a few bullets.
- Answer the exact question first. Put the decision, finding, or recommendation before context.
- Default to terse, structured, easy-to-scan bullets. Keep status updates, summaries, reviews, and explanations compact unless the user asks for depth.
- Include only decisive evidence. Do not dump long logs, raw diffs, tool narration, generic caveats, or full audits when a short answer satisfies the request.
- If more detail may help, offer a short "want deeper?" follow-up instead of expanding by default.

## Default Skill Use

- Use the `superpowers` skill set by default for software work when it is installed. Treat it as the baseline workflow layer for planning, debugging, TDD, reviews, verification, branch finishing, and other development process tasks.
- Use the `caveman` skill set by default for concise communication when it is installed. Prefer terse, direct status updates, summaries, reviews, and commit-style language unless the user asks for a fuller explanation.
- For rewrites, translations, English corrections, message polishing, tone adaptation, or text restructuring, use the `natural-copy-editing` skill.
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

## CodeGraph

CodeGraph is a local pre-indexed code knowledge graph (`colbymchenry/codegraph`). It is optional per project: only rely on it when the workspace has a `.codegraph/` directory (after `codegraph init`).

Before using the MCP tool, confirm the CLI is available:

```bash
codegraph --version
codegraph status
```

When `.codegraph/` exists and the task is structural — how a flow works, callers/callees, blast radius before a change, or surveying an unfamiliar area — prefer **`codegraph_explore`** (MCP) or **`codegraph explore "<question>"`** instead of a broad grep/read crawl. Treat returned source as already read; do not re-verify every symbol with grep unless the response shows a staleness warning after recent edits.

When there is no index, the user forbids graph tools, or the task is a single known file path, use normal search and Read. One-time setup per machine: `codegraph install`; per repo: `codegraph init`. See `curated-tools.json` in the agent-skills repo for the canonical reference.

<!-- context7 -->
Use the `ctx7` CLI to fetch current documentation whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service -- even well-known ones like React, Next.js, Prisma, Express, Tailwind, Django, or Spring Boot. This includes API syntax, configuration, version migration, library-specific debugging, setup instructions, and CLI tool usage. Use even when you think you know the answer -- your training data may not reflect recent changes. Prefer this over web search for library docs.

Do not use for: refactoring, writing scripts from scratch, debugging business logic, code review, or general programming concepts.

## Steps

1. Resolve library: `npx ctx7@latest library <name> "<user's question>"` — use the official library name with proper punctuation (e.g., "Next.js" not "nextjs", "Customer.io" not "customerio", "Three.js" not "threejs")
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question)
3. Fetch docs: `npx ctx7@latest docs <libraryId> "<user's question>"`
4. Answer using the fetched documentation

You MUST call `library` first to get a valid ID unless the user provides one directly in `/org/project` format. Use the user's full question as the query -- specific and detailed queries return better results than vague single words. Do not run more than 3 commands per question. Do not include sensitive information (API keys, passwords, credentials) in queries.

For version-specific docs, use `/org/project/version` from the `library` output (e.g., `/vercel/next.js/v14.3.0`).

If a command fails with a quota error, inform the user and suggest `npx ctx7@latest login` or setting `CONTEXT7_API_KEY` env var for higher limits. Do not silently fall back to training data.
Run Context7 CLI requests outside Codex's default sandbox. If a Context7 CLI command fails with DNS or network errors such as ENOTFOUND, host resolution failures, or fetch failed, rerun it outside the sandbox instead of retrying inside the sandbox.
<!-- context7 -->
