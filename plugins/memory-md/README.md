# memory-md

Persistent markdown-based memory system for Claude Code with MCP protocol.

## Features

- **MEMORY.md** - Technical knowledge, patterns, project decisions
- **IDENTITY.md** - AI persona and behavior rules
- **USER.md** - User profile, preferences, working style
- **Daily logs** - Automatic session activity tracking
- **Auto context injection** - Memory loaded at session start
- **Proactive updates** - AI updates memory without prompting

## Installation

```bash
/plugin install memory-md@tickernelz
```

## Storage Location

`~/.claude/memory/`

```
~/.claude/memory/
├── MEMORY.md
├── IDENTITY.md
├── USER.md
├── BOOTSTRAP.md (first run only)
└── daily/
    ├── 2026-02-26.md
    └── ...
```

## MCP Tools

### memory_read

Read a memory file.

```javascript
// Read core memory files
memory_read({ target: 'memory' });
memory_read({ target: 'identity' });
memory_read({ target: 'user' });

// Read daily log
memory_read({ target: 'daily', date: '2026-02-26' });
```

### memory_write

Write to a memory file.

```javascript
// Append (default)
memory_write({
    target: 'memory',
    content: 'Project uses Django + Neo4j'
});

// Overwrite
memory_write({
    target: 'identity',
    content: 'Name: Jarvis\nPersonality: Professional',
    mode: 'overwrite'
});
```

### memory_edit

Edit specific part of memory/identity/user file (not daily).

```javascript
// Must read file first to get exact oldString
memory_edit({
    target: 'memory',
    oldString: 'Project: Auth Service',
    newString: 'Project: Payment Service'
});
```

**Requirements:**

- AI must read file first to get exact text
- oldString must match exactly (case-sensitive)
- Only 1 occurrence allowed (fails if multiple matches)
- Not supported for daily logs (use append instead)

### memory_search

Search across all memory files.

```javascript
memory_search({
    query: 'PostgreSQL',
    max_results: 20 // optional
});
```

### memory_list

List all memory files.

```javascript
memory_list();
```

### memory_delete

Delete a memory file.

```javascript
memory_delete({ target: 'bootstrap' });
memory_delete({ target: 'daily', date: '2026-02-20' });
```

## First Run Setup

1. Plugin creates `BOOTSTRAP.md` with setup questions
2. AI reads BOOTSTRAP.md and asks questions one by one
3. AI creates MEMORY.md, IDENTITY.md, USER.md based on answers
4. AI deletes BOOTSTRAP.md automatically

## Memory Boundaries

Each file has ONE purpose. Never duplicate information.

| File            | Content                           | Examples                        |
| --------------- | --------------------------------- | ------------------------------- |
| **USER.md**     | User's personal info, preferences | Name, role, communication style |
| **IDENTITY.md** | AI's persona, behavior rules      | Name, personality, how to act   |
| **MEMORY.md**   | Technical facts, decisions        | Stack, frameworks, patterns     |
| **daily/**      | Task activity logs                | What was done today             |

## Automatic Behavior

AI proactively updates memory without asking:

- **After significant tasks** - Appends summary to daily log
- **Learning user preferences** - Updates USER.md
- **Discovering patterns** - Updates MEMORY.md
- **Timestamps** - Auto-generated, don't include in content

## Daily Log Format

Structured format for complex tasks:

```markdown
## TASK: {task_name}

- **Action**: What was done
- **Decision**: Why this approach chosen
- **Memory Update**: Which files updated
- **Next Steps**: Pending items
```

Simple format for quick activities:

```markdown
- Brief description of what was done
```

## License

MIT
