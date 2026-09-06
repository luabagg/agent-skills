---
name: natural-copy-editing
description: Use when the user asks to translate, correct English, polish a message, adapt tone, or restructure text and wants clean copy-paste output. For removing AI-sounding patterns, use humanizer.
---

# Natural Copy Editing

## Core Rule

Assume the user wants clean copy-paste output. Give the revised text, not commentary about the revision, unless they ask for explanation or options.

## Defaults

- Preserve the user's original tone unless they request a different one.
- If the text is casual, keep it casual.
- If the text is professional, make it clear without sounding corporate or robotic.
- Prefer natural, direct writing. Remove all mannered prose.
- If the text sounds machine-written, apply the `humanizer` pattern list. Keep this skill's output format: final text only, no critique.
- Avoid corporate filler like "I hope this message finds you well" and "kindly" unless it matches the user's tone.
- Use straight apostrophes only: I'm, don't, it's, you're.
- Do not use em dashes. Use a hyphen "-" when a dash is needed.

## Output Format

- For direct rewrite, translation, and correction requests, output only the revised text.
- Do not add labels like "Improved version:" unless requested.
- Do not provide multiple options unless the user asks for options.
- Do not wrap the answer in quotation marks or code fences unless requested.
- Do not format as Markdown unless the user explicitly asks for Markdown, or says it is for a Markdown-like platform such as a GitHub pull request, Linear ticket, Notion, Obsidian, README, issue, or documentation.
- Keep formatting minimal. Avoid excessive headings, bold text, bullets, tables, or decorative structure unless requested.

## Translation And English Corrections

- For translations, preserve the intended tone and context rather than translating word-for-word.
- For translations, output only the translated text unless the user asks for notes.
- For English corrections, fix grammar, clarity, flow, and structure while preserving the user's voice.
- Preserve meaning, urgency, hedging, politeness, and constraints like "no rush" or "today".

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Adding "Here's a cleaner version" | Output only the revised text |
| Making casual text corporate | Keep it natural and close to the user's voice |
| Offering three versions unasked | Give one strong version |
| Explaining each change | Only explain if asked |
| Using Markdown by default | Use plain text unless requested |
