const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OUTPUT_FILENAME = 'snapshot.txt';
const MAP_FILENAME = 'projectMap.txt';
const IGNORE = [
    'node_modules', '.git', 'dist', 'build', 'snapshot.txt', 'update.txt', 
    '.env', 'package-lock.json', '${rel}', 'path', 'chemin'
];

function buildTree(dir, prefix = '') {
    let structure = '';
    try {
        const items = fs.readdirSync(dir).filter(i => !IGNORE.includes(i));
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
        const items = fs.readdirSync(dir).filter(i => !IGNORE.includes(i));
        for (const item of items) {
            const p = path.join(dir, item);
            const rel = path.join(baseDir, item);
            const stat = fs.statSync(p);
            if (stat.isDirectory()) {
                content += captureContent(p, rel);
            } else {
                const ext = path.extname(item).toLowerCase();
                if (['.js', '.jsx', '.css', '.json', '.html', '.md'].includes(ext)) {
                    const fileContent = fs.readFileSync(p, 'utf8');
                    content += `\n[[[£ FILE: ${rel} £]]]\n${fileContent}\n[[[£ END: ${rel} £]]]\n`;
                }
            }
        }
    } catch (e) {}
    return content;
}

function run() {
    console.log("📸 Génération du Snapshot Optimum...");
    const tree = buildTree(__dirname);
    const code = captureContent(__dirname);
    const finalContent = `STRUCTURE:\n${tree}\n\nCODE:\n${code}`;
    fs.writeFileSync(OUTPUT_FILENAME, finalContent);
    fs.writeFileSync(MAP_FILENAME, tree);
    console.log(`✨ Terminé : ${OUTPUT_FILENAME} est le miroir parfait du projet.`);
}
run();
