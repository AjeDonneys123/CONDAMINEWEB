const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OUTPUT_FILENAME = 'snapshot.txt';
const MAP_FILENAME = 'projectMap.txt';
const IGNORE = ['node_modules', '.git', 'dist', 'google-cloud-sdk', 'y', 'snapshot.txt', 'history.txt', 'update.txt'];

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
            if (fs.statSync(p).isDirectory()) content += captureContent(p, rel);
            else if (['.js', '.jsx', '.css', '.json'].includes(path.extname(item))) {
                content += `\n### FILE: ${rel}\n${fs.readFileSync(p, 'utf8')}\n`;
            }
        }
    } catch (e) {}
    return content;
}

async function run() {
    console.log("📸 Snapshot de sécurité...");
    const tree = buildTree(__dirname);
    const code = captureContent(__dirname);
    fs.writeFileSync(OUTPUT_FILENAME, `STRUCTURE:\n${tree}\n\nCODE:\n${code}`);
    fs.writeFileSync(MAP_FILENAME, tree);
    console.log("✨ Terminé. Structure CondaClasse préservée.");
}
run();