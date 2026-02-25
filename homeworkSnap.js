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
                    content += `\n