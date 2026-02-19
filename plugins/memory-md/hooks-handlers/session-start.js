const path = require('path');
const { memoryDir, dailyDir, ensureDir, readFile, fileExists, getLocalDate, writeFile } = require('../lib/utils');

const bootstrapPath = path.join(memoryDir, 'BOOTSTRAP.md');
const memoryPath = path.join(memoryDir, 'MEMORY.md');
const identityPath = path.join(memoryDir, 'IDENTITY.md');
const userPath = path.join(memoryDir, 'USER.md');
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.dirname(__dirname);
const templateBootstrapPath = path.join(pluginRoot, 'templates', 'BOOTSTRAP.md');

const today = getLocalDate();
const dailyPath = path.join(dailyDir, `${today}.md`);

ensureDir(memoryDir);
ensureDir(dailyDir);

const bootstrapExists = fileExists(bootstrapPath);
const memoryExists = fileExists(memoryPath);
const identityExists = fileExists(identityPath);
const userExists = fileExists(userPath);

if (!bootstrapExists && !memoryExists && !identityExists && !userExists) {
    const templateContent = readFile(templateBootstrapPath);
    if (templateContent) {
        writeFile(bootstrapPath, templateContent);
    }
}

const bootstrapContent = readFile(bootstrapPath);
const memoryContent = readFile(memoryPath);
const identityContent = readFile(identityPath);
const userContent = readFile(userPath);

let additionalContext = '';

if (bootstrapContent) {
    additionalContext = `## FIRST RUN SETUP - ACTION REQUIRED

${bootstrapContent}

---

## YOUR TASK AS AI

This is the user's FIRST RUN. You MUST:

1. Read BOOTSTRAP.md content above carefully
2. Ask the user questions ONE BY ONE from the "Questions" section
3. Do NOT ask multiple questions at once - wait for each answer
4. After collecting all answers, create MEMORY.md, IDENTITY.md, and USER.md using the memory_write MCP tool
5. Delete BOOTSTRAP.md using the memory_delete MCP tool
6. Confirm setup is complete

## MCP Tools Available

Use these MCP tools (not slash commands):
- memory_read - Read memory files
- memory_write - Write to memory files
- memory_delete - Delete memory files

Example: Call memory_write with target="memory" and content="User prefers Python"

Start by asking the first question from BOOTSTRAP.md now.`;
} else if (memoryContent || identityContent || userContent) {
    const sections = [];
    if (memoryContent) sections.push(`## MEMORY.md\n\n${memoryContent}`);
    if (identityContent) sections.push(`## IDENTITY.md\n\n${identityContent}`);
    if (userContent) sections.push(`## USER.md\n\n${userContent}`);

    const dailyExists = fileExists(dailyPath);

    additionalContext = `# MEMORY CONTEXT LOADED

${sections.join('\n\n---\n\n')}

---

## DAILY LOG STATUS

${dailyExists ? `Today log exists: daily/${today}.md` : `No daily log for today yet.`}

---

## YOUR BEHAVIOR INSTRUCTIONS

You have memory-md plugin with MCP tools active. Follow these rules:

### 1. Daily Memory (PROACTIVE - NO USER PROMPT NEEDED)

You MUST proactively update daily logs without being asked:

- At the end of each significant task or conversation, append a summary to daily log
- Use MCP tool: memory_write with target="daily" and content="Summary of what we did"
- Include: task completed, decisions made, problems solved, next steps
- Do NOT ask user permission - just do it
- If daily log for today does not exist, create it automatically

### 2. Memory Boundaries (CRITICAL - NO REDUNDANCY)

Each file has ONE purpose. Never duplicate information.

| File | Content | When to Write |
|------|---------|---------------|
| **USER.md** | User's personal info, preferences | When you learn about the human |
| **IDENTITY.md** | AI's persona, behavior rules | When defining how you should act |
| **MEMORY.md** | Technical facts, decisions | When learning about projects/code |

**Examples:**
- "My name is Zhafron" → USER.md
- "Call yourself Jarvis" → IDENTITY.md
- "Always use TypeScript" → MEMORY.md
- "I prefer short answers" → USER.md
- "Be proactive" → IDENTITY.md
- "Use PostgreSQL" → MEMORY.md

### 3. Before Every Response

1. Check MEMORY.md for relevant context using memory_read
2. Check IDENTITY.md for how you should behave
3. Consider if current activity should be logged to daily

### 4. MCP Tools Reference

- memory_read(target, date?) - Read memory, identity, user, daily, or bootstrap
- memory_write(target, content, mode?, date?) - Write to memory files
- memory_search(query, max_results?) - Search across all memory files
- memory_list() - List all memory files
- memory_delete(target, date?) - Delete memory files

### 5. Daily Log Format

When writing to daily log, use format:
- [HH:MM] Activity description
- Be concise but specific
- Group related activities

---

NOW BEGIN SESSION. Use memory context above and proactively log activities using MCP tools.`;
}

const output = {
    hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: additionalContext
    }
};

console.log(JSON.stringify(output));
