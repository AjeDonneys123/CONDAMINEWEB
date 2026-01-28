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

// --- API SYSTÈME AVANCÉE (TIME LORD + ORACLE) ---

app.get('/api/system/apply-status', (req, res) => {
    const statusFile = path.join(__dirname, '../apply_status.json');
    if (fs.existsSync(statusFile)) {
        try { res.json(JSON.parse(fs.readFileSync(statusFile, 'utf8'))); } catch (e) { res.json({ status: 'OK' }); }
    } else { res.json({ status: 'OK' }); }
});

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

// --- NOUVEAU : L'ORACLE (ANALYSE COMPARATIVE) ---
app.post('/api/system/oracle', async (req, res) => {
    const diffFile = path.join(__dirname, '../temp_diff.json');
    if (!fs.existsSync(diffFile)) return res.json({ analysis: "Pas de données de différence." });

    try {
        const { oldContent, newContent, filePath } = JSON.parse(fs.readFileSync(diffFile, 'utf8'));
        
        const prompt = `ANALYSE DE RÉGRESSION CRITIQUE sur le fichier : ${filePath}

        VERSION PRÉCÉDENTE (Fonctionnelle) :
        ${oldContent.substring(0, 5000)} ...

        NOUVELLE VERSION (Suspecte) :
        ${newContent.substring(0, 5000)} ...

        TA MISSION :
        Compare les deux versions. Identifie précisément quelle LOGIQUE MÉTIER ou FONCTIONNALITÉ a été supprimée ou altérée.
        Ne parle pas de syntaxe ("il manque une accolade"). Parle d'impact ("La sauvegarde ne se fait plus").

        RÉPONSE (1 phrase courte) :
        "⚠️ RÉGRESSION : [Explication précise de ce qui a disparu]"`;

        const explanation = await AIEngine.ask(prompt, "Tu es un Senior Lead Developer qui fait une Code Review sévère.");
        res.json({ analysis: explanation });
    } catch (e) {
        res.json({ analysis: "L'Oracle est indisponible." });
    }
});

app.post('/api/system/revert', (req, res) => {
    console.log("⏪ [GIT] Retour vers le passé demandé...");
    exec('git reset --hard HEAD', (err, stdout) => {
        if (err) return res.status(500).json({ error: "Echec Git" });
        console.log("✅ [GIT] Système restauré.");
        res.json({ ok: true, message: "Système restauré à la dernière version saine." });
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

app.get('/api/check-deploy', (req, res) => { res.json({ status: "OK", version: "V9.3_ORACLE", bootId: SERVER_BOOT_ID }); });

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
app.listen(port, '0.0.0.0', () => console.log(`🚀 SERVEUR V11.0 (Oracle) UP`));
