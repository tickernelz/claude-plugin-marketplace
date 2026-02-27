'use strict';

const crypto = require('crypto');

let pipeline = null;
let embedder = null;

async function initModel() {
    const { pipeline: createPipeline } = await import('@huggingface/transformers');
    embedder = await createPipeline('feature-extraction', 'nomic-ai/nomic-embed-text-v1.5', {
        dtype: 'q8'
    });
    pipeline = embedder;
}

async function embedText(text) {
    if (!embedder) throw new Error('Model not initialized');
    const output = await embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

function hashContent(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}

function chunkMarkdown(content, filePath) {
    const lines = content.split('\n');
    const chunks = [];
    let currentHeading = '(intro)';
    let currentLines = [];

    for (const line of lines) {
        if (/^#{2,3}\s/.test(line)) {
            if (currentLines.length > 0) {
                const text = currentLines.join('\n').trim();
                if (text) {
                    const hash = hashContent(text);
                    chunks.push({ text, heading: currentHeading, filePath, hash });
                }
            }
            currentHeading = line.replace(/^#+\s/, '').trim();
            currentLines = [];
        } else {
            currentLines.push(line);
        }
    }

    if (currentLines.length > 0) {
        const text = currentLines.join('\n').trim();
        if (text) {
            const hash = hashContent(text);
            chunks.push({ text, heading: currentHeading, filePath, hash });
        }
    }

    return chunks;
}

async function embedFile(filePath, content) {
    const chunks = chunkMarkdown(content, filePath);
    const result = [];
    for (const chunk of chunks) {
        const vector = await embedText(chunk.text);
        result.push({
            vector,
            metadata: {
                filePath: chunk.filePath,
                heading: chunk.heading,
                text: chunk.text,
                hash: chunk.hash
            }
        });
    }
    return result;
}

module.exports = { initModel, embedText, chunkMarkdown, embedFile, hashContent };
