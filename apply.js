const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const statusFile = 'apply_status.json';
const inputFile = 'update.txt';

/**
 * 🛡️ APPLY.JS V9.8 - UNLIMITED FLEXIBILITY
 * - Suppression totale des restrictions de bundles.
 * - Commit Git automatique après chaque succès.
 */

function writeStatus(type, message) {
    const data = { status: type, message, timestamp: Date.now() };
    try { fs.writeFileSync(statusFile, JSON.stringify(data, null, 2)); } catch(e) {}
}

function applyUpdate() {
    try {
        if (!fs.existsSync(inputFile)) return;
        const rawContent = fs.readFileSync(inputFile, 'utf8');
        if (!rawContent || rawContent.length < 10) return;

        const appliedFiles = [];
        fs.writeFileSync(inputFile, ''); 
        
        const startRegex = /\[\[\[£\s*FILE\s*:\s*([^£\s\]]+)\s*£\]\]\]/g;
        let match;

        while ((match = startRegex.exec(rawContent)) !== null) {
            const filePath = match[1].trim();
            const startIdx = match.index + match[0].length;
            const endTag = `[[[£ END: ${filePath} £]]]`;
            const endIdx = rawContent.indexOf(endTag, startIdx);

            if (endIdx !== -1) {
                let newContent = rawContent.substring(startIdx, endIdx).trim();
                const fullPath = path.join(__dirname, filePath);
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                
                if (filePath.toLowerCase().endsWith('history.txt')) {
                    fs.appendFileSync(fullPath, '\n' + newContent + '\n');
                } else {
                    fs.writeFileSync(fullPath, newContent + '\n');
                }
                console.log(`✅ APPLIED: ${filePath}`);
                appliedFiles.push(filePath);
            }
        }

        if (appliedFiles.length > 0) {
            try {
                const commitMsg = `Auto-Update: ${appliedFiles.length} files changed.`;
                execSync('git add .');
                execSync(`git commit -m "${commitMsg}"`);
                console.log(`📦 [GIT] Commit auto effectué.`);
            } catch (err) { }
        }

        writeStatus('OK', 'Infrastructure mise à jour');
    } catch (e) {
        console.log(`💥 ERREUR APPLY : ${e.message}`);
        writeStatus('ERROR', e.message);
    }
}

setInterval(applyUpdate, 500);
console.log("🛡️ ARCHITECTE V9.8 - DÉBRIDÉ & COMMIT AUTO ACTIF");
