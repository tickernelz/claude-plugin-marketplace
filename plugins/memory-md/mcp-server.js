#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const homeDir = os.homedir();
const memoryDir = path.join(homeDir, '.claude', 'memory');
const dailyDir = path.join(memoryDir, 'daily');

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
  fs.writeFileSync(filePath, content, 'utf-8');
}

function appendFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  const existing = readFile(filePath) || '';
  const timestamp = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
  const stamped = `<!-- ${timestamp} -->\n${content}`;
  const separator = existing.trim() ? '\n\n' : '';
  fs.writeFileSync(filePath, existing + separator + stamped, 'utf-8');
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

function getFilePath(target, date) {
  switch (target) {
    case 'memory':
      return path.join(memoryDir, 'MEMORY.md');
    case 'identity':
      return path.join(memoryDir, 'IDENTITY.md');
    case 'user':
      return path.join(memoryDir, 'USER.md');
    case 'bootstrap':
      return path.join(memoryDir, 'BOOTSTRAP.md');
    case 'daily': {
      const targetDate = date || new Date().toISOString().slice(0, 10);
      return path.join(dailyDir, `${targetDate}.md`);
    }
    default:
      return null;
  }
}

function searchFiles(query, maxResults = 20) {
  const results = [];
  const needle = query.toLowerCase();
  const searchPaths = [
    { dir: memoryDir, prefix: '' },
    { dir: dailyDir, prefix: 'daily' }
  ];

  for (const { dir, prefix } of searchPaths) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
      for (const file of files) {
        if (results.length >= maxResults) break;
        const filePath = path.join(dir, file);
        const content = readFile(filePath);
        if (!content) continue;
        const lines = content.split('\n');
        for (let i = 0; i < lines.length && results.length < maxResults; i++) {
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
      const rootFiles = fs.readdirSync(memoryDir).filter(f => f.endsWith('.md')).sort();
      for (const f of rootFiles) {
        if (f !== 'BOOTSTRAP.md') root.push(f);
      }
    }
  } catch {}

  try {
    if (fs.existsSync(dailyDir)) {
      const dailyFiles = fs.readdirSync(dailyDir).filter(f => f.endsWith('.md')).sort().reverse();
      daily.push(...dailyFiles);
    }
  } catch {}

  return { root, daily };
}

const tools = {
  memory_read: {
    description: 'Read a memory file (memory, identity, user, daily, or bootstrap)',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['memory', 'identity', 'user', 'daily', 'bootstrap'] },
        date: { type: 'string', description: 'Date for daily log (YYYY-MM-DD)' }
      },
      required: ['target']
    }
  },
  memory_write: {
    description: 'Write to a memory file',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['memory', 'identity', 'user', 'daily'] },
        content: { type: 'string' },
        mode: { type: 'string', enum: ['append', 'overwrite'] },
        date: { type: 'string' }
      },
      required: ['target', 'content']
    }
  },
  memory_search: {
    description: 'Search across all memory files',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        max_results: { type: 'number' }
      },
      required: ['query']
    }
  },
  memory_list: {
    description: 'List all memory files',
    inputSchema: { type: 'object', properties: {} }
  },
  memory_delete: {
    description: 'Delete a memory file',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['memory', 'identity', 'user', 'daily', 'bootstrap'] },
        date: { type: 'string' }
      },
      required: ['target']
    }
  }
};

function handleToolCall(name, args) {
  switch (name) {
    case 'memory_read': {
      const { target, date } = args;
      const filePath = getFilePath(target, date);
      if (!filePath) return { content: [{ type: 'text', text: 'Invalid target' }] };
      const content = readFile(filePath);
      return { content: [{ type: 'text', text: content || `${target} not found or empty.` }] };
    }

    case 'memory_write': {
      const { target, content, mode, date } = args;
      const filePath = getFilePath(target, date);
      if (!filePath) return { content: [{ type: 'text', text: 'Invalid target' }] };
      if (mode === 'overwrite') {
        const timestamp = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
        writeFile(filePath, `<!-- last updated: ${timestamp} -->\n${content}`);
      } else {
        appendFile(filePath, content);
      }
      return { content: [{ type: 'text', text: `${mode === 'overwrite' ? 'Wrote to' : 'Appended to'} ${target}` }] };
    }

    case 'memory_search': {
      const { query, max_results = 20 } = args;
      const results = searchFiles(query, max_results);
      if (results.length === 0) {
        return { content: [{ type: 'text', text: `No results for "${query}".` }] };
      }
      const output = results.map(r => `${r.file}:${r.line}:${r.text}`).join('\n');
      return { content: [{ type: 'text', text: `Found ${results.length} results:\n\n${output}` }] };
    }

    case 'memory_list': {
      const files = listFiles();
      const parts = [];
      if (files.root.length > 0) {
        parts.push(`Root files:\n${files.root.map(f => `- ${f}`).join('\n')}`);
      }
      if (files.daily.length > 0) {
        const displayDaily = files.daily.slice(0, 10);
        const more = files.daily.length > 10 ? `\n... and ${files.daily.length - 10} more` : '';
        parts.push(`Daily logs (${files.daily.length}):\n${displayDaily.map(f => `- daily/${f}`).join('\n')}${more}`);
      }
      return { content: [{ type: 'text', text: parts.length > 0 ? parts.join('\n\n') : 'No memory files found.' }] };
    }

    case 'memory_delete': {
      const { target, date } = args;
      const filePath = getFilePath(target, date);
      if (!filePath) return { content: [{ type: 'text', text: 'Invalid target' }] };
      const success = deleteFile(filePath);
      return { content: [{ type: 'text', text: success ? `Deleted ${target}` : `Failed to delete ${target}` }] };
    }

    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
}

// MCP Protocol handlers
const handlers = {
  initialize: (params) => {
    return {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'memory-md', version: '1.0' }
    };
  },

  'tools/list': () => {
    return {
      tools: Object.entries(tools).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    };
  },

  'tools/call': (params) => {
    const { name, arguments: args } = params;
    return handleToolCall(name, args);
  }
};

// Main stdio loop
let buffer = '';

process.stdin.on('data', (chunk) => {
  buffer += chunk;

  while (true) {
    const newlineIndex = buffer.indexOf('\n');
    if (newlineIndex === -1) break;

    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);

    if (!line) continue;

    try {
      const message = JSON.parse(line);
      const { id, method, params } = message;

      if (handlers[method]) {
        const result = handlers[method](params || {});
        console.log(JSON.stringify({ jsonrpc: '2.0', id, result }));
      } else {
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` }
        }));
      }
    } catch (err) {
      console.error('Error handling message:', err.message);
    }
  }
});

// Ensure directories exist
ensureDir(memoryDir);
ensureDir(dailyDir);
