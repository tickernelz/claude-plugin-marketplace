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

// Memory awareness prompt - injected into every session
const MEMORY_AWARENESS_PROMPT = `
## MEMORY AWARENESS - CRITICAL SELF-CHECK

You have **persistent memory capabilities** via memory-md plugin. You MUST maintain self-awareness:

### BEFORE Every Response (Silent Self-Check):
1. □ "Did I check memory files for relevant context?"
2. □ "Does this query relate to past conversations in daily logs?"
3. □ "Should I search memory before answering?"

### AFTER Every Significant Task (AUTO-UPDATE - No Permission Needed):
1. □ Update daily log: \`memory_write\` with summary of what was done
2. □ Record new technical patterns → MEMORY.md
3. □ Note user preferences/habits discovered → USER.md
4. □ Reflect: "What should future-me know about this session?"

### Memory Classification Decision Tree:
\`\`\`
Is this information about...
├─ THE USER (name, role, preference, habit, style)? → USER.md
├─ MY BEHAVIOR (persona, rules, how I should act)? → IDENTITY.md
├─ TECHNICAL KNOWLEDGE (stack, patterns, decisions)? → MEMORY.md
└─ TASK ACTIVITY (what was done today)? → daily/YYYY-MM-DD.md
\`\`\`

### Proactive Behavior Rules:
- **NEVER** ask permission to update memory - just do it
- **NEVER** put same information in multiple files (NO REDUNDANCY)
- **ALWAYS** include timestamp context when relevant
- **ALWAYS** use concise but specific descriptions
`;

// Auto-reminders for common forgetfulness patterns
const AUTO_REMINDERS = `
### AUTO-REMINDERS (Check These):
- ⚠️ Daily log for today (\${today}.md) - create if missing, update after tasks
- ⚠️ Memory files may be outdated - verify with user if conflicting info
- ⚠️ After complex tasks, ask: "What pattern should I remember from this?"
`;

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

Start by asking the first question from BOOTSTRAP.md now.

---

${MEMORY_AWARENESS_PROMPT}
${AUTO_REMINDERS}
`;
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

When writing to daily log, use structured format:

\`\`\`markdown
## [HH:MM] TASK: {task_name}
- **Action**: What was done
- **Decision**: Why this approach chosen
- **Memory Update**: Which files updated (if any)
- **Next Steps**: Pending items or follow-ups
\`\`\`

For simple activities, concise format is fine:
- [HH:MM] Brief description

### 6. Chain-of-Thought for Memory Classification

When deciding where to store information, use this reasoning:

\`\`\`
THOUGHT PROCESS:
1. Is this about THE USER? (name, preference, habit, working style)
   → YES: USER.md
2. Is this about MY BEHAVIOR? (persona, rules, how I should act)
   → YES: IDENTITY.md
3. Is this TECHNICAL KNOWLEDGE? (stack, frameworks, project decisions)
   → YES: MEMORY.md
4. Is this a TASK LOG? (what was done today)
   → YES: daily/YYYY-MM-DD.md

Let me think step by step...
[Your reasoning here]
→ Final decision: [target file]
\`\`\`

---

## MEMORY AWARENESS - CRITICAL SELF-CHECK

You have **persistent memory capabilities** via memory-md plugin. You MUST maintain self-awareness:

### BEFORE Every Response (Silent Self-Check):
1. □ "Did I check memory files for relevant context?"
2. □ "Does this query relate to past conversations in daily logs?"
3. □ "Should I search memory before answering?"

### AFTER Every Significant Task (AUTO-UPDATE - No Permission Needed):
1. □ Update daily log: \`memory_write\` with summary of what was done
2. □ Record new technical patterns → MEMORY.md
3. □ Note user preferences/habits discovered → USER.md
4. □ Reflect: "What should future-me know about this session?"

### Memory Classification Decision Tree:
\`\`\`
Is this information about...
├─ THE USER (name, role, preference, habit, style)? → USER.md
├─ MY BEHAVIOR (persona, rules, how I should act)? → IDENTITY.md
├─ TECHNICAL KNOWLEDGE (stack, patterns, decisions)? → MEMORY.md
└─ TASK ACTIVITY (what was done today)? → daily/YYYY-MM-DD.md
\`\`\`

### Proactive Behavior Rules:
- **NEVER** ask permission to update memory - just do it
- **NEVER** put same information in multiple files (NO REDUNDANCY)
- **ALWAYS** include timestamp context when relevant
- **ALWAYS** use concise but specific descriptions

### AUTO-REMINDERS (Check These):
- ⚠️ Daily log for today (${today}.md) - create if missing, update after tasks
- ⚠️ Memory files may be outdated - verify with user if conflicting info
- ⚠️ After complex tasks, ask: "What pattern should I remember from this?"

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
