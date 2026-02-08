const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const statusFile = 'apply_status.json';
const inputFile = 'update.txt';

/**
 * 🛡️ APPLY.JS V9.6 - SMART COMMIT & FLEXIBLE MODE
 * - Autorise les multi-bundles (Plus de blocage d'herméticité).
 * - Effectue un COMMIT GIT automatique après chaque succès.
 */

const BUNDLES = {
    STRUCTURE: ['server/domains/structure', 'server/prof/structure', 'client/src/features/prof/components/ProfStudioFolder.jsx'],
    STUDIO: ['server/domains/studio', 'server/prof/studio', 'client/src/features/prof/studio', 'server/models/StudioProject.js'],
    CORE: ['server/core', 'server/server.js', 'server/models', 'client/src/App.jsx', 'apply.js'] 
};

function getBundle(filePath) {
    for (const [name, paths] of Object.entries(BUNDLES)) {
        if (paths.some(p => filePath.includes(p))) return name;
    }
    return 'GLOBAL';
}

function writeStatus(type, message) {
    const data = { status: type, message, timestamp: Date.now() };
    try { fs.writeFileSync(statusFile, JSON.stringify(data, null, 2)); } catch(e) {}
}

function applyUpdate() {
    try {
        if (!fs.existsSync(inputFile)) return;
        const rawContent = fs.readFileSync(inputFile, 'utf8');
        if (!rawContent || rawContent.length < 10) return;

        const appliedFiles = [];
        const detectedBundles = new Set();
        
        const fileMatchRegex = /\[\[\[£\s*FILE\s*:\s*([^£\s\]]+)\s*£\]\]\]/g;
        let m;
        while ((m = fileMatchRegex.exec(rawContent)) !== null) {
            const fPath = m[1].trim();
            if (fPath === 'apply.js') continue;
            detectedBundles.add(getBundle(fPath));
        }

        fs.writeFileSync(inputFile, ''); 
        const startRegex = /\[\[\[£\s*FILE\s*:\s*([^£\s\]]+)\s*£\]\]\]/g;
        let match;

        while ((match = startRegex.exec(rawContent)) !== null) {
            const filePath = match[1].trim();
            const startIdx = match.index + match[0].length;
            const endTag = `[[[£ END: ${filePath} £]]]`;
            const endIdx = rawContent.indexOf(endTag, startIdx);

            if (endIdx !== -1) {
                let newContent = rawContent.substring(startIdx, endIdx).trim();
                const fullPath = path.join(__dirname, filePath);
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                
                if (filePath.toLowerCase().endsWith('history.txt')) {
                    fs.appendFileSync(fullPath, '\n' + newContent + '\n');
                } else {
                    fs.writeFileSync(fullPath, newContent + '\n');
                }
                console.log(`✅ APPLIED: ${filePath}`);
                appliedFiles.push(filePath);
            }
        }

        if (appliedFiles.length > 0) {
            try {
                const commitMsg = `Auto-paste: ${appliedFiles.length} files (${Array.from(detectedBundles).join(', ')})`;
                execSync('git add .');
                execSync(`git commit -m "${commitMsg}"`);
                console.log(`📦 [GIT] Commit réussi : ${commitMsg}`);
            } catch (err) {
                console.log("ℹ️ [GIT] Rien à commiter.");
            }
        }

        writeStatus('OK', 'Infrastructure mise à jour et commitée');
    } catch (e) {
        console.log(`💥 ERREUR APPLY : ${e.message}`);
        writeStatus('ERROR', e.message);
    }
}

setInterval(applyUpdate, 500);
console.log("🛡️ ARCHITECTE FLEXIBLE (V9.6) - COMMIT AUTO ACTIF");