const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();
const memoryDir = path.join(homeDir, '.claude', 'memory');
const dailyDir = path.join(memoryDir, 'daily');

const MAX_BUFFER_SIZE = 1024 * 1024;
const MAX_CONTENT_SIZE = 100 * 1024;
const MAX_RESULTS = 100;

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

function appendFile(filePath, content) {
    ensureDir(path.dirname(filePath));
    const existing = readFile(filePath) || '';
    const timestamp = getLocalTimestamp();
    const stamped = `<!-- ${timestamp} -->\n${content}`;
    const separator = existing.trim() ? '\n\n' : '';
    writeFile(filePath, existing + separator + stamped);
}

function deleteFile(filePath) {
    try {
        fs.unlinkSync(filePath);
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
