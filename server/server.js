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
//hh
app.get('/api/system/version', (req, res) => {
    try {
        const vPath = path.join(__dirname, 'version.json');
        if (fs.existsSync(vPath)) {
            const vData = JSON.parse(fs.readFileSync(vPath, 'utf8'));
            return res.json({ hash: `v${vData.version} (b${vData.build})` });
        }
        res.json({ hash: 'DEV' });
    } catch (e) { res.json({ hash: 'UNKNOWN' }); }
});

// --- L'ORACLE V13.3 (CACHED) ---
app.post('/api/system/oracle', async (req, res) => {
    const diffFile = path.join(__dirname, '../temp_diff.json');
    const verdictFile = path.join(__dirname, '../temp_verdict.json');

    // 1. CHECK CACHE (Pour éviter le spam)
    if (fs.existsSync(verdictFile)) {
        try {
            const cached = JSON.parse(fs.readFileSync(verdictFile, 'utf8'));
            console.log("⚡ [ORACLE] Verdict servi depuis le cache.");
            return res.json(cached);
        } catch (e) {}
    }

    if (!fs.existsSync(diffFile)) return res.json({ verdict: "SAFE", reason: "Pas de diff" });

    try {
        const { oldContent, newContent, filePath } = JSON.parse(fs.readFileSync(diffFile, 'utf8'));
        
        const prompt = `AUDIT DE SÉCURITÉ CODE (Avant vs Après) sur : ${filePath}
        ANCIEN CODE (Extrait) : ${oldContent.substring(0, 4000)}
        NOUVEAU CODE (Extrait) : ${newContent.substring(0, 4000)}
        
        TA MISSION : Détermine si c'est une RÉGRESSION ou une OPTIMISATION.
        
        RÉPOND UNIQUEMENT EN JSON :
        { "verdict": "SAFE" ou "DANGER", "reason": "Explication courte." }`;

        console.log("🤔 [ORACLE] Appel IA...");
        const raw = await AIEngine.ask(prompt, "Tu es un Juge de Code.");
        
        if (raw.includes("ERREUR") || raw.includes("429")) {
            return res.json({ verdict: "DANGER", reason: "IA Saturée (Quota). Prudence." });
        }

        const result = AIEngine.sanitizeJSON(raw);
        
        // 2. SAUVEGARDE DU VERDICT
        fs.writeFileSync(verdictFile, JSON.stringify(result));
        
        res.json(result);

    } catch (e) {
        res.json({ verdict: "DANGER", reason: "Erreur technique serveur." });
    }
});

app.post('/api/system/revert', (req, res) => {
    console.log("⏪ [GIT] Retour vers le passé demandé...");
    exec('git reset --hard HEAD', (err, stdout) => {
        if (err) return res.status(500).json({ error: "Echec Git" });
        console.log("✅ [GIT] Système restauré.");
        res.json({ ok: true, message: "Système restauré." });
    });
});

const models = ['AcademicYear', 'Admin', 'Classroom', 'Subject', 'Teacher', 'Student', 'Enrollment', 'Chapter', 'Homework', 'Submission', 'GameLevel', 'GameProgress', 'MistakesBook', 'AccessLog', 'BugReport', 'ProjectDoc', 'Player', 'StudioProject', 'Sanction', 'ScanSession'];
models.forEach(m => { try { require(`./models/${m}`); } catch (e) { console.warn(`⚠️ Modèle manquant : ${m}`); } });

const publicPath = path.resolve(process.cwd(), 'public');
const uploadsPath = path.join(publicPath, 'uploads');
if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath, { recursive: true });
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

app.use('/uploads', express.static(uploadsPath));
app.get('/uploads/:filename', (req, res) => { const requestedFile = req.params.filename; const cleanName = decodeURIComponent(requestedFile).split('?')[0]; const filePath = path.join(uploadsPath, cleanName); if (fs.existsSync(filePath)) return res.sendFile(filePath); res.status(404).send('Fichier introuvable.'); });

app.get('/api/check-deploy', (req, res) => { res.json({ status: "OK", version: "V13.3_CACHED_ORACLE", bootId: SERVER_BOOT_ID }); });

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
app.listen(port, '0.0.0.0', () => console.log(`🚀 SERVEUR V13.3 (Cached) UP`));
