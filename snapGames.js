// @signatures: capturePaths, extractStories, run
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = 'games.txt';
const STORIES_FILE = 'userStories.txt';

// 1. FICHIERS SÉCURISÉS (Silo Games)
const PROTECTED_PATHS = [
    'server/domains/games',
    'server/eleve/games',
    'client/src/features/eleve/games',
    'client/src/features/eleve/components/DashboardFolder.jsx' // Affichage des jeux
];

// 2. FICHIERS À RISQUE (Modèles)
const RISK_PATHS = [
    'server/models/Game.js',
    'server/models/GameLevel.js',
    'server/models/GameProgress.js',
    'server/prof/models/prof.models.js'
];

function extractStories(keyword) {
    if (!fs.existsSync(STORIES_FILE)) return "⚠️ User Stories introuvables.";
    const lines = fs.readFileSync(STORIES_FILE, 'utf8').split('\n');
    let start = -1, end = lines.length;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('📜') && lines[i].toUpperCase().includes(keyword.toUpperCase())) {
            start = i;
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].includes('📜')) { end = j; break; }
            }
            break;
        }
    }
    return start !== -1 ? lines.slice(start, end).join('\n').trim() : `⚠️ Aucune story pour ${keyword}.`;
}

function capturePaths(paths) {
    let content = "";
    paths.forEach(p => {
        const fullPath = path.join(__dirname, p);
        if (!fs.existsSync(fullPath)) return;

        if (fs.statSync(fullPath).isDirectory()) {
            const files = fs.readdirSync(fullPath);
            files.forEach(f => {
                if (f.startsWith('.')) return;
                const subRelPath = path.join(p, f).replace(/\\/g, '/');
                const subFullPath = path.join(__dirname, subRelPath);
                if (fs.existsSync(subFullPath) && fs.statSync(subFullPath).isFile()) {
                    const code = fs.readFileSync(subFullPath, 'utf8');
                    content += `\n[[[£ FILE: ${subRelPath} £]]]\n${code}\n[[[£ END: ${subRelPath} £]]]\n`;
                }
            });
        } else {
            const code = fs.readFileSync(fullPath, 'utf8');
            const relPath = p.replace(/\\/g, '/');
            content += `\n[[[£ FILE: ${relPath} £]]]\n${code}\n[[[£ END: ${relPath} £]]]\n`;
        }
    });
    return content;
}

function run() {
    console.log("------------------------------------------------");
    console.log("🎮 GÉNÉRATION SNAPSHOT : GAMES");
    console.log("------------------------------------------------");
    
    const stories = extractStories('GAMES'); 
    const protectedCode = capturePaths(PROTECTED_PATHS);
    const riskCode = capturePaths(RISK_PATHS);

    const report = `
================================================================================
📜 USER STORIES (GAMES)
================================================================================
${stories}

================================================================================
🛡️ FICHIERS SÉCURISÉS (SILO GAMES)
================================================================================
${protectedCode}

================================================================================
⚠️ FICHIERS À RISQUE (MODÈLES PARTAGÉS)
================================================================================
${riskCode}
`;

    fs.writeFileSync(OUTPUT_FILE, report);
    console.log(`✅ ${OUTPUT_FILE} généré.`);
}

run();
