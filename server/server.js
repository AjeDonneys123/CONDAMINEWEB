// @signatures: SERVER_BOOT_ID
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

app.get('/api/system/version', (req, res) => {
    try {
        const vPath = path.join(__dirname, 'version.json');
        if (fs.existsSync(vPath)) {
            const vData = JSON.parse(fs.readFileSync(vPath, 'utf8'));
            return res.json({ hash: `${vData.build}` }); 
        }
        res.json({ hash: '1' });
    } catch (e) { res.json({ hash: '?' }); }
});

app.post('/api/system/oracle', async (req, res) => {
    const diffFile = path.join(__dirname, '../temp_diff.json');
    const verdictFile = path.join(__dirname, '../temp_verdict.json');
    
    // Si on a déjà un verdict SAIN en cache pour ce fichier, on le renvoie
    if (fs.existsSync(verdictFile)) {
        try {
            const cached = JSON.parse(fs.readFileSync(verdictFile, 'utf8'));
            if (cached.verdict === "SAFE") return res.json(cached);
        } catch (e) {}
    }

    if (!fs.existsSync(diffFile)) return res.json({ verdict: "SAFE", reason: "Rien à analyser" });

    try {
        const { oldContent, newContent, filePath } = JSON.parse(fs.readFileSync(diffFile, 'utf8'));
        const prompt = `FICHIER : ${filePath}\n\nANCIEN :\n${oldContent.substring(0, 2000)}\n\nNOUVEAU :\n${newContent.substring(0, 2000)}\n\nCONSIGNE :\n1. Si la logique métier est préservée -> "SAFE".\n2. Si une fonction/variable clé disparaît -> "DANGER".\n\nFORMAT JSON : {"verdict": "SAFE"|"DANGER", "reason": "court"}`;
        
        // Timeout 10s pour Gemini
        const raw = await AIEngine.ask(prompt, "Tu es un compilateur JSON.");
        const result = AIEngine.sanitizeJSON(raw);
        
        // On ne cache QUE les succès (verdict propre)
        if (result && result.verdict) {
            fs.writeFileSync(verdictFile, JSON.stringify(result));
            res.json(result);
        } else {
            throw new Error("IA malformée");
        }
    } catch (e) { 
        // En cas d'erreur IA, on renvoie une erreur 500 pour forcer le client à Retry
        console.error("❌ Oracle Error:", e.message);
        res.status(500).json({ error: "IA indisponible, réessai..." }); 
    }
});

app.post('/api/system/revert', (req, res) => { exec('git reset --hard HEAD', (err, stdout) => { res.json({ ok: true }); }); });

const models = ['AcademicYear', 'Admin', 'Classroom', 'Subject', 'Teacher', 'Student', 'Enrollment', 'Chapter', 'Homework', 'Submission', 'GameLevel', 'GameProgress', 'MistakesBook', 'AccessLog', 'BugReport', 'ProjectDoc', 'Player', 'StudioProject', 'Sanction', 'ScanSession'];
models.forEach(m => { 
    const modelPath = path.join(__dirname, 'models', `${m}.js`);
    if (fs.existsSync(modelPath)) require(modelPath);
});

const publicPath = path.resolve(process.cwd(), 'public');
const uploadsPath = path.join(publicPath, 'uploads');
if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath, { recursive: true });
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

app.use('/uploads', express.static(uploadsPath));
app.get('/uploads/:filename', (req, res) => { const requestedFile = req.params.filename; const cleanName = decodeURIComponent(requestedFile).split('?')[0]; const filePath = path.join(uploadsPath, cleanName); if (fs.existsSync(filePath)) return res.sendFile(filePath); res.status(404).send('Fichier introuvable.'); });

app.get('/api/check-deploy', (req, res) => { res.json({ status: "OK", version: "V17.2_RETRY_STORM", bootId: SERVER_BOOT_ID }); });

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
app.listen(port, '0.0.0.0', () => console.log(`🚀 SERVEUR V17.2 UP`));
