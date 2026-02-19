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
| `memory` | MEMORY.md | Long-term memory |
| `identity` | IDENTITY.md | AI identity/persona |
| `user` | USER.md | User profile |
| `daily` | daily/YYYY-MM-DD.md | Daily activity logs |
| `bootstrap` | BOOTSTRAP.md | First run setup (delete after use) |

## Usage Examples

Read memory files:
- `/memory-md read memory`
- `/memory-md read identity`
- `/memory-md read user`
- `/memory-md read daily --date 2026-02-19`

Write to memory files:
- `/memory-md write memory "Remember to use PostgreSQL"`
- `/memory-md write identity "Name: Jarvis" --mode overwrite`
- `/memory-md write daily "Fixed bug in auth"`

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

## File Operations

All files stored in `~/.claude/memory/`:
- Root files: MEMORY.md, IDENTITY.md, USER.md, BOOTSTRAP.md
- Daily logs: `daily/YYYY-MM-DD.md`

Write operations append timestamp comments automatically.
