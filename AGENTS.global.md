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

## Technical Prose

For docs, code comments, commit messages, PR descriptions, reports, and technical replies, use ASD-STE100 Simplified Technical English.

- Use approved words. Give each word one meaning.
- Use one word for one idea. Do not use two words for the same idea.
- Write short sentences. Keep instructions to 20 words or fewer.
- Use active voice. Write "Turn the switch," not "The switch must be turned."
- Write short paragraphs. Cover one topic in each paragraph.

Keep `caveman` for casual status updates and ordinary replies. Use correct technical English when the reply explains durable technical work.

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


<!-- headroom:rtk-instructions -->
# RTK (Rust Token Killer) - Token-Optimized Commands

When running shell commands, **always prefix with `rtk`**. This reduces context
usage by 60-90% with zero behavior change. If rtk has no filter for a command,
it passes through unchanged — so it is always safe to use.

## Key Commands
```bash
# Git (59-80% savings)
rtk git status          rtk git diff            rtk git log

# Files & Search (60-75% savings)
rtk ls <path>           rtk read <file>         rtk grep <pattern>
rtk find <pattern>      rtk diff <file>

# Test (90-99% savings) — shows failures only
rtk pytest tests/       rtk cargo test          rtk test <cmd>

# Build & Lint (80-90% savings) — shows errors only
rtk tsc                 rtk lint                rtk cargo build
rtk prettier --check    rtk mypy                rtk ruff check

# Analysis (70-90% savings)
rtk err <cmd>           rtk log <file>          rtk json <file>
rtk summary <cmd>       rtk deps                rtk env

# GitHub (26-87% savings)
rtk gh pr view <n>      rtk gh run list         rtk gh issue list

# Infrastructure (85% savings)
rtk docker ps           rtk kubectl get         rtk docker logs <c>

# Package managers (70-90% savings)
rtk pip list            rtk pnpm install        rtk npm run <script>
```

## Rules
- In command chains, prefix each segment: `rtk git add . && rtk git commit -m "msg"`
- For debugging, use raw command without rtk prefix
- `rtk proxy <cmd>` runs command without filtering but tracks usage
<!-- /headroom:rtk-instructions -->

<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
