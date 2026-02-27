#!/usr/bin/env node

const {
    memoryDir,
    dailyDir,
    MAX_BUFFER_SIZE,
    ensureDir,
    readFile,
    writeFile,
    appendFile,
    editFile,
    deleteFile,
    getLocalTimestamp,
    getFilePath,
    searchFiles,
    listFiles,
    validateContent,
    validateMaxResults
} = require('./lib/utils');

const { initModel, embedText, embedFile } = require('./lib/embedding');
const { upsertFile, search, deleteFile: deleteFileVectors } = require('./lib/vector-store');

// Resolved once the embedding model is ready; awaited inside tool handlers
let modelReady = null;

const tools = {
    memory_read: {
        description: 'Read a memory file (memory, identity, user, daily, or bootstrap)',
        inputSchema: {
            type: 'object',
            properties: {
                target: {
                    type: 'string',
                    enum: ['memory', 'identity', 'user', 'daily', 'bootstrap']
                },
                date: {
                    type: 'string',
                    description: 'Date for daily log (YYYY-MM-DD)'
                }
            },
            required: ['target']
        }
    },
    memory_write: {
        description: 'Write to a memory file',
        inputSchema: {
            type: 'object',
            properties: {
                target: {
                    type: 'string',
                    enum: ['memory', 'identity', 'user', 'daily']
                },
                content: { type: 'string' },
                mode: {
                    type: 'string',
                    enum: ['append', 'overwrite']
                },
                date: { type: 'string' }
            },
            required: ['target', 'content']
        }
    },
    memory_edit: {
        description:
            'Edit a specific part of memory/identity/user file (not daily). AI must read file first to get exact oldString.',
        inputSchema: {
            type: 'object',
            properties: {
                target: {
                    type: 'string',
                    enum: ['memory', 'identity', 'user']
                },
                oldString: {
                    type: 'string',
                    description: 'Text to replace. Must read file first to get exact text.'
                },
                newString: {
                    type: 'string',
                    description: 'Replacement text'
                }
            },
            required: ['target', 'oldString', 'newString']
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
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    memory_delete: {
        description: 'Delete a memory file',
        inputSchema: {
            type: 'object',
            properties: {
                target: {
                    type: 'string',
                    enum: ['memory', 'identity', 'user', 'daily', 'bootstrap']
                },
                date: { type: 'string' }
            },
            required: ['target']
        }
    }
};

function createResponse(text) {
    return { content: [{ type: 'text', text }] };
}

async function handleToolCall(name, args) {
    switch (name) {
        case 'memory_read': {
            const { target, date } = args;
            const filePath = getFilePath(target, date);
            if (!filePath) {
                return createResponse('Invalid target');
            }
            const content = readFile(filePath);
            return createResponse(content || `${target} not found or empty.`);
        }

        case 'memory_write': {
            const { target, content, mode, date } = args;

            const validContent = validateContent(content);
            if (!validContent) {
                return createResponse('Invalid or oversized content');
            }

            const filePath = getFilePath(target, date);
            if (!filePath) {
                return createResponse('Invalid target');
            }

            if (mode === 'overwrite') {
                const timestamp = getLocalTimestamp();
                writeFile(filePath, `<!-- last updated: ${timestamp} -->\n${validContent}`);
            } else {
                appendFile(filePath, validContent);
            }

            // ReAct-style reflection prompt for self-improvement
            const reflectionPrompt = `
[REFLECTION TRIGGERED]
After writing to ${target}, ask yourself:
1. Why was this update important?
2. What pattern does this reveal about the user or project?
3. Should this trigger additional memory updates (cross-referencing)?
4. How does this connect to previous memories?
`;
            // Re-index file after write
            try {
                await modelReady;
                const updatedContent = readFile(filePath);
                if (updatedContent) {
                    const embedded = await embedFile(filePath, updatedContent);
                    await upsertFile(filePath, embedded);
                }
            } catch (err) {
                process.stderr.write(`[embedding] upsert failed: ${err.message}\n`);
            }
            return createResponse(`${mode === 'overwrite' ? 'Wrote to' : 'Appended to'} ${target}.${reflectionPrompt}`);
        }

        case 'memory_search': {
            const { query, max_results } = args;
            if (!query || typeof query !== 'string') {
                return createResponse('Invalid query');
            }
            await modelReady;
            const topK = validateMaxResults(max_results);
            const queryVector = await embedText(query);
            const results = await search(queryVector, topK);
            if (results.length === 0) {
                return createResponse(`No results for "${query}".`);
            }
            const output = results
                .map(r => `${r.filePath}:${r.heading}:${r.score.toFixed(4)}:${r.text.slice(0, 200)}`)
                .join('\n\n');
            return createResponse(`Found ${results.length} results:\n\n${output}`);
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
                parts.push(
                    `Daily logs (${files.daily.length}):\n${displayDaily.map(f => `- daily/${f}`).join('\n')}${more}`
                );
            }

            return createResponse(parts.length > 0 ? parts.join('\n\n') : 'No memory files found.');
        }

        case 'memory_edit': {
            const { target, oldString, newString } = args;

            if (target === 'daily') {
                return createResponse('Error: edit action is not supported for daily logs. Use append mode instead.');
            }

            if (!oldString) {
                return createResponse('Error: oldString is required for edit action.');
            }

            if (newString === undefined) {
                return createResponse('Error: newString is required for edit action.');
            }

            const filePath = getFilePath(target);
            if (!filePath) {
                return createResponse('Invalid target');
            }

            try {
                editFile(filePath, oldString, newString);
                try {
                    await modelReady;
                    const updatedContent = readFile(filePath);
                    if (updatedContent) {
                        const embedded = await embedFile(filePath, updatedContent);
                        await upsertFile(filePath, embedded);
                    }
                } catch (err) {
                    process.stderr.write(`[embedding] re-index after edit failed: ${err.message}\n`);
                }
                return createResponse(`Edited ${target}`);
            } catch (error) {
                return createResponse(error.message || `Failed to edit ${target}`);
            }
        }

        case 'memory_delete': {
            const { target, date } = args;
            const filePath = getFilePath(target, date);
            if (!filePath) {
                return createResponse('Invalid target');
            }
            const success = deleteFile(filePath);
            if (success) {
                try {
                    await modelReady;
                    await deleteFileVectors(filePath);
                } catch (err) {
                    process.stderr.write(`[embedding] vector delete failed: ${err.message}\n`);
                }
            }
            return createResponse(success ? `Deleted ${target}` : `Failed to delete ${target}`);
        }

        default:
            return createResponse(`Unknown tool: ${name}`);
    }
}

const handlers = {
    initialize: params => {
        return {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: { name: 'memory-md', version: '1.2' }
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

    'tools/call': async params => {
        const { name, arguments: args } = params;
        return await handleToolCall(name, args || {});
    },

    ping: () => {
        return {};
    }
};

function sendResponse(id, result) {
    console.log(JSON.stringify({ jsonrpc: '2.0', id, result }));
}

function sendError(id, code, message) {
    console.log(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }));
}

let buffer = '';

process.stdin.on('data', chunk => {
    buffer += chunk;

    if (buffer.length > MAX_BUFFER_SIZE) {
        sendError(null, -32700, 'Buffer overflow - message too large');
        buffer = '';
        return;
    }

    while (true) {
        const newlineIndex = buffer.indexOf('\n');
        if (newlineIndex === -1) break;

        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!line) continue;

        let message;
        try {
            message = JSON.parse(line);
        } catch (err) {
            sendError(null, -32700, `Parse error: ${err.message}`);
            continue;
        }

        const { id, method, params } = message;

        if (id === undefined) {
            continue;
        }

        if (handlers[method]) {
            Promise.resolve(handlers[method](params || {}))
                .then(result => {
                    sendResponse(id, result);
                })
                .catch(err => {
                    sendError(id, -32603, `Internal error: ${err.message}`);
                });
        } else {
            sendError(id, -32601, `Method not found: ${method}`);
        }
    }
});

ensureDir(memoryDir);
ensureDir(dailyDir);

modelReady = initModel().catch(err => {
    process.stderr.write(`[embedding] model init failed: ${err.message}\n`);
    process.exit(1);
});
