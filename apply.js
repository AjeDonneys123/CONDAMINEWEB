// @signatures: applyUpdate, getBundle, extractSignatures, writeStatus
const fs = require('fs');
const path = require('path');
const statusFile = 'apply_status.json';
const inputFile = 'update.txt';

/**
 * 🛡️ APPLY.JS V7.4 - RÉALIGNEMENT STUDIO
 * Autorise server/models/StudioProject.js dans le bundle STUDIO.
 */

const BUNDLES = {
    STRUCTURE: ['server/domains/structure', 'server/prof/structure', 'client/src/features/prof/components/ProfStudioFolder.jsx'],
    STUDIO: [
        'server/domains/studio', 
        'server/prof/studio', 
        'client/src/features/prof/studio',
        'server/models/StudioProject.js' // <--- DÉPLACÉ ICI
    ],
    SCAN: ['server/domains/scans', 'server/prof/scans', 'client/src/features/prof/scans'],
    ADMIN: ['server/domains/admin', 'server/prof/admin', 'client/src/features/admin'],
    AUTH: ['server/domains/auth', 'server/prof/auth', 'client/src/features/auth'],
    ELEVE: ['server/eleve', 'client/src/features/eleve'],
    CORE: ['server/core', 'server/server.js', 'server/models', 'client/src/App.jsx', 'apply.js'] 
    // ^ La règle "STUDIO" étant placée AVANT "CORE", StudioProject sera capturé par STUDIO.
};

function getBundle(filePath) {
    for (const [name, paths] of Object.entries(BUNDLES)) {
        if (paths.some(p => filePath.includes(p))) return name;
    }
    return 'GLOBAL';
}

function writeStatus(type, message, details = null) {
    const data = { status: type, message, details, timestamp: Date.now() };
    try {
        fs.writeFileSync(statusFile, JSON.stringify(data, null, 2));
    } catch(e) {}
}

function extractSignatures(content) {
    const sigs = new Set();
    const patterns = [
        /function\s+([a-zA-Z0-9_]+)/g,
        /const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(/g,
        /export\s+default\s+function\s+([a-zA-Z0-9_]+)/g
    ];
    patterns.forEach(regex => {
        let match;
        while ((match = regex.exec(content)) !== null) sigs.add(match[1]);
    });
    return sigs;
}

function applyUpdate() {
    try {
        if (!fs.existsSync(inputFile)) return;
        const rawContent = fs.readFileSync(inputFile, 'utf8');
        if (!rawContent || rawContent.length < 10) return;

        const fileMatchRegex = /\[\[\[£\s*FILE\s*:\s*([^£\s\]]+)\s*£\]\]\]/g;
        let m;
        const detectedBundles = new Set();
        while ((m = fileMatchRegex.exec(rawContent)) !== null) {
            const fPath = m[1].trim();
            if (fPath.includes('history.txt') || fPath === 'apply.js') continue;
            const bundle = getBundle(fPath);
            if (bundle !== 'GLOBAL') detectedBundles.add(bundle);
        }

        if (detectedBundles.size > 1) {
            const list = Array.from(detectedBundles).join(', ');
            writeStatus('REJECTED', `Violation d'herméticité : ${list}`);
            fs.writeFileSync(inputFile, ''); 
            return;
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
            }
        }
        writeStatus('OK', 'Infrastructure mise à jour');
    } catch (e) {
        writeStatus('ERROR', e.message);
    }
}

setInterval(applyUpdate, 500);
console.log("🛡️ ARCHITECTE HERMÉTIQUE (V7.4) - STUDIO SYNC ACTIF");