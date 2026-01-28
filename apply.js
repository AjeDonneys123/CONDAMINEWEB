// @signatures: applyUpdate, extractSignatures, checkCssDependency, checkDeepClassIntegrity, writeStatus, snapshot
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inputFile = 'update.txt';
const statusFile = 'apply_status.json';

console.log("------------------------------------------------");
console.log("🛡️ [SYSTEM] Moteur V9.1 (Permissif + Snapshot)");
console.log("    Stratégie : Appliquer -> Alerter -> Revert possible");
console.log("------------------------------------------------");

function writeStatus(type, message, details = null, context = null) {
    const data = { status: type, message, details, context, timestamp: Date.now() };
    try { fs.writeFileSync(statusFile, JSON.stringify(data, null, 2)); } catch(e) {}
}

function snapshot() {
    try {
        // Sauvegarde l'état PROPRE avant de le salir
        execSync('git add .');
        execSync('git commit -m "Auto-Save Pre-Update"');
        console.log("💾 [GIT] Snapshot de sécurité créé.");
    } catch (e) { /* Rien à commiter, c'est pas grave */ }
}

function extractSignatures(content) {
    const codeBody = content.replace(/^\/\/ @signatures:.*\n/, '');
    const sigs = new Set();
    const patterns = [ /function\s+([a-zA-Z0-9_]+)/g, /const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(/g, /export\s+default\s+function\s+([a-zA-Z0-9_]+)/g, /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g, /class\s+([a-zA-Z0-9_]+)/g ];
    patterns.forEach(regex => { let match; while ((match = regex.exec(codeBody)) !== null) { sigs.add(match[2] ? `${match[1].toUpperCase()} ${match[2]}` : match[1]); } });
    return sigs;
}

function checkCssDependency(jsxPath, jsxContent, rawUpdateContent) {
    const importMatch = jsxContent.match(/import\s+['"]\.\/([^'"]+\.css)['"]/);
    if (importMatch) {
        const cssFileName = importMatch[1];
        const dir = path.dirname(jsxPath);
        const cssFullPath = path.join(__dirname, dir, cssFileName);
        const existsOnDisk = fs.existsSync(cssFullPath);
        // On vérifie le raw content pour voir si le CSS est fourni dans le même paquet
        const relativeCssPath = path.join(dir, cssFileName).split(path.sep).join('/');
        const headerTag = `[[[£ FILE: ${relativeCssPath} £]]]`;
        const existsInUpdate = rawUpdateContent.includes(headerTag);
        
        if (!existsOnDisk && !existsInUpdate) return { ok: false, missing: cssFileName };
        return { ok: true, cssPath: existsOnDisk ? cssFullPath : null };
    }
    return { ok: true, cssPath: null };
}

function applyUpdate() {
    try {
        if (!fs.existsSync(inputFile)) { fs.writeFileSync(inputFile, ''); return; }

        const rawContent = fs.readFileSync(inputFile, 'utf8');
        if (!rawContent || rawContent.trim().length < 10) return;

        // 1. FLUSH IMMÉDIAT (Débouchage)
        fs.writeFileSync(inputFile, '');

        // 2. SNAPSHOT (Filet de sécurité)
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

                if (filePath === 'history.txt') {
                    try {
                        const existingContent = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : "";
                        fs.writeFileSync(fullPath, existingContent + "\n" + newContent + '\n');
                        if(!warningTriggered) writeStatus('OK', 'Historique mis à jour');
                        processedCount++;
                        continue;
                    } catch (e) {}
                }

                const ext = path.extname(fullPath);
                let currentWarning = null;

                // --- ANALYSE DE RISQUE (SANS BLOCAGE) ---
                if (fs.existsSync(fullPath) && !isForced) {
                    const oldContent = fs.readFileSync(fullPath, 'utf8');
                    
                    if (['.js', '.jsx', '.ts'].includes(ext)) {
                        const oldSigs = extractSignatures(oldContent);
                        const newSigs = extractSignatures(newContent);
                        const missing = [...oldSigs].filter(s => !newSigs.has(s));
                        if (missing.length > 0) {
                            currentWarning = {
                                title: `Régression probable : ${path.basename(filePath)}`,
                                msg: `Fonctions perdues : ${missing.join(', ')}`,
                                context: { missing, filePath }
                            };
                            console.warn(`⚠️ RISQUE REGRESSION JS: ${filePath}`);
                        }
                    }
                }

                if (!currentWarning && ext === '.jsx') {
                    const cssCheck = checkCssDependency(filePath, newContent, rawContent);
                    if (!cssCheck.ok) {
                        currentWarning = {
                            title: `Style manquant`,
                            msg: `${cssCheck.missing} est introuvable.`,
                            context: { missing: ["Fichier CSS associé"], filePath }
                        };
                        console.warn(`⚠️ RISQUE ORPHELIN: ${filePath}`);
                    }
                }

                // --- APPLICATION DU CODE (MÊME SI DANGEREUX) ---
                if (['.js', '.jsx', '.ts'].includes(ext)) {
                    const currentSigs = [...extractSignatures(newContent)].sort();
                    if (currentSigs.length > 0) newContent = `// @signatures: ${currentSigs.join(', ')}\n` + newContent.replace(/^\/\/ @signatures:.*\n/, '');
                }
                
                fs.writeFileSync(fullPath, newContent + '\n');
                console.log(`   ✅ ÉCRIT (Avec risques potentiels) : ${filePath}`);
                
                // Si on a détecté un risque, on l'affiche dans le HUD
                if (currentWarning) {
                    writeStatus('WARNING', currentWarning.title, currentWarning.msg, currentWarning.context);
                    warningTriggered = true;
                }
                
                processedCount++;
            }
        }

        if (processedCount > 0 && !warningTriggered) {
            setTimeout(() => writeStatus('OK', 'Code appliqué', `${processedCount} fichiers mis à jour.`), 500);
            console.log(`✨ SUCCÈS : ${processedCount} fichiers traités.`);
        }

    } catch (e) {
        writeStatus('ERROR', 'Crash Apply.js', e.message);
        console.error("☠️ CRASH APPLY:", e.message);
    }
}

setInterval(applyUpdate, 500);