#!/usr/bin/env node

// Keeps the extension downloaded from client/public identical to the source
// folder. It is run before production builds and can watch during local dev.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const extensionParent = path.join(root, 'extension');
const extensionName = 'condaweb-slides-bridge';
const extensionDir = path.join(extensionParent, extensionName);
const archivePath = path.join(root, 'client', 'public', `${extensionName}.zip`);

function packageExtension() {
    if (!fs.existsSync(path.join(extensionDir, 'manifest.json'))) {
        throw new Error(`Extension introuvable : ${extensionDir}`);
    }
    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
    // -FS synchronises the archive: files removed from the extension source
    // are removed from the downloaded archive as well.
    execFileSync('zip', ['-r', '-FS', archivePath, extensionName], {
        cwd: extensionParent,
        stdio: 'inherit'
    });
    const manifest = JSON.parse(fs.readFileSync(path.join(extensionDir, 'manifest.json'), 'utf8'));
    console.log(`[extension] ZIP publié mis à jour · v${manifest.version}`);
}

packageExtension();

if (process.argv.includes('--watch')) {
    let timer = null;
    fs.watch(extensionDir, { recursive: true }, (_event, filename) => {
        if (!filename || filename.startsWith('.')) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
            try { packageExtension(); }
            catch (error) { console.error('[extension] impossible de reconstruire le ZIP', error.message); }
        }, 150);
    });
    console.log('[extension] surveillance active du ZIP téléchargeable');
}
