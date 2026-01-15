const fs = require('fs');
const path = require('path');
const inputFile = 'update.txt';
const statusFile = 'apply_status.json';

console.log("------------------------------------------------");
console.log("🤖 [CONSTITUTION] apply.js v31 actif.");
console.log("🚀 Correction Boucle Sync - Build #368");
console.log("------------------------------------------------");

function setStatus(status, file = null) {
    try { fs.writeFileSync(statusFile, JSON.stringify({ status, file, timestamp: Date.now() }, null, 2)); } catch (e) {}
}

function applyUpdate() {
    if (!fs.existsSync(inputFile)) return;
    let rawContent = "";
    try { rawContent = fs.readFileSync(inputFile, 'utf8'); } catch (e) { return; }
    if (rawContent.trim().length < 10) return;

    let processed = false;
    const startRegex = /\[\[\[£\s*FILE\s*:\s*([^£\]\s]+)\s*£\]\]\]/g;
    let startMatch;

    while ((startMatch = startRegex.exec(rawContent)) !== null) {
        const filePath = startMatch[1].trim();
        const contentStartIndex = startMatch.index + startMatch[0].length;
        const endTag = `[[[£ END: ${filePath} £]]]`;
        const endIdx = rawContent.indexOf(endTag);

        if (endIdx !== -1) {
            const fileContent = rawContent.substring(contentStartIndex, endIdx).trim();
            const fullPath = path.join(__dirname, filePath);
            if (!fs.existsSync(path.dirname(fullPath))) fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, fileContent);
            console.log(`   ✅ ALIGNÉ : ${filePath}`);
            processed = true;
        }
    }
    if (processed) {
        fs.writeFileSync(inputFile, '');
        setStatus('OK');
        console.log("✨ SYNC TERMINÉE.");
    }
}
setStatus('OK');
setInterval(applyUpdate, 1000);