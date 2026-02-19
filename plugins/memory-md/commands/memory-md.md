---
name: memory-md
description: Manage persistent markdown memory files - MEMORY.md, IDENTITY.md, USER.md, and daily logs
---

# /memory-md Command

Manage persistent memory files for context across sessions.

## Actions

| Action | Description |
|--------|-------------|
| `read` | Read a memory file |
| `write` | Write to a memory file |
| `search` | Search across all memory files |
| `list` | List all memory files |
| `delete` | Delete a file (for BOOTSTRAP.md cleanup) |

## Targets

| Target | File | Purpose |
|--------|------|---------|
| `memory` | MEMORY.md | Long-term memory - important facts, preferences, decisions |
| `identity` | IDENTITY.md | AI identity/persona - how I should behave |
| `user` | USER.md | User profile - your info and preferences |
| `daily` | daily/YYYY-MM-DD.md | Daily activity logs |
| `bootstrap` | BOOTSTRAP.md | First run setup (delete after use) |

## AI Behavior Rules

### Proactive Daily Logging (CRITICAL)

I MUST update daily logs automatically without user asking:

1. After completing a significant task, append to daily log
2. Format: `- [HH:MM] Completed: brief description`
3. Include: what was done, key decisions, blockers, next steps
4. Do NOT ask user "Should I log this?" - just do it
5. Create today's daily file automatically if not exists

### When to Write to Memory

| Trigger | Action |
|---------|--------|
| User states a preference | Write to MEMORY.md |
| Important decision made | Write to MEMORY.md |
| Bug/fixed pattern identified | Write to MEMORY.md |
| Task completed | Write to daily log |
| Learning about user | Write to USER.md |
| Identity clarification | Write to IDENTITY.md |

### Memory Hierarchy

1. **USER.md** - Static user info (name, role, preferences)
2. **IDENTITY.md** - How I should behave (persona, communication style)
3. **MEMORY.md** - Long-term knowledge (tech stack, patterns, decisions)
4. **daily/** - Session activities (proactively updated)

## Usage Examples

Read memory files:
- `/memory-md read memory`
- `/memory-md read identity`
- `/memory-md read user`
- `/memory-md read daily`
- `/memory-md read daily --date 2026-02-19`

Write to memory files:
- `/memory-md write memory "User prefers React over Vue"`
- `/memory-md write identity "Be concise, ask before major changes" --mode overwrite`
- `/memory-md write daily "Fixed auth bug in login flow"`

Search and list:
- `/memory-md search "PostgreSQL"`
- `/memory-md list`

Delete (for bootstrap cleanup):
- `/memory-md delete bootstrap`

## Parameters

- `--action`: read, write, search, list, delete
- `--target`: memory, identity, user, daily, bootstrap
- `--content`: Content to write (for write action)
- `--mode`: append (default) or overwrite
- `--date`: Date for daily log (YYYY-MM-DD), defaults to today
- `--query`: Search query (for search action)
- `--max-results`: Maximum search results (default: 20)

## File Locations

All files stored in `~/.claude/memory/`:
- Root files: MEMORY.md, IDENTITY.md, USER.md, BOOTSTRAP.md
- Daily logs: `daily/YYYY-MM-DD.md`

Write operations append timestamp comments automatically.
