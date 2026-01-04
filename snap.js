const fs = require('fs');
const path = require('path');

const OUTPUT_FILENAME = 'snapshot.txt';
const MAP_FILENAME = 'projectMap.txt';

const IGNORE_LIST = [
    'node_modules', '.git', 'dist', '.vscode', '.DS_Store', 
    'package-lock.json', 'snapshot.txt', 'PROJET_BACKUP.zip',
    'PROJET_POUR_IA.txt', 'PROJET_SNAPSHOT.txt', 'SNAPSHOT_CODE.txt', 'SNAPSHOT_FULL.txt',
    'history.txt', 'update.txt'
];
const EXTENSIONS = ['.js', '.jsx', '.css', '.html', '.json', '.env', '.md'];

// Balises exactes pour projectMap.txt
const START_TAG = "@@@     ARBORESSENCE  @@@";
const END_TAG = "@@@     FIN DE L ARBORESCENCE  @@@";

function buildTree(dir, prefix = '') {
    let structure = '';
    try {
        const items = fs.readdirSync(dir).filter(item => !IGNORE_LIST.includes(item));
        
        // On trie : Dossiers d'abord, puis fichiers
        items.sort((a, b) => {
            const aIsDir = fs.statSync(path.join(dir, a)).isDirectory();
            const bIsDir = fs.statSync(path.join(dir, b)).isDirectory();
            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;
            return a.localeCompare(b);
        });

        items.forEach((item, index) => {
            const isLast = index === items.length - 1;
            const fullPath = path.join(dir, item);
            let isDir = false;
            try { isDir = fs.statSync(fullPath).isDirectory(); } catch(e) {}
            
            structure += prefix + (isLast ? '└── ' : '├── ') + item + (isDir ? '/' : '') + '\n';
            if (isDir) {
                structure += buildTree(fullPath, prefix + (isLast ? '    ' : '│   '));
            }
        });
    } catch (e) {
        structure += prefix + "!!! Erreur de lecture !!!\n";
    }
    return structure;
}

function captureContent(dir, baseDir = "") {
    let content = "";
    try {
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
                        content += "#".repeat(60) + "\n\n" + data + "\n\n";
                    } catch (e) {}
                }
            }
        }
    } catch (e) {}
    return content;
}

function updateProjectMap(tree) {
    if (!fs.existsSync(MAP_FILENAME)) {
        console.log(`⚠️ ${MAP_FILENAME} n'existe pas. Création...`);
        fs.writeFileSync(MAP_FILENAME, `${START_TAG}\n${tree}\n${END_TAG}\n\n==Project MAP==\n(Généré automatiquement)`);
        console.log(`✅ ${MAP_FILENAME} créé.`);
        return;
    }

    let content = fs.readFileSync(MAP_FILENAME, 'utf8');
    
    // Recherche des balises
    const startIndex = content.indexOf(START_TAG);
    const endIndex = content.indexOf(END_TAG);

    if (startIndex === -1 || endIndex === -1) {
        console.log(`❌ Impossible de mettre à jour ${MAP_FILENAME} : Balises introuvables.`);
        console.log(`   Assurez-vous que le fichier contient "${START_TAG}" et "${END_TAG}".`);
        return;
    }

    // Remplacement du contenu entre les balises
    const before = content.substring(0, startIndex + START_TAG.length);
    const after = content.substring(endIndex);
    
    const newContent = before + "\n\n" + tree + "\n" + after;
    
    fs.writeFileSync(MAP_FILENAME, newContent);
    console.log(`✅ Arborescence injectée dans ${MAP_FILENAME} !`);
}

function run() {
    console.log("📸 Démarrage du scan...");
    
    // 1. Générer l'arbre
    const tree = buildTree(__dirname);
    
    // 2. Mettre à jour projectMap.txt
    updateProjectMap(tree);

    // 3. Générer snapshot.txt (Code complet pour backup/IA)
    let output = "ARBORESCENCE\n" + "=".repeat(20) + "\n\n.\n" + tree;
    output += "\n" + "=".repeat(60) + "\nCODE SOURCE COMPLET\n" + "=".repeat(60) + "\n\n" + captureContent(__dirname);
    fs.writeFileSync(OUTPUT_FILENAME, output);
    console.log(`✅ ${OUTPUT_FILENAME} généré (Backup complet).`);
}

run();