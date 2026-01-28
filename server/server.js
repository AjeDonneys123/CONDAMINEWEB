const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { exec } = require('child_process');
const AIEngine = require('./core/ai.engine');

if (!global.fetch) { const fetch = require('node-fetch'); global.fetch = fetch; global.Headers = fetch.Headers; global.Request = fetch.Request; global.Response = fetch.Response; }

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

app.use(express.json({ limit: '100mb' }));

app.get('/api/system/apply-status', (req, res) => {
    const statusFile = path.join(__dirname, '../apply_status.json');
    if (fs.existsSync(statusFile)) {
        try { res.json(JSON.parse(fs.readFileSync(statusFile, 'utf8'))); } catch (e) { res.json({ status: 'OK' }); }
    } else { res.json({ status: 'OK' }); }
});

// VERSION SIMPLIFIÉE (Entier) - Lit le numéro de build
app.get('/api/system/version', (req, res) => {
    try {
        const vPath = path.join(__dirname, 'version.json');
        if (fs.existsSync(vPath)) {
            const vData = JSON.parse(fs.readFileSync(vPath, 'utf8'));
            // Renvoie le numéro de build incrémenté par git-auto.js
            return res.json({ hash: `${vData.build}` }); 
        }
        res.json({ hash: '1' });
    } catch (e) { res.json({ hash: '?' }); }
});

// L'ORACLE MUET
app.post('/api/system/oracle', async (req, res) => {
    const diffFile = path.join(__dirname, '../temp_diff.json');
    const verdictFile = path.join(__dirname, '../temp_verdict.json');

    // Cache
    if (fs.existsSync(verdictFile)) { try { return res.json(JSON.parse(fs.readFileSync(verdictFile, 'utf8'))); } catch (e) {} }
    if (!fs.existsSync(diffFile)) return res.json({ verdict: "SAFE", reason: "Rien à analyser" });

    try {
        const { oldContent, newContent, filePath } = JSON.parse(fs.readFileSync(diffFile, 'utf8'));
        
        const prompt = `FICHIER MODIFIÉ : ${filePath}
        
        ANCIEN :
        ${oldContent.substring(0, 3000)}

        NOUVEAU :
        ${newContent.substring(0, 3000)}

        CONSIGNE STRICTE :
        1. Compare les versions.
        2. Si la logique métier est préservée (même si refactorisée) -> "SAFE".
        3. Si une fonction ou une variable utilisée est supprimée/vidée -> "DANGER".

        FORMAT DE RÉPONSE UNIQUE (JSON RAW) :
        {"verdict": "SAFE"|"DANGER", "reason": "Phrase très courte (max 10 mots)"}`;

        const raw = await AIEngine.ask(prompt, "Tu es un compilateur JSON strict. Interdiction de parler. Uniquement du JSON.");
        const result = AIEngine.sanitizeJSON(raw);
        
        fs.writeFileSync(verdictFile, JSON.stringify(result));
        res.json(result);
    } catch (e) { 
        res.json({ verdict: "DANGER", reason: "Erreur Analyse" }); 
    }
});

app.post('/api/system/revert', (req, res) => { exec('git reset --hard HEAD', (err, stdout) => { res.json({ ok: true }); }); });

const models = ['AcademicYear', 'Admin', 'Classroom', 'Subject', 'Teacher', 'Student', 'Enrollment', 'Chapter', 'Homework', 'Submission', 'GameLevel', 'GameProgress', 'MistakesBook', 'AccessLog', 'BugReport', 'ProjectDoc', 'Player', 'StudioProject', 'Sanction', 'ScanSession'];
models.forEach(m => { try { require(`./models/${m}`); } catch (e) { console.warn(`⚠️ Modèle manquant : ${m}`); } });

const publicPath = path.resolve(process.cwd(), 'public');
const uploadsPath = path.join(publicPath, 'uploads');
if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath, { recursive: true });
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

app.use('/uploads', express.static(uploadsPath));
app.get('/uploads/:filename', (req, res) => { const requestedFile = req.params.filename; const cleanName = decodeURIComponent(requestedFile).split('?')[0]; const filePath = path.join(uploadsPath, cleanName); if (fs.existsSync(filePath)) return res.sendFile(filePath); res.status(404).send('Fichier introuvable.'); });

app.get('/api/check-deploy', (req, res) => { res.json({ status: "OK", version: "V15.0_SILENT_MODE", bootId: SERVER_BOOT_ID }); });

app.use('/api/auth', require('./domains/auth/auth.routes'));
app.use('/api/admin', require('./domains/admin/admin.routes'));
app.use('/api/structure', require('./domains/structure/structure.routes'));
app.use('/api/games', require('./domains/games/games.routes'));
app.use('/api/homework', require('./domains/homework/homework.routes')); 
app.use('/api/studio', require('./domains/studio/studio.routes'));
app.use('/api/classroom', require('./domains/classroom/classroom.routes'));
app.use('/api/scans', require('./domains/scans/scans.routes'));

app.use((err, req, res, next) => { console.error("🔥 SERVER ERROR:", err.message); res.status(500).json({ error: err.message }); });

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ BDD CONNECTÉE'));

const distPath = path.resolve(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) { app.use(express.static(distPath)); app.get('*', (req, res) => { if (req.url.startsWith('/uploads/')) return res.status(404).send("Not found"); res.sendFile(path.join(distPath, 'index.html')); }); }
app.listen(port, '0.0.0.0', () => console.log(`🚀 SERVEUR V15.0 (Silent Mode) UP`));
