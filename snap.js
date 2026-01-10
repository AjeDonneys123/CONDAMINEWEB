const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OUTPUT_FILENAME = 'snapshot.txt';
const MAP_FILENAME = 'projectMap.txt';

const IGNORE_LIST = [
    'node_modules', '.git', 'dist', '.vscode', '.DS_Store', 
    'package-lock.json', 'snapshot.txt', 'PROJET_BACKUP.zip',
    'history.txt', 'update.txt', 'projectMap.txt'
];
const EXTENSIONS = ['.js', '.jsx', '.css', '.html', '.json', '.env', '.md'];

/**
 * 1. Génère l'arborescence standard
 */
function buildTree(dir, prefix = '') {
    let structure = '';
    try {
        const items = fs.readdirSync(dir).filter(item => !IGNORE_LIST.includes(item));
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
            if (isDir) structure += buildTree(fullPath, prefix + (isLast ? '    ' : '│   '));
        });
    } catch (e) { structure += prefix + "!!! Erreur !!!\n"; }
    return structure;
}

/**
 * 2. Capture le contenu des fichiers
 */
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
                    content += "\n############################################################\n";
                    content += `### FICHIER: ${relativePath}\n`;
                    content += "############################################################\n\n";
                    if (item === '.env') {
                        content += "MONGODB_URI=*****\nGEMINI_API_KEY=*****\n\n";
                    } else {
                        content += fs.readFileSync(fullPath, 'utf8') + "\n";
                    }
                }
            }
        }
    } catch (e) {}
    return content;
}

/**
 * 3. Demande à l'IA de générer la Project Map enrichie
 */
async function generateAIPage(snapshotContent) {
    console.log("🧠 [IA] Analyse du projet pour enrichir la map...");
    const fetch = (await import('node-fetch')).default;

    const prompt = `
    Tu es un architecte logiciel expert. Voici le code source complet de mon projet.
    
    TON TRAVAIL :
    1. Produis une arborescence ASCII (style tree).
    2. SOUS CHAQUE FICHIER dans l'arbre, ajoute exactement 2 lignes de résumé commençant par ">" expliquant son rôle technique et fonctionnel.
    3. En dessous de l'arbre, fais une section "INDEX DÉTAILLÉ" listant chaque fichier avec une explication plus longue (4-5 lignes).

    CODE SOURCE :
    ${snapshotContent}
    `;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    } catch (e) {
        console.error("❌ Erreur Gemini:", e.message);
        return "Erreur lors de la génération de la map par l'IA.";
    }
}

/**
 * 4. Lancement
 */
async function run() {
    console.log("📸 [1/3] Création du snapshot local...");
    const tree = buildTree(__dirname);
    const code = captureContent(__dirname);
    const fullSnapshot = `STRUCTURE\n${tree}\n\nCODE\n${code}`;
    fs.writeFileSync(OUTPUT_FILENAME, fullSnapshot);

    console.log("🌐 [2/3] Envoi à l'IA pour documentation...");
    const aiMap = await generateAIPage(fullSnapshot);

    console.log("📝 [3/3] Écriture de projectMap.txt...");
    fs.writeFileSync(MAP_FILENAME, aiMap);

    console.log(`✅ Terminé ! snapshot.txt est prêt et projectMap.txt a été enrichi par l'IA.`);
}

run();