'use strict';

const path = require('path');
const { LocalIndex } = require('vectra');
const { memoryDir } = require('./utils');

const rootIndexPath = path.join(memoryDir, 'root.index');
const dailyIndexPath = path.join(memoryDir, 'daily.index');

let rootIndex = null;
let dailyIndex = null;

async function getIndex(type) {
    if (type === 'root') {
        if (!rootIndex) {
            rootIndex = new LocalIndex(rootIndexPath);
            if (!(await rootIndex.isIndexCreated())) await rootIndex.createIndex();
        }
        return rootIndex;
    }
    if (type === 'daily') {
        if (!dailyIndex) {
            dailyIndex = new LocalIndex(dailyIndexPath);
            if (!(await dailyIndex.isIndexCreated())) await dailyIndex.createIndex();
        }
        return dailyIndex;
    }
    throw new Error(`Unknown index type: ${type}`);
}

function getIndexType(filePath) {
    return filePath.includes('/daily/') ? 'daily' : 'root';
}

async function upsertFile(filePath, embeddedChunks) {
    const type = getIndexType(filePath);
    const index = await getIndex(type);

    const existing = await index.listItems();
    for (const item of existing) {
        if (item.metadata && item.metadata.filePath === filePath) {
            await index.deleteItem(item.id);
        }
    }

    for (const { vector, metadata } of embeddedChunks) {
        await index.insertItem({ vector, metadata });
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
