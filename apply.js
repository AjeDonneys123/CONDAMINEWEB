const fs = require('fs');
const path = require('path');

const inputFile = 'update.txt';
const statusFile = 'apply_status.json';

const PROTECTED_PATHS = ['.git', 'node_modules', 'apply.js', 'git-auto.js', 'package.json', '.env', 'server/server.js', '.', './'];

console.log("------------------------------------------------");
console.log("🛠️  [WATCHER] apply.js (v17-KAMIKAZE) actif.");
console.log("💥  Mode : Erreur = Alerte + Vidange immédiate.");
console.log("------------------------------------------------");

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

    let cursor = 0;
    let processedAny = false;

    // --- 1. DELETE (Toujours traité en priorité) ---
    const deleteRegex = /\[\[\[£\s*DELETE\s*:\s*([^£\]\s]+)\s*£\]\]\]/g;
    let delMatch;
    while ((delMatch = deleteRegex.exec(rawContent)) !== null) {
        const relativePath = delMatch[1].trim();
        const targetPath = path.join(__dirname, relativePath);
        const isProtected = PROTECTED_PATHS.some(p => relativePath === p || relativePath.startsWith(p + '/') || relativePath.startsWith('./' + p));

        if (!isProtected) {
            try {
                if (fs.existsSync(targetPath)) {
                    fs.rmSync(targetPath, { recursive: true, force: true });
                    console.log(`   🗑️  SUPPRIMÉ : ${relativePath}`);
                }
            } catch (e) {}
        }
    }

    // --- 2. FILES (Séquentiel) ---
    const startMarker = "[[[£ FILE:";
    let nextStartIndex = rawContent.indexOf(startMarker, cursor);

    while (nextStartIndex !== -1) {
        const pathEndIndex = rawContent.indexOf("£]]]", nextStartIndex);
        
        // Sécurité de base sur la balise ouvrante
        if (pathEndIndex === -1) {
            // Cas très rare où même le nom du fichier est coupé
            setStatus('TRUNCATED', 'Inconnu (En-tête coupé)');
            fs.writeFileSync(inputFile, '');
            return;
        }

        const filePath = rawContent.substring(nextStartIndex + startMarker.length, pathEndIndex).trim();
        const endTag = `[[[£ END: ${filePath} £]]]`;
        const endTagIndex = rawContent.indexOf(endTag, pathEndIndex);

        if (endTagIndex !== -1) {
            // --- FICHIER COMPLET ---
            const contentStart = pathEndIndex + 4;
            const fileContent = rawContent.substring(contentStart, endTagIndex).trim();
            const fullPath = path.join(__dirname, filePath);
            const dir = path.dirname(fullPath);

            try {
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(fullPath, fileContent);
                console.log(`   ✅ APPLIQUÉ : ${filePath}`);
                processedAny = true;
            } catch (e) {
                console.error(`   ❌ ERREUR FILE ${filePath}: ${e.message}`);
            }

            cursor = endTagIndex + endTag.length;
            nextStartIndex = rawContent.indexOf(startMarker, cursor);
        } else {
            // --- FICHIER COUPÉ ---
            console.warn(`⚠️  [COUPURE DÉTECTÉE] Sur le fichier : ${filePath}`);
            console.warn(`💥  ACTION : Alerte Frontend + Vidange update.txt`);
            
            // 1. On prévient le site web
            setStatus('TRUNCATED', filePath);
            
            // 2. On vide le fichier pour faire place nette au prochain copier-coller
            fs.writeFileSync(inputFile, '');
            
            // 3. On arrête tout immédiatement
            return;
        }
    }

    // --- 3. NETTOYAGE FINAL (Si tout s'est bien passé) ---
    // Si on arrive ici, c'est qu'aucune coupure n'a été détectée dans la boucle
    if (processedAny) {
        // On ne garde que ce qui n'a pas été traité (normalement rien ou des espaces)
        const remaining = rawContent.substring(cursor).trim();
        if (remaining.length === 0) {
            fs.writeFileSync(inputFile, '');
            setStatus('OK'); // Tout est vert
            console.log(`✨ Cycle terminé. update.txt vidé.\n`);
        } else {
            // S'il reste du texte mais pas de balise FILE (poubelle), on vide aussi
            fs.writeFileSync(inputFile, '');
            setStatus('OK');
        }
    } else if (rawContent.length > 50 && !rawContent.includes('[[[£')) {
        // Texte poubelle sans aucune balise valide
        fs.writeFileSync(inputFile, '');
    }
}

// Initialisation
setStatus('OK');
setInterval(applyUpdate, 1000);