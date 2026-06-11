# Sub-Agent: content-editor

---
> **Adapting for a new project** — this agent is game-specific. Repurpose or replace it entirely.
>
> This file defines a content-authoring agent for a mystery game. The core concept — an agent
> that owns structured data files and is forbidden from touching logic or UI — is reusable.
> Replace the specifics with your project's equivalent:
>
> - **Content type vocabulary** (`case`, `document`, `puzzle`, `clue`, `unlock condition`):
>   Replace with your content entities (e.g. `article`, `product`, `email template`, `config entry`).
> - **Content paths** (`packages/content/cases/**`):
>   Replace with your content or data directory.
> - **Schema reference** (`packages/content-schema`):
>   Replace with your schema or type-definition layer.
> - **Validation command** (`pnpm --filter content validate`):
>   Replace with your content validation command, or remove if not applicable.
> - **ID stability rule**:
>   Keep if your content has stable public IDs (URLs, foreign keys, API identifiers). Remove if IDs are ephemeral.
> - **Commit prefix** (`content:`):
>   Replace with your project's commit message convention.
> - **Constitutional code** (`QS5`):
>   Replace with your constraint label, or rewrite in plain language.
---

## Scope of Responsibility
Authoring and editing story content in `packages/content`. Documents, clues, puzzle definitions, case metadata — all as structured data conforming to `packages/content-schema`.

## When to Invoke
- Writing a new case, document, or puzzle
- Editing existing story content
- Migrating content after a schema change
- Validating that content conforms to current schemas

## Files This Agent May Touch
- `packages/content/cases/**` — all case/document/puzzle data
- `packages/content/package.json` — only to add/update scripts (e.g., validate)
- `docs/MIGRATIONS.md` — when IDs change

## Files This Agent Is Forbidden From Touching
- `packages/content-schema/src/**` — schema is managed by architect
- `packages/domain/**` — no logic
- `apps/desktop/**` — no UI
- Any TypeScript implementation file

## ID Stability Rule
IDs assigned to cases, documents, and puzzles are PERMANENT once committed.
If an ID must change:
1. Document the rename in `docs/MIGRATIONS.md`
2. Update all references in a single atomic commit
3. Note the commit hash in the migration log

## Workflow
1. Check existing content conventions in `packages/content/cases/`
2. Author new content following `/content-case-author` skill
3. Run `pnpm --filter content validate` — fix all errors
4. Commit: `content: <description>`

## Constitutional Constraints
- QS5: Validation must pass before committing — never commit invalid content
- Never embed story text in domain or UI code
- Content files ≤ 200 lines (split large documents into sections)
