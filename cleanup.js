const fs = require('fs');
const path = require('path');

const FILES_TO_DELETE = [
    // Fichiers de test / Junk
    'client/src/test_ok.txt',
    'client/src/test_token_crash.js',
    'client/src/test_token_valid.txt',
    'verificatons.txt',
    
    // Ancienne feature "Project Tree" (Architecte V1) obsolète
    'client/src/features/prof/components/ProjectTreeViewer.jsx',
    'client/src/features/prof/components/ProjectTreeViewer.css',
    'server/models/ProjectDoc.js',
    'server/domains/admin/ai/project-doc.ai.js'
];

const DIRS_TO_CLEAN = [
    '.',
    'client/src/features/prof/components'
];

console.log("🧹 NETTOYAGE DU PROJET...");

FILES_TO_DELETE.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        try {
            fs.unlinkSync(fullPath);
            console.log(`✅ Supprimé : ${file}`);
        } catch (e) {
            console.error(`❌ Erreur suppression ${file}:`, e.message);
        }
    }
});

// Nettoyage des dossiers vides
function cleanEmptyDirs(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    items.forEach(item => {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory() && item !== 'node_modules' && item !== '.git') {
            cleanEmptyDirs(fullPath);
        }
    });
    if (dir !== '.' && fs.readdirSync(dir).length === 0) {
        try { fs.rmdirSync(dir); } catch (e) {}
    }
}

cleanEmptyDirs('.');
console.log("✨ PROJET PROPRE.");