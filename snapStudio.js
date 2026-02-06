// @signatures: capturePaths, extractStories, run
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = 'studio.txt';
const STORIES_FILE = 'userStories.txt';

// 1. FICHIERS SÉCURISÉS (Silo Studio)
const PROTECTED_PATHS = [
    'server/domains/studio',
    'server/prof/studio',
    'client/src/features/prof/studio',
    'server/models/StudioProject.js'
];

// 2. FICHIERS À RISQUE (Points de contact partagés)
// Le Studio interagit avec les dossiers (Structure) et la distribution (Homework/Games)
const RISK_PATHS = [
    'client/src/features/prof/components/ProfStudioFolder.jsx',          // Navigation Dossiers
    'client/src/features/prof/components/StudioDistributionSidebar.jsx', // Distribution Élèves
    'server/prof/models/prof.models.js',                                 // Schémas Globaux
    'server/server.js'                                                   // Routes Globales
];

function extractStories(keyword) {
    if (!fs.existsSync(STORIES_FILE)) return "⚠️ User Stories introuvables.";
    const lines = fs.readFileSync(STORIES_FILE, 'utf8').split('\n');
    let start = -1, end = lines.length;
    for (let i = 0; i < lines.length; i++) {
        // Détection de la section (ex: 📜 RÉFÉRENTIEL... STUDIO)
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
                if (f.startsWith('.')) return;
                
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
    console.log("🎬 GÉNÉRATION SNAPSHOT : STUDIO");
    console.log("------------------------------------------------");
    
    // 1. Extraction des Stories STUDIO
    const stories = extractStories('STUDIO'); 
    
    // 2. Capture du Code
    const protectedCode = capturePaths(PROTECTED_PATHS);
    const riskCode = capturePaths(RISK_PATHS);

    const report = `
================================================================================
📜 USER STORIES (STUDIO)
================================================================================
${stories}

================================================================================
🛡️ FICHIERS SÉCURISÉS (SILO STUDIO)
================================================================================
${protectedCode}

================================================================================
⚠️ FICHIERS À RISQUE (PARTAGÉS)
================================================================================
Composants utilisés par d'autres modules (Structure, Games, Homework).
${riskCode}
`;

    fs.writeFileSync(OUTPUT_FILE, report);
    console.log(`✅ Snapshot créé avec succès : ${OUTPUT_FILE}`);
}

run();
