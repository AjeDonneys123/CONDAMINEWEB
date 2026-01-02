const fs = require('fs');
const path = require('path');
const inputFile = 'update.txt';

console.log("🛠️  [WATCHER] apply.js (v4) actif. Marqueur requis : [[[ FILE: chemin ]]]");

function applyUpdate() {
    if (!fs.existsSync(inputFile)) return;
    const content = fs.readFileSync(inputFile, 'utf8').trim();
    if (content.length < 10) return;

    console.log("\n⚡ [MAJ] Nouveau code détecté...");
    
    // On découpe proprement avec le nouveau marqueur spécial
    const parts = content.split(/\[\[\[\s*FILE\s*:\s*([^\]\s]+)\s*\]\]\]/);
    let count = 0;

    // parts[0] est le vide avant le premier marqueur
    // parts[1] est le chemin du fichier 1
    // parts[2] est le contenu du fichier 1
    for (let i = 1; i < parts.length; i += 2) {
        const filePath = parts[i].trim();
        const fileContent = parts[i + 1].trim();

        if (filePath) {
            const fullPath = path.join(__dirname, filePath);
            const dir = path.dirname(fullPath);
            
            try {
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(fullPath, fileContent);
                console.log(`   ✅ SYNCHRO : ${filePath}`);
                count++;
            } catch (e) {
                console.error(`   ❌ ERREUR sur ${filePath}: ${e.message}`);
            }
        }
    }

    if (count > 0) {
        fs.writeFileSync(inputFile, ''); // ON VIDE LE FICHIER SEULEMENT ICI
        console.log(`✨ Terminé : ${count} fichiers mis à jour.\n`);
    }
}

setInterval(applyUpdate, 1000);