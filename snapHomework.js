// @signatures: capturePaths, extractStories, run
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = 'homework.txt';
const STORIES_FILE = 'userStories.txt';

// 1. FICHIERS SÉCURISÉS (Silo Homework)
// Ces fichiers contiennent la logique métier exclusive aux devoirs.
const PROTECTED_PATHS = [
    'server/domains/homework',
    'server/prof/homework',
    'client/src/features/prof/homework'
];

// 2. FICHIERS À RISQUE (Points de contact partagés)
// Ces fichiers sont critiques car utilisés par Studio, Structure ou Games.
const RISK_PATHS = [
    'client/src/features/prof/components/StudioDistributionSidebar.jsx', // Partagé avec Games
    'client/src/features/prof/components/ProfStudioFolder.jsx',          // Partagé avec Structure/Games
    'server/prof/models/prof.models.js',                                 // Schémas Globaux
    'server/server.js'                                                   // Routes Globales
];

function extractStories(keyword) {
    if (!fs.existsSync(STORIES_FILE)) return "⚠️ User Stories introuvables.";
    const lines = fs.readFileSync(STORIES_FILE, 'utf8').split('\n');
    let start = -1, end = lines.length;
    for (let i = 0; i < lines.length; i++) {
        // Détection de la section (ex: 📜 RÉFÉRENTIEL... HOMEWORK)
        if (lines[i].includes('📜') && lines[i].toUpperCase().includes(keyword.toUpperCase())) {
            start = i;
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].includes('📜')) { end = j; break; }
            }
            break;
        }
    }
    return start !== -1 ? lines.slice(start, end).join('\n').trim() : `⚠️ Aucune story trouvée pour ${keyword}.`;
}

function capturePaths(paths) {
    let content = "";
    paths.forEach(p => {
        const fullPath = path.join(__dirname, p);
        if (!fs.existsSync(fullPath)) return;

        if (fs.statSync(fullPath).isDirectory()) {
            const files = fs.readdirSync(fullPath);
            files.forEach(f => {
                if (f.startsWith('.')) return; // Ignore cachés
                
                const fPath = path.join(p, f).replace(/\\/g, '/');
                const absoluteFPath = path.join(__dirname, fPath);
                
                if (fs.existsSync(absoluteFPath) && fs.statSync(absoluteFPath).isFile()) {
                    const code = fs.readFileSync(absoluteFPath, 'utf8');
                    content += `\n[[[£ FILE: ${fPath} £]]]\n${code}\n[[[£ END: ${fPath} £]]]\n`;
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
    console.log("📚 GÉNÉRATION SNAPSHOT : HOMEWORK");
    console.log("------------------------------------------------");
    
    // 1. Extraction des Stories HOMEWORK
    const stories = extractStories('HOMEWORK'); 
    
    // 2. Capture du Code
    const protectedCode = capturePaths(PROTECTED_PATHS);
    const riskCode = capturePaths(RISK_PATHS);

    const report = `
================================================================================
📜 USER STORIES (HOMEWORK)
================================================================================
${stories}

================================================================================
🛡️ FICHIERS SÉCURISÉS (SILO HOMEWORK)
================================================================================
${protectedCode}

================================================================================
⚠️ FICHIERS À RISQUE (PARTAGÉS)
================================================================================
Ceux-ci peuvent casser les devoirs s'ils sont modifiés pour les jeux ou la structure.
${riskCode}
`;

    fs.writeFileSync(OUTPUT_FILE, report);
    console.log(`✅ Snapshot créé avec succès : ${OUTPUT_FILE}`);
    console.log("------------------------------------------------");
}

run();
