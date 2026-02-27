#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const memoryDir = path.join(os.homedir(), '.claude', 'memory');
const dailyDir = path.join(memoryDir, 'daily');
const markerFile = path.join(memoryDir, '.migration-v1.3.1');

// Check if migration already done
if (fs.existsSync(markerFile)) {
    process.exit(0);
}

// Check if embedding modules are available
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
if (!pluginRoot) {
    console.error('❌ CLAUDE_PLUGIN_ROOT not set');
    process.exit(1);
}

const { initModel, embedFile } = require(path.join(pluginRoot, 'lib', 'embedding.js'));
const { upsertFile } = require(path.join(pluginRoot, 'lib', 'vector-store.js'));

async function migrateExistingMemories() {
    console.log('🔄 Migrating existing memories to semantic search...');

    // Init model first
    await initModel();

    const filesToMigrate = [];

    // Scan root memory files
    const rootFiles = ['MEMORY.md', 'IDENTITY.md', 'USER.md'];
    for (const file of rootFiles) {
        const filePath = path.join(memoryDir, file);
        if (fs.existsSync(filePath)) {
            filesToMigrate.push(filePath);
        }
    }

    // Scan daily logs
    if (fs.existsSync(dailyDir)) {
        const dailyFiles = fs
            .readdirSync(dailyDir)
            .filter(f => f.endsWith('.md'))
            .map(f => path.join(dailyDir, f));
        filesToMigrate.push(...dailyFiles);
    }

    if (filesToMigrate.length === 0) {
        console.log('✅ No existing memories to migrate');
        fs.writeFileSync(markerFile, new Date().toISOString());
        return;
    }

    console.log(`📝 Found ${filesToMigrate.length} files to migrate`);

    let migrated = 0;
    let failed = 0;

    for (const filePath of filesToMigrate) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (!content.trim()) continue;

            const embedded = await embedFile(filePath, content);
            await upsertFile(filePath, embedded);
            migrated++;

            // Progress indicator
            if (migrated % 5 === 0) {
                console.log(`   Migrated ${migrated}/${filesToMigrate.length}...`);
            }
        } catch (err) {
            console.error(`   Failed to migrate ${path.basename(filePath)}: ${err.message}`);
            failed++;
        }
    }

    console.log(`✅ Migration complete: ${migrated} files indexed, ${failed} failed`);

    // Create marker file
    fs.writeFileSync(markerFile, new Date().toISOString());
}

migrateExistingMemories().catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
