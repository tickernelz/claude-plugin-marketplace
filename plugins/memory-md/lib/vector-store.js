'use strict';

const path = require('path');
const { LocalIndex } = require('vectra');
const { memoryDir } = require('./utils');

const rootIndexPath = path.join(memoryDir, 'root.index');
const dailyIndexPath = path.join(memoryDir, 'daily.index');

let rootIndexPromise = null;
let dailyIndexPromise = null;

async function getIndex(type) {
    if (type === 'root') {
        if (!rootIndexPromise) {
            rootIndexPromise = (async () => {
                const idx = new LocalIndex(rootIndexPath);
                if (!(await idx.isIndexCreated())) await idx.createIndex();
                return idx;
            })();
        }
        return rootIndexPromise;
    }
    if (type === 'daily') {
        if (!dailyIndexPromise) {
            dailyIndexPromise = (async () => {
                const idx = new LocalIndex(dailyIndexPath);
                if (!(await idx.isIndexCreated())) await idx.createIndex();
                return idx;
            })();
        }
        return dailyIndexPromise;
    }
    throw new Error(`Unknown index type: ${type}`);
}

function getIndexType(filePath) {
    return filePath.includes('/daily/') ? 'daily' : 'root';
}

async function upsertFile(filePath, embeddedChunks) {
    if (!embeddedChunks || embeddedChunks.length === 0) {
        throw new Error(`upsertFile called with no chunks for ${filePath}`);
    }
    const type = getIndexType(filePath);
    const index = await getIndex(type);

    const existing = await index.listItems();
    const existingByHash = new Map();
    const toDelete = [];

    for (const item of existing) {
        if (item.metadata && item.metadata.filePath === filePath) {
            if (item.metadata.hash) {
                existingByHash.set(item.metadata.hash, item.id);
            } else {
                toDelete.push(item.id);
            }
        }
    }

    const newHashes = new Set(embeddedChunks.map(c => c.metadata.hash));

    for (const [hash, id] of existingByHash) {
        if (!newHashes.has(hash)) {
            toDelete.push(id);
        }
    }

    for (const id of toDelete) {
        await index.deleteItem(id);
    }

    for (const { vector, metadata } of embeddedChunks) {
        if (!existingByHash.has(metadata.hash)) {
            await index.insertItem({ vector, metadata });
        }
    }
}

async function search(queryVector, topK = 10) {
    const results = [];

    for (const type of ['root', 'daily']) {
        const index = await getIndex(type);
        const items = await index.queryItems(queryVector, topK);
        for (const item of items) {
            results.push({
                score: item.score,
                filePath: item.item.metadata.filePath,
                heading: item.item.metadata.heading,
                text: item.item.metadata.text
            });
        }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
}

async function deleteFile(filePath) {
    const type = getIndexType(filePath);
    const index = await getIndex(type);
    const existing = await index.listItems();
    for (const item of existing) {
        if (item.metadata && item.metadata.filePath === filePath) {
            await index.deleteItem(item.id);
        }
    }
}

module.exports = { getIndex, upsertFile, search, deleteFile };
