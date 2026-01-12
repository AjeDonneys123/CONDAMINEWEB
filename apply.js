const fs = require('fs');
const path = require('path');

const inputFile = 'update.txt';
const statusFile = 'apply_status.json';

console.log("------------------------------------------------");
console.log("🛠️  [WATCHER] apply.js (v12-DESTRUCTOR) actif.");
console.log("🧹 Mode : Création + SUPPRESSION (DELETE) + Nettoyage");
console.log("------------------------------------------------");

/**
 * Informe le site web du statut
 */
function setStatus(error, truncatedFile = null) {
    try {
        fs.writeFileSync(statusFile, JSON.stringify({ error, truncatedFile, timestamp: Date.now() }, null, 2));
    } catch (e) {}
}

/**
 * Analyse et applique les blocs de code
 */
function applyUpdate() {
    if (!fs.existsSync(inputFile)) return;
    let rawContent = "";
    try { 
        rawContent = fs.readFileSync(inputFile, 'utf8'); 
    } catch (e) { return; }
    
    if (rawContent.trim().length < 5) return;

    let processedCount = 0;

    // --- 1. GESTION DES SUPPRESSIONS (Nouveau v12) ---
    // Syntaxe : [[[ DELETE: chemin/vers/fichier_ou_dossier ]]]
    const deleteRegex = /\[\[\[\s*DELETE\s*:\s*([^\]\s]+)\s*\]\]\]/g;
    let delMatch;
    
    while ((delMatch = deleteRegex.exec(rawContent)) !== null) {
        const targetPath = path.join(__dirname, delMatch[1].trim());
        try {
            if (fs.existsSync(targetPath)) {
                // rmSync avec recursive:true supprime fichiers ET dossiers
                fs.rmSync(targetPath, { recursive: true, force: true });
                console.log(`   🗑️  SUPPRIMÉ : ${delMatch[1]}`);
                processedCount++;
            } else {
                console.log(`   ⚠️  Introuvable (déjà supprimé ?) : ${delMatch[1]}`);
            }
        } catch (e) {
            console.error(`   ❌ ERREUR DELETE ${delMatch[1]}: ${e.message}`);
        }
    }

    // --- 2. GESTION DES FICHIERS (Création / Modification) ---
    const fileStartRegex = /\[\[\[\s*FILE\s*:\s*([^\]\s]+)\s*\]\]\]/g;
    let match;
    let lastUnfinishedBlock = "";

    // On parcourt tous les débuts de fichiers trouvés
    while ((match = fileStartRegex.exec(rawContent)) !== null) {
        const filePath = match[1].trim();
        const startTag = match[0];
        const endTag = `[[[ END: ${filePath} ]]]`;

        // VÉRIFICATION : Est-ce que ce fichier précis a sa balise de fin ?
        if (rawContent.includes(endTag)) {
            // BLOC COMPLET : On extrait le contenu
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
                console.error(`   ❌ ERREUR sur ${filePath}: ${e.message}`);
            }
        } else {
            // BLOC TRONQUÉ : Il manque la fin
            lastUnfinishedBlock = rawContent.substring(rawContent.indexOf(startTag));
            console.warn(`⚠️  [INCOMPLET] Le fichier ${filePath} est tronqué. Attente de la suite...`);
            setStatus("Fichier coupé détecté", filePath);
            break; // On arrête tout pour ce cycle
        }
    }

    // --- NETTOYAGE DE UPDATE.TXT ---
    try {
        // S'il y a un bloc incomplet, on le garde. Sinon on vide tout.
        if (lastUnfinishedBlock) {
            fs.writeFileSync(inputFile, lastUnfinishedBlock.trim());
        } else if (processedCount > 0) {
            // Tout a été traité (delete ou file), on vide
            fs.writeFileSync(inputFile, '');
            console.log(`✨ Terminé : ${processedCount} actions. update.txt vidé.\n`);
            setStatus(null);
        } else if (rawContent.length > 50 && processedCount === 0) {
            // Sécurité poubelle
            fs.writeFileSync(inputFile, '');
            console.log(`🧹 Nettoyage : Texte non-conforme supprimé.`);
        }
    } catch (e) {
        console.error("Erreur lors du nettoyage final.");
    }
}

// Vérification toutes les secondes
setInterval(applyUpdate, 1000);