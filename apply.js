// @signatures: applyUpdate, extractSignatures, checkCssDependency, checkDeepClassIntegrity, checkDomIntegrity, checkLogicDensity, writeStatus, snapshot, saveDiff
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inputFile = 'update.txt';
const statusFile = 'apply_status.json';
const diffFile = 'temp_diff.json';

console.log("------------------------------------------------");
console.log("🛡️ [SYSTEM] Moteur V13.2 (Auto-Reset)");
console.log("    Stratégie : Nettoyage au démarrage + Oracle");
console.log("------------------------------------------------");

// 1. PURGE AU DÉMARRAGE (Le Fix Vital)
// On remet le statut à OK dès le lancement pour éviter les boucles infinies
try {
    fs.writeFileSync(statusFile, JSON.stringify({ status: "OK", message: "Système prêt.", timestamp: Date.now() }, null, 2));
    console.log("🧹 [INIT] Statut réinitialisé à OK.");
} catch(e) {}

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

function extractSignatures(content) {
    const codeBody = content.replace(/^\/\/ @signatures:.*\n/, '');
    const sigs = new Set();
    const patterns = [ /function\s+([a-zA-Z0-9_]+)/g, /const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(/g, /export\s+default\s+function\s+([a-zA-Z0-9_]+)/g, /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g, /class\s+([a-zA-Z0-9_]+)/g ];
    patterns.forEach(regex => { let match; while ((match = regex.exec(codeBody)) !== null) { sigs.add(match[2] ? `${match[1].toUpperCase()} ${match[2]}` : match[1]); } });
    return sigs;
}

function checkLogicDensity(oldContent, newContent) {
    const logicKeywords = /\b(if|else|switch|case|return|await|async|map|filter|reduce|find|create|update|delete|useEffect|useState|useRef|try|catch|throw)\b/g;
    const countLogic = (text) => { const matches = text.match(logicKeywords); return matches ? matches.length : 0; };
    const oldScore = countLogic(oldContent);
    const newScore = countLogic(newContent);
    if (oldScore > 5 && newScore < oldScore * 0.99) {
        return { oldScore, newScore, drop: Math.round((1 - newScore/oldScore)*100) };
    }
    return null;
}

function checkDomIntegrity(oldContent, newContent) {
    const getIds = (text) => { const ids = new Set(); let match; while ((match = /\sid=['"]([^'"]+)['"]/g.exec(text))) ids.add(match[1]); return ids; };
    const oldIds = getIds(oldContent);
    const newIds = getIds(newContent);
    const missing = [...oldIds].filter(id => !newIds.has(id));
    return missing.length > 0 ? missing : null;
}

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
        return { ok: true, cssPath: existsOnDisk ? cssFullPath : null };
    }
    return { ok: true, cssPath: null };
}

function checkDeepClassIntegrity(jsxContent, cssPath) {
    if (!cssPath || !fs.existsSync(cssPath)) return null;
    try {
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        const definedClasses = new Set();
        let match;
        while ((match = /\.([a-zA-Z0-9_-]+)(?=\s*[:\{,])/g.exec(cssContent)) !== null) definedClasses.add(match[1]);
        const usedClasses = new Set();
        while ((match = /className\s*=\s*['"]([^'"]+)['"]/g.exec(jsxContent)) !== null) { match[1].split(/\s+/).forEach(c => { if(c && !c.includes('{')) usedClasses.add(c); }); }
        const missing = [...usedClasses].filter(c => !definedClasses.has(c));
        if (missing.length > 0 && missing.length < 5) return missing;
    } catch (e) {}
    return null;
}

function applyUpdate() {
    try {
        if (!fs.existsSync(inputFile)) { fs.writeFileSync(inputFile, ''); return; }
        const rawContent = fs.readFileSync(inputFile, 'utf8');
        if (!rawContent || rawContent.trim().length < 10) return;

        fs.writeFileSync(inputFile, '');
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

                if (fs.existsSync(fullPath) && !isForced) {
                    const oldContent = fs.readFileSync(fullPath, 'utf8');
                    
                    if (['.js', '.jsx', '.ts'].includes(ext)) {
                        // 1. SIGNATURES
                        const oldSigs = extractSignatures(oldContent);
                        const newSigs = extractSignatures(newContent);
                        const missing = [...oldSigs].filter(s => !newSigs.has(s));
                        if (missing.length > 0) {
                            currentWarning = { title: `Régression Structure`, msg: `Perdu : ${missing.join(', ')}`, context: { missing, filePath } };
                        }

                        // 2. DENSITE LOGIQUE
                        if (!currentWarning) {
                            const logicCheck = checkLogicDensity(oldContent, newContent);
                            if (logicCheck) {
                                currentWarning = {
                                    title: `Changement de Logique`,
                                    msg: `Densité : -${logicCheck.drop}%`,
                                    context: { missing: [`Densité -${logicCheck.drop}%`], filePath }
                                };
                            }
                        }
                    }

                    // 3. DOM & CSS
                    if (ext === '.jsx' && !currentWarning) {
                        const missingIds = checkDomIntegrity(oldContent, newContent);
                        if (missingIds) {
                            currentWarning = { title: `Structure cassée`, msg: `IDs : ${missingIds.join(', ')}`, context: { missing: missingIds, filePath } };
                        }
                        const cssCheck = checkCssDependency(filePath, newContent, rawContent);
                        if (!cssCheck.ok && !currentWarning) {
                            currentWarning = { title: `Style manquant`, msg: `${cssCheck.missing} introuvable`, context: { missing: ["Fichier CSS"], filePath } };
                        }
                    }
                    
                    if (currentWarning) {
                        saveDiff(oldContent, newContent, filePath);
                        // SI C'EST SERVER.JS QUI CHANGE, ON NE MET PAS "JUDGING" CAR IL VA RESTART
                        // On met OK pour éviter le blocage, mais on garde la diff pour l'historique si besoin
                        if (filePath.includes('server.js')) {
                            console.log("⚠️ Modification Serveur détectée (Pas d'analyse Oracle pour éviter boucle).");
                            currentWarning = null; // On annule l'alerte bloquante
                        }
                    }
                }

                if (['.js', '.jsx', '.ts'].includes(ext)) {
                    const currentSigs = [...extractSignatures(newContent)].sort();
                    if (currentSigs.length > 0) newContent = `// @signatures: ${currentSigs.join(', ')}\n` + newContent.replace(/^\/\/ @signatures:.*\n/, '');
                }
                
                fs.writeFileSync(fullPath, newContent + '\n');
                console.log(`   ✅ ÉCRIT : ${filePath}`);
                
                if (currentWarning) {
                    writeStatus('JUDGING', "Analyse IA en cours...", currentWarning.msg, currentWarning.context);
                    warningTriggered = true;
                }
                processedCount++;
            }
        }

        if (processedCount > 0 && !warningTriggered) {
            setTimeout(() => writeStatus('OK', 'Code appliqué', `${processedCount} fichiers mis à jour.`), 500);
            console.log(`✨ SUCCÈS.`);
        }

    } catch (e) {
        writeStatus('ERROR', 'Crash Apply.js', e.message);
    }
}

setInterval(applyUpdate, 500);