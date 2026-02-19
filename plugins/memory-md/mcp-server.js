#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
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

const server = new Server(
  {
    name: 'memory-md',
    version: '1.0.3'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'memory_read',
        description: 'Read a memory file (memory, identity, user, daily, or bootstrap)',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              enum: ['memory', 'identity', 'user', 'daily', 'bootstrap'],
              description: 'Which memory file to read'
            },
            date: {
              type: 'string',
              description: 'Date for daily log (YYYY-MM-DD), defaults to today'
            }
          },
          required: ['target']
        }
      },
      {
        name: 'memory_write',
        description: 'Write to a memory file',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              enum: ['memory', 'identity', 'user', 'daily'],
              description: 'Which memory file to write to'
            },
            content: {
              type: 'string',
              description: 'Content to write'
            },
            mode: {
              type: 'string',
              enum: ['append', 'overwrite'],
              description: 'Write mode (default: append)'
            },
            date: {
              type: 'string',
              description: 'Date for daily log (YYYY-MM-DD), defaults to today'
            }
          },
          required: ['target', 'content']
        }
      },
      {
        name: 'memory_search',
        description: 'Search across all memory files',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query'
            },
            max_results: {
              type: 'number',
              description: 'Maximum results (default: 20)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'memory_list',
        description: 'List all memory files',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'memory_delete',
        description: 'Delete a memory file (typically for BOOTSTRAP.md cleanup)',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              type: 'string',
              enum: ['memory', 'identity', 'user', 'daily', 'bootstrap'],
              description: 'Which memory file to delete'
            },
            date: {
              type: 'string',
              description: 'Date for daily log (YYYY-MM-DD)'
            }
          },
          required: ['target']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'memory_read': {
      const { target, date } = args;
      const filePath = getFilePath(target, date);
      if (!filePath) {
        return { content: [{ type: 'text', text: 'Invalid target' }] };
      }
      const content = readFile(filePath);
      if (!content) {
        return { content: [{ type: 'text', text: `${target} not found or empty.` }] };
      }
      return { content: [{ type: 'text', text: content }] };
    }

    case 'memory_write': {
      const { target, content, mode, date } = args;
      const filePath = getFilePath(target, date);
      if (!filePath) {
        return { content: [{ type: 'text', text: 'Invalid target' }] };
      }
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
      if (parts.length === 0) {
        return { content: [{ type: 'text', text: 'No memory files found.' }] };
      }
      return { content: [{ type: 'text', text: parts.join('\n\n') }] };
    }

    case 'memory_delete': {
      const { target, date } = args;
      const filePath = getFilePath(target, date);
      if (!filePath) {
        return { content: [{ type: 'text', text: 'Invalid target' }] };
      }
      const success = deleteFile(filePath);
      return { content: [{ type: 'text', text: success ? `Deleted ${target}` : `Failed to delete ${target} (file may not exist)` }] };
    }

    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
  }
});

async function main() {
  ensureDir(memoryDir);
  ensureDir(dailyDir);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
