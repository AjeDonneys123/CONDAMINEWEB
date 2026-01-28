// @signatures: applyUpdate, checkCssDependency, checkDeepClassIntegrity, extractSignatures, snapshot, writeStatus
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inputFile = 'update.txt';
const statusFile = 'apply_status.json';

console.log("------------------------------------------------");
console.log("🛡️ [SYSTEM] Moteur V9.0 (Time Lord)");
console.log("    Features : Auto-Commit + AI Risk Context + Revert");
console.log("------------------------------------------------");

function writeStatus(type, message, details = null, context = null) {
    const data = { 
        status: type, 
        message: message, 
        details: details, 
        context: context, // Pour l'IA (ex: { missing: ['func1'], filePath: '...' })
        timestamp: Date.now() 
    };
    try { fs.writeFileSync(statusFile, JSON.stringify(data, null, 2)); } catch(e) {}
}

function snapshot() {
    try {
        // Sauvegarde l'état actuel AVANT modification
        // On ignore les erreurs (ex: rien à commiter)
        execSync('git add .');
        execSync('git commit -m "Auto-Save Pre-Update"');
        console.log("💾 [GIT] Point de sauvegarde créé.");
    } catch (e) { 
        // Silencieux si rien à commiter
    }
}

// ... (Fonctions extractSignatures, checkCssDependency, checkDeepClassIntegrity identiques à V8.4)
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
        const existsInUpdate = rawUpdateContent.includes(cssFileName);
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

        // 1. SNAPSHOT DE SÉCURITÉ
        snapshot();

        fs.writeFileSync(inputFile, '');

        const isForced = rawContent.includes('[FORCE_REDUCTION]');
        let processedCount = 0;
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
                        writeStatus('OK', 'Historique mis à jour');
                        processedCount++;
                        continue;
                    } catch (e) {}
                }

                const ext = path.extname(fullPath);

                if (fs.existsSync(fullPath) && !isForced) {
                    const oldContent = fs.readFileSync(fullPath, 'utf8');
                    
                    if (['.js', '.jsx', '.ts'].includes(ext)) {
                        const oldSigs = extractSignatures(oldContent);
                        const newSigs = extractSignatures(newContent);
                        const missing = [...oldSigs].filter(s => !newSigs.has(s));
                        if (missing.length > 0) {
                            // ERREUR CRITIQUE AVEC CONTEXTE POUR L'IA
                            writeStatus('ERROR', `Régression : ${path.basename(filePath)}`, `Perdu : ${missing.join(', ')}`, { missing, filePath });
                            console.error(`❌ REGRESSION JS: ${filePath}`);
                            continue;
                        }
                    }
                    if (newContent.length < oldContent.length * 0.75) {
                        writeStatus('ERROR', `Taille suspecte : ${path.basename(filePath)}`, `-25%`, { missing: ["Contenu massif"], filePath });
                        console.error(`❌ POIDS CRITIQUE: ${filePath}`);
                        continue;
                    }
                }

                if (ext === '.jsx') {
                    const cssCheck = checkCssDependency(filePath, newContent, rawContent);
                    if (!cssCheck.ok) {
                        writeStatus('ERROR', `Style manquant`, `${cssCheck.missing} introuvable`, { missing: ["Fichier CSS associé"], filePath });
                        console.error(`❌ ORPHELIN: ${filePath}`);
                        continue;
                    }
                    if (cssCheck.cssPath) {
                        const missingClasses = checkDeepClassIntegrity(newContent, cssCheck.cssPath);
                        if (missingClasses) {
                            writeStatus('WARNING', `Style incomplet`, `Classes: ${missingClasses.join(', ')}`, { missing: missingClasses, filePath });
                        }
                    }
                }

                if (['.js', '.jsx', '.ts'].includes(ext)) {
                    const currentSigs = [...extractSignatures(newContent)].sort();
                    if (currentSigs.length > 0) newContent = `// @signatures: ${currentSigs.join(', ')}\n` + newContent.replace(/^\/\/ @signatures:.*\n/, '');
                }
                
                fs.writeFileSync(fullPath, newContent + '\n');
                console.log(`   ✅ ÉCRIT : ${filePath}`);
                processedCount++;
            }
        }

        if (processedCount > 0) {
            setTimeout(() => writeStatus('OK', 'Sync Terminée', `${processedCount} fichiers traités.`), 500);
            console.log(`✨ SUCCÈS : ${processedCount} fichiers traités.`);
        }

    } catch (e) {
        writeStatus('ERROR', 'Crash Apply.js', e.message);
        console.error("☠️ CRASH APPLY:", e.message);
    }
}

setInterval(applyUpdate, 500);
