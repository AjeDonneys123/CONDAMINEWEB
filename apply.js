// @signatures: applyUpdate, checkCssDependency, checkDeepClassIntegrity, checkDomIntegrity, checkLogicDensity, countLogic, extractSignatures, getIds, saveDiff, snapshot, writeStatus
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inputFile = 'update.txt';
const statusFile = 'apply_status.json';
const diffFile = 'temp_diff.json';
const verdictFile = 'temp_verdict.json';

console.log("------------------------------------------------");
console.log("🛡️ [SYSTEM] Moteur V16.1 (Black Box)");
console.log("    Feature : Rapport d'erreurs exhaustif");
console.log("------------------------------------------------");

function writeStatus(type, message, details = null, context = null) {
    const data = { status: type, message, details, context, timestamp: Date.now() };
    try { fs.writeFileSync(statusFile, JSON.stringify(data, null, 2)); } catch(e) {}
}

function saveDiff(oldContent, newContent, filePath) {
    try { 
        fs.writeFileSync(diffFile, JSON.stringify({ oldContent, newContent, filePath }));
        if (fs.existsSync(verdictFile)) fs.unlinkSync(verdictFile); 
    } catch (e) {}
}

function snapshot(filesCount) {
    try {
        execSync('git add .');
        execSync(`git commit -m "Auto-Save Batch (${filesCount} files)"`);
    } catch (e) { }
}

