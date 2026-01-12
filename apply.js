const fs = require('fs');
const path = require('path');

const inputFile = 'update.txt';
const statusFile = 'apply_status.json';

console.log("------------------------------------------------");
console.log("🛠️  [WATCHER] apply.js (v11-SÉCURITÉ MAX) actif.");
console.log("🧹 Mode : Nettoyage automatique + Validation [[[ END ]]]");
console.log("------------------------------------------------");

/**
 * Informe le site web du statut (utilisé pour l'alerte rouge en haut du site)
 */
function setStatus(error, truncatedFile = null) {
    try {
        fs.writeFileSync(statusFile, JSON.stringify({ error, truncatedFile, timestamp: Date.now() }, null, 2));
    } catch (e) {}
}

/**
 * Analyse et applique les blocs de code de manière granulaire
 */
function applyUpdate() {
    if (!fs.existsSync(inputFile)) return;
    let rawContent = "";
    try { 
        rawContent = fs.readFileSync(inputFile, 'utf8'); 
    } catch (e) { return; }
    
    if (rawContent.trim().length < 5) return;

    // Regex pour détecter le début : [[[ FILE: chemin ]]]
    const fileStartRegex = /\[\[\[\s*FILE\s*:\s*([^\]\s]+)\s*\]\]\]/g;
    let match;
    let lastUnfinishedBlock = "";
    let processedCount = 0;

    // On parcourt tous les débuts de fichiers trouvés dans update.txt
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
            // BLOC TRONQUÉ : Il manque la fin pour ce fichier
            // On sauvegarde tout le reste du texte à partir de ce fichier pour le conserver
            lastUnfinishedBlock = rawContent.substring(rawContent.indexOf(startTag));
            console.warn(`⚠️  [INCOMPLET] Le fichier ${filePath} est tronqué. Attente de la suite...`);
            setStatus("Fichier coupé détecté", filePath);
            break; // On arrête le traitement pour ce cycle
        }
    }

    // --- NETTOYAGE INTELLIGENT DE UPDATE.TXT ---
    try {
        // On réécrit le fichier :
        // - Soit avec le bloc incomplet qu'on a gardé
        // - Soit vide si tout a été traité
        fs.writeFileSync(inputFile, lastUnfinishedBlock.trim());
        
        if (processedCount > 0 && !lastUnfinishedBlock) {
            console.log(`✨ Terminé : ${processedCount} fichiers synchronisés. update.txt est vide.\n`);
            setStatus(null); // On efface l'alerte sur le site
        } else if (rawContent.length > 50 && processedCount === 0 && !lastUnfinishedBlock) {
            // Si le fichier contient du texte mais aucune balise valide (poubelle)
            fs.writeFileSync(inputFile, '');
            console.log(`🧹 Nettoyage : Texte non-conforme supprimé.`);
        }
    } catch (e) {
        console.error("Erreur lors du nettoyage final.");
    }
}

// Vérification toutes les secondes
setInterval(applyUpdate, 1000);
