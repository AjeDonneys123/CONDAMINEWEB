const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { exec } = require('child_process'); // Nécessaire pour Git
const AIEngine = require('./core/ai.engine'); // Pour l'analyse de risque

if (!global.fetch) { const fetch = require('node-fetch'); global.fetch = fetch; global.Headers = fetch.Headers; global.Request = fetch.Request; global.Response = fetch.Response; }

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

app.use(express.json({ limit: '100mb' }));

// --- API SYSTÈME AVANCÉE (TIME LORD) ---

// 1. Lire le statut (HUD)
app.get('/api/system/apply-status', (req, res) => {
    const statusFile = path.join(__dirname, '../apply_status.json');
    if (fs.existsSync(statusFile)) {
        try { res.json(JSON.parse(fs.readFileSync(statusFile, 'utf8'))); } catch (e) { res.json({ status: 'OK' }); }
    } else { res.json({ status: 'OK' }); }
});

// 2. Version actuelle (Git Hash)
app.get('/api/system/version', (req, res) => {
    exec('git rev-parse --short HEAD', (err, stdout) => {
        if (err) return res.json({ hash: 'DEV-MODE' });
        res.json({ hash: stdout.trim() });
    });
});

// 3. Analyse de Risque IA
app.post('/api/system/analyze-risk', async (req, res) => {
    const { missing, filePath } = req.body;
    const prompt = `ALERTE CODE : Dans le fichier "${filePath}", les fonctions/variables suivantes ont disparu : [${missing.join(', ')}].
    Explique en UNE SEULE PHRASE courte et percutante (style avertissement militaire) quel est le risque fonctionnel pour l'application.`;
    
    try {
        const explanation = await AIEngine.ask(prompt, "Tu es un expert en sécurité de code.");
        res.json({ analysis: explanation });
    } catch (e) {
        res.json({ analysis: "Analyse IA indisponible." });
    }
});

// 4. Machine à Remonter le Temps (Revert)
app.post('/api/system/revert', (req, res) => {
    console.log("⏪ [GIT] Retour vers le passé demandé...");
    // On annule tout ce qui n'est pas commité et on revient au commit précédent si nécessaire
    // Ici on fait un hard reset sur le dernier commit VALIDE (HEAD)
    // Comme apply.js commit AVANT de toucher, HEAD est la version "saine" avant la tentative
    // Ou HEAD^ si on veut annuler le dernier commit réussi.
    
    // Stratégie : On suppose que apply.js a fait un commit "Pre-Update".
    // Si on veut annuler ce que l'utilisateur vient de faire (qui a peut être été bloqué ou appliqué partiellement)
    // On fait un reset hard sur HEAD (pour virer les changements non stagés)
    // Si on veut annuler le dernier commit enregistré, c'est HEAD^.
    
    // Pour la sécurité : On fait un hard reset à HEAD (état propre dernier commit).
    exec('git reset --hard HEAD', (err, stdout) => {
        if (err) return res.status(500).json({ error: "Echec Git" });
        console.log("✅ [GIT] Système restauré.");
        res.json({ ok: true, message: "Système restauré à la dernière version saine." });
    });
});

// ... (Le reste du fichier server.js ne change pas, juste les imports/routes au dessus)
const models = ['AcademicYear', 'Admin', 'Classroom', 'Subject', 'Teacher', 'Student', 'Enrollment', 'Chapter', 'Homework', 'Submission', 'GameLevel', 'GameProgress', 'MistakesBook', 'AccessLog', 'BugReport', 'ProjectDoc', 'Player', 'StudioProject', 'Sanction', 'ScanSession'];
models.forEach(m => { try { require(`./models/${m}`); } catch (e) { console.warn(`⚠️ Modèle manquant : ${m}`); } });

const publicPath = path.resolve(process.cwd(), 'public');
const uploadsPath = path.join(publicPath, 'uploads');
if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath, { recursive: true });
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });

app.use('/uploads', express.static(uploadsPath));
app.get('/uploads/:filename', (req, res) => { const requestedFile = req.params.filename; const cleanName = decodeURIComponent(requestedFile).split('?')[0]; const filePath = path.join(uploadsPath, cleanName); if (fs.existsSync(filePath)) return res.sendFile(filePath); res.status(404).send('Fichier introuvable.'); });

app.get('/api/check-deploy', (req, res) => { res.json({ status: "OK", version: "V9.0_TIME_LORD", bootId: SERVER_BOOT_ID }); });

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
app.listen(port, '0.0.0.0', () => console.log(`🚀 SERVEUR V9.0 UP`));
