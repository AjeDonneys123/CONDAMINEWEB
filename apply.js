const fs = require('fs');
const path = require('path');
const inputFile = 'update.txt';
const statusFile = 'apply_status.json';

function setStatus(status, file = null) {
    try { fs.writeFileSync(statusFile, JSON.stringify({ status, file, timestamp: Date.now() }, null, 2)); } catch (e) {}
}

function applyUpdate() {
    if (!fs.existsSync(inputFile)) return;
    let rawContent = "";
    try { rawContent = fs.readFileSync(inputFile, 'utf8'); } catch (e) { return; }
    if (rawContent.trim().length < 5) return;

    const startRegex = /\[\[\[£\s*FILE\s*:\s*([^£\]\s]+)\s*£\]\]\]/g;
    let startMatch;
    let processed = false;

    while ((startMatch = startRegex.exec(rawContent)) !== null) {
        const filePath = startMatch[1].trim();
        const contentStart = startMatch.index + startMatch[0].length;
        const endPattern = new RegExp(`\\[\\[\\[£\\s*END\\s*:\\s*${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*£\\]\\]\\]`);
        const remaining = rawContent.substring(contentStart);
        const endMatch = remaining.match(endPattern);

        if (endMatch) {
            const fileContent = remaining.substring(0, endMatch.index).trim();
            const fullPath = path.join(__dirname, filePath);
            if (!fs.existsSync(path.dirname(fullPath))) fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, fileContent);
            processed = true;
        } else {
            setStatus('TRUNCATED', filePath);
            return;
        }
    }
    if (processed) { fs.writeFileSync(inputFile, ''); setStatus('OK'); }
}
setInterval(applyUpdate, 1000);