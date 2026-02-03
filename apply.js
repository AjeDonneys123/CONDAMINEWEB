// @signatures: applyUpdate, getBundle, extractSignatures, writeStatus, readStatusSafe, checkDomIntegrity, checkLogicDensity, saveDiff, snapshot
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inputFile = 'update.txt';
const statusFile = 'apply_status.json';
const diffFile = 'temp_diff.json';
const verdictFile = 'temp_verdict.json';

/**
 * 🛡️ APPLY.JS V7.3 - ARCHITECTE HERMÉTIQUE RÉPARÉ
 * RÔLE : Protection contre les régressions par domaine fonctionnel.
 * RÈGLE : Un seul paquet (Bundle) par mise à jour.
 */

const BUNDLES = {
    STRUCTURE: ['server/domains/structure', 'server/prof/structure', 'client/src/features/prof/components/ProfStudioFolder.jsx'],
    STUDIO: ['server/domains/studio', 'server/prof/studio', 'client/src/features/prof/studio'],
    SCAN: ['server/domains/scans', 'server/prof/scans', 'client/src/features/prof/scans'],
    ADMIN: ['server/domains/admin', 'server/prof/admin', 'client/src/features/admin'],
    AUTH: ['server/domains/auth', 'server/prof/auth', 'client/src/features/auth'],
    ELEVE: ['server/eleve', 'client/src/features/eleve'],
    CORE: ['server/core', 'server/server.js', 'server/models', 'client/src/App.jsx', 'apply.js', 'apply_status.json']
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
        const tempPath = statusFile + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2));
        fs.renameSync(tempPath, statusFile);
    } catch(e) {}
}

function extractSignatures(content) {
    const sigs = new Set();
    const patterns = [
        /function\s+([a-zA-Z0-9_]+)/g,
        /const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(/g,
        /export\s+default\s+function\s+([a-zA-Z0-9_]+)/g,
        /async\s+function\s+([a-zA-Z0-9_]+)/g
    ];
    patterns.forEach(regex => {
        let match;
        while ((match = regex.exec(content)) !== null) sigs.add(match[1]);
    });
    return sigs;
}

function checkDomIntegrity(oldContent, newContent) {
    const getIds = (text) => {
        const ids = new Set();
        let match;
        const regex = /id=['"]([^'"]+)['"]/g;
        while ((match = regex.exec(text))) ids.add(match[1]);
        return ids;
    };
    const oldIds = getIds(oldContent);
    const newIds = getIds(newContent);
    const missing = [...oldIds].filter(id => !newIds.has(id));
    return missing.length > 0 ? missing : null;
}

function checkLogicDensity(oldContent, newContent) {
    const logicKeywords = /\b(if|else|switch|case|return|await|async|map|filter|reduce|useEffect|useState|useRef)\b/g;
    const count = (text) => (text.match(logicKeywords) || []).length;
    const oldScore = count(oldContent);
    const newScore = count(newContent);
    if (oldScore > 10 && newScore < oldScore * 0.7) return { drop: Math.round((1 - newScore/oldScore)*100) };
    return null;
}

function applyUpdate() {
    try {
        if (!fs.existsSync(inputFile)) return;
        const rawContent = fs.readFileSync(inputFile, 'utf8');
        if (!rawContent || rawContent.length < 10) return;

        // 1. ANALYSE D'HERMÉTICITÉ
        const fileMatchRegex = /\[\[\[£\s*FILE\s*:\s*([^£\s\]]+)\s*£\]\]\]/g;
        let m;
        const detectedBundles = new Set();
        while ((m = fileMatchRegex.exec(rawContent)) !== null) {
            const fPath = m[1].trim();
            if (fPath.includes('history.txt') || fPath === 'apply.js' || fPath === 'apply_status.json') continue;
            const bundle = getBundle(fPath);
            if (bundle !== 'GLOBAL') detectedBundles.add(bundle);
        }

        if (detectedBundles.size > 1) {
            const list = Array.from(detectedBundles).join(', ');
            console.error("❌ [REJET] Violation d'herméticité : " + list);
            writeStatus('REJECTED', `Plusieurs paquets détectés : ${list}`);
            fs.writeFileSync(inputFile, ''); return;
        }

        // 2. APPLICATION
        fs.writeFileSync(inputFile, ''); 
        const startRegex = /\[\[\[£\s*FILE\s*:\s*([^£\s\]]+)\s*£\]\]\]/g;
        let match;

        while ((match = startRegex.exec(rawContent)) !== null) {
            const filePath = match[1].trim();
            const startIdx = match.index + match[0].length;
            
            const endTagNormal = `[[[£ END: ${filePath} £]]]`;
            const endTagRefactor = `[[[£ END:REFACTORING: ${filePath} £]]]`;
            
            let endIdx = rawContent.indexOf(endTagNormal, startIdx);
            let isRefactoring = false;
            if (endIdx === -1) {
                endIdx = rawContent.indexOf(endTagRefactor, startIdx);
                if (endIdx !== -1) isRefactoring = true;
            }

            if (endIdx !== -1) {
                let newContent = rawContent.substring(startIdx, endIdx).trim();
                const fullPath = path.join(__dirname, filePath);
                let canWrite = true;

                if (fs.existsSync(fullPath) && !isRefactoring && !filePath.includes('history.txt')) {
                    const oldContent = fs.readFileSync(fullPath, 'utf8');
                    const oldSigs = extractSignatures(oldContent);
                    const newSigs = extractSignatures(newContent);
                    const lost = [...oldSigs].filter(s => !newSigs.has(s));
                    const lostIds = checkDomIntegrity(oldContent, newContent);
                    const density = checkLogicDensity(oldContent, newContent);

                    if (lost.length > 0 || lostIds || density) {
                        const reason = lost.length > 0 ? `Perte fonctions: ${lost.join(', ')}` : (lostIds ? "IDs manquants" : "Logique réduite");
                        writeStatus('JUDGING', `VÉRIFICATION : ${filePath}`, reason);
                        canWrite = false;
                    }
                }

                if (canWrite || isRefactoring) {
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                    if (filePath.toLowerCase().endsWith('history.txt')) {
                        fs.appendFileSync(fullPath, '\n' + newContent + '\n');
                    } else {
                        fs.writeFileSync(fullPath, newContent + '\n');
                    }
                    console.log(`${isRefactoring ? '🛠️  REFACTORED' : '✅ APPLIED'}: ${filePath}`);
                }
            }
        }
        writeStatus('OK', 'Mise à jour réussie');
    } catch (e) {
        console.error("❌ Erreur Moteur:", e.message);
        writeStatus('ERROR', e.message);
    }
}

setInterval(applyUpdate, 500);
console.log("🛡️ ARCHITECTE HERMÉTIQUE (V7.3) ACTIF");