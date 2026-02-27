const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const homeDir = os.homedir();
const memoryDir = path.join(homeDir, '.claude', 'memory');
const dailyDir = path.join(memoryDir, 'daily');

const MAX_BUFFER_SIZE = 1024 * 1024;
const MAX_CONTENT_SIZE = 100 * 1024;
const MAX_RESULTS = 100;
const MAX_MEMORY_LINES = 1000;

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

function writeFile(filePath, content) {
    ensureDir(path.dirname(filePath));
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, content, 'utf-8');
    fs.renameSync(tmp, filePath);
}

function checkMemoryLineLimit(filePath, content) {
    const fileName = path.basename(filePath);
    if (fileName === 'MEMORY.md') {
        const lineCount = content.split('\n').length;
        if (lineCount > MAX_MEMORY_LINES) {
            throw new Error(
                `MEMORY.md exceeds ${MAX_MEMORY_LINES} line limit (current: ${lineCount} lines). ` +
                    `Please use memory_edit to remove outdated or unimportant content before adding new entries. ` +
                    `Ask the user which sections to remove or consolidate.`
            );
        }
    }
}

function appendFile(filePath, content) {
    ensureDir(path.dirname(filePath));
    const existing = readFile(filePath) || '';
    const timestamp = getLocalTimestamp();
    const stamped = `<!-- ${timestamp} -->\n${content}`;
    const separator = existing.trim() ? '\n\n' : '';
    const newContent = existing + separator + stamped;
    checkMemoryLineLimit(filePath, newContent);
    writeFile(filePath, newContent);
    autoCommit(filePath, 'append');
}

function editFile(filePath, oldString, newString) {
    const content = readFile(filePath);
    if (!content) {
        throw new Error('File not found or empty');
    }

    if (!content.includes(oldString)) {
        throw new Error('oldString not found in file');
    }

    const matches = content.split(oldString).length - 1;
    if (matches > 1) {
        throw new Error(`Found ${matches} occurrences of oldString, expected exactly 1`);
    }

    const updatedContent = content.replace(oldString, newString);
    checkMemoryLineLimit(filePath, updatedContent);
    writeFile(filePath, updatedContent);
    autoCommit(filePath, 'edit');
}

function deleteFile(filePath) {
    try {
        fs.unlinkSync(filePath);
        autoCommit(filePath, 'delete');
        return true;
    } catch {
        return false;
    }
}

function fileExists(filePath) {
    return fs.existsSync(filePath);
}

function getLocalTimestamp() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function getLocalDate() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function validateDate(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const [, y, m, d] = match;
    const date = new Date(`${y}-${m}-${d}`);
    if (isNaN(date.getTime())) return null;
    return dateStr;
}

function validateTarget(target) {
    const valid = ['memory', 'identity', 'user', 'daily', 'bootstrap'];
    return valid.includes(target) ? target : null;
}

function validateContent(content) {
    if (!content || typeof content !== 'string') return null;
    if (content.length > MAX_CONTENT_SIZE) return null;
    return content;
}

function validateMaxResults(max) {
    if (!max || typeof max !== 'number') return 20;
    return Math.min(Math.max(1, Math.floor(max)), MAX_RESULTS);
}

function getFilePath(target, date) {
    const validTarget = validateTarget(target);
    if (!validTarget) return null;

    switch (validTarget) {
        case 'memory':
            return path.join(memoryDir, 'MEMORY.md');
        case 'identity':
            return path.join(memoryDir, 'IDENTITY.md');
        case 'user':
            return path.join(memoryDir, 'USER.md');
        case 'bootstrap':
            return path.join(memoryDir, 'BOOTSTRAP.md');
        case 'daily': {
            const targetDate = validateDate(date) || getLocalDate();
            return path.join(dailyDir, `${targetDate}.md`);
        }
        default:
            return null;
    }
}

function searchFiles(query, maxResults = 20) {
    const results = [];
    const needle = query.toLowerCase();
    const limit = validateMaxResults(maxResults);
    const searchPaths = [
        { dir: memoryDir, prefix: '' },
        { dir: dailyDir, prefix: 'daily' }
    ];

    for (const { dir, prefix } of searchPaths) {
        if (!fs.existsSync(dir)) continue;
        try {
            const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
            for (const file of files) {
                if (results.length >= limit) break;
                const filePath = path.join(dir, file);
                const content = readFile(filePath);
                if (!content) continue;
                const lines = content.split('\n');
                for (let i = 0; i < lines.length && results.length < limit; i++) {
                    if (lines[i].toLowerCase().includes(needle)) {
                        results.push({
                            file: prefix ? `${prefix}/${file}` : file,
                            line: i + 1,
                            text: lines[i].trimEnd()
                        });
                    }
                }
            }
        } catch {}
    }
    return results;
}

function listFiles() {
    const root = [];
    const daily = [];

    try {
        if (fs.existsSync(memoryDir)) {
            const rootFiles = fs
                .readdirSync(memoryDir)
                .filter(f => f.endsWith('.md'))
                .sort();
            for (const f of rootFiles) {
                if (f !== 'BOOTSTRAP.md') root.push(f);
            }
        }
    } catch {}

    try {
        if (fs.existsSync(dailyDir)) {
            const dailyFiles = fs
                .readdirSync(dailyDir)
                .filter(f => f.endsWith('.md'))
                .sort()
                .reverse();
            daily.push(...dailyFiles);
        }
    } catch {}

    return { root, daily };
}

function ensureGitRepo() {
    const gitDir = path.join(memoryDir, '.git');
    if (!fs.existsSync(gitDir)) {
        try {
            execSync('git init', { cwd: memoryDir, stdio: 'pipe' });
            execSync('git config user.name "Claude Memory"', { cwd: memoryDir, stdio: 'pipe' });
            execSync('git config user.email "memory@claude.local"', { cwd: memoryDir, stdio: 'pipe' });
        } catch (err) {
            throw new Error(`Failed to initialize git repository: ${err.message}`);
        }
    }
}

function autoCommit(filePath, operation) {
    ensureGitRepo();
    const fileName = path.basename(filePath);

    try {
        // Add all changes in memory directory
        execSync('git add .', { cwd: memoryDir, stdio: 'pipe' });

        // Check if there are changes to commit
        const status = execSync('git status --porcelain', { cwd: memoryDir, encoding: 'utf-8' });
        if (!status.trim()) {
            // No changes to commit
            return;
        }

        const messages = {
            write: `Update ${fileName}`,
            append: `Append to ${fileName}`,
            edit: `Edit ${fileName}`,
            delete: `Delete ${fileName}`
        };

        const message = messages[operation] || `Update ${fileName}`;
        execSync(`git commit -m "${message}"`, { cwd: memoryDir, stdio: 'pipe' });
    } catch (err) {
        // Only throw if it's not a "nothing to commit" error
        if (!err.message.includes('nothing to commit') && !err.message.includes('nothing added to commit')) {
            throw new Error(`Failed to commit changes: ${err.message}`);
        }
    }
}

module.exports = {
    homeDir,
    memoryDir,
    dailyDir,
    MAX_BUFFER_SIZE,
    MAX_CONTENT_SIZE,
    MAX_RESULTS,
    ensureDir,
    readFile,
    writeFile,
    appendFile,
    editFile,
    deleteFile,
    fileExists,
    getLocalTimestamp,
    getLocalDate,
    validateDate,
    validateTarget,
    validateContent,
    validateMaxResults,
    getFilePath,
    searchFiles,
    listFiles
};
