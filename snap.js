const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OUTPUT_FILENAME = 'snapshot.txt';
const MAP_FILENAME = 'projectMap.txt';
// J'ai ajouté .env ici pour être sûr qu'on ne l'ouvre jamais par erreur, même si on change les filtres
const IGNORE = ['node_modules', '.git', 'dist', 'build', 'google-cloud-sdk', 'y', 'snapshot.txt', 'history.txt', 'update.txt', '.env'];

function buildTree(dir, prefix = '') {
    let structure = '';
    try {
        const items = fs.readdirSync(dir).filter(i => !IGNORE.includes(i));
        items.sort();
        items.forEach((item, index) => {
            const isLast = index === items.length - 1;
            const fullPath = path.join(dir, item);
            let isDir = false;
            try { isDir = fs.statSync(fullPath).isDirectory(); } catch(e) {}
            
            structure += prefix + (isLast ? '└── ' : '├── ') + item + (isDir ? '/' : '') + '\n';
            if (isDir) structure += buildTree(fullPath, prefix + (isLast ? '    ' : '│   '));
        });
    } catch (e) {}
    return structure;
}

function captureContent(dir, baseDir = "") {
    let content = "";
    try {
        const items = fs.readdirSync(dir).filter(i => !IGNORE.includes(i));
        for (const item of items) {
            const p = path.join(dir, item);
            const rel = path.join(baseDir, item);
            let stat;
            try { stat = fs.statSync(p); } catch(e) { continue; }

            if (stat.isDirectory()) {
                content += captureContent(p, rel);
            } else {
                const ext = path.extname(item).toLowerCase();
                // AJOUT DES EXTENSIONS MANQUANTES (.cjs, .mjs, .html, .md)
                if (['.js', '.jsx', '.css', '.json', '.html', '.cjs', '.mjs', '.md'].includes(ext)) {
                    try {
                        const fileContent = fs.readFileSync(p, 'utf8');
                        // Petite sécurité : on ne prend pas les fichiers trop énormes (> 500ko) pour ne pas saturer
                        if (fileContent.length < 500000) {
                            content += `\n### FILE: ${rel}\n${fileContent}\n`;
                        } else {
                            content += `\n### FILE: ${rel}\n(Fichier trop volumineux - ignoré)\n`;
                        }
                    } catch (e) {}
                }
            }
        }
    } catch (e) {}
    return content;
}

async function run() {
    console.log("📸 Snapshot de sécurité (Extensions étendues)...");
    const tree = buildTree(__dirname);
    const code = captureContent(__dirname);
    
    const finalContent = `STRUCTURE:\n${tree}\n\nCODE:\n${code}`;
    
    fs.writeFileSync(OUTPUT_FILENAME, finalContent);
    fs.writeFileSync(MAP_FILENAME, tree);
    console.log(`✨ Terminé. Snapshot généré (${(finalContent.length / 1024).toFixed(2)} KB).`);
}
run();