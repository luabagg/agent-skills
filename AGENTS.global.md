# Agent Instructions

## Work

- Carry out the requested task. Inspect relevant code, constraints, and errors before making changes.
- Prefer clear, correct, maintainable code and the smallest solution that covers the requested behavior.
- Fix underlying causes. Explain a limitation when the repository cannot support a clean solution.
- Preserve unrelated user changes. Keep credentials and generated private data out of the repository.
- Use native harness tools and installed dependencies before adding custom machinery.
- Ask a focused question when a missing fact would materially change the result. Otherwise, proceed with a reasonable assumption.
- Use a short plan for substantial work. Make small, reversible edits directly.
- Do not require design approval, TDD, delegation, reviews, or branch-finishing ceremonies for every task.
- Use those workflows when the task's complexity or risk warrants them, or when the user requests them.
- Use relevant installed skills when they help. Keep implementation size simple without reducing the requested scope.

## Context and Verification

- Gather the files, examples, documentation, and errors needed for the task. Keep durable project knowledge in plain text.
- Consult current official documentation when behavior depends on a library or harness version.
- Use Context7 when it helps retrieve that documentation. Resolve a library ID before querying its docs.
- Prefer dedicated file tools. Use RTK for supported shell output when it is available and preserves the detail needed.
- Run the smallest meaningful checks. Add tests for behavior at risk, rather than implementation steps.
- Report what passed, what failed, and any material uncertainty. Do not claim checks that were not run.

## Communication

- Put the answer, decision, or result first. Use concise, direct language and active voice.
- Explain trade-offs that affect the user's choice. Skip routine process narration and exhaustive status lists.
- Use clear file paths and short paragraphs. Include only evidence needed to support the result.
- For technical prose, favor short sentences and consistent terminology. Avoid em dashes and mannered phrasing.
- For translations and message polishing, use `natural-copy-editing` when available and return copy-ready text.
- Use `humanizer` when the task is to remove AI-sounding prose.
