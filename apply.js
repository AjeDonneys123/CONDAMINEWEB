// @signatures: applyUpdate, checkCssDependency, checkDeepClassIntegrity, checkDomIntegrity, checkLogicDensity, countLogic, extractSignatures, getIds, saveDiff, snapshot, writeStatus
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inputFile = 'update.txt';
const statusFile = 'apply_status.json';
const diffFile = 'temp_diff.json';
const verdictFile = 'temp_verdict.json';

function writeStatus(type, message, details = null, context = null) {
    const data = { status: type, message, details, context, timestamp: Date.now() };
    try { fs.writeFileSync(statusFile, JSON.stringify(data, null, 2)); } catch(e) {}
}

function saveDiff(oldContent, newContent, filePath) {
    try { fs.writeFileSync(diffFile, JSON.stringify({ oldContent, newContent, filePath }));
    if (fs.existsSync(verdictFile)) fs.unlinkSync(verdictFile); } catch (e) {}
}

function snapshot(filesCount) {
    try { execSync('git add .'); execSync(`git commit -m "Safety Snapshot (${filesCount} files)"`); } catch (e) { }
}

// --- NOUVEAUX MOTEURS MATHÉMATIQUES V17 ---

function extractSignatures(content) {
    const sigs = new Set();
    const patterns = [
        /function\s+([a-zA-Z0-9_]+)/g,
        /const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(/g,
        /export\s+default\s+function\s+([a-zA-Z0-9_]+)/g
    ];
    patterns.forEach(regex => {
        let match;
        while ((match = regex.exec(content)) !== null) sigs.add(match[1]);
    });
    return sigs;
}

function checkDomIntegrity(oldContent, newContent) {
    const getIds = (text) => {
        const ids = new Set();
        let match;
        const regex = /id=['"]([^'"]+)['"]/g;
        while ((match = regex.exec(text))) ids.add(match[1]);
        return ids;
    };
    const oldIds = getIds(oldContent);
    const newIds = getIds(newContent);
    const missing = [...oldIds].filter(id => !newIds.has(id));
    return missing.length > 0 ? missing : null;
}

function checkLogicDensity(oldContent, newContent) {
    const logicKeywords = /\b(if|else|switch|case|return|await|async|map|filter|reduce|useEffect|useState|useRef)\b/g;
    const count = (text) => (text.match(logicKeywords) || []).length;
    const oldScore = count(oldContent);
    const newScore = count(newContent);
    if (oldScore > 10 && newScore < oldScore * 0.7) return { drop: Math.round((1 - newScore/oldScore)*100) };
    return null;
}

function applyUpdate() {
    try {
        if (!fs.existsSync(inputFile)) return;
        const rawContent = fs.readFileSync(inputFile, 'utf8');
        if (!rawContent || rawContent.length < 10) return;
        fs.writeFileSync(inputFile, '');

        const startRegex = /\[\[\[£\s*FILE\s*:\s*([^£\]\s]+)\s*£\]\]\]/g;
        let match;

        while ((match = startRegex.exec(rawContent)) !== null) {
            const filePath = match[1].trim();
            const startIdx = match.index + match[0].length;
            const endTag = `[[[£ END: ${filePath} £]]]`;
            const endIdx = rawContent.indexOf(endTag, startIdx);

            if (endIdx !== -1) {
                let newContent = rawContent.substring(startIdx, endIdx).trim();
                const fullPath = path.join(__dirname, filePath);
                
                if (fs.existsSync(fullPath)) {
                    const oldContent = fs.readFileSync(fullPath, 'utf8');
                    const ext = path.extname(fullPath);

                    if (['.js', '.jsx'].includes(ext)) {
                        // 1. Check Signatures
                        const oldSigs = extractSignatures(oldContent);
                        const newSigs = extractSignatures(newContent);
                        const lostSigs = [...oldSigs].filter(s => !newSigs.has(s));
                        
                        // 2. Check DOM IDs
                        const lostIds = checkDomIntegrity(oldContent, newContent);
                        
                        // 3. Check Density
                        const densityIssue = checkLogicDensity(oldContent, newContent);

                        if (lostSigs.length > 0 || lostIds || densityIssue) {
                            saveDiff(oldContent, newContent, filePath);
                            const reason = lostSigs.length > 0 ? `Fonctions perdues: ${lostSigs.join(', ')}` : 
                                           lostIds ? `Structure HTML cassée (IDs perdus: ${lostIds.join(', ')})` :
                                           `Sabotage logique (-${densityIssue.drop}%)`;
                            
                            writeStatus('JUDGING', `ALERTE STRUCTURELLE : ${path.basename(filePath)}`, reason, { filePath });
                        }
                    }
                }
                
                fs.mkdirSync(path.dirname(fullPath), { recursive: true });
                fs.writeFileSync(fullPath, newContent + '\n');
                console.log(`✅ APPLIED: ${filePath}`);
            }
        }
        if (!fs.existsSync(statusFile) || JSON.parse(fs.readFileSync(statusFile)).status === 'OK') {
            writeStatus('OK', 'Mise à jour réussie');
        }
    } catch (e) { console.error(e); }
}

setInterval(applyUpdate, 500);
