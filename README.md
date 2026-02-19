# tickernelz/claude-plugin-marketplace

Personal plugin marketplace for Claude Code.

## Installation

```bash
/plugin marketplace add tickernelz/claude-plugin-marketplace
```

## Plugins

### memory-md

Persistent markdown-based memory system.

```bash
/plugin install memory-md@tickernelz
```

#### Features

- MEMORY.md - Long-term memory
- IDENTITY.md - AI identity/persona
- USER.md - User profile
- Daily logs - Day-to-day activities
- Auto context injection at session start

#### Usage

```bash
/memory-md read memory
/memory-md read identity
/memory-md read user
/memory-md read daily
/memory-md write memory "Content"
/memory-md write identity "Content" --mode overwrite
/memory-md search "query"
/memory-md list
```

#### Storage

`~/.claude/memory/`

#### First Run

1. Plugin creates BOOTSTRAP.md
2. AI reads BOOTSTRAP.md and asks setup questions
3. AI writes MEMORY.md, IDENTITY.md, USER.md
4. Delete BOOTSTRAP.md: `/memory-md delete bootstrap`

## License

MIT
