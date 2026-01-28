// @signatures: cleanDirectory
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, 'public/uploads');
const TEMP_DIR = path.join(__dirname, 'public/uploads/temp');

console.log("------------------------------------------------");
console.log("🧹 NETTOYAGE PROFOND DU DOSSIER UPLOADS");
console.log("   Cible : " + UPLOADS_DIR);
console.log("------------------------------------------------");

function cleanDirectory(directory) {
    if (!fs.existsSync(directory)) {
        console.log(`   ⚠️ Dossier inexistant : ${directory}`);
        return;
    }

    const files = fs.readdirSync(directory);
    let count = 0;

    for (const file of files) {
        // On ne touche pas aux dossiers (sauf temp qu'on videra spécifiquement)
        // et on garde le .gitkeep
        if (file === '.gitkeep') continue;
        
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (file === 'temp') {
                // On vide le dossier temp mais on le garde
                cleanDirectory(fullPath);
            }
            continue;
        }

        try {
            fs.unlinkSync(fullPath);
            count++;
        } catch (e) {
            console.error(`   ❌ Erreur suppression ${file}: ${e.message}`);
        }
    }
    console.log(`   ✅ Nettoyé ${directory} : ${count} fichiers supprimés.`);
}

// 1. Vider le dossier uploads racine (images, scans, etc.)
cleanDirectory(UPLOADS_DIR);

console.log("\n✨ NETTOYAGE TERMINÉ.");
console.log("   Les fichiers sont désormais stockés sur le Drive.");
