const fs = require('fs');
const path = require('path');

const OUTPUT_FILENAME = 'snapshot.txt';
const IGNORE_LIST = [
    'node_modules', '.git', 'dist', '.vscode', '.DS_Store', 
    'package-lock.json', 'snapshot.txt', 'PROJET_BACKUP.zip',
    'PROJET_POUR_IA.txt', 'PROJET_SNAPSHOT.txt', 'SNAPSHOT_CODE.txt', 'SNAPSHOT_FULL.txt'
];
const EXTENSIONS = ['.js', '.jsx', '.css', '.html', '.json', '.env', '.md'];

function buildTree(dir, prefix = '') {
    let structure = '';
    const items = fs.readdirSync(dir).filter(item => !IGNORE_LIST.includes(item));
    items.forEach((item, index) => {
        const isLast = index === items.length - 1;
        const fullPath = path.join(dir, item);
        let isDir = false;
        try { isDir = fs.statSync(fullPath).isDirectory(); } catch(e) {}
        
        structure += prefix + (isLast ? '└── ' : '├── ') + item + (isDir ? '/' : '') + '\n';
        if (isDir) structure += buildTree(fullPath, prefix + (isLast ? '    ' : '│   '));
    });
    return structure;
}

function captureContent(dir, baseDir = "") {
    let content = "";
    const items = fs.readdirSync(dir).filter(item => !IGNORE_LIST.includes(item));
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.join(baseDir, item);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
            content += captureContent(fullPath, relativePath);
        } else {
            const ext = path.extname(item).toLowerCase();
            if (EXTENSIONS.includes(ext) || item === '.env') {
                try {
                    const data = fs.readFileSync(fullPath, 'utf8');
                    content += "\n" + "#".repeat(60) + "\n";
                    content += "### FICHIER: " + relativePath + "\n";
                    content += "#".repeat(60) + "\n\n";
                    content += data + "\n\n";
                } catch (e) {}
            }
        }
    }
    return content;
}

function run() {
    console.log("📸 Génération du Snapshot Propre...");
    let output = "ARBORESCENCE\n" + "=".repeat(20) + "\n\n.\n";
    output += buildTree(__dirname);
    output += "\n" + "=".repeat(60) + "\n";
    output += "CODE SOURCE COMPLET\n";
    output += "=".repeat(60) + "\n\n";
    output += captureContent(__dirname);
    fs.writeFileSync(OUTPUT_FILENAME, output);
    console.log("✅ snapshot.txt mis à jour !");
}
run();