// ... (Fonctions d'analyse inchangées) ...
function extractSignatures(content) { const codeBody = content.replace(/^\/\/ @signatures:.*\n/, ''); const sigs = new Set(); const patterns = [ /function\s+([a-zA-Z0-9_]+)/g, /const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(/g, /export\s+default\s+function\s+([a-zA-Z0-9_]+)/g, /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g, /class\s+([a-zA-Z0-9_]+)/g ]; patterns.forEach(regex => { let match; while ((match = regex.exec(codeBody)) !== null) { sigs.add(match[2] ? `${match[1].toUpperCase()} ${match[2]}` : match[1]); } }); return sigs; }
function checkLogicDensity(oldContent, newContent) { const logicKeywords = /\b(if|else|switch|case|return|await|async|map|filter|reduce|find|create|update|delete|useEffect|useState|useRef|try|catch|throw)\b/g; const countLogic = (text) => { const matches = text.match(logicKeywords); return matches ? matches.length : 0; }; const oldScore = countLogic(oldContent); const newScore = countLogic(newContent); if (oldScore > 5 && newScore < oldScore * 0.95) { return { oldScore, newScore, drop: Math.round((1 - newScore/oldScore)*100) }; } return null; }
function checkDomIntegrity(oldContent, newContent) { const getIds = (text) => { const ids = new Set(); let match; while ((match = /\sid=['"]([^'"]+)['"]/g.exec(text))) ids.add(match[1]); return ids; }; const oldIds = getIds(oldContent); const newIds = getIds(newContent); const missing = [...oldIds].filter(id => !newIds.has(id)); return missing.length > 0 ? missing : null; }
function checkCssDependency(jsxPath, jsxContent, rawUpdateContent) { const importMatch = jsxContent.match(/import\s+['"]\.\/([^'"]+\.css)['"]/); if (importMatch) { const cssFileName = importMatch[1]; const dir = path.dirname(jsxPath); const cssFullPath = path.join(__dirname, dir, cssFileName); const existsOnDisk = fs.existsSync(cssFullPath); const relativeCssPath = path.join(dir, cssFileName).split(path.sep).join('/'); const headerTag = `[[[£ FILE: ${relativeCssPath} £]]]`; const existsInUpdate = rawUpdateContent.includes(headerTag); if (!existsOnDisk && !existsInUpdate) return { ok: false, missing: cssFileName }; return { ok: true, cssPath: existsOnDisk ? cssFullPath : null }; } return { ok: true, cssPath: null }; }
function checkDeepClassIntegrity(jsxContent, cssPath) { if (!cssPath || !fs.existsSync(cssPath)) return null; try { const cssContent = fs.readFileSync(cssPath, 'utf8'); const definedClasses = new Set(); let match; while ((match = /\.([a-zA-Z0-9_-]+)(?=\s*[:\{,])/g.exec(cssContent)) !== null) definedClasses.add(match[1]); const usedClasses = new Set(); while ((match = /className\s*=\s*['"]([^'"]+)['"]/g.exec(jsxContent)) !== null) { match[1].split(/\s+/).forEach(c => { if(c && !c.includes('{')) usedClasses.add(c); }); } const missing = [...usedClasses].filter(c => !definedClasses.has(c)); if (missing.length > 0 && missing.length < 5) return missing; } catch (e) {} return null; }

function applyUpdate() {
    try {
        if (!fs.existsSync(inputFile)) { fs.writeFileSync(inputFile, ''); return; }
        const rawContent = fs.readFileSync(inputFile, 'utf8');
        if (!rawContent || rawContent.trim().length < 10) return;

        fs.writeFileSync(inputFile, '');
        
        const fileTags = rawContent.match(/\[\[\[£\s*FILE\s*:/g) || [];
        if (fileTags.length > 0) snapshot(fileTags.length);

        const isForced = rawContent.includes('[FORCE_REDUCTION]');
        
        let transactionReport = {
            total: 0,
            processed: 0,
            errors: [],
            warnings: [], 
            criticalDiffSaved: false 
        };

        const startRegex = /\[\[\[£\s*FILE\s*:\s*([^£\]\s]+)\s*£\]\]\]/g;
        let match;

        while ((match = startRegex.exec(rawContent)) !== null) {
            const filePath = match[1].trim();
            const startIdx = match.index + match[0].length;
            const endTag = `[[[£ END: ${filePath} £]]]`;
            const endIdx = rawContent.indexOf(endTag, startIdx);

            if (endIdx !== -1) {
                transactionReport.total++;
                let newContent = rawContent.substring(startIdx, endIdx).trim();
                const fullPath = path.join(__dirname, filePath);
                const dirPath = path.dirname(fullPath);
                
                if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

                if (['history.txt'].includes(filePath)) {
                    if(fs.existsSync(fullPath)) fs.appendFileSync(fullPath, "\n" + newContent + "\n");
                    else fs.writeFileSync(fullPath, newContent + "\n");
                    continue;
                }

                const ext = path.extname(fullPath);
                let currentWarning = null;
                let currentSeverity = 'LOW';

                if (fs.existsSync(fullPath) && !isForced) {
                    const oldContent = fs.readFileSync(fullPath, 'utf8');
                    
                    if (['.js', '.jsx', '.ts'].includes(ext)) {
                        const oldSigs = extractSignatures(oldContent);
                        const newSigs = extractSignatures(newContent);
                        const missing = [...oldSigs].filter(s => !newSigs.has(s));
                        
                        if (missing.length > 0) {
                            currentWarning = { title: `Régression Structurelle`, msg: `Perdu : ${missing.join(', ')}`, context: { missing, filePath } };
                            currentSeverity = 'HIGH';
                        }

                        if (!currentWarning) {
                            const logicCheck = checkLogicDensity(oldContent, newContent);
                            if (logicCheck) {
                                currentWarning = { title: `Chute Logique`, msg: `Densité -${logicCheck.drop}%`, context: { missing: [`Densité -${logicCheck.drop}%`], filePath } };
                                currentSeverity = 'MEDIUM';
                            }
                        }
                    }

                    if (ext === '.jsx' && !currentWarning) {
                        const missingIds = checkDomIntegrity(oldContent, newContent);
                        if (missingIds) {
                            currentWarning = { title: `Structure DOM`, msg: `IDs perdus: ${missingIds.join(', ')}`, context: { missing: missingIds, filePath } };
                            currentSeverity = 'HIGH';
                        }
                    }
                    
                    if (currentWarning && !transactionReport.criticalDiffSaved) {
                        saveDiff(oldContent, newContent, filePath);
                        transactionReport.criticalDiffSaved = true;
                    }
                }

                if (ext === '.jsx') {
                    const cssCheck = checkCssDependency(filePath, newContent, rawContent);
                    if (!cssCheck.ok) {
                        transactionReport.errors.push({ file: filePath, msg: `CSS manquant : ${cssCheck.missing}` });
                        console.error(`❌ REJETÉ : ${filePath}`);
                        continue; 
                    }
                }

                if (['.js', '.jsx', '.ts'].includes(ext)) {
                    const currentSigs = [...extractSignatures(newContent)].sort();
                    if (currentSigs.length > 0) newContent = `// @signatures: ${currentSigs.join(', ')}\n` + newContent.replace(/^\/\/ @signatures:.*\n/, '');
                }
                
                fs.writeFileSync(fullPath, newContent + '\n');
                console.log(`   ✅ ÉCRIT : ${filePath}`);
                
                if (currentWarning) {
                    transactionReport.warnings.push({ ...currentWarning, file: filePath, severity: currentSeverity });
                }
                transactionReport.processed++;
            }
        }

        // 3. RAPPORT FINAL (V16.1 : LISTE EXHAUSTIVE)
        if (transactionReport.errors.length > 0) {
            const err = transactionReport.errors[0];
            writeStatus('ERROR', `Blocage sur ${path.basename(err.file)}`, err.msg, null);
        } 
        else if (transactionReport.warnings.length > 0) {
            const worst = transactionReport.warnings.find(w => w.severity === 'HIGH') || transactionReport.warnings[0];
            
            // CONSTRUIRE LA LISTE COMPLÈTE POUR LE PRESSE-PAPIER
            const fullLog = transactionReport.warnings.map(w => `⚠️ ${path.basename(w.file)}: ${w.title} (${w.msg})`).join('\n');
            
            // On envoie le pire à l'IA (context), mais le log complet à l'UI (details)
            writeStatus('JUDGING', `Analyse Multiple (${transactionReport.warnings.length} fichiers)`, fullLog, worst.context);
        } 
        else if (transactionReport.processed > 0) {
            writeStatus('OK', 'Mise à jour réussie', `${transactionReport.processed} fichiers traités.`);
        }

    } catch (e) {
        writeStatus('ERROR', 'Crash Apply.js', e.message);
    }
}

setInterval(applyUpdate, 500);
