const fs = require('fs');
const path = require('path');

const inputFile = 'update.txt';
const statusFile = 'apply_status.json';

// 🛡️ LISTE DES INTOUCHABLES (Ne seront jamais supprimés)
const PROTECTED_PATHS = [
    '.git',
    'node_modules',
    'apply.js',
    'git-auto.js',
    'package.json',
    '.env',
    'server/server.js',
    '.',
    './'
];

console.log("------------------------------------------------");
console.log("🛠️  [WATCHER] apply.js (v14-FORTRESS) actif.");
console.log("🔒  Format Sécurisé : [[[£ ... £]]]");
console.log("------------------------------------------------");

function setStatus(error, truncatedFile = null) {
    try {
        fs.writeFileSync(statusFile, JSON.stringify({ error, truncatedFile, timestamp: Date.now() }, null, 2));
    } catch (e) {}
}

function applyUpdate() {
    if (!fs.existsSync(inputFile)) return;
    let rawContent = "";
    try { 
        rawContent = fs.readFileSync(inputFile, 'utf8'); 
    } catch (e) { return; }
    
    if (rawContent.trim().length < 5) return;

    let processedCount = 0;

    // --- 1. GESTION DES SUPPRESSIONS (Nouveau format £) ---
    // Regex : [[[£ DELETE: chemin £]]]
    const deleteRegex = /\[\[\[£\s*DELETE\s*:\s*([^£\]\s]+)\s*£\]\]\]/g;
    let delMatch;
    
    while ((delMatch = deleteRegex.exec(rawContent)) !== null) {
        const relativePath = delMatch[1].trim();
        const targetPath = path.join(__dirname, relativePath);

        const isProtected = PROTECTED_PATHS.some(p => 
            relativePath === p || 
            relativePath.startsWith(p + '/') ||
            relativePath.startsWith('./' + p)
        );

        if (isProtected) {
            console.error(`   ⛔ REFUS DE SUPPRIMER : ${relativePath} (Protégé)`);
            processedCount++;
            continue;
        }

        try {
            if (fs.existsSync(targetPath)) {
                fs.rmSync(targetPath, { recursive: true, force: true });
                console.log(`   🗑️  SUPPRIMÉ : ${relativePath}`);
                processedCount++;
            } else {
                console.log(`   ⚠️  Introuvable : ${relativePath}`);
            }
        } catch (e) {
            console.error(`   ❌ ERREUR DELETE ${relativePath}: ${e.message}`);
        }
    }

    // --- 2. GESTION DES FICHIERS (Nouveau format £) ---
    // Regex : [[[£ FILE: chemin £]]]
    const fileStartRegex = /\[\[\[£\s*FILE\s*:\s*([^£\]\s]+)\s*£\]\]\]/g;
    let match;
    let lastUnfinishedBlock = "";

    while ((match = fileStartRegex.exec(rawContent)) !== null) {
        const filePath = match[1].trim();
        const startTag = match[0];
        // Balise de fin avec £ : [[[£ END: chemin £]]]
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
            } catch (e) {
                console.error(`   ❌ ERREUR FILE ${filePath}: ${e.message}`);
            }
        } else {
            lastUnfinishedBlock = rawContent.substring(rawContent.indexOf(startTag));
            console.warn(`⚠️  [INCOMPLET] ${filePath}`);
            setStatus("Fichier coupé détecté", filePath);
            break;
        }
    }

    // --- NETTOYAGE ---
    try {
        if (lastUnfinishedBlock) {
            fs.writeFileSync(inputFile, lastUnfinishedBlock.trim());
        } else if (processedCount > 0) {
            fs.writeFileSync(inputFile, '');
            console.log(`✨ Terminé : ${processedCount} actions.\n`);
            setStatus(null);
        } else if (rawContent.length > 50 && processedCount === 0) {
            // Si le texte ne contient pas les balises £, on considère que c'est du bruit
            fs.writeFileSync(inputFile, '');
            console.log(`🧹 Nettoyage texte non conforme (Format £ attendu).`);
        }
    } catch (e) { console.error("Erreur nettoyage."); }
}

setInterval(applyUpdate, 1000);