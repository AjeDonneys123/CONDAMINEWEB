// @signatures: buildTree, captureContent, run, isStructureFile
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OUTPUT_FILENAME = 'snapshot.txt';
const STRUCTURE_FILENAME = 'structure.txt';
const MAP_FILENAME = 'projectMap.txt';
const STORIES_FILENAME = 'userStories.txt';

const IGNORE = [
    'node_modules', '.git', 'dist', 'build', 'snapshot.txt', 'structure.txt', 'update.txt', 
    '.env', 'package-lock.json', 'projectMap.txt'
];

// Définition du paquet STRUCTURE identique à apply.js
const STRUCTURE_BUNDLE = [
    'server/domains/structure', 
    'server/prof/structure', 
    'client/src/features/prof/components/ProfStudioFolder.jsx'
];

function isStructureFile(filePath) {
    return STRUCTURE_BUNDLE.some(p => filePath.includes(p));
}

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

function captureContent(dir, baseDir = "", onlyStructure = false) {
    let content = "";
    try {
        const items = fs.readdirSync(dir).filter(i => !IGNORE.includes(i));
        for (const item of items) {
            const p = path.join(dir, item);
            const rel = path.join(baseDir, item).replace(/\\/g, '/');
            const stat = fs.statSync(p);
            
            if (stat.isDirectory()) {
                content += captureContent(p, rel, onlyStructure);
            } else {
                if (onlyStructure && !isStructureFile(rel)) continue;

                const ext = path.extname(item).toLowerCase();
                if (['.js', '.jsx', '.css', '.json', '.html', '.md', '.txt'].includes(ext)) {
                    if (rel === OUTPUT_FILENAME || rel === STRUCTURE_FILENAME || rel === MAP_FILENAME) continue;
                    const fileContent = fs.readFileSync(p, 'utf8');
                    content += `\n[[[£ FILE: ${rel} £]]]\n${fileContent}\n[[[£ END: ${rel} £]]]\n`;
                }
            }
        }
    } catch (e) {}
    return content;
}

function run() {
    console.log("📸 Génération du Snapshot Global...");
    const tree = buildTree(__dirname);
    const fullCode = captureContent(__dirname, "", false);
    fs.writeFileSync(OUTPUT_FILENAME, `STRUCTURE:\n${tree}\n\nCODE:\n${fullCode}`);
    fs.writeFileSync(MAP_FILENAME, tree);

    console.log("📂 Génération du Snapshot STRUCTURE...");
    let stories = "";
    if (fs.existsSync(STORIES_FILENAME)) {
        // On récupère tout le contenu de userStories.txt car il est maintenant dédié à STRUCTURE
        stories = fs.readFileSync(STORIES_FILENAME, 'utf8');
    }
    
    const structureCode = captureContent(__dirname, "", true);
    
    const finalStructureContent = `${stories}

================================================================================
💻 CODE SOURCE - MODULE STRUCTURE
================================================================================
${structureCode}`;

    fs.writeFileSync(STRUCTURE_FILENAME, finalStructureContent);

    console.log(`✨ Terminé :`);
    console.log(`   - ${OUTPUT_FILENAME} (Total)`);
    console.log(`   - ${STRUCTURE_FILENAME} (Référentiel STRUCTURE + Code)`);
}

run();
