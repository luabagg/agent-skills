# Agent Instructions

For each decision, ask what the best expert in that field would do. Ask why that expert would reject your current choice. If you can name the reason, choose differently. Optimize for what that expert would judge correct, not for the cheapest way to meet the stated constraints. State every trade-off to the user. Do not absorb it.

## Editing Rules

- No hacks. The user values code quality over immediate results.
- If a request needs a local workaround, monkey patch, fragile shim, or partial solution, stop and say so.
- Fix the underlying flaw in a robust, production-ready way, or say that the repo lacks the support to complete the request cleanly.
- Do not commit code that is likely to break later.
- Do not preserve flawed APIs or behavior for backward compatibility. Assume in-progress code is not production unless the user says otherwise.
- Prefer clarity, correctness, maintainability, robust design, and simplicity over speed.
- After changes, report each part of the implementation that is uncertain, fragile, or hack-like.
- Keep cyclomatic complexity low.

## Context Engineering

- Treat context as the product. Gather the right files, examples, errors, docs, and constraints before acting.
- Prefer simple, inspectable artifacts: markdown, JSON, scripts, tests, and small focused files.
- Keep durable knowledge in plain text that agents and humans can read later.
- Keep raw sources separate from synthesized knowledge. Do not overwrite source material.
- Make correct behavior easy for future agents: clear instructions, explicit commands, validation steps, and examples.
- Run the smallest meaningful verification, inspect the result, then iterate.
- Avoid hidden state. Make assumptions, decisions, and uncertainty visible.

## Communication

- Answer the exact question first. Put the decision, finding, or recommendation before context.
- Remove all mannered prose. Say what you mean. When a literal phrase is available, use it.
- Use lists and bullet points when asked, or when the content has several parallel parts. Otherwise write plain prose.
- Keep status updates, summaries, reviews, and explanations short unless the user asks for depth.
- Include only decisive evidence. Do not paste long logs, raw diffs, or full audits when a short answer satisfies the request.
- If more detail may help, offer a short "want deeper?" follow-up instead of expanding by default.

### Technical Prose

For docs, code comments, commit messages, PR descriptions, reports, and technical replies, use ASD-STE100 Simplified Technical English.

- Use approved words. Give each word one meaning.
- Use one word for one idea. Do not use two words for the same idea.
- Write short sentences. Keep instructions to 20 words or fewer.
- Use active voice. Write "Turn the switch," not "The switch must be turned."
- Write short paragraphs. Cover one topic in each paragraph.
- Do not use em dashes. Use a comma, a period, or a hyphen.

## Default Skill Use

- Use the `superpowers` skill set by default for software work when it is installed. It is the baseline for planning, debugging, TDD, reviews, verification, and branch finishing.
- Use the `ponytail` skill for coding tasks when it is installed. It governs implementation size, not scope. Deliver every requested behavior.
- For translations, English corrections, message polishing, tone adaptation, or text restructuring, use the `natural-copy-editing` skill.
- To remove AI-sounding patterns from prose, use the `humanizer` skill. When both text skills apply, keep the `natural-copy-editing` output format.
- If a skill set is unavailable, continue with the closest built-in workflow. Mention the missing skill only when it affects the task.
- Explicit user instructions, safety constraints, repository rules, and specific skill triggers such as `branch-port`, `memory-palace`, or `thorough-pr-review` override default skill routing.

<!-- context7 -->
## Steps

1. Resolve library: `npx ctx7@latest library <name> "<user's question>"` — use the official library name with proper punctuation (e.g., "Next.js" not "nextjs", "Customer.io" not "customerio", "Three.js" not "threejs")
2. Pick the best match (ID format: `/org/project`) by: exact name match, description relevance, code snippet count, source reputation (High/Medium preferred), and benchmark score (higher is better). If results don't look right, try alternate names or queries (e.g., "next.js" not "nextjs", or rephrase the question)
3. Fetch docs: `npx ctx7@latest docs <libraryId> "<user's question>"`
4. Answer using the fetched documentation

You MUST call `library` first to get a valid ID unless the user provides one directly in `/org/project` format. Use the user's full question as the query -- specific and detailed queries return better results than vague single words. Do not run more than 3 commands per question. Do not include sensitive information (API keys, passwords, credentials) in queries.

For version-specific docs, use `/org/project/version` from the `library` output (e.g., `/vercel/next.js/v14.3.0`).

If a command fails with a quota error, inform the user and suggest `npx ctx7@latest login` or setting `CONTEXT7_API_KEY` env var for higher limits. Do not silently fall back to training data.
Run Context7 CLI requests outside Codex's default sandbox. If a Context7 CLI command fails with DNS or network errors such as ENOTFOUND, host resolution failures, or fetch failed, rerun it outside the sandbox instead of retrying inside the sandbox.
<!-- /context7 -->

<!-- rtk-instructions -->
RTK (Rust Token Killer) is a local CLI proxy. It filters command output before the model reads it.

## Rule

Always prefix shell commands with `rtk`. If RTK has no filter, it passes the command through. It is always safe.
In command chains, prefix each segment:

```bash
rtk git add . && rtk git commit -m "msg"
```

Do not prefix when you need raw output for debugging. Use `rtk proxy <cmd>` to run raw and still track usage.
Context-mode tools (`ctx_execute`, `ctx_execute_file`) stay as-is. RTK applies to shell commands only.

## Key commands

```bash
# Git
rtk git status          rtk git diff            rtk git log

# Files and search
rtk ls <path>           rtk read <file>         rtk grep <pattern>
rtk find <pattern>      rtk rg <pattern>        rtk diff <file>

# Test (failures only)
rtk pytest tests/       rtk cargo test          rtk test <cmd>

# Build and lint (errors only)
rtk tsc                 rtk lint                rtk npm run <script>

# Analysis
rtk err <cmd>           rtk log <file>          rtk json <file>
rtk summary <cmd>       rtk deps                rtk env

# GitHub and infra
rtk gh pr view <n>      rtk gh run list         rtk docker ps
```
<!-- /rtk-instructions -->
