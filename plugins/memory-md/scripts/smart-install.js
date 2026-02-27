#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
if (!pluginRoot) {
    console.error('[ERROR] CLAUDE_PLUGIN_ROOT not set');
    process.exit(1);
}

const memoryDir = path.join(os.homedir(), '.claude', 'memory');
const dailyDir = path.join(memoryDir, 'daily');

const INSTALL_MARKER = path.join(pluginRoot, '.install-version');
const EMBED_MARKER = path.join(memoryDir, '.embedded');
const LOCK_FILE = path.join(memoryDir, '.install.lock');
const PACKAGE_JSON = path.join(pluginRoot, 'package.json');

// Lock mechanism
if (fs.existsSync(LOCK_FILE)) {
    const lockAge = Date.now() - fs.statSync(LOCK_FILE).mtimeMs;
    if (lockAge < 300000) {
        process.exit(0);
    }
    fs.unlinkSync(LOCK_FILE);
}

fs.writeFileSync(LOCK_FILE, Date.now().toString());

function cleanup() {
    if (fs.existsSync(LOCK_FILE)) {
        fs.unlinkSync(LOCK_FILE);
    }
}

process.on('exit', cleanup);
process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
});
process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
});

function needsInstall() {
    if (!fs.existsSync(path.join(pluginRoot, 'node_modules'))) {
        return true;
    }
    try {
        const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
        const marker = JSON.parse(fs.readFileSync(INSTALL_MARKER, 'utf-8'));
        return pkg.version !== marker.version;
    } catch {
        return true;
    }
}

function installDeps() {
    console.error('[INFO] Installing dependencies...');
    try {
        execSync('npm install', {
            cwd: pluginRoot,
            stdio: 'inherit'
        });
        const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
        fs.writeFileSync(
            INSTALL_MARKER,
            JSON.stringify({
                version: pkg.version,
                installedAt: new Date().toISOString()
            })
        );
        console.error('[INFO] Dependencies installed');
    } catch (err) {
        console.error('[ERROR] npm install failed:', err.message);
        cleanup();
        process.exit(1);
    }
}

function verifyCriticalModules() {
    const critical = ['@huggingface/transformers', 'vectra'];
    const missing = [];
    for (const dep of critical) {
        const modulePath = path.join(pluginRoot, 'node_modules', dep);
        if (!fs.existsSync(modulePath)) {
            missing.push(dep);
        }
    }
    if (missing.length > 0) {
        console.error(`[ERROR] Critical modules missing: ${missing.join(', ')}`);
        cleanup();
        process.exit(1);
    }
}

function ensureGitRepo() {
    const gitDir = path.join(memoryDir, '.git');
    if (!fs.existsSync(gitDir)) {
        try {
            if (!fs.existsSync(memoryDir)) {
                fs.mkdirSync(memoryDir, { recursive: true });
            }
            execSync('git init', { cwd: memoryDir, stdio: 'pipe' });
            execSync('git config user.name "Claude Memory"', { cwd: memoryDir, stdio: 'pipe' });
            execSync('git config user.email "memory@claude.local"', { cwd: memoryDir, stdio: 'pipe' });
            console.error('[INFO] Git repository initialized');
        } catch (err) {
            throw new Error(`Failed to initialize git repository: ${err.message}`);
        }
    }
}

function clearModelCache() {
    const cachePath = path.join(os.homedir(), '.cache', 'huggingface');
    if (fs.existsSync(cachePath)) {
        fs.rmSync(cachePath, { recursive: true, force: true });
    }
}

function needsEmbedding() {
    if (fs.existsSync(EMBED_MARKER)) {
        return false;
    }

    const rootFiles = ['MEMORY.md', 'IDENTITY.md', 'USER.md'];
    for (const file of rootFiles) {
        const filePath = path.join(memoryDir, file);
        if (fs.existsSync(filePath)) {
            return true;
        }
    }

    if (fs.existsSync(dailyDir)) {
        const dailyFiles = fs.readdirSync(dailyDir).filter(f => f.endsWith('.md'));
        if (dailyFiles.length > 0) {
            return true;
        }
    }

    return false;
}

async function embedExistingMemories() {
    console.error('[INFO] Embedding existing memories...');

    const { initModel, embedFile } = require(path.join(pluginRoot, 'lib', 'embedding.js'));
    const { upsertFile } = require(path.join(pluginRoot, 'lib', 'vector-store.js'));

    await initModel();

    const filesToEmbed = [];

    const rootFiles = ['MEMORY.md', 'IDENTITY.md', 'USER.md'];
    for (const file of rootFiles) {
        const filePath = path.join(memoryDir, file);
        if (fs.existsSync(filePath)) {
            filesToEmbed.push(filePath);
        }
    }

    if (fs.existsSync(dailyDir)) {
        const dailyFiles = fs
            .readdirSync(dailyDir)
            .filter(f => f.endsWith('.md'))
            .map(f => path.join(dailyDir, f));
        filesToEmbed.push(...dailyFiles);
    }

    if (filesToEmbed.length === 0) {
        console.error('[INFO] No existing memories to embed');
        fs.writeFileSync(EMBED_MARKER, new Date().toISOString());
        return;
    }

    console.error(`[INFO] Found ${filesToEmbed.length} files to embed`);

    let embedded = 0;
    let failed = 0;

    for (const filePath of filesToEmbed) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            if (!content.trim()) continue;

            const embeddedChunks = await embedFile(filePath, content);
            await upsertFile(filePath, embeddedChunks);
            embedded++;

            if (embedded % 5 === 0) {
                console.error(`[INFO] Embedded ${embedded}/${filesToEmbed.length}...`);
            }
        } catch (err) {
            console.error(`[WARN] Failed to embed ${path.basename(filePath)}: ${err.message}`);
            failed++;
        }
    }

    console.error(`[INFO] Embedding complete: ${embedded} files indexed, ${failed} failed`);

    fs.writeFileSync(EMBED_MARKER, new Date().toISOString());
}

async function run() {
    try {
        // Step 1: Install dependencies if needed
        if (needsInstall()) {
            installDeps();
            verifyCriticalModules();
        }

        // Step 2: Initialize git repo if needed
        ensureGitRepo();

        // Step 3: Embed existing memories if needed
        if (needsEmbedding()) {
            await embedExistingMemories();
        }

        cleanup();
    } catch (err) {
        if (err.message.includes('Protobuf parsing failed') || err.message.includes('mutex lock failed')) {
            console.error('[WARN] Model cache corrupt, clearing and retrying...');
            try {
                clearModelCache();
                await embedExistingMemories();
                cleanup();
            } catch (retryErr) {
                console.error('[ERROR] Embedding failed after retry:', retryErr.message);
                cleanup();
                process.exit(1);
            }
        } else {
            console.error('[ERROR] Installation failed:', err.message);
            cleanup();
            process.exit(1);
        }
    }
}

run();
