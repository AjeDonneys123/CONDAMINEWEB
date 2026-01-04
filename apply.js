const fs = require('fs');
const path = require('path');
const inputFile = 'update.txt';
const historyFile = 'history.txt';

console.log("🛠️  [WATCHER] apply.js (v7) actif.");
console.log("📜 Mémoire : 'history-important' (Permanent) | 'history' (Max 10)");

/**
 * Gère la rotation de l'historique
 * @param {string} newEntry - Le contenu du log
 * @param {boolean} isImportant - Si permanent ou non
 */
function manageHistory(newEntry, isImportant) {
    const delimiter = "==================================================";
    let historyContent = "";
    
    if (fs.existsSync(historyFile)) {
        historyContent = fs.readFileSync(historyFile, 'utf8');
    }

    // On sépare les blocs existants
    const blocks = historyContent.split(delimiter)
        .map(b => b.trim())
        .filter(b => b.length > 5);

    // On trie : Permanents vs Flux (Normal)
    // On identifie les permanents par le tag [IMPORTANT]
    const importantBlocks = blocks.filter(b => b.includes("[IMPORTANT]"));
    let normalBlocks = blocks.filter(b => !b.includes("[IMPORTANT]") && !b.includes("---"));

    const timestamp = new Date().toLocaleString();
    
    if (isImportant) {
        const formatted = `### [IMPORTANT] - ${timestamp}\n${newEntry}`;
        importantBlocks.push(formatted);
    } else {
        const formatted = `### [LOG] - ${timestamp}\n${newEntry}`;
        normalBlocks.push(formatted);
        // RÈGLE : On ne garde que les 10 derniers logs normaux
        if (normalBlocks.length > 10) {
            normalBlocks.shift(); // Supprime le plus ancien
        }
    }

    // Reconstruction propre du fichier
    let finalOutput = "--- NOTES ARCHITECTURE (PERMANENT) ---\n\n";
    finalOutput += importantBlocks.join(`\n\n${delimiter}\n\n`);
    finalOutput += `\n\n${delimiter}\n\n`;
    finalOutput += "--- DERNIÈRES MODIFICATIONS (FLUX MAX 10) ---\n\n";
    finalOutput += normalBlocks.join(`\n\n${delimiter}\n\n`);
    finalOutput += `\n\n${delimiter}\n`;

    try {
        fs.writeFileSync(historyFile, finalOutput);
        console.log(`   📝 HISTORIQUE : ${isImportant ? 'IMPORTANT (Permanent)' : 'LOG (Flux 10)'} mis à jour.`);
    } catch (e) {
        console.error("   ❌ Erreur écriture history.txt :", e.message);
    }
}

/**
 * Analyse update.txt et applique les changements
 */
function applyUpdate() {
    if (!fs.existsSync(inputFile)) return;
    const rawContent = fs.readFileSync(inputFile, 'utf8');
    const content = rawContent.trim();
    if (content.length < 10) return;

    console.log("\n⚡ [MAJ] Nouveau flux détecté...");

    // Capture [[[ TYPE : TARGET ]]]
    const parts = content.split(/\[\[\[\s*(\w+)\s*:\s*([^\]\s]+)\s*\]\]\]/);
    let count = 0;

    for (let i = 1; i < parts.length; i += 3) {
        const type = parts[i] ? parts[i].trim().toLowerCase() : null;
        const target = parts[i + 1] ? parts[i + 1].trim() : null;
        const blockContent = parts[i + 2] ? parts[i + 2].trim() : "";

        if (type && target) {
            const targetLower = target.toLowerCase();

            // CAS 1 : HISTORIQUE DYNAMIQUE
            if (targetLower === 'history' || type === 'update') {
                const isImportant = targetLower.includes('important');
                manageHistory(blockContent, isImportant);
                count++;
            } 
            // CAS 2 : MISE À JOUR DE FICHIER
            else if (type === 'file') {
                const fullPath = path.join(__dirname, target);
                const dir = path.dirname(fullPath);
                
                try {
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    fs.writeFileSync(fullPath, blockContent);
                    console.log(`   ✅ SYNCHRO : ${target}`);
                    count++;
                } catch (e) {
                    console.error(`   ❌ ERREUR sur ${target}: ${e.message}`);
                }
            }
        }
    }

    if (count > 0) {
        fs.writeFileSync(inputFile, ''); // Vide update.txt
        console.log(`✨ Terminé : ${count} éléments traités.\n`);
    }
}

// Watcher toutes les secondes
setInterval(applyUpdate, 1000);