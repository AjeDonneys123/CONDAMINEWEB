// @signatures: buildTree, captureContent, run, isStructureFile, isStudioFile, isGamesFile, extractStories
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OUTPUT_FILENAME = 'snapshot.txt';
const STRUCTURE_FILENAME = 'structure.txt';
const STUDIO_FILENAME = 'studio.txt'; 
const GAMES_FILENAME = 'games.txt'; 
const MAP_FILENAME = 'projectMap.txt';
const STORIES_FILENAME = 'userStories.txt';

const IGNORE = [
    'node_modules', '.git', 'dist', 'build', 
    'snapshot.txt', 'structure.txt', 'studio.txt', 'games.txt', 
    'update.txt', '.env', 'package-lock.json', 'projectMap.txt'
];

// Définition du paquet STRUCTURE
const STRUCTURE_BUNDLE = [
    'server/domains/structure', 
    'server/prof/structure', 
    'client/src/features/prof/components/ProfStudioFolder.jsx'
];

// Définition du paquet STUDIO (Front, Back, Models)
const STUDIO_BUNDLE = [
    'server/domains/studio',
    'server/prof/studio',
    'client/src/features/prof/studio',
    'server/models/StudioProject.js'
];

// Définition du paquet GAMES (Quiz, Zombie, Starship)
const GAMES_BUNDLE = [
    'server/domains/games',
    'server/prof/games',
    'server/eleve/games',
    'client/src/features/prof/games',
    'client/src/features/eleve/games',
    'server/models/Game.js',
    'server/models/GameLevel.js',
    'server/models/GameProgress.js'
];

function isStructureFile(filePath) {
    return STRUCTURE_BUNDLE.some(p => filePath.includes(p));
}

function isStudioFile(filePath) {
    return STUDIO_BUNDLE.some(p => filePath.includes(p));
}

function isGamesFile(filePath) {
    return GAMES_BUNDLE.some(p => filePath.includes(p));
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

function captureContent(dir, baseDir = "", filterFn = null) {
    let content = "";
    try {
        const items = fs.readdirSync(dir).filter(i => !IGNORE.includes(i));
        for (const item of items) {
            const p = path.join(dir, item);
            const rel = path.join(baseDir, item).replace(/\\/g, '/');
            const stat = fs.statSync(p);
            
            if (stat.isDirectory()) {
                content += captureContent(p, rel, filterFn);
            } else {
                if (filterFn && !filterFn(rel)) continue;

                const ext = path.extname(item).toLowerCase();
                if (['.js', '.jsx', '.css', '.json', '.html', '.md', '.txt'].includes(ext)) {
                    if (rel === STORIES_FILENAME || rel === OUTPUT_FILENAME || rel === STRUCTURE_FILENAME || rel === STUDIO_FILENAME || rel === GAMES_FILENAME || rel === MAP_FILENAME) continue;
                    const fileContent = fs.readFileSync(p, 'utf8');
                    content += `\n[[[£ FILE: ${rel} £]]]\n${fileContent}\n[[[£ END: ${rel} £]]]\n`;
                }
            }
        }
    } catch (e) {}
    return content;
}

// 🧠 EXTRACTION INTELLIGENTE DES USER STORIES
function extractStories(fullText, keyword) {
    if (!fullText) return `⚠️ User Stories non chargées (Fichier ${STORIES_FILENAME} manquant)`;
    
    const lines = fullText.split('\n');
    let start = -1;
    let end = lines.length;

    for (let i = 0; i < lines.length; i++) {
        // Détection du début : Ligne contenant le parchemin ET le mot clé (ex: GAMES)
        if (lines[i].includes('📜') && lines[i].toUpperCase().includes(keyword.toUpperCase())) {
            // On remonte pour prendre la barre de séparation (===) si elle est juste avant
            if (i > 0 && lines[i-1].startsWith('====')) start = i - 1;
            else start = i;

            // Recherche de la fin (Prochaine section 📜 ou fin de fichier)
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].includes('📜')) {
                    // On s'arrête à la barre de séparation précédente
                    if (lines[j-1].startsWith('====')) end = j - 1;
                    else end = j;
                    break;
                }
            }
            break;
        }
    }

    if (start === -1) return `⚠️ [SNAP] Aucune section trouvée pour : ${keyword} dans ${STORIES_FILENAME}`;
    
    return lines.slice(start, end).join('\n').trim();
}

function run() {
    console.log("📚 Chargement des User Stories...");
    let allStories = "";
    if (fs.existsSync(STORIES_FILENAME)) {
        allStories = fs.readFileSync(STORIES_FILENAME, 'utf8');
    } else {
        console.warn(`⚠️ Fichier ${STORIES_FILENAME} introuvable.`);
    }

    console.log("📸 Génération du Snapshot Global...");
    const tree = buildTree(__dirname);
    const fullCode = captureContent(__dirname, "", null);
    fs.writeFileSync(OUTPUT_FILENAME, `STRUCTURE:\n${tree}\n\nCODE:\n${fullCode}`);
    fs.writeFileSync(MAP_FILENAME, tree);

    // --- SNAPSHOT STRUCTURE ---
    console.log("📂 Génération du Snapshot STRUCTURE...");
    const structureStories = extractStories(allStories, 'STRUCTURE');
    const structureCode = captureContent(__dirname, "", isStructureFile);
    fs.writeFileSync(STRUCTURE_FILENAME, `${structureStories}\n\n================================================================================\n💻 CODE SOURCE - MODULE STRUCTURE\n================================================================================\n${structureCode}`);

    // --- SNAPSHOT STUDIO ---
    console.log("🎬 Génération du Snapshot STUDIO...");
    const studioStories = extractStories(allStories, 'STUDIO');
    const studioCode = captureContent(__dirname, "", isStudioFile);
    fs.writeFileSync(STUDIO_FILENAME, `${studioStories}\n\n================================================================================\n💻 CODE SOURCE - MODULE STUDIO\n================================================================================\n${studioCode}`);

    // --- SNAPSHOT GAMES ---
    console.log("🎮 Génération du Snapshot GAMES...");
    const gamesStories = extractStories(allStories, 'GAMES');
    const gamesCode = captureContent(__dirname, "", isGamesFile);
    fs.writeFileSync(GAMES_FILENAME, `${gamesStories}\n\n================================================================================\n💻 CODE SOURCE - MODULE GAMES\n================================================================================\n${gamesCode}`);

    console.log(`✨ Terminé :`);
    console.log(`   - ${OUTPUT_FILENAME} (Global)`);
    console.log(`   - ${STRUCTURE_FILENAME} (Structure + Stories)`);
    console.log(`   - ${STUDIO_FILENAME} (Studio + Stories)`);
    console.log(`   - ${GAMES_FILENAME} (Games + Stories)`);
}

run();
