const fs = require('fs');
const path = require('path');

const inputFile = 'update.txt';
const statusFile = 'apply_status.json';

// 🛡️ LISTE DES INTOUCHABLES
const PROTECTED_PATHS = ['.git', 'node_modules', 'apply.js', 'git-auto.js', 'package.json', '.env', 'server/server.js', '.', './'];

console.log("------------------------------------------------");
console.log("🛠️  [WATCHER] apply.js (v15-NOTIFIER) actif.");
console.log("📡  Statut : Synchronisé avec le Frontend via API.");
console.log("------------------------------------------------");

// Écrit le statut pour le frontend
function setStatus(status, file = null) {
    try {
        const data = { status, file, timestamp: Date.now() };
        fs.writeFileSync(statusFile, JSON.stringify(data, null, 2));
    } catch (e) {}
}

function applyUpdate() {
    if (!fs.existsSync(inputFile)) return;
    let rawContent = "";
    try { rawContent = fs.readFileSync(inputFile, 'utf8'); } catch (e) { return; }
    
    if (rawContent.trim().length < 5) return;

    let processedCount = 0;

    // 1. DELETE
    const deleteRegex = /\[\[\[£\s*DELETE\s*:\s*([^£\]\s]+)\s*£\]\]\]/g;
    let delMatch;
    while ((delMatch = deleteRegex.exec(rawContent)) !== null) {
        const relativePath = delMatch[1].trim();
        const targetPath = path.join(__dirname, relativePath);
        const isProtected = PROTECTED_PATHS.some(p => relativePath === p || relativePath.startsWith(p + '/') || relativePath.startsWith('./' + p));

        if (isProtected) {
            console.error(`   ⛔ PROTECTED: ${relativePath}`);
        } else {
            try {
                if (fs.existsSync(targetPath)) {
                    fs.rmSync(targetPath, { recursive: true, force: true });
                    console.log(`   🗑️  SUPPRIMÉ : ${relativePath}`);
                    processedCount++;
                }
            } catch (e) {}
        }
    }

    // 2. FILES
    const fileStartRegex = /\[\[\[£\s*FILE\s*:\s*([^£\]\s]+)\s*£\]\]\]/g;
    let match;
    let lastUnfinishedBlock = "";
    let hasTruncated = false;

    while ((match = fileStartRegex.exec(rawContent)) !== null) {
        const filePath = match[1].trim();
        const startTag = match[0];
        const endTag = `[[[£ END: ${filePath} £]]]`;

        if (rawContent.includes(endTag)) {
            const startIndex = rawContent.indexOf(startTag) + startTag.length;
            const endIndex = rawContent.indexOf(endTag);
            const fileContent = rawContent.substring(startIndex, endIndex).trim();
            const fullPath = path.join(__dirname, filePath);
            const dir = path.dirname(fullPath);
            
            try {
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(fullPath, fileContent);
                console.log(`   ✅ APPLIQUÉ : ${filePath}`);
                processedCount++;
            } catch (e) { console.error(`ERR: ${e.message}`); }
        } else {
            // C'EST ICI QUE CA SE PASSE : FICHIER COUPÉ
            lastUnfinishedBlock = rawContent.substring(rawContent.indexOf(startTag));
            console.warn(`⚠️  [COUPÉ] ${filePath} - En attente de la suite...`);
            setStatus('TRUNCATED', filePath); // <--- ALERTE LE FRONTEND
            hasTruncated = true;
            break;
        }
    }

    // Nettoyage et Reset Statut
    try {
        if (hasTruncated) {
            // On ne vide pas update.txt, on attend la suite
            // Mais le statut est déjà mis à jour plus haut
        } else {
            if (processedCount > 0) {
                console.log(`✨ Terminé.\n`);
                setStatus('OK'); // Tout va bien
                fs.writeFileSync(inputFile, '');
            } else if (!lastUnfinishedBlock && rawContent.length > 50) {
                fs.writeFileSync(inputFile, ''); // Poubelle
                setStatus('OK');
            }
        }
    } catch (e) {}
}

// Initialise le statut à OK au démarrage
setStatus('OK');
setInterval(applyUpdate, 1000);