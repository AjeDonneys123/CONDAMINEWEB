// @signatures: applyUpdate, checkCssDependency, saveDiff, snapshot, writeStatus
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inputFile = 'update.txt';
const statusFile = 'apply_status.json';
const diffFile = 'temp_diff.json';

console.log("------------------------------------------------");
console.log("🛡️ [SYSTEM] Moteur V13.0 (GOD MODE)");
console.log("    Stratégie : 100% Analyse IA - Zéro Trust");
console.log("------------------------------------------------");

function writeStatus(type, message, details = null, context = null) {
    const data = { status: type, message, details, context, timestamp: Date.now() };
    try { fs.writeFileSync(statusFile, JSON.stringify(data, null, 2)); } catch(e) {}
}

function saveDiff(oldContent, newContent, filePath) {
    try { fs.writeFileSync(diffFile, JSON.stringify({ oldContent, newContent, filePath })); } catch (e) {}
}

function snapshot() {
    try { execSync('git add .'); execSync('git commit -m "Auto-Save"'); } catch (e) { }
}

// Seule vérification mécanique conservée : L'existence physique des fichiers
function checkCssDependency(jsxPath, jsxContent, rawUpdateContent) {
    const importMatch = jsxContent.match(/import\s+['"]\.\/([^'"]+\.css)['"]/);
    if (importMatch) {
        const cssFileName = importMatch[1];
        const dir = path.dirname(jsxPath);
        const cssFullPath = path.join(__dirname, dir, cssFileName);
        const existsOnDisk = fs.existsSync(cssFullPath);
        const relativeCssPath = path.join(dir, cssFileName).split(path.sep).join('/');
        const headerTag = `[[[£ FILE: ${relativeCssPath} £]]]`;
        const existsInUpdate = rawUpdateContent.includes(headerTag);
        if (!existsOnDisk && !existsInUpdate) return { ok: false, missing: cssFileName };
    }
    return { ok: true };
}

function applyUpdate() {
    try {
        if (!fs.existsSync(inputFile)) { fs.writeFileSync(inputFile, ''); return; }
        const rawContent = fs.readFileSync(inputFile, 'utf8');
        if (!rawContent || rawContent.trim().length < 10) return;

        fs.writeFileSync(inputFile, ''); // Flush
        snapshot();

        const isForced = rawContent.includes('[FORCE_REDUCTION]');
        let processedCount = 0;
        let warningTriggered = false;
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
                const dirPath = path.dirname(fullPath);
                if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

                // Exception Logs
                if (filePath === 'history.txt' || filePath === 'apply_status.json' || filePath === 'temp_diff.json') {
                    if(filePath === 'history.txt') fs.appendFileSync(fullPath, "\n" + newContent + "\n");
                    continue;
                }

                const ext = path.extname(fullPath);
                let oldContent = "";
                if (fs.existsSync(fullPath)) oldContent = fs.readFileSync(fullPath, 'utf8');

                // Si le contenu est identique, on ignore (pas de spam IA)
                if (oldContent.trim() === newContent.trim()) {
                    console.log(`   💤 Identique : ${filePath}`);
                    continue;
                }

                // CHECK 1 : CSS Physique (Le seul check local)
                if (ext === '.jsx') {
                    const cssCheck = checkCssDependency(filePath, newContent, rawContent);
                    if (!cssCheck.ok) {
                        writeStatus('ERROR', `Style manquant`, `${cssCheck.missing} introuvable`, null);
                        console.error(`❌ ORPHELIN: ${filePath}`);
                        continue; // Bloque l'écriture
                    }
                }

                // ÉCRITURE
                fs.writeFileSync(fullPath, newContent + '\n');
                console.log(`   ✅ ÉCRIT : ${filePath}`);
                processedCount++;

                // CHECK 2 : L'ORACLE (IA)
                // On envoie TOUT fichier JS/JSX/CSS modifié à l'IA
                if (['.js', '.jsx', '.css', '.html'].includes(ext)) {
                    saveDiff(oldContent, newContent, filePath);
                    writeStatus('JUDGING', `Analyse IA en cours...`, `Vérification : ${path.basename(filePath)}`, { filePath });
                    warningTriggered = true;
                }
            }
        }

        if (processedCount > 0 && !warningTriggered) {
            // Cas rare où on a écrit un fichier non surveillé (ex: .json config)
            writeStatus('OK', 'Mise à jour effectuée', `${processedCount} fichiers.`);
        }

    } catch (e) {
        writeStatus('ERROR', 'Crash Apply.js', e.message);
    }
}

setInterval(applyUpdate, 500);
