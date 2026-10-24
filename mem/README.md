# mem/ — portable project memory

This folder is the project's long-term memory for AI-assisted work (Claude Code or any other
assistant). It's committed with the repo, so it follows you to every machine — clone the repo and
the memory comes with it. Nothing here is machine-specific.

## How it's loaded

- **Claude Code**: `CLAUDE.md` at the repo root imports `@mem/MEMORY.md`, which links everything
  else. It's picked up automatically at session start; no setup needed on a new machine.
- **Other assistants**: point them at `mem/MEMORY.md` first.

## Files

| File | What goes in it |
|---|---|
| `MEMORY.md` | Index + the short "read this first" summary. Keep it under ~60 lines. |
| `rules.md` | Standing instructions from the owner. **Hard rules — always follow.** |
| `decisions.md` | Decision log (date, decision, why, alternatives rejected). Append-only. |
| `migration.md` | React/TypeScript migration plan and per-phase status. |
| `project-facts.md` | Non-obvious facts, gotchas, and places the docs and code disagree. |
| `session-log.md` | One short entry per working session: what was done, what's next. |

## Updating it

At the end of a session (or whenever something durable is learned), update the relevant file and
commit it with the work. Prefer editing an existing entry over adding a near-duplicate. Never put
secrets, tokens, or personal data here.
