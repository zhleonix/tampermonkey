# Agent Guide for Tampermonkey Script Maintenance

## Purpose
This repository contains Tampermonkey userscripts, currently under `bqg_tool/`. Use this guide when creating, updating, or maintaining scripts in this workspace.

## What to edit here
- `bqg_tool/*.user.js`: Tampermonkey userscript source files.
- `REAMME.md`: repository description and usage notes.

## Key conventions
- Each userscript must include a valid Tampermonkey metadata block (`// ==UserScript== ... // ==/UserScript==`).
- Keep configuration values in a clearly marked `CONFIG` object near the top of the script.
- Do not hardcode credentials in the repository. Replace secrets with placeholders in code and document how the user should supply them.
- The current script uses `GM_xmlhttpRequest` and `GM_registerMenuCommand`, plus `@connect` host entries for external API access.
- Only add `@grant` and `@connect` entries that are actually required by the script.

## Script style
- Keep the script self-contained inside an IIFE (`(function() { ... })();`).
- Prefer simple DOM selection and event-driven UI logic; there is no bundler or build pipeline in this repository.
- Preserve user-visible Chinese text and prompts when editing the existing script.

## Specific maintenance guidance
- When changing page targets, update `CONFIG.targetSelector` and keep the `alert`/button behavior consistent.
- When updating AI integration, keep the prompt template and output handling strict: only return final text, no explanations.
- If adding a new script, document it in `REAMME.md` with its purpose and how to configure the API key.

## When in doubt
- Ask the user before adding new external dependencies, new `@grant` permissions, or new cross-domain `@connect` hosts.
- Do not remove the existing prompt constraints or change the script’s requirement to preserve original text.
- If a change is risky, suggest a small incremental improvement rather than a full rewrite.

## Useful notes for agents
- There is no test harness or build command in this repo.
- The repository is primarily manual userscript code, so focus on correctness, metadata, configuration, and documentation.
