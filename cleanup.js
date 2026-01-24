const fs = require('fs');
const path = require('path');

const DIRS_TO_CLEAN = [
    'public/uploads',
    'public/uploads/temp'
];

console.log("🧹 NETTOYAGE DES FICHIERS TEMPORAIRES...");

function cleanDir(directory) {
    const fullPath = path.join(__dirname, directory);
    if (fs.existsSync(fullPath)) {
        const files = fs.readdirSync(fullPath);
        for (const file of files) {
            if (file === '.gitkeep') continue;
            try {
                fs.unlinkSync(path.join(fullPath, file));
                console.log(`   🗑️ Supprimé : ${file}`);
            } catch (e) {
                console.error(`   ❌ Erreur suppression ${file}`);
            }
        }
    } else {
        // Création si inexistant pour éviter crash
        fs.mkdirSync(fullPath, { recursive: true });
    }
}

DIRS_TO_CLEAN.forEach(dir => cleanDir(dir));

console.log("✨ DOSSIER UPLOADS VIDÉ (Fichiers inutiles supprimés).");