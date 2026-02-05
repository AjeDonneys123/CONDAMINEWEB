// @signatures: capturePaths, extractStories, run
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = 'homework.txt';
const STORIES_FILE = 'userStories.txt';

// 1. LES FICHIERS PROTÉGÉS (Silo pur)
const HOMEWORK_PATHS = [
    'server/domains/homework',
    'server/prof/homework',
    'client/src/features/prof/homework'
];

// 2. LES FICHIERS DANGEREUX (Points de contact partagés)
const DANGER_PATHS = [
    'client/src/features/prof/components/StudioDistributionSidebar.jsx',
    'client/src/features/prof/components/ProfStudioFolder.jsx',
    'server/prof/models/prof.models.js',
    'server/server.js'
];

function extractStories(keyword) {
    if (!fs.existsSync(STORIES_FILE)) return "⚠️ User Stories introuvables.";
    const lines = fs.readFileSync(STORIES_FILE, 'utf8').split('\n');
    let start = -1, end = lines.length;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('📜') && lines[i].toUpperCase().includes(keyword.toUpperCase())) {
            start = i;
            for (let j = i + 1; j < lines.length; j++) {
                if (lines[j] && lines[j].includes('📜')) { end = j; break; }
            }
            break;
        }
    }
    return start !== -1 ? lines.slice(start, end).join('\n').trim() : "Aucune story trouvée.";
}

function capturePaths(paths) {
    let content = "";
    paths.forEach(p => {
        const fullPath = path.join(__dirname, p);
        if (!fs.existsSync(fullPath)) return;

        if (fs.statSync(fullPath).isDirectory()) {
            const files = fs.readdirSync(fullPath);
            files.forEach(f => {
                const fPath = path.join(p, f);
                const absoluteFPath = path.join(__dirname, fPath);
                if (fs.existsSync(absoluteFPath) && fs.statSync(absoluteFPath).isFile()) {
                    const code = fs.readFileSync(absoluteFPath, 'utf8');
                    content += `\n[[[£ FILE: ${fPath.replace(/\\/g, '/')} £]]]\n${code}\n[[[£ END: ${fPath.replace(/\\/g, '/')} £]]]\n`;
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
    console.log("🔒 GÉNÉRATION DU SNAPSHOT DE PROTECTION HOMEWORK");
    console.log("------------------------------------------------");
    
    const stories = extractStories('STRUCTURE'); 
    const homeworkCode = capturePaths(HOMEWORK_PATHS);
    const dangerCode = capturePaths(DANGER_PATHS);

    const report = `
================================================================================
📜 RÉFÉRENTIEL FONCTIONNEL (HOMEWORK)
================================================================================
${stories}

================================================================================
🛡️ FICHIERS PROTÉGÉS (SILO HOMEWORK)
================================================================================
${homeworkCode}

================================================================================
⚠️ FICHIERS DANGEREUX (COMPOSANTS PARTAGÉS)
================================================================================
Ceux-ci peuvent casser les devoirs s'ils sont modifiés pour les jeux ou la structure.
${dangerCode}
`;

    fs.writeFileSync(OUTPUT_FILE, report);
    console.log(`✅ Snapshot créé avec succès : ${OUTPUT_FILE}`);
    console.log(`🚀 Tu peux maintenant taper : git checkout -b stable-homework`);
    console.log("------------------------------------------------");
}

run();
