// @signatures: buildTree, captureContent, run
const fs = require('fs');
const path = require('path');

const OUTPUT_FILENAME = 'snapshot.txt';

// 1. LISTE D'EXCLUSION RADICALE
const IGNORE_DIRS = [
    'node_modules', '.git', 'dist', 'build', 'uploads', 'public', '.vscode', 'tests'
];

// Fichiers à ignorer absolument (pour éviter la boucle infinie)
const IGNORE_FILES = [
    'snapshot.txt', 'structure.txt', 'studio.txt', 'games.txt', 
    'update.txt', 'history.txt', 'zz.txt', 'tree.txt', 'projectMap.txt',
    'package-lock.json', '.DS_Store', '.env'
];

// 2. DOSSIERS AUTORISÉS (On ne scanne QUE le code source)
const ALLOWED_ROOT_DIRS = ['server', 'client'];

function buildTree(dir, prefix = '') {
    let structure = '';
    try {
        const items = fs.readdirSync(dir).filter(i => !IGNORE_DIRS.includes(i) && !IGNORE_FILES.includes(i));
        items.sort();
        items.forEach((item, index) => {
            const isLast = index === items.length - 1;
            const fullPath = path.join(dir, item);
            const isDir = fs.statSync(fullPath).isDirectory();
            structure += prefix + (isLast ? '└── ' : '├── ') + item + (isDir ? '/' : '') + '\n';
            if (isDir) structure += buildTree(fullPath, prefix + (isLast ? '    ' : '│   '));
        });
    } catch (e) {}
    return structure;
}

function captureContent(dir, baseDir = "") {
    let content = "";
    try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const p = path.join(dir, item);
            const rel = path.join(baseDir, item).replace(/\\/g, '/');
            const stat = fs.statSync(p);
            
            // Ignorer si dans la liste d'exclusion
            if (IGNORE_DIRS.includes(item) || IGNORE_FILES.includes(item)) continue;

            if (stat.isDirectory()) {
                // On ne descend que dans 'server' et 'client/src'
                if (baseDir === "" && !ALLOWED_ROOT_DIRS.includes(item)) continue;
                content += captureContent(p, rel);
            } else {
                // Sécurité taille : max 100Ko par fichier
                if (stat.size > 100000) continue; 

                const ext = path.extname(item).toLowerCase();
                // Capture uniquement le code
                if (['.js', '.jsx', '.css', '.json', '.html'].includes(ext)) {
                    const fileContent = fs.readFileSync(p, 'utf8');
                    content += `\n[[[£ FILE: ${rel} £]]]\n${fileContent}\n[[[£ END: ${rel} £]]]\n`;
                }
            }
        }
    } catch (e) {}
    return content;
}

function run() {
    console.log("🚀 Génération du Snapshot (Mode Sécurisé VS Code)...");
    
    const tree = buildTree(__dirname);
    const code = captureContent(__dirname, "");
    
    const finalData = `STRUCTURE:\n${tree}\n\nCODE:\n${code}`;
    
    fs.writeFileSync(OUTPUT_FILENAME, finalData);
    console.log(`✅ snapshot.txt généré avec succès (${(finalData.length / 1024).toFixed(1)} Ko).`);
}

run();
