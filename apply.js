// @signatures: applyUpdate, checkCssDependency, checkDeepClassIntegrity, checkDomIntegrity, checkLogicDensity, countLogic, extractSignatures, getIds, snapshot, writeStatus
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inputFile = 'update.txt';
const statusFile = 'apply_status.json';

console.log("------------------------------------------------");
console.log("🛡️ [SYSTEM] Moteur V10.2 (High Sensitivity)");
console.log("    Seuil Densité : Alerte dès -10% de logique");
console.log("------------------------------------------------");

function writeStatus(type, message, details = null, context = null) {
    const data = { status: type, message, details, context, timestamp: Date.now() };
    try { fs.writeFileSync(statusFile, JSON.stringify(data, null, 2)); } catch(e) {}
}

function snapshot() {
    try {
        execSync('git add .');
        execSync('git commit -m "Auto-Save Pre-Update"');
    } catch (e) { }
}

function extractSignatures(content) {
    const codeBody = content.replace(/^\/\/ @signatures:.*\n/, '');
    const sigs = new Set();
    const patterns = [ /function\s+([a-zA-Z0-9_]+)/g, /const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(/g, /export\s+default\s+function\s+([a-zA-Z0-9_]+)/g, /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g, /class\s+([a-zA-Z0-9_]+)/g ];
    patterns.forEach(regex => { let match; while ((match = regex.exec(codeBody)) !== null) { sigs.add(match[2] ? `${match[1].toUpperCase()} ${match[2]}` : match[1]); } });
    return sigs;
}

function checkLogicDensity(oldContent, newContent) {
    // Liste enrichie de mots-clés logiques
    const logicKeywords = /\b(if|else|switch|case|return|await|async|map|filter|reduce|find|create|update|delete|useEffect|useState|useRef|try|catch|throw)\b/g;
    
    const countLogic = (text) => {
        const matches = text.match(logicKeywords);
        return matches ? matches.length : 0;
    };

    const oldScore = countLogic(oldContent);
    const newScore = countLogic(newContent);

    // MODIFICATION V10.2 : Seuil à 0.90 (10% de perte suffit pour alerter)
    if (oldScore > 5 && newScore < oldScore * 0.90) {
        return { oldScore, newScore, drop: Math.round((1 - newScore/oldScore)*100) };
    }
    return null;
}

function checkDomIntegrity(oldContent, newContent) {
    const getIds = (text) => {
        const ids = new Set();
        const regex = /\sid=['"]([^'"]+)['"]/g;
        let match;
        while ((match = regex.exec(text))) ids.add(match[1]);
        return ids;
    };
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
                            currentWarning = { title: `Régression Structure : ${path.basename(filePath)}`, msg: `Perdu : ${missing.join(', ')}`, context: { missing, filePath } };
                        }

                        // 2. DENSITE LOGIQUE (Seuil 10%)
                        if (!currentWarning) {
                            const logicCheck = checkLogicDensity(oldContent, newContent);
                            if (logicCheck) {
                                currentWarning = {
                                    title: `Chute de Logique : ${path.basename(filePath)}`,
                                    msg: `Densité : -${logicCheck.drop}% (Seuil 10% dépassé)`,
                                    context: { missing: [`Perte de densité logique de ${logicCheck.drop}% (ex: try, await, if supprimés)`], filePath }
                                };
                                console.warn(`⚠️ RISQUE LOGIQUE: ${filePath} (-${logicCheck.drop}%)`);
                            }
                        }
                    }

                    // 3. DOM
                    if (ext === '.jsx' && !currentWarning) {
                        const missingIds = checkDomIntegrity(oldContent, newContent);
                        if (missingIds) {
                            currentWarning = { title: `Structure cassée : ${path.basename(filePath)}`, msg: `IDs disparus : ${missingIds.join(', ')}`, context: { missing: missingIds.map(id => `ID HTML #${id}`), filePath } };
                        }
                    }
                }

                // 4. CSS
                if (ext === '.jsx' && !currentWarning) {
                    const cssCheck = checkCssDependency(filePath, newContent, rawContent);
                    if (!cssCheck.ok) {
                        currentWarning = { title: `Style manquant`, msg: `${cssCheck.missing} introuvable`, context: { missing: ["Fichier CSS associé"], filePath } };
                    }
                    if (!currentWarning && cssCheck.cssPath) {
                        const missingClasses = checkDeepClassIntegrity(newContent, cssCheck.cssPath);
                        if (missingClasses) {
                            currentWarning = { title: `Style incomplet`, msg: `Classes: ${missingClasses.join(', ')}`, context: { missing: missingClasses, filePath } };
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
