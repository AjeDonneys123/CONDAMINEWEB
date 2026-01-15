const fs = require('fs');
const path = require('path');

const inputFile = 'update.txt';
const statusFile = 'apply_status.json';

const PROTECTED_PATHS = ['.git', 'node_modules', 'apply.js', 'package.json', '.env', 'server/server.js'];

function setStatus(status, file = null) {
    try {
        const data = { status, file, timestamp: Date.now() };
        fs.writeFileSync(statusFile, JSON.stringify(data, null, 2));
    } catch (e) {}
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyUpdate() {
    if (!fs.existsSync(inputFile)) return;
    let rawContent = "";
    try { rawContent = fs.readFileSync(inputFile, 'utf8'); } catch (e) { return; }
    
    if (rawContent.trim().length < 5) return;

    let processedAny = false;

    const startRegex = /\[\[\[£\s*FILE\s*:\s*([^£\]\s]+)\s*£\]\]\]/g;
    let startMatch;

    while ((startMatch = startRegex.exec(rawContent)) !== null) {
        const filePath = startMatch[1].trim();
        const contentStartIndex = startMatch.index + startMatch[0].length;
        
        const safePath = escapeRegExp(filePath);
        const endPattern = new RegExp(`\\[\\[\\[£\\s*END\\s*:\\s*${safePath}\\s*£\\]\\]\\]`);
        
        const remainingText = rawContent.substring(contentStartIndex);
        const endMatch = remainingText.match(endPattern);

        if (endMatch) {
            const fileContent = remainingText.substring(0, endMatch.index).trim();
            const fullPath = path.join(__dirname, filePath);
            const dir = path.dirname(fullPath);

            try {
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(fullPath, fileContent);
                console.log(`   ✅ APPLIQUÉ : ${filePath}`);
                processedAny = true;
            } catch (e) {
                console.error(`   ❌ ERREUR FILE ${filePath}: ${e.message}`);
            }
        } else {
            console.warn(`⚠️ [COUPURE] Sur : ${filePath}`);
            setStatus('TRUNCATED', filePath);
            fs.writeFileSync(inputFile, '');
            return;
        }
    }

    if (processedAny) {
        fs.writeFileSync(inputFile, '');
        setStatus('OK');
    }
}

setStatus('OK');
setInterval(applyUpdate, 1000);