const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();
const memoryDir = path.join(homeDir, '.claude', 'memory');
const dailyDir = path.join(memoryDir, 'daily');
const bootstrapPath = path.join(memoryDir, 'BOOTSTRAP.md');
const memoryPath = path.join(memoryDir, 'MEMORY.md');
const identityPath = path.join(memoryDir, 'IDENTITY.md');
const userPath = path.join(memoryDir, 'USER.md');
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.dirname(__dirname);
const templateBootstrapPath = path.join(pluginRoot, 'templates', 'BOOTSTRAP.md');

const today = new Date().toISOString().split('T')[0];
const dailyPath = path.join(dailyDir, `${today}.md`);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

ensureDir(memoryDir);
ensureDir(dailyDir);

const bootstrapExists = fileExists(bootstrapPath);
const memoryExists = fileExists(memoryPath);
const identityExists = fileExists(identityPath);
const userExists = fileExists(userPath);

if (!bootstrapExists && !memoryExists && !identityExists && !userExists) {
  const templateContent = readFile(templateBootstrapPath);
  if (templateContent) {
    fs.writeFileSync(bootstrapPath, templateContent, 'utf-8');
  }
}

const bootstrapContent = readFile(bootstrapPath);
const memoryContent = readFile(memoryPath);
const identityContent = readFile(identityPath);
const userContent = readFile(userPath);
const dailyContent = readFile(dailyPath);

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
4. After collecting all answers, create MEMORY.md, IDENTITY.md, and USER.md using /memory-md write
5. Delete BOOTSTRAP.md using /memory-md delete bootstrap
6. Confirm setup is complete

Start by asking the first question from BOOTSTRAP.md now.`;
} else if (memoryContent || identityContent || userContent) {
  const sections = [];
  if (memoryContent) sections.push(`## MEMORY.md\n\n${memoryContent}`);
  if (identityContent) sections.push(`## IDENTITY.md\n\n${identityContent}`);
  if (userContent) sections.push(`## USER.md\n\n${userContent}`);

  const memoryLoaded = sections.length > 0;
  const dailyExists = fileExists(dailyPath);

  additionalContext = `# MEMORY CONTEXT LOADED

${sections.join('\n\n---\n\n')}

---

## DAILY LOG STATUS

${dailyExists ? `Today log exists: daily/${today}.md` : `No daily log for today yet.`}

---

## YOUR BEHAVIOR INSTRUCTIONS

You have memory-md plugin active. Follow these rules:

### 1. Daily Memory (PROACTIVE - NO USER PROMPT NEEDED)

You MUST proactively update daily logs without being asked:

- At the end of each significant task or conversation, append a summary to daily log
- Use: /memory-md write daily "Summary of what we did"
- Include: task completed, decisions made, problems solved, next steps
- Do NOT ask user permission - just do it
- If daily log for today does not exist, create it automatically

### 2. Long-term Memory (WHEN RELEVANT)

When you learn important information:
- User preferences that should persist
- Important project decisions
- Recurring patterns or conventions
- Use: /memory-md write memory "Important fact to remember"

### 3. Before Every Response

1. Check MEMORY.md for relevant context to the current task
2. Check IDENTITY.md for how you should behave
3. Consider if current activity should be logged to daily

### 4. Command Reference

- /memory-md read memory|identity|user|daily
- /memory-md write memory "content" --mode append|overwrite
- /memory-md write daily "content"
- /memory-md search "query"
- /memory-md list

### 5. Daily Log Format

When writing to daily log, use format:
- [HH:MM] Activity description
- Be concise but specific
- Group related activities

---

NOW BEGIN SESSION. Use memory context above and proactively log activities.`;
}

const output = {
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: additionalContext
  }
};

console.log(JSON.stringify(output));
