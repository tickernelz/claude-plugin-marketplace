#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const memoryDir = path.join(os.homedir(), '.claude', 'memory');
const dailyDir = path.join(memoryDir, 'daily');
const markerFile = path.join(memoryDir, '.migration-v1.3.3');
const lockFile = path.join(memoryDir, '.migration-v1.3.3.lock');

if (fs.existsSync(markerFile)) {
    process.exit(0);
}

if (fs.existsSync(lockFile)) {
    const lockAge = Date.now() - fs.statSync(lockFile).mtimeMs;
    if (lockAge < 300000) {
        process.exit(0);
    }
    fs.unlinkSync(lockFile);
}

fs.writeFileSync(lockFile, Date.now().toString());

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
if (!pluginRoot) {
    console.error('❌ CLAUDE_PLUGIN_ROOT not set');
    if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
    process.exit(1);
}

const { initModel, embedFile } = require(path.join(pluginRoot, 'lib', 'embedding.js'));
const { upsertFile } = require(path.join(pluginRoot, 'lib', 'vector-store.js'));

async function migrateExistingMemories() {
    console.error('🔄 Migrating existing memories to semantic search...');

    await initModel();

    const filesToMigrate = [];

    const rootFiles = ['MEMORY.md', 'IDENTITY.md', 'USER.md'];
    for (const file of rootFiles) {
        const filePath = path.join(memoryDir, file);
        if (fs.existsSync(filePath)) {
            filesToMigrate.push(filePath);
        }
    }

    if (fs.existsSync(dailyDir)) {
        const dailyFiles = fs
            .readdirSync(dailyDir)
            .filter(f => f.endsWith('.md'))
            .map(f => path.join(dailyDir, f));
        filesToMigrate.push(...dailyFiles);
    }

    if (filesToMigrate.length === 0) {
        console.error('✅ No existing memories to migrate');
        fs.writeFileSync(markerFile, new Date().toISOString());
        return;
    }

    console.error(`📝 Found ${filesToMigrate.length} files to migrate`);

    let migrated = 0;
    let failed = 0;

    for (const filePath of filesToMigrate) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (!content.trim()) continue;

            const embedded = await embedFile(filePath, content);
            await upsertFile(filePath, embedded);
            migrated++;

            if (migrated % 5 === 0) {
                console.error(`   Migrated ${migrated}/${filesToMigrate.length}...`);
            }
        } catch (err) {
            console.error(`   Failed to migrate ${path.basename(filePath)}: ${err.message}`);
            failed++;
        }
    }

    console.error(`✅ Migration complete: ${migrated} files indexed, ${failed} failed`);

    fs.writeFileSync(markerFile, new Date().toISOString());
}

function clearModelCache() {
    const cachePaths = [
        path.join(os.homedir(), '.cache', 'huggingface'),
        path.join(pluginRoot, 'node_modules', '@huggingface', 'transformers', '.cache')
    ];
    for (const cachePath of cachePaths) {
        if (fs.existsSync(cachePath)) {
            fs.rmSync(cachePath, { recursive: true, force: true });
        }
    }
}

async function runMigration() {
    try {
        await migrateExistingMemories();
    } catch (err) {
        if (err.message.includes('Protobuf parsing failed') || err.message.includes('mutex lock failed')) {
            console.error('⚠️  Model cache corrupt, clearing and retrying...');
            try {
                clearModelCache();
                await migrateExistingMemories();
            } catch (retryErr) {
                console.error('❌ Migration failed after retry:', retryErr.message);
                if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
                process.exit(0);
            }
        } else {
            console.error('❌ Migration failed:', err.message);
            if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
            process.exit(0);
        }
    } finally {
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
    }
}

runMigration();
