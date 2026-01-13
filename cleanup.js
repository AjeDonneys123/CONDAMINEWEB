const fs = require('fs');
const path = require('path');

/**
 * 🧹 SCRIPT DE NETTOYAGE CONDAMINE
 * Supprime récursivement tous les dossiers vides
 * Ignore les dossiers système (.git, node_modules)
 */

const IGNORE = ['.git', 'node_modules', 'client'];

function cleanEmptyDirs(dir) {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);

    // On parcourt d'abord les sous-dossiers
    items.forEach(item => {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory() && !IGNORE.includes(item)) {
            cleanEmptyDirs(fullPath);
        }
    });

    // Après avoir nettoyé les enfants, on vérifie si le dossier est devenu vide
    // On ne supprime JAMAIS la racine '.'
    if (dir !== '.' && fs.readdirSync(dir).length === 0) {
        console.log(`🗑️  Dossier vide supprimé : ${dir}`);
        try {
            fs.rmdirSync(dir);
        } catch (e) {
            console.error(`❌ Impossible de supprimer ${dir}: ${e.message}`);
        }
    }
}

console.log("🧼 Lancement du nettoyage des dossiers vides...");
cleanEmptyDirs('.');
console.log("✨ Nettoyage terminé.");