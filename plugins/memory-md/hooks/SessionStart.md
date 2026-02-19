---
hook: SessionStart
---

# Memory Context Injection

Inject memory context from ~/.claude/memory/ into system prompt.

## Logic

1. Get memory directory: `~/.claude/memory/`
2. Check if `BOOTSTRAP.md` exists
3. If BOOTSTRAP.md exists:
   - Read BOOTSTRAP.md content
   - Inject bootstrap instructions into system prompt
   - Notify user: "First run detected. Follow BOOTSTRAP.md to set up memory."
4. If BOOTSTRAP.md does not exist:
   - Read MEMORY.md, IDENTITY.md, USER.md
   - Inject content into system prompt under "## Memory Context"
   - Add instructions for using memory tool

## File Locations

- MEMORY.md: ~/.claude/memory/MEMORY.md
- IDENTITY.md: ~/.claude/memory/IDENTITY.md
- USER.md: ~/.claude/memory/USER.md
- BOOTSTRAP.md: ~/.claude/memory/BOOTSTRAP.md
- Daily logs: ~/.claude/memory/daily/YYYY-MM-DD.md

## Context Injection Format

```markdown
## Memory Context

## MEMORY.md
[content]

---

## IDENTITY.md
[content]

---

## USER.md
[content]

---

## Memory Instructions
Use /memory-md command to manage memory files.
```

## Bootstrap Content Template

If BOOTSTRAP.md exists, inject:

```markdown
## BOOTSTRAP.md (First Run Setup)

[BOOTSTRAP.md content]

## Memory Setup Instructions
This is your first run. Read BOOTSTRAP.md above and follow the setup instructions.
Ask the user questions interactively, then write to MEMORY.md, IDENTITY.md, and USER.md.
After setup is complete, delete BOOTSTRAP.md using /memory-md command.
```
