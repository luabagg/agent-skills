---
name: memory-palace
description: Use when the user asks to search, ingest, or audit their Obsidian knowledge vault.
---

# Memory palace

Before touching the vault, resolve `$VAULT` using this precedence:

1. Explicit path in the current user request, if provided.
2. `MEMORY_PALACE_VAULT`, if available in the runtime environment.
3. Persisted default at `~/.agents/memory-palace/config.json` (`vaultPath`).
4. Current-directory fallback: walk upward from cwd and use the first directory that looks like this vault.

The persisted config is created with:

```bash
npm run setup:memory-palace -- --vault <path>
```

For WSL, prefer a WSL-accessible path (`/mnt/c/...`). The setup script converts Windows drive paths like `C:\Users\...` to `/mnt/c/Users/...` when running under WSL, validates the converted path, and saves the WSL path.

Treat the resolved path as `$VAULT` below. If no candidate resolves, stop and ask the user to run setup or provide an explicit vault path.

It follows the Karpathy LLM-wiki pattern: raw sources are dropped into `raw/`, the *compiled* knowledge lives under `wiki/` as plain markdown with wikilinks, daily notes live in `journal/`, and ongoing responsibilities live in `areas/`. Plain markdown only -- works in any markdown editor.

You are the **librarian**. The user is the curator. They decide what enters the vault. You file it, link it, and keep it consistent.

## When to invoke

Trigger this skill on explicit user intent:

- **Ingest** -- "file this into my vault", "add this to the wiki", "ingest this URL/file", "save this article into my notes", "remember this".
- **Query** -- "what does my vault say about X", "look up X in my notes", "do I have notes on Y", "answer from my vault".
- **Lint** -- "audit my vault", "check the wiki", "find duplicates / orphans / broken links".

Do **not** trigger when:

- The user is doing unrelated coding/writing and merely *mentions* a person, tool, or concept.
- The user asks a general question that doesn't reference their vault.
- You're inside a different project's session and the user hasn't asked you to touch the vault.

## Vault layout (canonical)

```text
$VAULT/
|-- AGENTS.md            # the cross-agent working agreement -- read this first if unsure
|-- CLAUDE.md -> AGENTS.md   # compatibility symlink for Claude-specific tooling
|-- raw/{inbox,articles,papers,transcripts}/   # source material, READ-ONLY
|-- wiki/
|   |-- index.md         # top-level map
|   |-- log.md           # append-only ingest log
|   |-- concepts/        # ideas, frameworks, methods
|   |-- people/          # one page per person
|   |-- tools/           # one page per tool/product/service
|   `-- projects/        # active and past projects
|-- journal/             # daily notes -- DO NOT modify unless explicitly asked
|-- areas/               # ongoing responsibilities
`-- templates/           # Obsidian templates
```

## The three protocols

### 1. Ingest

Process one source (path or URL) into the wiki.

1. **Acquire.** If a path, read the file. If a URL, fetch it and save the cleaned markdown into the right `$VAULT/raw/` subfolder first (`articles/` for web pages, `papers/` for PDFs, `transcripts/` for podcasts/videos/meetings, `inbox/` if unsure). Use a kebab-case filename. Then process from the saved file.
2. **Extract.** Identify key claims, entities (people / tools / concepts / projects), open questions, and contradictions with what's already in the wiki.
3. **File each entity.** For every entity:
   - **Search `$VAULT/wiki/` first** -- check exact name, kebab variants, and `aliases:` in frontmatter. Use grep/glob; the vault is small enough that brute-force search is fine.
   - If a matching page exists, **merge** new claims into it. Update `updated:` in frontmatter. Don't duplicate.
   - If no match, **create** a new page in the right subfolder (`wiki/people/`, `wiki/tools/`, `wiki/concepts/`, `wiki/projects/`) with this frontmatter:
     ```yaml
     ---
     type: person | tool | concept | project
     created: YYYY-MM-DD
     updated: YYYY-MM-DD
     tags: []
     aliases: []
     ---
     ```
   - Add wikilinks both ways. Cite the source path under a `## Sources` section.
4. **Update the index.** If a genuinely new top-level area appeared, add it to `$VAULT/wiki/index.md`. Otherwise leave the index alone.
5. **Log it.** Append one line to `$VAULT/wiki/log.md`:
   `- YYYY-MM-DD -- <source path or URL> -- touched: [[page-a]], [[page-b]]`
6. **Report.** Tell the user which pages you created, which you modified, and any contradictions or open questions you flagged.

### 2. Query

Answer a question from the vault.

1. **Search `$VAULT/wiki/` first.** Read enough pages to actually answer.
2. **Fall back to `$VAULT/raw/` only if** the wiki is silent or obviously stale. If you do, say so explicitly and offer to ingest the source.
3. **Synthesize** in your own words. Inline-cite every load-bearing claim with a wikilink: `[[page-name]]`. Don't paraphrase content that isn't in the vault and dress it up as a citation.
4. **Be honest about gaps.** "The vault doesn't cover X." Then offer to ingest a source.
5. **End with** "Save this as an analysis page?" If yes, save under `$VAULT/wiki/concepts/` with a kebab-case filename and frontmatter (`type: concept`, `tags: [analysis]`).

### 3. Lint

Audit the vault and report issues. **Never auto-fix.**

Check:
- **Broken wikilinks** -- `[[target]]` / `![[target]]` where the target doesn't exist anywhere in the vault.
- **Orphan pages** -- pages in `wiki/` with zero backlinks (excluding `index.md` and `log.md`).
- **Near-duplicates** -- same entity under two names (similar filenames, alias overlap, overlapping claims).
- **Contradictions** -- clear factual disagreements between pages (be conservative; don't flag stylistic differences).
- **Stale frontmatter** -- missing required fields, `updated:` older than `created:`.

Output one report. End with: "Which fixes should I apply?" Wait for the user's call.

## Hard rules

- **Never modify files in `$VAULT/raw/`** -- they are source. Read-only after the initial save during ingest.
- **Never modify `$VAULT/journal/`** unless the user explicitly asks.
- **Search before creating.** Always. Prefer merging into an existing page over creating a near-duplicate.
- **One entity = one page.** If you find two, flag it via lint rather than silently keeping both.
- **Filenames are kebab-case.** Dates are `YYYY-MM-DD`.
- **Wikilinks `[[like-this]]`.** Plain markdown. No proprietary syntax.
- **Don't invent citations.** Every `[[wikilink]]` you produce must point to a page that exists.
- **Don't write placeholder content.** Empty folders use `.gitkeep`.
- **When in doubt, ask.** If a source could plausibly belong to two pages, or you're unsure whether to extend an existing entity vs. create a new one -- ask the user before writing.
